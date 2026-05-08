import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_db
from app.services.rag_service import init_rag

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 50)
    print("ESTÜ Akademik Asistan API başlatılıyor...")

    # 1. Veritabanı tablolarını oluştur
    await init_db()

    # 2. RAG (embedding + ChromaDB)
    vector_store = init_rag()

    # 3. LLM (Groq)
    from langchain_groq import ChatGroq
    from langchain_community.cache import SQLiteCache
    from langchain_core.globals import set_llm_cache

    set_llm_cache(SQLiteCache(database_path=".langchain_cache.db"))
    llm = ChatGroq(
        groq_api_key=settings.GROQ_API_KEY,
        model_name="llama-3.3-70b-versatile",
        temperature=0.1,
    )

    # Chat router'a LLM'i ver
    from app.api.chat import set_llm
    set_llm(llm)

    print("=" * 50)
    print("Sistem hazır!")
    yield

    print("Sistem kapatılıyor...")


app = FastAPI(
    title="ESTÜ Akademik Asistan API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate Limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Sunucuda beklenmeyen bir hata oluştu."},
    )

# Routers
from app.api import auth, chat, user, documents

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(user.router)
app.include_router(documents.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}