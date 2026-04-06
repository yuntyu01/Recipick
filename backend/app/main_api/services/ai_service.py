import os
from typing import Optional
import json
from decimal import Decimal


def _decimal_to_num(v):
    if isinstance(v, Decimal):
        return int(v) if v % 1 == 0 else float(v)
    return v

from fastapi import HTTPException
from google import genai
from google.genai import types

from app.shared.config import settings
from app.shared.repositories import recipe_repo, rate_limit_repo

# ── 추천 질문 정의 ────────────────────────────────────────────

RECOMMEND_QUESTIONS = [
    {
        "id": "category",
        "question": "어떤 게 당겨?",
        "multi_select": True,
        "choices": [
            {"key": "any",    "label": "상관없음"},   # 프론트: 한 줄 풀폭, 선택 시 나머지 해제
            {"key": "한식",   "label": "한식 🍚"},
            {"key": "중식",   "label": "중식 🥢"},
            {"key": "일식",   "label": "일식 🍣"},
            {"key": "양식",   "label": "양식 🍝"},
            {"key": "분식",   "label": "분식 🍢"},
            {"key": "디저트", "label": "디저트 🍰"},
        ],
    },
    {
        "id": "situation",
        "question": "지금 어떤 상황이야?",
        "multi_select": True,
        "choices": [
            {"key": "workout",  "label": "운동 중 💪"},
            {"key": "diet",     "label": "다이어트 중 🥗"},
            {"key": "broke",    "label": "그지임 🪙"},
            {"key": "stress",   "label": "스트레스 폭발 😤"},
        ],
    },
    {
        "id": "effort",
        "question": "요리 얼마나 공들여?",
        "choices": [
            {"key": "very_lazy",  "label": "극귀찮음 😴"},
            {"key": "lazy",       "label": "좀 귀찮음 🥱"},
            {"key": "normal",     "label": "보통 🙂"},
            {"key": "passionate", "label": "열정 있음 🔥"},
        ],
    },
    {
        "id": "servings",
        "question": "몇 인분?",
        "choices": [
            {"key": "one",  "label": "1인분 🧍"},
            {"key": "two",  "label": "2인분 👫"},
            {"key": "few",  "label": "3~4인분 👨‍👩‍👦"},
            {"key": "many", "label": "5인분+ 🍱"},
        ],
    },
]

# choice key → Gemini 프롬프트용 설명
_SITUATION_DESC = {
    "workout": "운동 중 (고단백, 영양가 있는 음식 필요)",
    "diet":    "다이어트 중 (저칼로리, 담백한 음식 선호)",
    "broke":   "예산이 없음 (저렴한 재료로 만들 수 있는 음식)",
    "stress":  "스트레스 받음 (기름지거나 달달하거나 위로가 되는 음식)",
}
_EFFORT_DESC = {
    "very_lazy":  "극도로 귀찮음 (재료 2~3가지, 5분 이내)",
    "lazy":       "조금 귀찮음 (간단한 조리, 10분 이내)",
    "normal":     "보통 (일반적인 가정 요리)",
    "passionate": "열정 있음 (복잡해도 OK, 시간 상관없음)",
}
_SERVINGS_DESC = {
    "one":  "1인분",
    "two":  "2인분",
    "few":  "3~4인분",
    "many": "5인분 이상",
}


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


# ── 레시피 추천 ────────────────────────────────────────────────

def get_recommend_questions() -> dict:
    return {"questions": RECOMMEND_QUESTIONS}


