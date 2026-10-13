import chromadb
import pdfplumber
from sentence_transformers import SentenceTransformer
import os
from sqlalchemy.orm import Session
from models.document_model import DocumentMetadata

chroma_client = chromadb.PersistentClient(path="./chroma_data")
collection = chroma_client.get_or_create_collection(name="documents")
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

def extract_text_from_pdf(file_path: str) -> str:
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
    return text

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
    chunks = []
    start = 0
    text_length = len(text)
    while start < text_length:
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks

# Tambahkan parameter db: Session di sini
def process_and_store_pdf(file_path: str, filename: str, db: Session):
    # 1. Cek apakah dokumen sudah ada di PostgreSQL
    existing_doc = db.query(DocumentMetadata).filter(DocumentMetadata.filename == filename).first()
    if existing_doc:
        raise ValueError("Dokumen dengan nama ini sudah pernah di-upload.")

    # 2. Proses PDF dan ChromaDB seperti biasa
    raw_text = extract_text_from_pdf(file_path)
    chunks = chunk_text(raw_text)
    
    for i, chunk in enumerate(chunks):
        vector = embedding_model.encode(chunk).tolist()
        chunk_id = f"{filename}_chunk_{i}"
        
        collection.add(
            ids=[chunk_id],
            embeddings=[vector],
            documents=[chunk],
            metadatas=[{"source": filename, "chunk_index": i}]
        )
    
    # 3. Simpan nama file ke PostgreSQL
    new_doc = DocumentMetadata(filename=filename)
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)
    
    return len(chunks)

def search_documents(query: str, n_results: int = 5, file_context: str = None):
    query_vector = embedding_model.encode(query).tolist()
    
    # Jika React mengirimkan nama file, FILTER HANYA dari file tersebut!
    if file_context:
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=n_results,
            where={"source": file_context} # Ini kunci keajaibannya
        )
    else:
        # Jika tidak ada file spesifik, cari di semua dokumen
        results = collection.query(
            query_embeddings=[query_vector],
            n_results=n_results
        )
    return results

def delete_document_from_db(document_id: int, db: Session):
    doc = db.query(DocumentMetadata).filter(DocumentMetadata.id == document_id).first()
    if not doc:
        raise ValueError("Dokumen tidak ditemukan.")
    
    filename = doc.filename
    
    collection.delete(where={"source": filename})
    
    db.delete(doc)
    db.commit()
    
    return filename