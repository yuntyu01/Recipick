from pydantic import BaseModel
from typing import Optional


class AiAskRequest(BaseModel):
    video_id: str
    question: str
    current_step: Optional[int] = None


class AiAskResponse(BaseModel):
    answer: str
    ai_ask_count: int
    ai_ask_limit: int
    ttl_expire_at: int
