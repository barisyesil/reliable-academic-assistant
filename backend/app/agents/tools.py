import re
from langchain.tools import tool


def make_agent_tools(vector_store, user_data: dict) -> tuple[list, list]:
    """
    Kullanıcıya özel, kısa docstring'li tool seti üretir.
    Kısa docstring'ler LLM'in tool call formatını karıştırmasını önler.
    """
    request_sources: list[dict] = []

    @tool
    def search_regulations(search_query: str) -> str:
        """ESTÜ yönetmelik ve akademik belgelerinde arama yapar."""
        print(f"  [TOOL] search_regulations → '{search_query}'")

        docs = vector_store.max_marginal_relevance_search(
            search_query, k=4, fetch_k=20, lambda_mult=0.7
        )
        if not docs:
            return "Bu konu için veritabanında ilgili belge bulunamadı."

        parts = []
        for doc in docs:
            meta_match = re.match(r"(KATEGORİ:.*?\| BELGE:.*?\| SAYFA:.*?\n\n)", doc.page_content)
            clean = doc.page_content
            if meta_match:
                clean = doc.page_content.replace(meta_match.group(1), "").strip()

            request_sources.append({
                "page": str(doc.metadata.get("page", "1")),
                "content": clean[:400] + "...",
                "category": str(doc.metadata.get("category", "genel")),
                "document_name": str(doc.metadata.get("document_name", "Bilinmiyor")),
            })
            parts.append(f"Belge: {doc.metadata.get('document_name')}\nİçerik:\n{clean[:800]}")

        return "\n\n---\n\n".join(parts)

    @tool
    def get_user_grades(query: str) -> str:
        """Öğrencinin GPA, AKTS ve ders listesini döndürür."""
        print(f"  [TOOL] get_user_grades → '{query}'")
        if not user_data["has_courses"]:
            return "Sisteme kayıtlı ders bulunamadı. GPA hesaplanamıyor."
        return user_data["gpa_summary"]

    @tool
    def get_calendar_events(timeframe: str) -> str:
        """Öğrencinin yaklaşan takvim etkinliklerini döndürür."""
        print(f"  [TOOL] get_calendar_events → '{timeframe}'")
        return user_data["events_summary"]

    @tool
    def calculate_academic_status(gpa_and_requirement: str) -> str:
        """Mevcut GPA ile minimum şartı karşılaştırır. Format: 'mevcut_gpa,gerekli_gpa'"""
        print(f"  [TOOL] calculate_academic_status → '{gpa_and_requirement}'")
        try:
            parts_list = [p.strip() for p in gpa_and_requirement.replace(" ", ",").split(",")]
            nums = [float(p) for p in parts_list if p]
            if len(nums) < 2:
                current = user_data.get("gpa", 0.0)
                required = nums[0] if nums else 2.0
            else:
                current, required = nums[0], nums[1]

            diff = round(abs(current - required), 2)
            if current >= required:
                return f"UYGUN: GPA {current} >= {required} şartını karşılıyor ({diff} puan fazla)."
            else:
                return f"UYGUN DEĞİL: GPA {current} < {required} şartı ({diff} puan eksik)."
        except Exception:
            return f"Hesaplama yapılamadı. Girdi: '{gpa_and_requirement}'"

    return (
        [search_regulations, get_user_grades, get_calendar_events, calculate_academic_status],
        request_sources,
    )