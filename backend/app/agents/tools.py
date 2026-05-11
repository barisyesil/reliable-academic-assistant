import re
from langchain.tools import tool

# Confidence threshold for BGE-M3 (0.0 to 1.0)
SCORE_THRESHOLD = 0.40 

def make_agent_tools(vector_store, user_data: dict) -> tuple[list, list]:
    request_sources: list[dict] = []

    @tool
    def search_regulations(search_query: str) -> str:
        """Searches through ESTÜ regulations and official academic documents."""
        print(f"  [TOOL] search_regulations → '{search_query}'")

        # Similarity search with relevance scores
        docs_with_scores = vector_store.similarity_search_with_relevance_scores(
            search_query, 
            k=4 
        )

        # Filter sources based on threshold
        relevant_docs = [
            (doc, score) for doc, score in docs_with_scores 
            if score >= SCORE_THRESHOLD
        ]

        if not relevant_docs:
            return "No documents with sufficient reliability were found in the ESTÜ regulations for this query."

        print(f"  [RAG] {len(relevant_docs)} relevant sources found (Threshold: {SCORE_THRESHOLD})")

        parts = []
        for doc, score in relevant_docs:
            # Metadata cleanup
            meta_match = re.match(r"(KATEGORİ:.*?\| BELGE:.*?\| SAYFA:.*?\n\n)", doc.page_content)
            clean = doc.page_content
            if meta_match:
                clean = doc.page_content.replace(meta_match.group(1), "").strip()

            # Prepare for frontend (request_sources remains structured)
            request_sources.append({
                "page": str(doc.metadata.get("page", "1")),
                "content": clean[:400] + "...",
                "category": str(doc.metadata.get("category", "general")),
                "document_name": str(doc.metadata.get("document_name", "Unknown")),
                "relevance_score": round(float(score), 2)
            })
            # --- TERMİNALE BAS ---
            print("\n" + "="*50)
            print(f"🔍 RAG KAYNAK İÇERİĞİ ({int(score*100)}% Alakalı)")
            print(f"DOSYA: {doc.metadata.get('document_name')}")
            print("-" * 20)
            print(clean[:1500]) # Modelin okuduğu 1500 karakterin aynısı
            print("="*50 + "\n")
            # ---------------------
            # Formatted string for the LLM to process
            parts.append(f"Document: {doc.metadata.get('document_name')} (Confidence: {int(score*100)}%)\nContent:\n{clean[:1500]}")

        return "\n\n---\n\n".join(parts)

    @tool
    def get_user_grades(query: str) -> str:
        """Returns the student's GPA, ECTS credits, and complete course list."""
        print(f"  [TOOL] get_user_grades → '{query}'")
        if not user_data["has_courses"]:
            return "No registered courses found for this user. GPA cannot be calculated."
        return user_data["gpa_summary"]

    @tool
    def get_calendar_events(timeframe: str) -> str:
        """Returns the student's upcoming academic calendar events and exams."""
        print(f"  [TOOL] get_calendar_events → '{timeframe}'")
        return user_data["events_summary"]

    @tool
    def calculate_academic_status(gpa_and_requirement: str) -> str:
        """Compares current GPA with a minimum requirement. Format: 'current_gpa,required_gpa'"""
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
                return f"ELIGIBLE: Current GPA {current} meets the {required} requirement ({diff} points above)."
            else:
                return f"NOT ELIGIBLE: Current GPA {current} is below the {required} requirement ({diff} points short)."
        except Exception:
            return f"Calculation failed. Please check input format: '{gpa_and_requirement}'"

    return (
        [search_regulations, get_user_grades, get_calendar_events, calculate_academic_status],
        request_sources,
    )