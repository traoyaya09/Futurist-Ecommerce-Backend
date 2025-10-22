# merge_embeddings_dedup.py
import os
import glob
import numpy as np

TEXT_DIR = "text_embeddings"
IMAGE_DIR = "image_embeddings"
OUTPUT_DIR = "models"

os.makedirs(OUTPUT_DIR, exist_ok=True)

def merge_npz_chunks_unique(embedding_dir, output_file):
    """
    Merge all .npz files in embedding_dir into a single .npz file.
    Removes duplicate product IDs, keeping the last occurrence.
    """
    merged_dict = {}  # product_id -> embedding

    npz_files = glob.glob(os.path.join(embedding_dir, "*.npz"))
    if not npz_files:
        print(f"[WARN] No .npz files found in {embedding_dir}")
        return

    for file_path in npz_files:
        data = np.load(file_path)
        ids = data["ids"]
        embeddings = data["embeddings"]
        for pid, emb in zip(ids, embeddings):
            merged_dict[pid] = emb  # overwrite duplicates

    all_ids = np.array(list(merged_dict.keys()))
    all_embeddings = np.array(list(merged_dict.values()))

    np.savez_compressed(os.path.join(OUTPUT_DIR, output_file),
                        ids=all_ids,
                        embeddings=all_embeddings)
    print(f"[INFO] Merged {len(all_ids)} unique embeddings into {output_file}")


if __name__ == "__main__":
    print("[INFO] Merging text embeddings...")
    merge_npz_chunks_unique(TEXT_DIR, "merged_text_embeddings.npz")
    print("[INFO] Merging image embeddings...")
    merge_npz_chunks_unique(IMAGE_DIR, "merged_image_embeddings.npz")
    print("[INFO] All embeddings merged and deduplicated successfully!")
