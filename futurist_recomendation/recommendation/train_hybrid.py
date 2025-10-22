# --------------------------
# train_hybrid.py
# --------------------------

import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"  # Fix for OpenMP duplicate lib issue

import pickle
import numpy as np
import pandas as pd
from pymongo import MongoClient
from sentence_transformers import SentenceTransformer
import torch
import clip
from dotenv import load_dotenv
from product_model import (
    preprocess_ratings,
    create_ratings_matrix,
    collaborative_filtering,
    content_based_filtering,
)
from PIL import Image
import requests
from io import BytesIO
import glob
import time

# --------------------------
# Load env vars
# --------------------------
load_dotenv()

CONFIG = {
    "mongo_uri": os.getenv("MONGO_URI", "mongodb://localhost:27017"),
    "db_name": "futurist_e-commerce",
    "products_collection": "products",
    "ratings_collection": "ratings",
    "model_dir": "models",
    "embedding_model_name": "all-MiniLM-L6-v2",
    "clip_model": "ViT-B/32",
    "text_embedding_dir": "text_embeddings",
    "image_embedding_dir": "image_embeddings",
}

os.makedirs(CONFIG["model_dir"], exist_ok=True)
os.makedirs(CONFIG["text_embedding_dir"], exist_ok=True)
os.makedirs(CONFIG["image_embedding_dir"], exist_ok=True)

client = MongoClient(CONFIG["mongo_uri"])
db = client[CONFIG["db_name"]]
products_col = db[CONFIG["products_collection"]]
ratings_col = db[CONFIG["ratings_collection"]]

# --------------------------
# Load products from MongoDB
# --------------------------
def load_products():
    return pd.DataFrame(list(products_col.find({})))

df_products = load_products()
print(f"[INFO] Loaded {len(df_products)} products from MongoDB")
if df_products.empty:
    print("[WARN] No products found in DB. Exiting...")
    exit(0)

# --------------------------
# Precompute text embeddings
# --------------------------
text_model = SentenceTransformer(CONFIG["embedding_model_name"])

def compute_text_embeddings(df, chunk_size=500, save_dir=CONFIG["text_embedding_dir"]):
    for col in ["name", "description", "category"]:
        if col not in df.columns:
            df[col] = ""
    
    df["name"] = df["name"].fillna("").astype(str).str.strip()
    df["description"] = df["description"].fillna("").astype(str).str.strip()
    df["category"] = df["category"].fillna("").astype(str).str.strip()

    num_products = len(df)
    print(f"[INFO] Computing text embeddings for {num_products} products in chunks of {chunk_size}...")

    for start_idx in range(0, num_products, chunk_size):
        end_idx = min(start_idx + chunk_size, num_products)
        chunk_df = df.iloc[start_idx:end_idx]

        texts = (chunk_df["name"] + " " + chunk_df["description"] + " " + chunk_df["category"]).tolist()
        texts = [" ".join(t.split()) for t in texts]

        embeddings = text_model.encode(texts, show_progress_bar=True, convert_to_numpy=True)
        ids_list = chunk_df["_id"].astype(str).tolist()

        save_path = os.path.join(save_dir, f"text_embeddings_{start_idx}_{end_idx}.npz")
        np.savez_compressed(save_path, ids=np.array(ids_list), embeddings=embeddings)
        print(f"[INFO] Saved text embeddings for products {start_idx}-{end_idx} → {save_path}")

    print("[INFO] All text embeddings computed and saved to disk.")

# --------------------------
# Robust image download + embedding
# --------------------------
def fetch_image_tensor(url, preprocess, device, retries=3):
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    for attempt in range(retries):
        try:
            response = requests.get(url, timeout=10, headers=headers)
            if response.status_code != 200 or not response.content:
                raise ValueError(f"Bad response ({response.status_code})")
            image = Image.open(BytesIO(response.content)).convert("RGB")
            return preprocess(image).unsqueeze(0).to(device)
        except Exception:
            if attempt < retries - 1:
                time.sleep(1)  # brief delay before retry
                continue
            return None  # fallback

