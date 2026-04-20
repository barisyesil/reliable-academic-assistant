from pydantic import BaseModel
from typing import List

class SourceSchema(BaseModel):
    page: str
    content: str
    category: str = "genel"
    document_name: str = "Bilinmiyor"

class ChatRequest(BaseModel):
    session_id: str = "default_session"
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceSchema]