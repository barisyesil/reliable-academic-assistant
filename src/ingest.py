import os
import json
import hashlib
import re
from dotenv import load_dotenv
from langchain_community.document_loaders import PyMuPDFLoader
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

def structural_clean_and_format(text):
    """
    Bu fonksiyon akademik metinleri LLM ve Splitter için daha okunabilir hale getirir.
    'Madde X' veya 'Bölüm Y' gibi başlıkları algılayıp Markdown başlığına (##) çevirir.
    Böylece parçalayıcı bu başlıkları bölmek yerine bir bütün olarak ele alır.
    """
    # Kelime arası tire ile bölünmüş satırları birleştir
    text = re.sub(r'(\w+)-\n(\w+)', r'\1\2', text)
    
    # "MADDE 14", "Madde 14 -", "BÖLÜM 2" gibi yapıları yakala ve Markdown başlığı yap
    text = re.sub(r'(?i)\n(madde\s+\d+)', r'\n\n## \1', text)
    text = re.sub(r'(?i)\n(bölüm\s+\d+)', r'\n\n# \1', text)
    
    # Fazla boşlukları temizle
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text

def process_academic_documents(data_dir="data"):
    print("--- [PRO] Gelişmiş Veri Hattı Başlatılıyor ---")
    
    # DÜNYA STANDARDI ÇOK DİLLİ MODEL: BAAI/bge-m3
    # Hem Türkçe hem İngilizce metinleri aynı uzayda mükemmel eşleştirir.
    print("[*] BGE-M3 Embedding Modeli yükleniyor (Bu işlem ilk seferde biraz sürebilir)...")
    embeddings = HuggingFaceEmbeddings(
        model_name="BAAI/bge-m3",
        model_kwargs={'device': 'cpu'}, # Ekran kartın (CUDA) varsa 'cuda' yapabilirsin
        encode_kwargs={'normalize_embeddings': True} # Kosinüs benzerliği için şart
    )
    
    # YAPISAL PARÇALAYICI (Structural Splitter)
    # Artık önce "## Madde" başlıklarına göre bölmeyi deneyecek, 
    # sığmazsa paragraflara, o da sığmazsa cümlelere bölecek.
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500, # BGE-M3 daha uzun bağlam anlayabilir, boyutu artırdık
        chunk_overlap=300,
        separators=["\n# ", "\n## ", "\n\n", "\n", "• ", ". ", " "],
        keep_separator=True
    )
    
    vector_db = Chroma(persist_directory="./db", embedding_function=embeddings)
    processed_hashes = load_processed_hashes()
    new_hashes = processed_hashes.copy()
    files_to_process = []
    
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        
    for root, dirs, files in os.walk(data_dir):
        for filename in files:
            if filename.endswith(".pdf"):
                filepath = os.path.join(root, filename)
                file_hash = get_file_hash(filepath)
                
                if filepath not in processed_hashes or processed_hashes[filepath] != file_hash:
                    category = os.path.basename(root)
                    if category == os.path.basename(data_dir):
                        category = "genel"
                    files_to_process.append((filepath, file_hash, category, filename))

    if not files_to_process:
        print("--- Sistem zaten güncel! ---")
        return

    for filepath, file_hash, category, filename in files_to_process:
        print(f"\n--- İşleniyor: [{category.upper()}] {filename} ---")
        
        loader = PyMuPDFLoader(filepath)
        try:
            documents = loader.load()
        except Exception as e:
            print(f"[!] Hata oluştu ({filename}): {e}")
            continue
        
        for doc in documents:
            # Önce metni yapısal olarak temizle ve Markdown başlıkları ekle
            doc.page_content = structural_clean_and_format(doc.page_content)
            
            doc.metadata["category"] = category
            doc.metadata["document_name"] = filename
            
            # Bağlamı zenginleştirmek için her sayfanın başına meta bilgiyi gömüyoruz
            header = f"KATEGORİ: {category.upper()} | BELGE: {filename} | SAYFA: {doc.metadata.get('page', '1')}\n\n"
            doc.page_content = header + doc.page_content
        
        chunks = text_splitter.split_documents(documents)
        vector_db.add_documents(chunks) 
        new_hashes[filepath] = file_hash
        
    save_processed_hashes(new_hashes)
    print("\n--- Veritabanı BGE-M3 ve Yapısal Chunking ile Başarıyla Güncellendi! ---")

if __name__ == "__main__":
    process_academic_documents()