from pydantic import BaseModel
from typing import Optional, Union


class AiAskRequest(BaseModel):
    video_id: str
    question: str
    current_step: Optional[int] = None


class AiAskResponse(BaseModel):
    answer: str
    ai_ask_count: int
    ai_ask_limit: int
    ttl_expire_at: int


# ── 레시피 추천 ──────────────────────────────────────────────

class RecommendChoice(BaseModel):
    key: str
    label: str


class RecommendQuestion(BaseModel):
    id: str
    question: str
    multi_select: bool = False   # True면 다중 선택 허용
    choices: list[RecommendChoice]


class RecommendQuestionsResponse(BaseModel):
    questions: list[RecommendQuestion]


class RecommendRequest(BaseModel):
    # 단일 선택: str / 다중 선택: list[str]
    answers: dict[str, Union[str, list[str]]]


class RecommendRecipe(BaseModel):
    video_id: str
    title: str
    channel_name: str
    thumbnail_url: str
    url: str


class RecommendResponse(BaseModel):
    recipes: list[RecommendRecipe]        # DB 레시피 (최대 9개, 프론트서 3개 랜덤)
    suggestions: list[str]               # 텍스트 메뉴 이름 (최대 9개, 프론트서 3개 랜덤)
    ai_ask_count: int
    ai_ask_limit: int
    ttl_expire_at: int
