from pydantic import BaseModel
from typing import List, Optional

class MessageItem(BaseModel):
    role: str
    text: str

class ChatRequest(BaseModel):
    session_id: str
    message: str
    file_context: Optional[str] = None