import os
from typing import Optional
import json
from decimal import Decimal

from fastapi import HTTPException
from google import genai
from google.genai import types

from app.shared.config import settings
from app.shared.repositories import recipe_repo, rate_limit_repo


SYSTEM_PROMPT = (
    "너는 친절한 주방 AI 비서야. 무조건 요리와 관련된 질문에만 짧고 간결하게 대답해. "
    "요리와 상관없는 질문(주식, 코딩 등)에는 '요리 관련 질문만 도와드릴 수 있어요'라고 딱 한 줄로만 대답해."
)


def _build_context(recipe: dict, current_step: Optional[int]) -> str:
    """레시피 컨텍스트 구성"""
    def _jsonable(value):
        if isinstance(value, Decimal):
            return int(value) if value % 1 == 0 else float(value)
        if isinstance(value, list):
            return [_jsonable(v) for v in value]
        if isinstance(value, dict):
            return {k: _jsonable(v) for k, v in value.items()}
        return value

    # 요리와 무관한 소셜 수치 제거 후 전체 JSON 직렬화
    context_recipe = dict(recipe or {})
    for key in ("comment_count", "like_count", "share_count"):
        context_recipe.pop(key, None)

    # 현재 단계 힌트 추가
    step_hint = ""
    if current_step is not None and isinstance(current_step, int):
        step_hint = f"current_step: {current_step}"

    recipe_json = json.dumps(_jsonable(context_recipe), ensure_ascii=False)
    if step_hint:
        return f"{step_hint}\nrecipe: {recipe_json}"
    return f"recipe: {recipe_json}"


def ask_ai(user_id: str, video_id: str, question: str, current_step: Optional[int] = None) -> dict:
    """AI 질문 처리"""
    if not question or not question.strip():
        raise HTTPException(status_code=400, detail="질문이 비어 있습니다.")

    recipe = recipe_repo.get_recipe(video_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="레시피를 찾을 수 없습니다.")

    context = _build_context(recipe, current_step)

    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")

    client = genai.Client(api_key=api_key)
    model = settings.GEMINI_CHAT_MODEL

    user_prompt = f"Context:\n{context}\n\nUser: {question.strip()}"

    response = client.models.generate_content(
        model=model,
        contents=types.Content(
            parts=[
                types.Part(text=f"System: {SYSTEM_PROMPT}"),
                types.Part(text=user_prompt),
            ]
        ),
        config={"response_mime_type": "text/plain"},
    )

    answer = (response.text or "").strip() or "요리 관련 질문만 도와드릴 수 있어요"

    # 성공 응답 이후에만 레이트리밋 카운트 증가
    rate = rate_limit_repo.increment_daily_ai_count(user_id=user_id, limit=settings.AI_DAILY_LIMIT)
    if not rate["allowed"]:
        raise HTTPException(status_code=429, detail="오늘 질문 횟수를 초과했습니다.")

    return {
        "answer": answer,
        "ai_ask_count": rate["ai_ask_count"],
        "ai_ask_limit": settings.AI_DAILY_LIMIT,
        "ttl_expire_at": rate["ttl_expire_at"],
    }