def get_valid_image_url(row):
    url = row.get("imageUrl") or row.get("image")
    if not url or not url.startswith("http"):
        return None
    return url

def compute_image_embeddings(df, chunk_size=500, save_dir=CONFIG["image_embedding_dir"]):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    clip_model, preprocess = clip.load(CONFIG["clip_model"], device=device)

    num_products = len(df)
    print(f"[INFO] Computing CLIP image embeddings for {num_products} products in chunks of {chunk_size}...")

    for start_idx in range(0, num_products, chunk_size):
        end_idx = min(start_idx + chunk_size, num_products)
        chunk_df = df.iloc[start_idx:end_idx]

        embeddings_list, ids_list = [], []

        for _, row in chunk_df.iterrows():
            image_url = get_valid_image_url(row)
            if not image_url:
                continue
            image_tensor = fetch_image_tensor(image_url, preprocess, device)
            if image_tensor is None:
                emb = np.zeros(512)  # fallback zero vector
            else:
                with torch.no_grad():
                    emb = clip_model.encode_image(image_tensor).cpu().numpy()[0]
            embeddings_list.append(emb)
            ids_list.append(str(row["_id"]))

        if embeddings_list:
            save_path = os.path.join(save_dir, f"image_embeddings_{start_idx}_{end_idx}.npz")
            np.savez_compressed(save_path, ids=np.array(ids_list), embeddings=np.array(embeddings_list))
            print(f"[INFO] Saved image embeddings {start_idx}-{end_idx} → {save_path}")

    print("[INFO] All image embeddings computed and saved to disk.")

# --------------------------
# Merge embeddings
# --------------------------
def merge_embeddings(embedding_dir):
    all_files = glob.glob(os.path.join(embedding_dir, "*.npz"))
    merged = {}
    for file_path in all_files:
        data = np.load(file_path)
        ids = data["ids"]
        embs = data["embeddings"]
        for pid, emb in zip(ids, embs):
            merged[pid] = emb
    print(f"[INFO] Loaded {len(merged)} embeddings from {embedding_dir}")
    return merged

# --------------------------
# Run embedding computations
# --------------------------
compute_text_embeddings(df_products)
compute_image_embeddings(df_products)

text_embeddings = merge_embeddings(CONFIG["text_embedding_dir"])
image_embeddings = merge_embeddings(CONFIG["image_embedding_dir"])

# --------------------------
# Collaborative filtering
# --------------------------
ratings_df = pd.DataFrame(list(ratings_col.find({})))
if ratings_df.empty:
    print("[WARN] No ratings found, skipping collaborative model")
    collaborative_model = {}
    ratings_matrix = pd.DataFrame()
else:
    ratings_df = preprocess_ratings(ratings_df)
    ratings_matrix = create_ratings_matrix(ratings_df)
    collaborative_model = collaborative_filtering(ratings_matrix)

# --------------------------
# Content-based similarity
# --------------------------
unique_products = df_products["_id"].astype(str).unique()
content_sim_matrix = content_based_filtering(
    unique_products,
    mongo_uri=CONFIG["mongo_uri"],
    db_name=CONFIG["db_name"]
)

# --------------------------
# Save models
# --------------------------
with open(os.path.join(CONFIG["model_dir"], "collaborative_model.pkl"), "wb") as f:
    pickle.dump(collaborative_model, f)
with open(os.path.join(CONFIG["model_dir"], "content_sim_matrix.pkl"), "wb") as f:
    pickle.dump(content_sim_matrix, f)

# --------------------------
# Save merged embeddings for API
# --------------------------
np.savez_compressed(os.path.join(CONFIG["model_dir"], "merged_text_embeddings.npz"),
                    ids=np.array(list(text_embeddings.keys())),
                    embeddings=np.array(list(text_embeddings.values())))
np.savez_compressed(os.path.join(CONFIG["model_dir"], "merged_image_embeddings.npz"),
                    ids=np.array(list(image_embeddings.keys())),
                    embeddings=np.array(list(image_embeddings.values())))

print("[INFO] Hybrid model and embeddings saved successfully!")
