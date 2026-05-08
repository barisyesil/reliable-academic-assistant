import re
from langchain.tools import tool
from langchain_chroma import Chroma


def make_agent_tools(vector_store: Chroma, user_data: dict) -> list:
    """
    Her istek için kullanıcıya özel tool seti üretir.
    user_data = db_service.get_user_academic_summary() çıktısı.
    Araçlar senkron çalışır; async veri önceden çekilip closure'a gömülür.
    """

    request_sources: list[dict] = []  # Chat endpoint tarafından okunacak

    @tool
    def search_regulations(search_query: str) -> str:
        """Eskişehir Teknik Üniversitesi (ESTÜ) veritabanında, yönetmeliklerinde ve akademik belgelerinde arama yapar.
        Staj yapma yerleri, kabul edilen kurumlar, yönetmelik, kural, staj şartı, sınav hakkı, ders geçme, not sistemi gibi TÜM üniversite sorularında ARAMA MOTORU OLARAK SADECE BU ARACI KULLAN."""
        print(f"  [TOOL] search_regulations → '{search_query}'")

        docs = vector_store.max_marginal_relevance_search(
            search_query, k=4, fetch_k=20, lambda_mult=0.7
        )
        if not docs:
            return "Bu sorgu için veritabanında ilgili bir yönetmelik veya belge bulunamadı."

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
        """Kullanıcının not ortalamasını (GPA), tamamladığı AKTS ve ders geçmişini döndürür.
        'Staj yapabilir miyim', 'ortalaması yeterli mi', 'burs alabilir mi' gibi sorularda kullan."""
        print(f"  [TOOL] get_user_grades → '{query}'")
        if not user_data["has_courses"]:
            return "Kullanıcının henüz sisteme kayıtlı dersi bulunmuyor. GPA hesaplanamıyor."
        return user_data["gpa_summary"]

    @tool
    def get_calendar_events(timeframe: str) -> str:
        """Kullanıcının önümüzdeki 30 günlük takvim etkinliklerini getirir.
        Yaklaşan sınavlar, ödev tarihleri, başvuru deadlinelari için kullan."""
        print(f"  [TOOL] get_calendar_events → '{timeframe}'")
        return user_data["events_summary"]

    @tool
    def calculate_academic_status(gpa_and_requirement: str) -> str:
        """İki sayıyı (mevcut GPA ve gerekli minimum GPA) karşılaştırarak uygunluk kararı verir.
        Format: 'mevcut_gpa,gerekli_gpa' — Örn: '2.85,2.50'"""
        print(f"  [TOOL] calculate_academic_status → '{gpa_and_requirement}'")
        try:
            parts = [p.strip() for p in gpa_and_requirement.replace(" ", ",").split(",")]
            nums = [float(p) for p in parts if p]
            if len(nums) < 2:
                current = user_data["gpa"]
                required = nums[0] if nums else 2.0
            else:
                current, required = nums[0], nums[1]

            diff = round(abs(current - required), 2)
            if current >= required:
                return (
                    f"✓ UYGUN: Mevcut GPA ({current}) minimum şartı ({required}) "
                    f"karşılıyor. {diff} puan fazlası var."
                )
            else:
                return (
                    f"✗ UYGUN DEĞİL: Mevcut GPA ({current}), minimum şartı ({required}) "
                    f"karşılamıyor. {diff} puan eksik."
                )
        except Exception:
            return f"Hesaplama yapılamadı. Girdi: '{gpa_and_requirement}'"

    return [search_regulations, get_user_grades, get_calendar_events, calculate_academic_status], request_sources