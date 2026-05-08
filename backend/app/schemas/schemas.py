from pydantic import BaseModel, EmailStr
from typing import Any


# --- Auth ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    student_id: str | None = None
    department: str | None = None
    year_of_study: int | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: dict


# --- User ---
class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    student_id: str | None = None
    department: str | None = None
    year_of_study: int | None = None


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    student_id: str | None
    department: str | None
    year_of_study: int | None

    class Config:
        from_attributes = True


# --- Chat ---
class ChatRequest(BaseModel):
    conversation_id: str | None = None
    query: str


class SourceSchema(BaseModel):
    page: str
    content: str
    category: str = "genel"
    document_name: str = "Bilinmiyor"


class ChatResponse(BaseModel):
    answer: str
    sources: list[SourceSchema]
    conversation_id: str


# --- Courses ---
class CourseIn(BaseModel):
    course_code: str
    course_name: str
    credits: float
    grade: str
    semester: str
    source: str = "manual"


class CourseOut(CourseIn):
    id: str

    class Config:
        from_attributes = True


# --- Events ---
class EventIn(BaseModel):
    title: str
    color_category: str = "red"
    event_date: str  # "YYYY-MM-DD"
    event_time: str | None = None


class EventOut(EventIn):
    id: str

    class Config:
        from_attributes = True


# --- Conversations ---
class ConversationOut(BaseModel):
    id: str
    title: str
    last_message_at: str

    class Config:
        from_attributes = True


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    sources: list[Any] | None
    created_at: str

    class Config:
        from_attributes = True