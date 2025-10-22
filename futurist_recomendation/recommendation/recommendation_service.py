
import os
import logging
import asyncio
import time
import csv
from datetime import datetime
from typing import Optional, List

import numpy as np
import torch
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from sentence_transformers import SentenceTransformer
from PIL import Image
import clip
import joblib
import base64
import io
import requests
import spacy

from embedding_loader import load_and_merge_embeddings

# -----------------------------
# Logging Setup
# -----------------------------
logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("RecommendationService")

# -----------------------------
# CSV Logger Setup
# -----------------------------
CSV_FILE = "performance_metrics.csv"
CSV_LOCK = asyncio.Lock()

async def log_performance(endpoint: str, user_id: str, success: int, fail: int, min_ms: int, max_ms: int, avg_ms: float, total_requests: int):
    async with CSV_LOCK:
        file_exists = os.path.isfile(CSV_FILE)
        with open(CSV_FILE, "a", newline="") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["timestamp", "endpoint", "userId", "success", "fail", "min_ms", "max_ms", "avg_ms", "total_requests"])
            writer.writerow([datetime.utcnow().isoformat(), endpoint, user_id, success, fail, min_ms, max_ms, round(avg_ms,2), total_requests])

# -----------------------------
# MongoDB Setup
# -----------------------------
MONGO_URI = "mongodb+srv://traoyaya09:vcqgF9ub9r57oq0m@cluster0.lbqbl2z.mongodb.net/futurist_e-commerce"
DB_NAME = "futurist_e-commerce"
use_fallback = False
products_col = logs_col = interactions_col = None

for attempt in range(5):
    try:
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=30000, connectTimeoutMS=30000)
        db = client[DB_NAME]
        products_col = db.get_collection("products")
        logs_col = db.get_collection("recommendation_logs")
        interactions_col = db.get_collection("interaction_logs")
        client.admin.command("ping")
        logger.info("Connected to MongoDB successfully.")
        break
    except ServerSelectionTimeoutError as e:
        logger.warning(f"MongoDB connection attempt {attempt+1} failed: {e}")
        time.sleep(5)
else:
    logger.error("MongoDB unavailable. Using fallback catalog.")
    use_fallback = True

# -----------------------------
# Fallback catalog
# -----------------------------
FALLBACK_PRODUCTS = [
    {"_id": "f1", "name": "Fallback Sneaker", "description": "Default sneaker", "price": 100, "discountPrice": 80,
     "category": "shoes", "subCategory": "sneakers", "brand": "FallbackBrand", "stock": 10,
     "imageUrl": "https://via.placeholder.com/150", "rating": 4.2, "reviewsCount": 10, "reviews": [],
     "isFeatured": False, "promotion": None, "createdAt": str(datetime.utcnow())},
    {"_id": "f2", "name": "Fallback Jacket", "description": "Default jacket", "price": 200, "discountPrice": 150,
     "category": "clothing", "subCategory": "jackets", "brand": "FallbackBrand", "stock": 5,
     "imageUrl": "https://via.placeholder.com/150", "rating": 4.0, "reviewsCount": 3, "reviews": [],
     "isFeatured": False, "promotion": None, "createdAt": str(datetime.utcnow())},
]

# -----------------------------
# Load Hybrid Model
# -----------------------------
try:
    hybrid_model = joblib.load("models/collaborative_model.pkl")
    logger.info("Hybrid collaborative model loaded.")
except Exception as e:
    logger.warning(f"Hybrid model not loaded: {e}")
    hybrid_model = {}

# -----------------------------
# Load Embeddings
# -----------------------------
text_embeddings = load_and_merge_embeddings("text_embeddings")
image_embeddings = load_and_merge_embeddings("image_embeddings")

# -----------------------------
# Models for encoding queries
# -----------------------------
text_model = SentenceTransformer("all-MiniLM-L6-v2")
device = "cuda" if torch.cuda.is_available() else "cpu"
clip_model, preprocess = clip.load("ViT-B/32", device=device)
nlp = spacy.load("en_core_web_sm")
DEFAULT_NORMALIZE = os.getenv("NORMALIZE_SCORES", "true").lower() == "true"

