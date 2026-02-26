import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Makine öğrenmesi modüllerimiz
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_classic.chains import RetrievalQA

from src.schemas import ChatRequest, ChatResponse, SourceSchema

load_dotenv()

# Uygulama genelinde yaşayacak yapay zeka motorumuz
ai_engine = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Sunucu başlarken makine öğrenmesi modellerini hafızaya alır.
    """
    print("--- Makine Öğrenmesi Modelleri Yükleniyor ---")
    try:
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        vector_store = Chroma(persist_directory="./db", embedding_function=embeddings)
        
        llm = ChatGroq(
            groq_api_key=os.getenv("GROQ_API_KEY"),
            model_name="llama-3.1-8b-instant",
            temperature=0
        )
        
        ai_engine["qa_chain"] = RetrievalQA.from_chain_type(
            llm=llm,
            chain_type="stuff",
            retriever=vector_store.as_retriever(search_kwargs={"k": 3}),
            return_source_documents=True
        )
        print("--- Sistem Başarıyla Hazırlandı ---")
    except Exception as e:
        print(f"Model yükleme hatası: {e}")
    
    yield
    
    # Sunucu kapanırken belleği temizler
    ai_engine.clear()

app = FastAPI(
    title="ETÜ Akademik Asistan API",
    version="1.0.0",
    lifespan=lifespan
)

# Frontend ile haberleşebilmek için CORS ayarları (Güvenlik)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Canlı ortama çıkarken buraya spesifik domainler eklenecek
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Kullanıcıdan gelen soruları yapay zeka motoruna iletir ve formatlayıp döndürür.
    """
    if "qa_chain" not in ai_engine:
        raise HTTPException(status_code=503, detail="Yapay zeka servisi şu an kullanılamıyor.")
    
    try:
        # Soruyu modele gönderiyoruz
        response = ai_engine["qa_chain"].invoke({"query": request.query})
        
        # Sadece sayfa numaralarını frontend'e iletmek üzere formatlıyoruz
        source_list = []
        for doc in response.get('source_documents', []):
            page = str(doc.metadata.get('page', 'Bilinmiyor'))
            source_list.append(SourceSchema(page=page))
            
        return ChatResponse(
            answer=response['result'],
            sources=source_list
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))