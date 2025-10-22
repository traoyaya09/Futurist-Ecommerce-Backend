#Create a clean conda env with just Python:
 cd C:\Users\dell\Desktop\backend\futurist_recomendation\recommendation 
conda create -n futurist_recommendation python=3.11 -y
conda activate futurist_recommendation


#Install everything via pip:

pip install -r requirements.txt


#Download spaCy model separately:

python -m spacy download en_core_web_sm


#Run your service:

uvicorn recommendation_service:app --reload --host 0.0.0.0 --port 8000





import os
import logging
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
import time
import spacy
import asyncio

from embedding_loader import load_and_merge_embeddings

# -----------------------------
# Logging Setup
# -----------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("RecommendationService")

# -----------------------------
# Environment / MongoDB
# -----------------------------
MONGO_URI = "mongodb+srv://traoyaya09:vcqgF9ub9r57oq0m@cluster0.lbqbl2z.mongodb.net/futurist_e-commerce"
DB_NAME = "futurist_e-commerce"

use_fallback = False
products_col = logs_col = interactions_col = None
MAX_RETRIES, RETRY_DELAY = 5, 5

for attempt in range(MAX_RETRIES):
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
        time.sleep(RETRY_DELAY)
else:
    logger.error(f"MongoDB connection failed after {MAX_RETRIES} attempts, using fallback catalog")
    use_fallback = True