_RECOMMEND_SCHEMA = {
    "type": "object",
    "properties": {
        "recipe_video_ids": {
            "type": "array",
            "items": {"type": "string"},
        },
        "suggestions": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["recipe_video_ids", "suggestions"],
}


def recommend_recipes(user_id: str, answers: dict) -> dict:
    # 한도 초과 여부만 먼저 확인 (카운트는 아직 올리지 않음)
    current = rate_limit_repo.get_daily_ai_count(user_id=user_id)
    if current >= settings.AI_DAILY_LIMIT:
        raise HTTPException(status_code=429, detail="오늘 추천 횟수를 초과했습니다.")

    # 사용자 상황 텍스트 조합 (situation은 다중 선택 가능)
    raw_situation = answers.get("situation", "")
    if isinstance(raw_situation, list):
        situation = ", ".join(_SITUATION_DESC.get(s, s) for s in raw_situation)
    else:
        situation = _SITUATION_DESC.get(raw_situation, raw_situation)

    effort   = _EFFORT_DESC.get(answers.get("effort", ""),   answers.get("effort", ""))
    servings = _SERVINGS_DESC.get(answers.get("servings", ""), answers.get("servings", ""))

    # DB 레시피 풀 수집
    # category 답변은 str("any") 또는 list[str](["한식","중식"]) 둘 다 가능
    raw_category = answers.get("category", "any")
    if isinstance(raw_category, str):
        raw_category = [raw_category]

    if "any" in raw_category:
        # 상관없음 → 전체 카테고리, 카테고리당 20개
        pool = recipe_repo.get_recipe_pool_for_recommendation(per_category=20)
    else:
        # 선택한 카테고리만, 카테고리당 더 많이 뽑아 총량 유지
        per_cat = max(20, 120 // len(raw_category))
        pool = recipe_repo.get_recipe_pool_for_recommendation(
            per_category=per_cat, categories=raw_category
        )

    pool_summary = [
        {
            "video_id":              r["video_id"],
            "title":                 r["title"],
            "category":              r["category"],
            "difficulty":            r.get("difficulty") or "",
            "total_calorie":         _decimal_to_num(r.get("total_calorie")),
            "total_estimated_price": _decimal_to_num(r.get("total_estimated_price")),
            "protein_g":             _decimal_to_num(r.get("protein_g")),
            "servings":              _decimal_to_num(r.get("servings")),
        }
        for r in pool
    ]

    prompt = f"""너는 레시피 추천 전문가야. 아래 사용자 상황과 레시피 목록을 보고 추천해줘.

[사용자 상황]
- 상황: {situation}
- 요리 공력: {effort}
- 인원: {servings}

[레시피 목록 (JSON)]
{json.dumps(pool_summary, ensure_ascii=False)}

[지시사항]
1. recipe_video_ids: 위 목록 중 이 사람에게 가장 잘 맞는 video_id를 최대 20개 골라줘. 없으면 빈 배열.
   - 반드시 서로 다른 종류의 요리를 선택해. 같은 요리가 여러 채널에 있어도 한 번만 골라.
2. suggestions: DB에 없어도 되는 자유 메뉴 이름을 이 사람 상황에 맞게 최대 20개 제안해줘. 메뉴 이름만, 이유 없이. 중복 없이.

JSON만 반환해."""

    api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY", "")
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=settings.GEMINI_CHAT_MODEL,
        contents=types.Content(parts=[types.Part(text=prompt)]),
        config={
            "response_mime_type": "application/json",
            "response_schema": _RECOMMEND_SCHEMA,
        },
    )

    result = json.loads(response.text)

    # Gemini 성공 후 카운트 증가
    rate = rate_limit_repo.increment_daily_ai_count(user_id=user_id, limit=settings.AI_DAILY_LIMIT)

    # video_id → 레시피 카드 조합
    pool_map = {r["video_id"]: r for r in pool}
    recipes = []
    for vid in result.get("recipe_video_ids", []):
        r = pool_map.get(vid)
        if r:
            recipes.append({
                "video_id":      r["video_id"],
                "title":         r["title"],
                "channel_name":  r["channel_name"],
                "thumbnail_url": r["thumbnail_url"],
                "url":           r["url"],
            })

    return {
        "recipes":       recipes,
        "suggestions":   result.get("suggestions", []),
        "ai_ask_count":  rate["ai_ask_count"],
        "ai_ask_limit":  settings.AI_DAILY_LIMIT,
        "ttl_expire_at": rate["ttl_expire_at"],
    }