# -----------------------------
# Pydantic Models
# -----------------------------
class RecommendationRequest(BaseModel):
    userId: Optional[str] = None
    query: Optional[str] = None
    image: Optional[str] = None
    limit: int = 20
    page: int = 1
    normalize: Optional[bool] = None
    debug: Optional[bool] = False

class BatchRecommendationRequest(BaseModel):
    requests: List[RecommendationRequest]

class InteractionRequest(BaseModel):
    userId: str
    productId: str
    action: str
    timestamp: Optional[str] = None

# -----------------------------
# FastAPI App
# -----------------------------
app = FastAPI(title="Hybrid Product Recommendation Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Helper functions
# -----------------------------
def normalize_product(raw):
    return {
        "_id": str(raw["_id"]),
        "name": raw.get("name","Unnamed Product"),
        "description": raw.get("description","No description"),
        "price": raw.get("price"),
        "discountPrice": raw.get("discountPrice"),
        "category": raw.get("category","Uncategorized"),
        "subCategory": raw.get("subCategory",""),
        "brand": raw.get("brand",""),
        "stock": raw.get("stock",0),
        "imageUrl": raw.get("imageUrl") or raw.get("image") or "https://via.placeholder.com/150",
        "rating": raw.get("rating",0),
        "reviewsCount": raw.get("reviewsCount",0),
        "reviews": raw.get("reviews",[]),
        "isFeatured": raw.get("isFeatured",False),
        "promotion": raw.get("promotion"),
        "createdAt": raw.get("createdAt")
    }

def cosine_similarity_matrix(query_vecs: np.ndarray, product_vecs: np.ndarray):
    query_vecs = np.atleast_2d(query_vecs)
    product_vecs = np.array(product_vecs)
    query_norms = np.linalg.norm(query_vecs, axis=1, keepdims=True) + 1e-8
    prod_norms = np.linalg.norm(product_vecs, axis=1, keepdims=True) + 1e-8
    sim = (query_vecs @ product_vecs.T) / (query_norms @ prod_norms.T)
    return sim.squeeze()

def get_text_embedding(query: str):
    return text_model.encode([query])[0]

def get_image_embedding(image_str: str):
    try:
        if image_str.startswith("http"):
            image = Image.open(requests.get(image_str, stream=True, timeout=10).raw)
        else:
            image_bytes = base64.b64decode(image_str.split(",")[-1])
            image = Image.open(io.BytesIO(image_bytes))
        image = preprocess(image).unsqueeze(0).to(device)
        with torch.no_grad():
            emb = clip_model.encode_image(image)
        return emb.cpu().numpy()[0]
    except Exception as e:
        logger.warning(f"Image embedding failed: {e}")
        return np.zeros(512)

def preprocess_query(query: str) -> str:
    doc = nlp(query.lower())
    keywords = [token.text for token in doc if token.pos_ in ["NOUN","ADJ"]]
    return " ".join(keywords) if keywords else query

def compute_field_boost(product, query: str) -> float:
    boost = 0.0
    q_words = query.lower().split()
    if any(w in product.get("name","").lower() for w in q_words): boost += 0.3
    if any(w in product.get("category","").lower() for w in q_words): boost += 0.2
    if any(w in product.get("subCategory","").lower() for w in q_words): boost += 0.2
    if any(w in product.get("brand","").lower() for w in q_words): boost += 0.1
    return boost

def fetch_products(skip:int, limit:int, query:Optional[str]=None):
    if use_fallback: return FALLBACK_PRODUCTS[skip:skip+limit]
    filter_query = {"stock":{"$gt":0}}
    if query: filter_query["$text"] = {"$search":query}
    return list(products_col.find(filter_query).skip(skip).limit(limit))

def combine_scores_vectorized(hybrid_scores, text_sims, image_sims, interaction_boost, field_boosts, weights=None):
    if weights is None:
        weights={"hybrid":0.5,"text":0.2,"image":0.2,"interaction":0.05,"field":0.05}
    total = sum(weights.values())
    weights = {k:v/total for k,v in weights.items()}
    return (weights["hybrid"]*hybrid_scores +
            weights["text"]*text_sims +
            weights["image"]*image_sims +
            weights["interaction"]*interaction_boost +
            weights["field"]*field_boosts)

# -----------------------------
# Async Single Recommendation
# -----------------------------
@app.post("/recommendations")
async def get_recommendations(req: RecommendationRequest, normalize: Optional[bool] = Query(None)):
    if normalize is not None: req.normalize = normalize
    start_time = time.perf_counter()
    try:
        batch_result = await asyncio.to_thread(get_batch_recommendations, BatchRecommendationRequest(requests=[req]))
        result = batch_result["data"][0]
        success, fail = 1, 0
    except Exception:
        result = []
        success, fail = 0, 1
    duration_ms = (time.perf_counter() - start_time) * 1000
    await log_performance("recommendations", req.userId or "anon", success, fail, duration_ms, duration_ms, duration_ms, 1)
    return result

# -----------------------------
# Async Batch Recommendation
# -----------------------------
@app.post("/batch_recommendations")
def get_batch_recommendations(batch_req: BatchRecommendationRequest):
    all_responses = []
    for req in batch_req.requests:
        skip = max((req.page-1)*req.limit,0)
        products = fetch_products(skip, req.limit, req.query)
        if not products:
            all_responses.append([])
            continue
        product_ids = [str(p["_id"]) for p in products]
        processed_query = preprocess_query(req.query) if req.query else ""
        n_products = len(products)
        text_sims = np.zeros(n_products)
        image_sims = np.zeros(n_products)
        if processed_query:
            query_text_vec = get_text_embedding(processed_query)
            product_text_vecs = np.array([text_embeddings.get(pid,np.zeros(384)) for pid in product_ids])
            text_sims = cosine_similarity_matrix(query_text_vec, product_text_vecs).flatten() if product_text_vecs.size else np.zeros(n_products)
        if req.image:
            query_img_vec = get_image_embedding(req.image)
            product_img_vecs = np.array([image_embeddings.get(pid,np.zeros(512)) for pid in product_ids])
            image_sims = cosine_similarity_matrix(query_img_vec, product_img_vecs).flatten() if product_img_vecs.size else np.zeros(n_products)
        field_boosts = np.array([compute_field_boost(p,processed_query) for p in products])
        hybrid_scores = np.array([hybrid_model.get(str(req.userId),{}).get(pid,0.5) if req.userId else 0.5 for pid in product_ids])
        combined_scores = combine_scores_vectorized(hybrid_scores,text_sims,image_sims,np.zeros(n_products),field_boosts)
        do_normalize = req.normalize if req.normalize is not None else DEFAULT_NORMALIZE
        if do_normalize:
            min_s,max_s = combined_scores.min(),combined_scores.max()
            combined_scores = ((combined_scores - min_s)/(max_s-min_s) if max_s>min_s else np.ones_like(combined_scores))
        final_response = [{"product":normalize_product(p),"score":float(combined_scores[idx])} for idx,p in enumerate(products)]
        all_responses.append(final_response)
    return {"status":"success","data":all_responses}

# -----------------------------
# Async Interaction Logging
# -----------------------------
@app.post("/interactions")
async def save_interaction(req: InteractionRequest):
    start_time = time.perf_counter()
    try:
        if not use_fallback and interactions_col:
            interactions_col.insert_one({
                "userId": req.userId,
                "productId": req.productId,
                "action": req.action,
                "timestamp": req.timestamp or datetime.utcnow()
            })
        success, fail = 1,0
        res = {"status":"success"}
    except Exception:
        success, fail = 0,1
        res = {"status":"fail"}
    duration_ms = (time.perf_counter() - start_time) * 1000
    await log_performance("interactions", req.userId, success, fail, duration_ms, duration_ms, duration_ms, 1)
    return res

# -----------------------------
# Async Embedding Lookup
# -----------------------------
@app.get("/embedding/{product_ids}")
async def get_embedding(product_ids: str, embedding_type: Optional[str] = Query("both", enum=["text","image","both"])):
    start_time = time.perf_counter()
    ids_list = product_ids.split(",")
    response = {}
    for pid in ids_list:
        emb = {}
        if embedding_type in ["text","both"]: emb["text"] = text_embeddings.get(pid)
        if embedding_type in ["image","both"]: emb["image"] = image_embeddings.get(pid)
        response[pid] = emb
    duration_ms = (time.perf_counter() - start_time) * 1000
    await log_performance("embedding", "anon", len(ids_list), 0, duration_ms, duration_ms, duration_ms, len(ids_list))
    return {"status":"success","data":response}
