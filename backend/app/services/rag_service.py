import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

_vector_store = None


def get_vector_store() -> Chroma:
    global _vector_store
    if _vector_store is None:
        raise RuntimeError("RAG servisi henüz başlatılmadı. Lifespan'ı kontrol et.")
    return _vector_store


def init_rag() -> Chroma:
    global _vector_store
    print("[RAG] BGE-M3 embedding modeli yükleniyor...")
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},
    )
    if not os.path.exists("./db"):
        os.makedirs("./db", exist_ok=True)
        print("[RAG] './db' klasörü oluşturuldu. ingest.py çalıştırılmalı.")

    _vector_store = Chroma(
        persist_directory="./db",
        embedding_function=embeddings,
    )
    print("[RAG] ChromaDB bağlandı.")
    return _vector_store