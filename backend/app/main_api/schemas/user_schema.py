from pydantic import BaseModel
from typing import Optional
from app.shared.models.recipe_model import RecipeStatus


class UserProfileUpsertRequest(BaseModel):
    nickname: str
    profile_image: Optional[str] = None


class UserProfileResponse(BaseModel):
    user_id: str
    nickname: str
    profile_image: Optional[str] = None
    created_at: str


class UserHistoryCreateRequest(BaseModel):
    video_id: str
    recipe_title: str
    thumbnail_url: str
    created_at: Optional[str] = None


class UserHistoryResponse(BaseModel):
    video_id: str
    recipe_title: str
    thumbnail_url: str
    created_at: str
    saved_at: str
    channel_name: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[str] = None
    servings: Optional[int] = None
    total_estimated_price: Optional[int] = None
    total_calorie: Optional[int] = None
    like_count: Optional[int] = None
    comment_count: Optional[int] = None
    share_count: Optional[int] = None
    status: Optional[RecipeStatus] = None


class UserActivityResponse(BaseModel):
    user_id: str
    video_id: str
    activity_type: str
    created_at: str
    recipe_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    nickname: Optional[str] = None
    content: Optional[str] = None
    like_count: Optional[int] = None
