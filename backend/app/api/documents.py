import os
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from fastapi import UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user_id

router = APIRouter(prefix="/api", tags=["documents"])


@router.get("/document/{category}/{filename}")
async def get_document(category: str, filename: str):
    paths = [
        os.path.join("data", category, filename),
        os.path.join("data", filename),
    ]
    for path in paths:
        if os.path.exists(path):
            return FileResponse(path)
    raise HTTPException(status_code=404, detail="Belge bulunamadı.")


@router.post("/parse-transcript")
async def parse_transcript(
    file: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Transkript PDF'ini parse eder ve kullanıcının derslerini DB'ye kaydeder."""
    from app.models.models import Course
    from sqlalchemy import select
    import re

    content = await file.read()

    # Mevcut transcript_parser mantığı (fitz ile)
    import fitz
    doc = fitz.open(stream=content, filetype="pdf")
    full_text = ""
    for page in doc:
        full_text += page.get_text("text") + "\n"

    semester_matches = list(re.finditer(
        r"(20\d{2}-20\d{2})\s*(Güz|Bahar|Yaz)\s*Dönemi", full_text, re.IGNORECASE
    ))
    semesters_data = []

    for i, match in enumerate(semester_matches):
        semester_name = f"{match.group(1)} {match.group(2).capitalize()} Dönemi"
        start_idx = match.end()
        end_idx = semester_matches[i + 1].start() if i + 1 < len(semester_matches) else len(full_text)
        semester_text = full_text[start_idx:end_idx]

        courses = []
        course_pattern = r"\b([A-ZÇŞĞÜÖİ][A-ZÇŞĞÜÖİ\s]{1,4}\d{3,4})\b"
        course_matches = list(re.finditer(course_pattern, semester_text))

        for j, cmatch in enumerate(course_matches):
            course_code = cmatch.group(1).replace("\n", "").strip()
            if len(course_code) < 5:
                continue
            c_start = cmatch.end()
            c_end = course_matches[j + 1].start() if j + 1 < len(course_matches) else len(semester_text)
            chunk = semester_text[c_start:c_end]

            grade_match = re.search(r"\b(AA|AB|BA|BB|BC|CB|CC|CD|DC|DD|FD|FF|S|U|DZ|YZ)\b", chunk)
            grade = grade_match.group(1) if grade_match else "BB"
            credits = 3.0
            for f_str in re.findall(r"\b\d+\.\d+\b", chunk):
                if len(f_str.split(".")[1]) == 1:
                    credits = float(f_str)
                    break

            clean_chunk = re.sub(r"\b(AA|AB|BA|BB|BC|CB|CC|CD|DC|DD|FD|FF|S|U|DZ|YZ)\b", "", chunk)
            clean_chunk = re.sub(r"\b\d+\.\d+\b", "", clean_chunk)
            clean_chunk = re.sub(r"\b[ZSM]\b", "", clean_chunk)
            course_name = re.sub(r"\s+", " ", clean_chunk.replace("|", "").replace("\n", " ")).strip()
            if len(course_name) > 65:
                course_name = course_name[:65].strip() + "..."

            courses.append({
                "code": course_code,
                "name": course_name,
                "credits": credits,
                "grade": grade,
            })

        if courses:
            semesters_data.append({"semester_name": semester_name, "courses": courses})

    # DB'ye kaydet
    from sqlalchemy import delete
    await db.execute(
        delete(Course).where(Course.user_id == user_id, Course.source == "transcript")
    )
    saved = 0
    for sem in semesters_data:
        for c in sem["courses"]:
            db.add(Course(
                user_id=user_id,
                course_code=c["code"],
                course_name=c["name"],
                credits=c["credits"],
                grade=c["grade"],
                semester=sem["semester_name"],
                source="transcript",
            ))
            saved += 1
    await db.commit()

    return {
        "semesters": semesters_data,
        "saved_to_db": saved,
        "raw_text": full_text[:500],
    }