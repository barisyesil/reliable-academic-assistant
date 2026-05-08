from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
from app.models.models import Course, Event

GRADE_POINTS = {
    "AA": 4.0, "AB": 3.7, "BA": 3.3, "BB": 3.0,
    "BC": 2.7, "CB": 2.3, "CC": 2.0, "CD": 1.7,
    "DC": 1.3, "DD": 1.0, "FD": 0.5, "FF": 0.0,
    "S": None, "U": None, "DZ": None, "YZ": None,
}


async def get_user_academic_summary(user_id: str, db: AsyncSession) -> dict:
    """
    Agent araçlarına senkron olarak geçirilmek üzere kullanıcının
    akademik verilerini önceden toplu çeker.
    """
    # Dersler
    result = await db.execute(select(Course).where(Course.user_id == user_id))
    courses = result.scalars().all()

    total_points, total_credits = 0.0, 0.0
    graded_courses = []
    for c in courses:
        pts = GRADE_POINTS.get(c.grade)
        if pts is not None:
            total_points += pts * c.credits
            total_credits += c.credits
            graded_courses.append(c)

    gpa = round(total_points / total_credits, 2) if total_credits else 0.0

    course_lines = "\n".join(
        f"  - {c.course_code} | {c.course_name} | {c.grade} | {c.credits} AKTS | {c.semester}"
        for c in courses[-20:]  # Son 20 ders
    )

    # Etkinlikler
    today = date.today()
    end = today + timedelta(days=30)
    ev_result = await db.execute(
        select(Event).where(
            Event.user_id == user_id,
            Event.event_date >= str(today),
            Event.event_date <= str(end),
        ).order_by(Event.event_date)
    )
    events = ev_result.scalars().all()
    event_lines = "\n".join(
        f"  - {e.event_date} {e.event_time or ''}: {e.title}"
        for e in events
    ) or "Önümüzdeki 30 günde takvimde etkinlik yok."

    return {
        "gpa": gpa,
        "total_credits": total_credits,
        "gpa_summary": (
            f"Kullanıcının Kümülatif GPA'sı: {gpa}\n"
            f"Tamamlanan AKTS: {total_credits}\n"
            f"Ders listesi (son 20):\n{course_lines or '  (Henüz ders eklenmemiş)'}"
        ),
        "events_summary": f"Yaklaşan etkinlikler:\n{event_lines}",
        "has_courses": len(courses) > 0,
    }