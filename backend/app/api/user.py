from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.models import User, Course, Event
from app.schemas.schemas import UserProfileUpdate, UserOut, CourseIn, CourseOut, EventIn, EventOut
import fitz
import re

router = APIRouter(prefix="/api/user", tags=["user"])


# --- Profile ---
@router.get("/me", response_model=UserOut)
async def get_me(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
    return user


@router.patch("/me", response_model=UserOut)
async def update_profile(
    data: UserProfileUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


# --- Courses ---
@router.get("/courses", response_model=list[CourseOut])
async def list_courses(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Course).where(Course.user_id == user_id))
    return result.scalars().all()


@router.post("/courses", response_model=CourseOut, status_code=201)
async def add_course(
    data: CourseIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    course = Course(user_id=user_id, **data.model_dump())
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


@router.delete("/courses/{course_id}", status_code=204)
async def delete_course(
    course_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.user_id == user_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Ders bulunamadı.")
    await db.delete(course)
    await db.commit()


# --- Transcript parse + bulk save ---
@router.post("/courses/upload-transcript", status_code=201)
async def upload_transcript(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Transkript parse + DB'ye kaydet.
    Frontend FormData ile 'file' alanında PDF gönderir.
    """
    from fastapi import UploadFile, File
    # Bu endpoint'i ayrı olarak çağırıyoruz — bak: /api/user/courses/parse-transcript
    pass


@router.post("/courses/parse-and-save")
async def parse_and_save_transcript(
    file_bytes: bytes,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    from transcript_parser import TranscriptParser  # Mevcut parser'ı kullan
    parsed = TranscriptParser.parse_pdf(file_bytes)

    saved = []
    for sem in parsed.get("semesters", []):
        for c in sem.get("courses", []):
            parts = c["name"].split(" - ", 1)
            code = parts[0].strip() if parts else "?"
            name = parts[1].strip() if len(parts) > 1 else c["name"]
            course = Course(
                user_id=user_id,
                course_code=code,
                course_name=name,
                credits=c["credits"],
                grade=c["grade"],
                semester=sem["semester_name"],
                source="transcript",
            )
            db.add(course)
            saved.append(course)
    await db.commit()
    return {"saved": len(saved)}


# --- Events ---
@router.get("/events", response_model=list[EventOut])
async def list_events(user_id: str = Depends(get_current_user_id), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).where(Event.user_id == user_id).order_by(Event.event_date))
    return result.scalars().all()


@router.post("/events", response_model=EventOut, status_code=201)
async def add_event(
    data: EventIn,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    event = Event(user_id=user_id, **data.model_dump())
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(
    event_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event).where(Event.id == event_id, Event.user_id == user_id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Etkinlik bulunamadı.")
    await db.delete(event)
    await db.commit()