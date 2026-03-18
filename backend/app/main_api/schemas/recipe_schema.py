from pydantic import BaseModel
from typing import Optional
from app.shared.models.recipe_model import RecipeStatus

class RecipeRequest(BaseModel):
    video_id: str
    original_url: str
    sharer_nickname: str
    # 프론트엔드에서 못 받아오면 임시값을 쓰도록 기본값 세팅
    title: str = "레시피 분석 준비 중..." 
    channel_name: str = "알 수 없음"

class RecipeResponse(BaseModel):
    status: RecipeStatus
    video_id: str
    thumbnail_url: str
    title: str
    channel_name: str
    data: Optional[dict] = None


class RecipeCommentCreateRequest(BaseModel):
    content: str
    like_count: int = 0


class RecipeCommentResponse(BaseModel):
    comment_id: str
    video_id: str
    user_id: str
    nickname: str
    is_anonymous: bool = False
    anonymous_number: Optional[int] = None
    content: str
    like_count: int
    created_at: str


class RecipeCommentUpdateRequest(BaseModel):
    comment_id: str
    content: str


class RecipeCommentDeleteRequest(BaseModel):
    comment_id: str


class RecipeActionResponse(BaseModel):
    success: bool
    action: str
    video_id: str
    user_id: str
    created_at: Optional[str] = None
    already_exists: bool = False


class RecipeRecommendationResponse(BaseModel):
    video_id: str
    title: str
    channel_name: str
    thumbnail_url: str
    url: str
    category: str
