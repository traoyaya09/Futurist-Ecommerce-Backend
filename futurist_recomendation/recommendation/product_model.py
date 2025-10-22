# product_model.py
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from pymongo import MongoClient

# --------------------------
# Ratings Preprocessing
# --------------------------
def preprocess_ratings(df):
    """
    Clean and preprocess ratings data.
    Ensure each row has userId, productId, rating
    """
    df = df.dropna(subset=['userId', 'productId', 'rating'])
    df['rating'] = df['rating'].astype(float)
    df['userId'] = df['userId'].astype(str)
    df['productId'] = df['productId'].astype(str)
    return df

# --------------------------
# Ratings Matrix
# --------------------------
def create_ratings_matrix(df):
    """
    Create user x product ratings matrix
    """
    ratings_matrix = df.pivot(index='userId', columns='productId', values='rating').fillna(0)
    return ratings_matrix

# --------------------------
# Collaborative Filtering
# --------------------------
def collaborative_filtering(ratings_matrix):
    """
    Simple user-based collaborative filtering using cosine similarity
    Returns a dictionary: {userId: {productId: score}}
    """
    user_sim = cosine_similarity(ratings_matrix)
    users = ratings_matrix.index.tolist()
    products = ratings_matrix.columns.tolist()
    user_scores = {}

    for i, user in enumerate(users):
        scores = {}
        for j, prod in enumerate(products):
            # Weighted sum of ratings from similar users
            sim_sum = np.sum(user_sim[i])
            if sim_sum == 0:
                scores[prod] = 0
            else:
                scores[prod] = np.dot(user_sim[i], ratings_matrix[prod].values) / sim_sum
        user_scores[user] = scores
    return user_scores

# --------------------------
# Content-Based Filtering (Embedding-based)
# --------------------------
def content_based_filtering(product_ids, mongo_uri="mongodb://localhost:27017", db_name="myshop"):
    """
    Content-based similarity using precomputed embeddings (text + image).
    Returns a dict of product similarity matrices.
    """
    client = MongoClient(mongo_uri)
    db = client[db_name]
    products_col = db["products"]

    # Load embeddings for selected products
    product_docs = list(products_col.find(
        {"_id": {"$in": [pid for pid in product_ids]}},
        {"_id": 1, "textEmbedding": 1, "imageEmbedding": 1}
    ))

    embeddings = {}
    for doc in product_docs:
        text_emb = np.array(doc.get("textEmbedding", []))
        img_emb = np.array(doc.get("imageEmbedding", []))

        # Fallback if one of the embeddings is missing
        if text_emb.size == 0 and img_emb.size == 0:
            combined = np.zeros(512)
        elif text_emb.size == 0:
            combined = img_emb
        elif img_emb.size == 0:
            combined = text_emb
        else:
            # Weighted average of text + image embeddings
            combined = 0.5 * text_emb + 0.5 * img_emb

        embeddings[str(doc["_id"])] = combined

    # Compute cosine similarity between all products
    sim_matrix = {}
    for pid in embeddings:
        sim_matrix[pid] = {}
        for other_pid in embeddings:
            if pid == other_pid:
                continue
            a, b = embeddings[pid], embeddings[other_pid]
            if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
                sim = 0.0
            else:
                sim = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-8)
            sim_matrix[pid][other_pid] = float(sim)

    return sim_matrix

# --------------------------
# Hybrid Recommender
# --------------------------
def hybrid_recommender(collab_model, content_model, alpha=0.6, beta=0.4):
    """
    Combine collaborative + content scores into hybrid
    """
    hybrid = {}
    for user, prod_scores in collab_model.items():
        hybrid[user] = {}
        for pid, score in prod_scores.items():
            content_score = np.mean(list(content_model.get(pid, {}).values())) if pid in content_model else 0
            hybrid[user][pid] = alpha * score + beta * content_score
    return hybrid

# --------------------------
# Normalize Product Document
# --------------------------
def normalize_product_doc(doc):
    return {
        "_id": str(doc.get("_id")),
        "name": doc.get("name", "Unnamed Product"),
        "description": doc.get("description", ""),
        "price": doc.get("price", None),
        "discountPrice": doc.get("discountPrice", None),
        "category": doc.get("category", "Uncategorized"),
        "brand": doc.get("brand", ""),
        "stock": doc.get("stock", 0),
        "imageUrl": doc.get("imageUrl", "https://via.placeholder.com/150"),
        "rating": doc.get("rating", 0),
        "reviewsCount": doc.get("reviewsCount", 0),
        "reviews": doc.get("reviews", []),
        "isFeatured": doc.get("isFeatured", False),
        "promotion": doc.get("promotion", None),
        "createdAt": doc.get("createdAt", None)
    }
