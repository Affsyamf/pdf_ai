# backend/models/chat_model.py
from sqlalchemy import Column, Integer, String, Text, DateTime
from datetime import datetime
from database import Base

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True)  # Untuk menandai sesi user
    role = Column(String)  # 'user' atau 'bot'
    text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)