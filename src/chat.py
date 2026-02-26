import os
from dotenv import load_dotenv

# Modern LangChain imports (2026 Standards)
from langchain_groq import ChatGroq
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma  # Fixed: New dedicated package
from langchain_classic.chains import RetrievalQA

# Loading internal configurations
load_dotenv()

def run_academic_assistant():
    """
    Core RAG logic. Connects the ETU regulation database with 
    the Llama 3 generator for reliable, sourced answers.
    """

    # 1. Initialize Embeddings using the modern HuggingFace package
    # Aligns with the 'all-MiniLM-L6-v2' requirement in the thesis proposal
    print("--- Loading embedding model ---")
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # 2. Connect to the existing Vector Database (ChromaDB)
    # Using the 'langchain-chroma' dedicated integration
    if not os.path.exists("./db"):
        print("Error: Vector database not found at './db'. Run ingest.py first.")
        return

    vector_store = Chroma(
        persist_directory="./db",
        embedding_function=embeddings
    )

    # 3. Setup Llama 3 via Groq API 
    # Keeping temperature low to minimize hallucinations 
    print("--- Connecting to Llama 3 via Groq ---")
    llm = ChatGroq(
        groq_api_key=os.getenv("GROQ_API_KEY"),
        model_name="llama-3.1-8b-instant", # Daha güncel, hızlı ve desteklenen sürüm
        temperature=0 #
    )

    # 4. Construct the QA Chain
    # We retrieve relevant chunks and 'stuff' them into the LLM prompt
    assistant_chain = RetrievalQA.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vector_store.as_retriever(search_kwargs={"k": 1}), # Pulling top 3 relevant chunks for better context
        return_source_documents=True,
    )

    print("\n--- ETÜ Academic Assistant is Online ---")
    
    while True:
        query = input("\nStudent Question: ")
        if query.lower() in ["exit", "quit"]:
            break

        print("Fetching info from regulations...")
        try:
            # Running the chain
            response = assistant_chain.invoke({"query": query})
            
            # Displaying the result
            print(f"\n[AI]: {response['result']}")
            
            # Show the sources to prove reliability 
            print("\n[SOURCES]:")
            for doc in response['source_documents']:
                # Pulling page number from metadata
                page = doc.metadata.get('page', 'Unknown')
                print(f" - Reference found in document on Page: {page}")

        except Exception as e:
            print(f"Workflow error: {e}")

if __name__ == "__main__":
    run_academic_assistant()