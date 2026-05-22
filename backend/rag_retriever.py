import os

import json
import gradio as gr
# get_vector_store yerine init_rag fonksiyonunu da import ediyoruz
from app.services.rag_service import init_rag, get_vector_store

print("[SİSTEM] Vektör veritabanı ve BGE-M3 modeli yükleniyor...")
try:
    # FastAPI'nin normalde açılışta yaptığı başlatma işlemini burada manuel yapıyoruz
    init_rag() 
    vector_store = get_vector_store()
    print("[SİSTEM] Veritabanı ve model başarıyla yüklendi!")
except Exception as e:
    print(f"[HATA] Başlatma sırasında bir sorun oluştu: {e}")
    exit(1)

def fetch_contexts(query):
    if not query.strip():
        return '{\n  "contexts": []\n}'
        
    try:
        # Puan (relevance score) ile arama yap
        # NOT: Eğer bu fonksiyon hata verirse (model çıktısına bağlı olarak), 
        # sadece similarity_search(query, k=4) kullanabilirsin.
        results = vector_store.similarity_search_with_relevance_scores(
            query, 
            k=4, 
            score_threshold=0.40
        )
        
        contexts = [doc.page_content for doc, score in results]
        
        # Eğer hiç sonuç yoksa en yakın 1 taneyi getir
        if not contexts:
            fallback = vector_store.similarity_search(query, k=1)
            contexts = [doc.page_content for doc in fallback] if fallback else []

        return json.dumps({"contexts": contexts}, ensure_ascii=False, indent=2)
        
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False, indent=2)

# Gradio Arayüzü
with gr.Blocks(theme=gr.themes.Soft()) as demo:
    gr.Markdown("# 🚑 ESTÜ RAG - Manuel Context Kurtarma Aracı")
    query_input = gr.Textbox(lines=3, label="Soruyu Yapıştır")
    fetch_btn = gr.Button("🔍 Kaynakları Getir", variant="primary")
    json_output = gr.Code(language="json", label="Çıktı")

    fetch_btn.click(fn=fetch_contexts, inputs=query_input, outputs=json_output)

if __name__ == "__main__":
    demo.launch(server_port=7860)