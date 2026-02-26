from pydantic import BaseModel
from typing import List, Optional

class SourceSchema(BaseModel):
    page: str

class ChatRequest(BaseModel):
    session_id: str = "default_session" # Test kolaylığı için varsayılan bir değer atadık
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[SourceSchema]