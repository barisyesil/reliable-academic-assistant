from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.models import Conversation, Message
from app.schemas.schemas import ChatRequest, ChatResponse, SourceSchema
from app.services.rag_service import get_vector_store
from app.services.db_service import get_user_academic_summary
from app.agents.tools import make_agent_tools
from app.agents.academic_agent import build_agent, build_messages

router = APIRouter(prefix="/api/chat", tags=["chat"])

# In-memory LLM instance (lifespan'da set edilir)
_llm = None


def set_llm(llm):
    global _llm
    _llm = llm


@router.post("", response_model=ChatResponse)
async def chat_endpoint(
    request: ChatRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    if _llm is None:
        raise HTTPException(status_code=503, detail="AI motoru henüz hazır değil.")

    # 1. Conversation bul veya oluştur
    conv_id = request.conversation_id
    if conv_id:
        result = await db.execute(
            select(Conversation).where(
                Conversation.id == conv_id,
                Conversation.user_id == user_id,
            )
        )
        conv = result.scalar_one_or_none()
        if not conv:
            raise HTTPException(status_code=404, detail="Sohbet bulunamadı.")
    else:
        conv = Conversation(user_id=user_id)
        db.add(conv)
        await db.flush()

    # 2. Son 6 mesajı yükle (3 tur)
    msgs_result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv.id)
        .order_by(Message.created_at.desc())
        .limit(6)
    )
    raw_msgs = list(reversed(msgs_result.scalars().all()))

    # Mesajları (user, assistant) çiftlerine dönüştür
    history_pairs: list[tuple[str, str]] = []
    for i in range(0, len(raw_msgs) - 1, 2):
        if raw_msgs[i].role == "user" and raw_msgs[i + 1].role == "assistant":
            history_pairs.append((raw_msgs[i].content, raw_msgs[i + 1].content))

    # 3. Kullanıcı akademik verisini çek (agent tools için)
    user_data = await get_user_academic_summary(user_id, db)

    # 4. Tools + Agent kur
    tools, sources_collector = make_agent_tools(get_vector_store(), user_data)
    agent = build_agent(_llm, tools)

    # 5. Agent çalıştır
    # 5. Agent çalıştır
    try:
        # LangGraph mesaj listesiyle çalışır
        input_messages = build_messages(request.query, history_pairs)
        
        # Ajanı invoke et
        result = agent.invoke({"messages": input_messages})
        
        # Sonuç listesindeki en son mesaj ajanın cevabıdır
        final_message = result["messages"][-1]
        ai_answer = final_message.content
        
    except Exception as e:
        print(f"[LANGGRAPH HATA] {e}")
        raise HTTPException(status_code=500, detail="Ajan yanıt oluştururken bir sorunla karşılaştı.")
    # 6. Mesajları kaydet
    user_msg = Message(conversation_id=conv.id, role="user", content=request.query)
    ai_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=ai_answer,
        sources=sources_collector if sources_collector else None,
    )
    db.add_all([user_msg, ai_msg])
    conv.last_message_at = datetime.now(timezone.utc)

    # Sohbet başlığını ilk mesajdan türet
    if conv.title == "Yeni Sohbet":
        conv.title = request.query[:60]

    await db.commit()

    # 7. Kaynakları deduplicate et
    unique: dict[str, SourceSchema] = {}
    for src in sources_collector:
        key = src["document_name"] + src["page"]
        if key not in unique:
            unique[key] = SourceSchema(**src)

    return ChatResponse(
        answer=ai_answer,
        sources=list(unique.values()),
        conversation_id=conv.id,
    )


@router.get("/conversations")
async def list_conversations(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user_id)
        .order_by(Conversation.last_message_at.desc())
        .limit(30)
    )
    convs = result.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "last_message_at": c.last_message_at.isoformat(),
        }
        for c in convs
    ]


@router.get("/conversations/{conv_id}/messages")
async def get_messages(
    conv_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == user_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı.")

    msgs = await db.execute(
        select(Message)
        .where(Message.conversation_id == conv_id)
        .order_by(Message.created_at)
    )
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": m.sources,
            "created_at": m.created_at.isoformat(),
        }
        for m in msgs.scalars().all()
    ]


@router.delete("/conversations/{conv_id}", status_code=204)
async def delete_conversation(
    conv_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.user_id == user_id,
        )
    )
    conv = result.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı.")
    await db.delete(conv)
    await db.commit()