# hybrid_fraud_api.py

import os
import logging
import time
import asyncio
from typing import Optional, List, Tuple
from fastapi import FastAPI, HTTPException, Depends, Header, Query, status
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, ValidationError
from pymongo import MongoClient
import pandas as pd
import numpy as np
import joblib
import jwt
from jwt import PyJWTError
from prometheus_client import Gauge, Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

# ----------------------
# Logging Setup
# ----------------------
logger = logging.getLogger("hybrid_fraud_api")
logger.setLevel(logging.INFO)
ch = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
ch.setFormatter(formatter)
logger.addHandler(ch)

# ----------------------
# Config / Secrets
# ----------------------
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://traoyaya09:vcqgF9ub9r57oq0m@cluster0.lbqbl2z.mongodb.net/futurist_e-commerce")
JWT_SECRET = os.getenv("JWT_SECRET", "internal_secret")
JWT_ALGORITHM = "HS256"

# Batch queue config
MAX_BATCH_SIZE = 512
MAX_QUEUE_SIZE = 10000
BATCH_WAIT_TIME = 0.01  # 10ms
QUEUE_PUT_TIMEOUT = 0.005  # 5ms
DEFAULT_THRESHOLD = 0.5

# ----------------------
# FastAPI App
# ----------------------
app = FastAPI(title="Hybrid Fraud Detection API", version="2.0")

# ----------------------
# Load Models / Encoders / Scaler
# ----------------------
logger.info("Loading models and encoders...")
xgb_model = joblib.load("xgb_fraud_model.pkl")
iso_model = joblib.load("isolation_forest.pkl")
scaler = joblib.load("scaler.pkl")
le_nameOrig = joblib.load("labelencoder_nameOrig.pkl")
le_nameDest = joblib.load("labelencoder_nameDest.pkl")
onehot = joblib.load("onehot_type.pkl")
iso_contamination = joblib.load("iso_contamination.pkl")  # contamination from training
logger.info(f"Models loaded successfully. IF contamination={iso_contamination:.4f}")

# ----------------------
# MongoDB Connection
# ----------------------
client = MongoClient(MONGO_URI)
db = client["futurist_e-commerce"]
collection = db["LedgerTransaction"]

# ----------------------
# Prometheus Metrics
# ----------------------
fraud_api_queue_length = Gauge("fraud_api_queue_length", "Current async queue length")
fraud_api_batch_size = Histogram("fraud_api_batch_size", "Number of transactions per batch",
                                 buckets=(1, 2, 4, 8, 16, 32, 64, 128, 256, 512))
fraud_api_request_latency_seconds = Histogram("fraud_api_request_latency_seconds", "Request latency in seconds")
fraud_api_requests_total = Counter("fraud_api_requests_total", "Total number of requests")
fraud_api_errors_total = Counter("fraud_api_errors_total", "Total number of errors")

# ----------------------
# Pydantic Models
# ----------------------
class TransactionInput(BaseModel):
    _id: Optional[str] = None
    raw_transaction: Optional[dict] = None
    threshold: Optional[float] = None
    if_contamination: Optional[float] = None  # NEW

class BatchPayload(BaseModel):
    transactions: List[TransactionInput]

# ----------------------
# JWT Auth Dependency
# ----------------------
def get_current_user(authorization: str = Header(...)):
    try:
        token = authorization.split(" ")[1]
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (IndexError, PyJWTError):
        raise HTTPException(status_code=401, detail="Invalid authentication token")

# ----------------------
# Helper Functions
# ----------------------
def safe_transform(le, series: pd.Series):
    classes = set(le.classes_)
    return [le.transform([val])[0] if val in classes else -1 for val in series.astype(str)]

