from pydantic import BaseModel
from typing import List

class SourceSchema(BaseModel):
    page: str
    content: str  # Bu satır çok kritik!

class ChatRequest(BaseModel):
    session_id: str = "default_session"
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceSchema]