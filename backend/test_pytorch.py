# test_torch.py — FastAPI'den bağımsız çalıştır
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"  # Geçici bypass
os.environ["OMP_NUM_THREADS"] = "1"

import torch
print(f"Torch: {torch.__version__}")
print(f"Thread count: {torch.get_num_threads()}")

from langchain_huggingface import HuggingFaceEmbeddings
emb = HuggingFaceEmbeddings(
    model_name="BAAI/bge-m3",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)
print("BAŞARILI:", emb.embed_query("test"))