def prepare_features(data: pd.DataFrame) -> pd.DataFrame:
    data["deltaOrg"] = data["oldbalanceOrg"] - data["newbalanceOrig"]
    data["deltaDest"] = data["newbalanceDest"] - data["oldbalanceDest"]

    # One-hot type
    type_encoded = onehot.transform(data[["type"]].fillna("UNKNOWN"))
    type_encoded_df = pd.DataFrame(type_encoded, columns=onehot.get_feature_names_out(["type"]))

    # Label encoding
    data["nameOrig_encoded"] = safe_transform(le_nameOrig, data["nameOrig"])
    data["nameDest_encoded"] = safe_transform(le_nameDest, data["nameDest"])

    # Combine features
    X = pd.concat([data[["step", "amount", "oldbalanceOrg", "newbalanceOrig",
                         "oldbalanceDest", "newbalanceDest", "deltaOrg", "deltaDest",
                         "nameOrig_encoded", "nameDest_encoded"]],
                   type_encoded_df], axis=1)
    return X

def predict(df: pd.DataFrame, if_contamination: Optional[float] = None) -> pd.DataFrame:
    X_scaled = scaler.transform(prepare_features(df))

    # XGBoost predictions
    df["xgb_proba"] = xgb_model.predict_proba(X_scaled)[:, 1]
    df["xgb_pred"] = (df["xgb_proba"] > 0.5).astype(int)

    # Isolation Forest predictions
    iso_scores = iso_model.decision_function(X_scaled)
    contamination = if_contamination if if_contamination is not None else iso_contamination
    threshold = np.percentile(iso_scores, 100 * contamination)
    df["iso_pred"] = (iso_scores < threshold).astype(int)  # 1 = outlier/fraud

    # Combined fraud score
    df["fraud_score"] = (df["xgb_proba"] * 0.7) + (df["iso_pred"] * 0.3)
    df["fraud_pred"] = (df["fraud_score"] > 0.5).astype(int)

    return df

# ----------------------
# Async batch queue
# ----------------------
BATCH_QUEUE: asyncio.Queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)

async def batch_worker():
    loop = asyncio.get_event_loop()
    while True:
        item = await BATCH_QUEUE.get()
        batch: List[Tuple[dict, asyncio.Future]] = [item]

        # Accumulate more items quickly
        try:
            while len(batch) < MAX_BATCH_SIZE:
                next_item = await asyncio.wait_for(BATCH_QUEUE.get(), timeout=BATCH_WAIT_TIME)
                batch.append(next_item)
        except asyncio.TimeoutError:
            pass

        fraud_api_queue_length.set(BATCH_QUEUE.qsize())
        fraud_api_batch_size.observe(len(batch))

        trans_objs, futures = [], []
        for payload_dict, fut in batch:
            try:
                trans_objs.append(payload_dict)
                futures.append(fut)
            except ValidationError as e:
                if not fut.done():
                    fut.set_exception(HTTPException(status_code=422, detail=str(e)))
                    fraud_api_errors_total.inc()

        if not trans_objs:
            continue

        df = pd.DataFrame(trans_objs)
        start_time = time.time()
        try:
            # Check if individual contamination provided
            if_contamination_list = [tx.get("if_contamination") for tx in trans_objs]
            if all(v is None for v in if_contamination_list):
                df = predict(df)
            else:
                # process individually
                results = []
                for row, cont in zip(df.to_dict(orient="records"), if_contamination_list):
                    df_row = predict(pd.DataFrame([row]), if_contamination=cont)
                    results.append(df_row.iloc[0].to_dict())
                df = pd.DataFrame(results)

            duration = time.time() - start_time
            fraud_api_request_latency_seconds.observe(duration)
        except Exception:
            fraud_api_errors_total.inc()
            for fut in futures:
                if not fut.done():
                    fut.set_exception(HTTPException(status_code=500, detail="Processing failed"))
            continue

        for fut, row in zip(futures, df.to_dict(orient="records")):
            if not fut.done():
                fut.set_result(row)

@app.on_event("startup")
async def start_worker():
    asyncio.create_task(batch_worker())

