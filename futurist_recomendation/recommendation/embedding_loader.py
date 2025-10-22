# embedding_loader.py
import os
import glob
import numpy as np

def load_and_merge_embeddings(embedding_dir):
    """
    Load all .npz embedding chunks from a directory, merge them,
    remove duplicates (keep the last occurrence), and return as a dictionary.

    Returns:
        dict: {product_id: embedding (np.array)}
    """
    merged_embeddings = {}  # {product_id: embedding}

    npz_files = glob.glob(os.path.join(embedding_dir, "*.npz"))
    if not npz_files:
        print(f"[WARN] No .npz files found in {embedding_dir}")
        return merged_embeddings

    for file_path in npz_files:
        data = np.load(file_path)
        ids = data["ids"]
        embeddings = data["embeddings"]
        for pid, emb in zip(ids, embeddings):
            merged_embeddings[pid] = emb  # overwrite duplicates

    print(f"[INFO] Loaded and merged {len(merged_embeddings)} unique embeddings from {embedding_dir}")
    return merged_embeddings


# -----------------------------
# Example usage
# -----------------------------
if __name__ == "__main__":
    text_embeddings = load_and_merge_embeddings("text_embeddings")
    image_embeddings = load_and_merge_embeddings("image_embeddings")

    # Access embeddings like:
    # text_embeddings["12345"], image_embeddings["12345"]
