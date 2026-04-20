import os
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from fastapi.responses import FileResponse
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

# --- YENİ: Önbellek (Cache) Kütüphaneleri ---
from langchain_core.globals import set_llm_cache
from langchain_community.cache import SQLiteCache

# Ajan Kütüphaneleri
from langchain.tools import tool
from langchain_classic.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage, AIMessage

from src.schemas import ChatRequest, ChatResponse, SourceSchema

load_dotenv()

ai_engine = {}
chat_histories = {} 

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("--- Yapay Zeka Motoru ve Önbellek Yükleniyor ---")
    try:
        # 1. ÖNBELLEK (CACHE) AKTİVASYONU: Tekrarlayan sorularda 0 token harcar!
        set_llm_cache(SQLiteCache(database_path=".langchain.db"))
        print("[*] SQLite Önbellek Sistemi Aktif.")

        print("[*] BGE-M3 Embedding Modeli yükleniyor...")
        embeddings = HuggingFaceEmbeddings(
            model_name="BAAI/bge-m3",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        ai_engine["vector_store"] = Chroma(persist_directory="./db", embedding_function=embeddings)
        
        # 2. MODEL DEĞİŞİMİ: 70B yerine daha hafif ve kotası yüksek 8B modeline geçtik.
        ai_engine["llm"] = ChatGroq(
            groq_api_key=os.getenv("GROQ_API_KEY"),
            model_name="llama-3.1-8b-instant", 
            temperature=0.1
        )
        print("--- Sistem Hazır ---")
    except Exception as e:
        print(f"Hata: {e}")
    yield
    ai_engine.clear()
    chat_histories.clear()

app = FastAPI(title="ESTÜ Akademik Asistan API - Optimize Sürüm", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    session_id = request.session_id
    query = request.query
    
    if session_id not in chat_histories:
        chat_histories[session_id] = []
    
    # 3. BAĞLAM DİYETİ: 5 mesaj yerine son 3 mesajı tutuyoruz.
    window_history = chat_histories[session_id][-3:] 
    llm = ai_engine["llm"]
    vector_store = ai_engine["vector_store"]
    
    request_sources = []

    @tool
    def search_regulations(search_query: str) -> str:
        """Eskişehir Teknik Üniversitesi (ESTÜ) yönetmelikleri, kuralları ve akademik belgelerinde arama yapar.
        Kullanıcı akademik bir soru sorduğunda KESİNLİKLE bu aracı kullan."""
        print(f"[AJAN ARACI KULLANIYOR] Sorgu: {search_query}")
        
        # 3. BAĞLAM DİYETİ: k=4 yerine k=3 yaparak ajana gönderilen metin yığınını azalttık.
        docs = vector_store.max_marginal_relevance_search(search_query, k=5, fetch_k=15, lambda_mult=0.7)
        
        if not docs:
            return "Veritabanında bu sorguyla ilgili bir bilgi bulunamadı."
        
        context_parts = []
        for doc in docs:
            meta_match = re.match(r'(KATEGORİ:.*?\| BELGE:.*?\| SAYFA:.*?\n\n)', doc.page_content)
            clean_content = doc.page_content
            if meta_match:
                clean_content = doc.page_content.replace(meta_match.group(1), "").strip()

            request_sources.append({
                "page": str(doc.metadata.get('page', '1')),
                "content": clean_content[:400] + "...",
                "category": str(doc.metadata.get('category', 'genel')),
                "document_name": str(doc.metadata.get('document_name', 'Bilinmiyor'))
            })
            
            context_parts.append(f"Belge: {doc.metadata.get('document_name')}\nİçerik:\n{clean_content}")
            
        return "\n\n---\n\n".join(context_parts)

    tools = [search_regulations]

    system_prompt = """Sen Eskişehir Teknik Üniversitesi (ESTÜ) öğrencileri için geliştirilmiş resmi, zeki ve yönlendirici bir Akademik Asistansın.
Aşağıdaki kurallara KESİNLİKLE uy:
1. Soru sorulduğunda ezberden cevap verme, ÖNCE 'search_regulations' aracını kullanarak araştırma yap.
2. SADECE arama aracından dönen gerçek bilgilere dayanarak cevap ver. Uydurma.
3. Eğer öğrencinin durumu veya sınıfı belirtilmemişse, yönetmeliğe göre eksik olan bilgiyi öğrenciye sorarak yönlendir.
4. Muhabbet tarzı sorularda aracı kullanmana gerek yoktur.
5. Sohbetin akışına göre sadece Türkçe ve İngilizce dillerini kullanabilirsin. Diğer dillerde cevap verme."""

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    try:
        agent = create_tool_calling_agent(llm, tools, prompt)
        agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
        
        formatted_history = []
        for h_user, h_ai in window_history:
            formatted_history.append(HumanMessage(content=h_user))
            formatted_history.append(AIMessage(content=h_ai))

        result = agent_executor.invoke({
            "input": query,
            "chat_history": formatted_history
        })
        
        ai_answer = result["output"]

        unique_sources_dict = {}
        for src in request_sources:
            key = src["document_name"] + src["page"]
            if key not in unique_sources_dict:
                unique_sources_dict[key] = SourceSchema(**src)
                
        final_sources = list(unique_sources_dict.values())

        chat_histories[session_id].append((query, ai_answer))
        
        return ChatResponse(answer=ai_answer, sources=final_sources)

    except Exception as e:
        print(f"API Hatası: {str(e)}") 
        raise HTTPException(status_code=500, detail="Bir iç hata oluştu.")

@app.get("/api/document/{category}/{filename}")
async def get_document(category: str, filename: str):
    path_with_category = os.path.join("data", category, filename)
    path_root = os.path.join("data", filename)
    
    if os.path.exists(path_with_category):
        return FileResponse(path_with_category)
    elif os.path.exists(path_root):
        return FileResponse(path_root)
    else:
        raise HTTPException(status_code=404, detail="Belge bulunamadı.")