# ----------------------
# Single / Batch Prediction Endpoint
# ----------------------
@app.post("/fraud/predict")
async def fraud_predict(
    transaction_input: TransactionInput = None,
    batch_payload: BatchPayload = None,
    ids: Optional[List[str]] = Query(None),  # support ?ids[]=id1&ids[]=id2
    user=Depends(get_current_user)
):
    fraud_api_requests_total.inc()

    # ----------------------------
    # 1️⃣ Single _id lookup
    # ----------------------------
    if transaction_input and transaction_input._id:
        data_doc = collection.find_one({"_id": transaction_input._id})
        if not data_doc:
            raise HTTPException(status_code=404, detail="Transaction not found")

        df = pd.DataFrame([data_doc])
        df = predict(df, if_contamination=transaction_input.if_contamination)

        threshold = transaction_input.threshold or DEFAULT_THRESHOLD
        df["fraud_pred"] = (df["fraud_score"] > threshold).astype(int)

        update_fields = df.iloc[0][["xgb_proba","xgb_pred","iso_pred","fraud_score","fraud_pred"]].to_dict()
        collection.update_one({"_id": transaction_input._id}, {"$set": update_fields})

        logger.info(f"Predictions added for transaction _id={transaction_input._id}")
        return JSONResponse(content=df.to_dict(orient="records")[0])

    # ----------------------------
    # 2️⃣ Batch _ids lookup
    # ----------------------------
    if ids:
        docs = list(collection.find({"_id": {"$in": ids}}))
        if not docs:
            raise HTTPException(status_code=404, detail="Transactions not found")

        df = pd.DataFrame(docs)
        df = predict(df)
        df["fraud_pred"] = df["fraud_score"].apply(lambda x: int(x > DEFAULT_THRESHOLD))

        results = {doc["_id"]: row for doc, row in zip(docs, df.to_dict(orient="records"))}

        for doc_id, row in results.items():
            update_fields = {k: row[k] for k in ["xgb_proba","xgb_pred","iso_pred","fraud_score","fraud_pred"]}
            collection.update_one({"_id": doc_id}, {"$set": update_fields})

        return results

    # ----------------------------
    # 3️⃣ Raw single transaction
    # ----------------------------
    if transaction_input and transaction_input.raw_transaction:
        if BATCH_QUEUE.full():
            fraud_api_errors_total.inc()
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                detail="Service busy. Try again later.")

        fut = asyncio.get_running_loop().create_future()
        await asyncio.wait_for(BATCH_QUEUE.put((transaction_input.raw_transaction, fut)), timeout=QUEUE_PUT_TIMEOUT)
        fraud_api_queue_length.set(BATCH_QUEUE.qsize())

        try:
            result = await fut
            threshold = transaction_input.threshold or DEFAULT_THRESHOLD
            result["fraud_pred"] = int(result["fraud_score"] > threshold)
            return result
        except Exception as e:
            fraud_api_errors_total.inc()
            raise HTTPException(status_code=500, detail=str(e))

    # ----------------------------
    # 4️⃣ Batch raw transactions
    # ----------------------------
    if batch_payload:
        futs = []
        for tx in batch_payload.transactions:
            fut = asyncio.get_running_loop().create_future()
            payload = tx.raw_transaction if tx.raw_transaction else {}
            payload["if_contamination"] = tx.if_contamination  # attach per-row IF contamination
            await BATCH_QUEUE.put((payload, fut))
            futs.append((fut, tx.threshold))

        raw_results = await asyncio.gather(*[fut for fut, _ in futs], return_exceptions=True)
        results = []
        for (res, (_, thresh)) in zip(raw_results, futs):
            if isinstance(res, Exception):
                results.append({"error": str(res)})
            else:
                threshold = thresh or DEFAULT_THRESHOLD
                res["fraud_pred"] = int(res["fraud_score"] > threshold)
                results.append(res)
        return results

    # ----------------------------
    # 5️⃣ No valid input
    # ----------------------------
    raise HTTPException(status_code=400, detail="Provide either _id, _ids, raw_transaction, or batch transactions")

# ----------------------
# Prometheus metrics endpoint
# ----------------------
@app.get("/metrics")
async def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)

# ----------------------
# Health & Readiness
# ----------------------
@app.get("/health")
async def health():
    return {"status": "ok", "message": "Hybrid Fraud API running"}

@app.get("/ready")
async def ready():
    ok = all([xgb_model, iso_model, scaler, le_nameOrig, le_nameDest, onehot])
    return {"ready": ok}
