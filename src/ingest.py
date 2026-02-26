import os
import json
import hashlib
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_experimental.text_splitter import SemanticChunker
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma

load_dotenv()

# İşlenmiş dosyaların Hash (Kimlik) değerlerini tutacağımız sözleşme dosyası
HASH_DB_PATH = "./db/processed_files.json"

def get_file_hash(filepath):
    """
    Dosyanın içeriğine göre benzersiz bir MD5 özeti (hash) üretir.
    Dosyada tek bir harf bile değişse bu değer tamamen değişir.
    """
    hasher = hashlib.md5()
    with open(filepath, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def load_processed_hashes():
    """Önceden işlenmiş dosyaların kayıtlarını belleğe alır."""
    if os.path.exists(HASH_DB_PATH):
        with open(HASH_DB_PATH, 'r') as f:
            return json.load(f)
    return {}

def save_processed_hashes(hashes):
    """Güncel dosya kayıtlarını diske yazar."""
    os.makedirs("./db", exist_ok=True)
    with open(HASH_DB_PATH, 'w') as f:
        json.dump(hashes, f, indent=4)

def process_academic_documents(data_dir="data"):
    """
    Klasördeki dosyaları tarar, sadece yeni veya değişmiş olanları bulur,
    anlamsal (semantic) olarak parçalar ve vektör veritabanına EKLER.
    """
    print("--- Veri Hattı (Ingestion Pipeline) Başlatılıyor ---")
    
    # 1. Embedding Modeli ve Semantic Chunker
    # Semantic Chunker, cümlelerin anlamsal bütünlüğünü bozmadan ayırmak için embeddings kullanır
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    text_splitter = SemanticChunker(embeddings)
    
    # 2. Veritabanı Bağlantısı (Üzerine yazmak yerine mevcut olanı çağırıyoruz)
    vector_db = Chroma(persist_directory="./db", embedding_function=embeddings)
    
    processed_hashes = load_processed_hashes()
    new_hashes = processed_hashes.copy()
    files_to_process = []
    
    # 3. Klasör Taraması ve Hash Kontrolü (Incremental Logic)
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    for filename in os.listdir(data_dir):
        if filename.endswith(".pdf"):
            filepath = os.path.join(data_dir, filename)
            file_hash = get_file_hash(filepath)
            
            # Eğer dosya daha önce işlenmemişse VEYA içeriği (hash değeri) değişmişse:
            if filepath not in processed_hashes or processed_hashes[filepath] != file_hash:
                print(f"[*] Yeni/Değişen dosya tespit edildi: {filename}")
                files_to_process.append((filepath, file_hash))
            else:
                print(f"[~] Es geçiliyor (Değişiklik yok): {filename}")

    if not files_to_process:
        print("--- Yeni döküman bulunamadı. Sistem tamamen güncel! ---")
        return

    # 4. Sadece Yeni Dosyaları İşleme
    for filepath, file_hash in files_to_process:
        print(f"\n--- İşleniyor: {filepath} ---")
        loader = PyPDFLoader(filepath)
        documents = loader.load()
        
        print(f"--- Anlamsal (Semantic) Parçalama Uygulanıyor ---")
        chunks = text_splitter.split_documents(documents)
        
        # from_documents yerine add_documents kullanıyoruz (Veritabanını sıfırlamamak için)
        vector_db.add_documents(chunks) 
        
        # İşlem başarılı olunca yeni hash değerini kaydediyoruz
        new_hashes[filepath] = file_hash
        
    save_processed_hashes(new_hashes)
    print("\n--- Veri İşleme Tamamlandı. Veritabanı Güncellendi! ---")

if __name__ == "__main__":
    process_academic_documents()