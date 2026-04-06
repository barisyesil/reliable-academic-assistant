import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

from src.schemas import ChatRequest, ChatResponse, SourceSchema

load_dotenv()

ai_engine = {}
# API'nin hafıza deposu (Gerçek senaryoda bu Redis veya PostgreSQL'de tutulur)
chat_histories = {} 

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- Yapay Zeka Motoru ve Hafıza Modülleri Yükleniyor ---")
    try:
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        
        # Veritabanını doğrudan engine içine alıyoruz ki endpoint'te manuel arama yapabilelim
        ai_engine["vector_store"] = Chroma(persist_directory="./db", embedding_function=embeddings)
        
        ai_engine["llm"] = ChatGroq(
            groq_api_key=os.getenv("GROQ_API_KEY"),
            model_name="llama-3.3-70b-versatile",
            temperature=0
        )
        print("--- Sistem Başarıyla Hazırlandı ---")
    except Exception as e:
        print(f"Model yükleme hatası: {e}")
    
    yield
    ai_engine.clear()
    chat_histories.clear()

app = FastAPI(title="ESTÜ Akademik Asistan API - Hafızalı & Yönlendiricili Sürüm", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    if "llm" not in ai_engine or "vector_store" not in ai_engine:
        raise HTTPException(status_code=503, detail="Yapay zeka servisi şu an kullanılamıyor.")
    
    session_id = request.session_id
    query = request.query
    
    if session_id not in chat_histories:
        chat_histories[session_id] = []
        
    window_history = chat_histories[session_id][-3:]
    router_llm = ai_engine["llm"]
    vector_store = ai_engine["vector_store"]
    
    try:
        # --- 1. ADIM: NİYET ANALİZİ (ROUTER) - ENGLISH PROMPT ---
        intent_prompt = f"""You are an intelligent router. Classify the user's LATEST input strictly as 'GENERAL' or 'ACADEMIC'.
GENERAL: Small talk, greetings, asking about your capabilities, meaningless words (e.g., "string", "test"), or continuing a casual chat.
ACADEMIC: Specific questions about university rules, regulations, passing grades, courses, internships, or institutional knowledge.

User's Latest Input: {query}
Category (Only output GENERAL or ACADEMIC):"""
        
        intent = router_llm.invoke(intent_prompt).content.strip().upper()
        
        # Geçmişi düzenle
        history_text = "\n".join([f"User: {h[0]}\nAssistant: {h[1]}" for h in window_history])
        if not history_text:
            history_text = "No previous history."

        # --- 2. ADIM: İŞLEME VE CEVAP ÜRETİMİ (ENGLISH MASTER PROMPTS) ---
        if "GENERAL" in intent:
            print("[ROUTER] Genel sohbet algılandı.")
            
            chat_prompt = f"""System: You are a helpful, friendly academic assistant. 
Your absolute priority is to respond ONLY to the 'LATEST USER MESSAGE'. 
Do NOT re-answer or repeat previous responses from the 'CHAT HISTORY'. 
Use the 'CHAT HISTORY' strictly for context if the user's latest message refers to something discussed previously (like their name or status).
Always respond in the language the user is speaking.

[CHAT HISTORY]
{history_text}

[LATEST USER MESSAGE]
{query}

Assistant:"""
            
            ai_answer = router_llm.invoke(chat_prompt).content
            sources = []
            
        else:
            print("[ROUTER] Akademik soru algılandı. Gelişmiş Context Entegrasyonu yapılıyor.")
            
            # Manuel RAG Araması
            # MMR (Maksimum Marjinal Uygunluk) Araması
            # fetch_k=10 (arka planda 10 tane bul), k=3 (aralarından en çeşitli 3'ünü seç)
            # ChromaDB'de similarity_search (Benzerlik Araması) yerine max_marginal_relevance_search 
            # (MMR - Maksimum Marjinal Uygunluk) kullanacağız.
            #  MMR arka planda 10 tane benzer kaynak bulur, 
            # sonra bunların içinden "birbirine en az benzeyen, en çeşitli 3 kaynağı" seçip sana getirir.
            docs = vector_store.max_marginal_relevance_search(query, k=6, fetch_k=10, lambda_mult=0.5)
            context_text = "\n\n".join([f"--- Page {doc.metadata.get('page', '?')} ---\n{doc.page_content}" for doc in docs])
            
            # MASTER PROMPT IN ENGLISH
            academic_prompt = f"""System: You are a reliable, strictly factual Academic Assistant.
Your absolute priority is to answer the 'LATEST USER MESSAGE'. Do NOT re-answer previous questions from the 'CHAT HISTORY'.

RULES:
1. Answer the 'LATEST USER MESSAGE' using ONLY the facts provided in the 'OFFICIAL REGULATIONS'. Do not hallucinate.
2. Read the 'CHAT HISTORY' ONLY to understand the user's personal context (e.g., their current semester, department, name).
3. If the user asks a personal academic question (e.g., "when should I do my internship?"), apply the rules from the 'OFFICIAL REGULATIONS' to their specific situation found in the 'CHAT HISTORY'.
4. If the 'OFFICIAL REGULATIONS' do not contain the answer to the latest message, clearly state: "I could not find information regarding this in the official regulations."
5. Always answer in the same language as the 'LATEST USER MESSAGE'.

[CHAT HISTORY (User's Context)]
{history_text}

[OFFICIAL REGULATIONS (Knowledge Base)]
{context_text}

[LATEST USER MESSAGE]
{query}

Assistant:"""
            
            ai_answer = router_llm.invoke(academic_prompt).content
            
            
            sources = []
            for doc in docs:
                sources.append(SourceSchema(
                    page=str(doc.metadata.get('page', 'Bilinmiyor')),
                    content=doc.page_content  # PDF'ten alınan orijinal metin bloğu
                ))

        # Genel hafızayı güncelle
        chat_histories[session_id].append((query, ai_answer))
        return ChatResponse(answer=ai_answer, sources=sources)
        
    except Exception as e:
        print(f"API Hatası: {str(e)}") # Hatayı terminalde daha net görmek için ekledik
        raise HTTPException(status_code=500, detail=str(e))