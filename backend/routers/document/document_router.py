from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from services.document.document_service import process_and_store_pdf, delete_document_from_db
from models.document_model import DocumentMetadata
from database import get_db
import os
import shutil

router = APIRouter(
    prefix="/api/documents",
    tags=["Documents"]
)

os.makedirs("temp_uploads", exist_ok=True)

# 1. Endpoint baru: Mengambil daftar semua dokumen dari PostgreSQL
@router.get("/")
def get_all_documents(db: Session = Depends(get_db)):
    documents = db.query(DocumentMetadata).order_by(DocumentMetadata.created_at.desc()).all()
    return [{"id": doc.id, "filename": doc.filename, "created_at": doc.created_at} for doc in documents]

# 2. Update endpoint upload untuk menyertakan koneksi database
@router.post("/upload")
async def upload_pdf(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Hanya file PDF yang diizinkan.")
    
    file_path = f"temp_uploads/{file.filename}"
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Teruskan db ke service
        total_chunks = process_and_store_pdf(file_path, file.filename, db)
        
        os.remove(file_path)
        
        return {
            "message": "PDF berhasil diproses", 
            "filename": file.filename, 
            "chunks": total_chunks
        }
    except ValueError as ve:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))
    
@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    try:
        filename = delete_document_from_db(document_id, db)
        return {"message": f"Dokumen '{filename}' berhasil dihapus dari sistem."}
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))