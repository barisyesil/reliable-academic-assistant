import os
import json
import hashlib
import re
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

load_dotenv()

HASH_DB_PATH = "./db/processed_files.json"

def get_file_hash(filepath):
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def load_processed_hashes():
    if os.path.exists(HASH_DB_PATH):
        with open(HASH_DB_PATH, 'r') as f:
            return json.load(f)
    return {}

def save_processed_hashes(hashes):
    os.makedirs("./db", exist_ok=True)
    with open(HASH_DB_PATH, 'w') as f:
        json.dump(hashes, f, indent=4)

def clean_pdf_text(text):
    # Tablo veya liste olabilecek ardışık boşlukları ve satır atlamalarını korur.
    # PyPDF kaynaklı, kelimeyi ortadan bölen tireleri ve rastgele satır sonlarını temizleyerek cümle bütünlüğünü (anlamı) kurtarır.
    text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)
    text = re.sub(r'(?<!\n)\n(?!\n)', ' ', text)
    return text

def process_academic_documents(data_dir="data"):
    print("--- Veri Hattı (Ingestion Pipeline) Başlatılıyor ---")
    
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    
    # Paragraf, tablo (\n\n) ve cümle sonlarına (. ! ?) duyarlı anlamsal/yapısal bölücü.
    # Not: Tabloları ve paragrafları bozmadan anlamsal bütünlüğü korumak için en verimli yöntem bu yapılandırmadır.
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        separators=["\n\n", "\n", ". ", "! ", "? ", " "],
        keep_separator=True
    )
    
    vector_db = Chroma(persist_directory="./db", embedding_function=embeddings)
    
    processed_hashes = load_processed_hashes()
    new_hashes = processed_hashes.copy()
    files_to_process = []
    
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    for filename in os.listdir(data_dir):
        if filename.endswith(".pdf"):
            filepath = os.path.join(data_dir, filename)
            file_hash = get_file_hash(filepath)
            
            if filepath not in processed_hashes or processed_hashes[filepath] != file_hash:
                print(f"[*] Yeni/Değişen dosya tespit edildi: {filename}")
                files_to_process.append((filepath, file_hash))
            else:
                print(f"[~] Es geçiliyor (Değişiklik yok): {filename}")

    if not files_to_process:
        print("--- Yeni döküman bulunamadı. Sistem tamamen güncel! ---")
        return

    for filepath, file_hash in files_to_process:
        print(f"\n--- İşleniyor: {filepath} ---")
        loader = PyPDFLoader(filepath)
        documents = loader.load()
        
        # Cümleleri düzeltme işlemi
        for doc in documents:
            doc.page_content = clean_pdf_text(doc.page_content)
        
        print(f"--- Anlamsal ve Yapısal Parçalama Uygulanıyor ---")
        chunks = text_splitter.split_documents(documents)
        
        vector_db.add_documents(chunks) 
        new_hashes[filepath] = file_hash
        
    save_processed_hashes(new_hashes)
    print("\n--- Veri İşleme Tamamlandı. Veritabanı Güncellendi! ---")

if __name__ == "__main__":
    process_academic_documents()