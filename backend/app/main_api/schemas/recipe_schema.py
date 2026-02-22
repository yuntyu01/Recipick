from pydantic import BaseModel
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
    data: dict = None