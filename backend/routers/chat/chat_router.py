from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from schemas.input_models_chat import ChatRequest
from services.chat.chat_service import get_ai_response_stream
from database import get_db
from models.chat_model import ChatMessage

router = APIRouter(
    prefix="/api/chat",
    tags=["Chat"]
)

@router.get("/sessions")
def get_all_sessions(db: Session = Depends(get_db)):
    """Mengambil daftar riwayat percakapan (sidebar)"""
    # Ambil session_id unik
    sessions = db.query(ChatMessage.session_id, func.min(ChatMessage.created_at).label('created_at')).group_by(ChatMessage.session_id).order_by('created_at').all()
    
    result = []
    for sess in sessions:
        # Ambil pesan pertama dari sesi ini untuk dijadikan judul chat
        first_msg = db.query(ChatMessage).filter(ChatMessage.session_id == sess.session_id, ChatMessage.role == 'user').order_by(ChatMessage.created_at.asc()).first()
        
        title = "Chat Baru"
        if first_msg:
            title = first_msg.text[:30] + "..." if len(first_msg.text) > 30 else first_msg.text
            
        result.append({"id": sess.session_id, "title": title})
    
    # Return dengan urutan terbaru di atas
    return result[::-1]

@router.delete("/sessions/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    """Menghapus seluruh riwayat chat dalam 1 sesi"""
    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.commit()
    return {"message": "Chat dihapus"}

@router.get("/{session_id}")
def get_chat_history(session_id: str, db: Session = Depends(get_db)):
    """Mengambil riwayat chat lama saat browser di-refresh"""
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    return [{"role": msg.role, "text": msg.text} for msg in messages]

@router.post("/")
def chat_with_ai(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        # 1. Simpan pertanyaan User
        user_msg = ChatMessage(session_id=request.session_id, role="user", text=request.message)
        db.add(user_msg)
        db.commit()

        # 2. Ambil History
        history = db.query(ChatMessage).filter(ChatMessage.session_id == request.session_id).order_by(ChatMessage.created_at.asc()).all()

        # 3. Buat fungsi generator untuk streaming sekaligus menyimpan ke DB di akhir
        def generate_and_save():
            full_reply = ""
            for chunk in get_ai_response_stream(request.message, history, request.file_context):
                full_reply += chunk
                yield chunk
            
            # Setelah looping selesai (pesan komplit), simpan ke database
            bot_msg = ChatMessage(session_id=request.session_id, role="bot", text=full_reply)
            db.add(bot_msg)
            db.commit()

        # Kembalikan response tipe stream
        return StreamingResponse(generate_and_save(), media_type="text/plain")

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))