# -----------------------------
# Fallback catalog
# -----------------------------
FALLBACK_PRODUCTS = [
    {
        "_id": "f1",
        "name": "Fallback Sneaker",
        "description": "A default sneaker used when DB is unavailable.",
        "price": 100,
        "discountPrice": 80,
        "category": "shoes",
        "subCategory": "sneakers",
        "brand": "FallbackBrand",
        "stock": 10,
        "imageUrl": "https://via.placeholder.com/150",
        "rating": 4.2,
        "reviewsCount": 10,
        "reviews": [],
        "isFeatured": False,
        "promotion": None,
        "createdAt": str(datetime.utcnow()),
    },
    {
        "_id": "f2",
        "name": "Fallback Jacket",
        "description": "A default jacket used when DB is unavailable.",
        "price": 200,
        "discountPrice": 150,
        "category": "clothing",
        "subCategory": "jackets",
        "brand": "FallbackBrand",
        "stock": 5,
        "imageUrl": "https://via.placeholder.com/150",
        "rating": 4.0,
        "reviewsCount": 3,
        "reviews": [],
        "isFeatured": False,
        "promotion": None,
        "createdAt": str(datetime.utcnow()),
    },
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
logger.info(f"Loaded {len(text_embeddings)} text and {len(image_embeddings)} image embeddings.")

# -----------------------------
# Models for encoding queries
# -----------------------------
text_model = SentenceTransformer("all-MiniLM-L6-v2")
device = "cuda" if torch.cuda.is_available() else "cpu"
clip_model, preprocess = clip.load("ViT-B/32", device=device)

# Load spaCy for query preprocessing
nlp = spacy.load("en_core_web_sm")

# -----------------------------
# Env var default normalization
# -----------------------------
DEFAULT_NORMALIZE = os.getenv("NORMALIZE_SCORES", "true").lower() == "true"

# -----------------------------
# Pydantic models
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
# FastAPI app
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
# Helpers
# -----------------------------
def cosine_similarity_matrix(query_vecs: np.ndarray, product_vecs: np.ndarray):
    query_vecs = np.atleast_2d(query_vecs)
    product_vecs = np.array(product_vecs)
    query_norms = np.linalg.norm(query_vecs, axis=1, keepdims=True) + 1e-8
    prod_norms = np.linalg.norm(product_vecs, axis=1, keepdims=True) + 1e-8
    sim = (query_vecs @ product_vecs.T) / (query_norms @ prod_norms.T)
    return sim.squeeze()

def normalize_product(raw):
    return {
        "_id": str(raw["_id"]),
        "name": raw.get("name", "Unnamed Product"),
        "description": raw.get("description", "No description"),
        "price": raw.get("price"),
        "discountPrice": raw.get("discountPrice"),
        "category": raw.get("category", "Uncategorized"),
        "subCategory": raw.get("subCategory", ""),
        "brand": raw.get("brand", ""),
        "stock": raw.get("stock", 0),
        "imageUrl": raw.get("imageUrl") or raw.get("image") or "https://via.placeholder.com/150",
        "rating": raw.get("rating", 0),
        "reviewsCount": raw.get("reviewsCount", 0),
        "reviews": raw.get("reviews", []),
        "isFeatured": raw.get("isFeatured", False),
        "promotion": raw.get("promotion"),
        "createdAt": raw.get("createdAt"),
    }

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
    keywords = [token.text for token in doc if token.pos_ in ["NOUN", "ADJ"]]
    return " ".join(keywords) if keywords else query

def compute_field_boost(product, query: str) -> float:
    boost = 0.0
    q_words = query.lower().split()
    if any(w in product.get("name", "").lower() for w in q_words):
        boost += 0.3
    if any(w in product.get("category", "").lower() for w in q_words):
        boost += 0.2
    if any(w in product.get("subCategory", "").lower() for w in q_words):
        boost += 0.2
    if any(w in product.get("brand", "").lower() for w in q_words):
        boost += 0.1
    return boost

def compute_decay_interaction_boost_vectorized(user_id: str, product_ids: list, half_life_hours=2):
    if use_fallback or interactions_col is None:
        return np.zeros(len(product_ids))
    now = datetime.utcnow()
    half_life_seconds = half_life_hours * 3600
    boost_map = {pid: 0.0 for pid in product_ids}
    interactions = list(interactions_col.find({
        "userId": user_id,
        "productId": {"$in": product_ids}
    }))
    if not interactions:
        return np.zeros(len(product_ids))
    timestamps = np.array([datetime.fromisoformat(a.get("timestamp", now)) if isinstance(a.get("timestamp", now), str)
                           else a.get("timestamp", now) for a in interactions])
    pids = np.array([a["productId"] for a in interactions])
    age_seconds = np.array([(now - ts).total_seconds() for ts in timestamps])
    decay = 0.5 ** (age_seconds / half_life_seconds)
    for pid, d in zip(pids, decay):
        boost_map[pid] += d
    boost_arr = np.array([boost_map[pid] for pid in product_ids])
    max_boost = boost_arr.max() if boost_arr.size > 0 else 1.0
    if max_boost > 0:
        boost_arr /= max_boost
    return boost_arr

def combine_scores_vectorized(hybrid_scores, text_sims, image_sims, interaction_boost, field_boosts, weights=None):
    if weights is None:
        weights = {"hybrid": 0.5, "text": 0.2, "image": 0.2, "interaction": 0.05, "field": 0.05}
    total = sum(weights.values())
    weights = {k: v / total for k, v in weights.items()}
    return (
        weights["hybrid"] * hybrid_scores +
        weights["text"] * text_sims +
        weights["image"] * image_sims +
        weights["interaction"] * interaction_boost +
        weights["field"] * field_boosts
    )

def fetch_products(skip, limit, query=None):
    if use_fallback:
        return FALLBACK_PRODUCTS[skip: skip + limit]
    filter_query = {"stock": {"$gt": 0}}
    if query:
        filter_query["$text"] = {"$search": query}
    return list(products_col.find(filter_query).skip(skip).limit(limit))

# -----------------------------
# Single Recommendation Endpoint
# -----------------------------
@app.post("/recommendations")
async def get_recommendations(req: RecommendationRequest, normalize: Optional[bool] = Query(None)):
    """
    Fully async, concurrency-safe single recommendation endpoint.
    Wraps the batch endpoint with a single request for async execution.
    """
    # Override request normalization if query param is provided
    if normalize is not None:
        req.normalize = normalize

    # Call batch endpoint in a thread to avoid blocking
    batch_result = await asyncio.to_thread(
        get_batch_recommendations,
        BatchRecommendationRequest(requests=[req])
    )

    # Return only the first request's result
    return batch_result["data"][0]

# -----------------------------
# Batch Recommendation Endpoint
# -----------------------------

@app.post("/batch_recommendations")
def get_batch_recommendations(batch_req: BatchRecommendationRequest):
    all_responses = []

    for req in batch_req.requests:
        skip = max((req.page - 1) * req.limit, 0)
        products = fetch_products(skip, req.limit, req.query)

        if not products:
            all_responses.append([])
            continue

        product_ids = [str(p["_id"]) for p in products]
        processed_query = preprocess_query(req.query) if req.query else ""

        # -----------------------------
        # Compute embeddings and similarities safely
        # -----------------------------
        n_products = len(products)
        text_sims = np.zeros(n_products)
        image_sims = np.zeros(n_products)

        if processed_query:
            query_text_vec = get_text_embedding(processed_query)
            product_text_vecs = np.array([text_embeddings.get(pid, np.zeros(384)) for pid in product_ids])
            if product_text_vecs.size > 0:
                text_sims = cosine_similarity_matrix(query_text_vec, product_text_vecs)
            text_sims = np.atleast_1d(text_sims).flatten()
            if text_sims.shape[0] != n_products:
                text_sims = np.zeros(n_products)

        if req.image:
            query_img_vec = get_image_embedding(req.image)
            product_img_vecs = np.array([image_embeddings.get(pid, np.zeros(512)) for pid in product_ids])
            if product_img_vecs.size > 0:
                image_sims = cosine_similarity_matrix(query_img_vec, product_img_vecs)
            image_sims = np.atleast_1d(image_sims).flatten()
            if image_sims.shape[0] != n_products:
                image_sims = np.zeros(n_products)

        interaction_boost = (compute_decay_interaction_boost_vectorized(req.userId, product_ids)
                             if req.userId else np.zeros(n_products))
        if interaction_boost.shape[0] != n_products:
            interaction_boost = np.zeros(n_products)

        field_boosts = np.array([compute_field_boost(p, processed_query) for p in products])
        if field_boosts.shape[0] != n_products:
            field_boosts = np.zeros(n_products)

        hybrid_scores = np.array([
            hybrid_model.get(str(req.userId), {}).get(pid, 0.5) if req.userId else 0.5
            for pid in product_ids
        ])
        if hybrid_scores.shape[0] != n_products:
            hybrid_scores = np.full(n_products, 0.5)

        # -----------------------------
        # Combine and normalize scores
        # -----------------------------
        combined_scores = combine_scores_vectorized(hybrid_scores, text_sims, image_sims, interaction_boost, field_boosts)
        combined_scores = np.atleast_1d(combined_scores).flatten()
        if combined_scores.shape[0] != n_products:
            combined_scores = np.ones(n_products)

        do_normalize = req.normalize if req.normalize is not None else DEFAULT_NORMALIZE
        if do_normalize:
            min_s, max_s = combined_scores.min(), combined_scores.max()
            combined_scores = ((combined_scores - min_s) / (max_s - min_s)
                               if max_s > min_s else np.ones_like(combined_scores))

        # -----------------------------
        # Prepare final response
        # -----------------------------
        final_response = []
        for idx, p in enumerate(products):
            entry = {"product": normalize_product(p), "score": float(combined_scores[idx])}
            if req.debug:
                entry["debug"] = {
                    "hybrid": float(hybrid_scores[idx]),
                    "text_sim": float(text_sims[idx]),
                    "image_sim": float(image_sims[idx]),
                    "interaction_boost": float(interaction_boost[idx]),
                    "field_boost": float(field_boosts[idx]),
                }
            final_response.append(entry)

        # -----------------------------
        # Log recommendations safely
        # -----------------------------
        if not use_fallback and logs_col is not None:
            try:
                logs_col.insert_one({
                    "userId": req.userId,
                    "query": req.query,
                    "processedQuery": processed_query,
                    "image": req.image,
                    "recommended_products": [x["product"]["_id"] for x in final_response],
                    "scores": [x["score"] for x in final_response],
                    "timestamp": datetime.utcnow()
                })
            except Exception as e:
                logger.warning(f"Logging failed for user {req.userId}: {e}")

        all_responses.append(final_response)

    return {"status": "success", "data": all_responses}



# -----------------------------
# Interaction Logging Endpoint
# -----------------------------
@app.post("/interactions")
def save_interaction(req: InteractionRequest):
    try:
        if not use_fallback and interactions_col is not None:
            interactions_col.insert_one({
                "userId": req.userId,
                "productId": req.productId,
                "action": req.action,
                "timestamp": req.timestamp or datetime.utcnow()
            })
        return {"status": "success"}
    except Exception as e:
        logger.exception("Interaction logging failed")
        raise HTTPException(status_code=500, detail=str(e))

# -----------------------------
# Embedding Lookup Endpoint
# -----------------------------
@app.get("/embedding/{product_ids}")
def get_embedding(
    product_ids: str,
    embedding_type: Optional[str] = Query("both", enum=["text", "image", "both"])
):
    try:
        ids_list = product_ids.split(",")
        response = {}
        for pid in ids_list:
            pid = pid.strip()
            emb = {}
            if embedding_type in ["text", "both"]:
                emb["text"] = text_embeddings.get(pid)
            if embedding_type in ["image", "both"]:
                emb["image"] = image_embeddings.get(pid)
            response[pid] = emb
        return {"status": "success", "data": response}
    except Exception as e:
        logger.exception("Embedding lookup failed")
        raise HTTPException(status_code=500, detail=str(e))
