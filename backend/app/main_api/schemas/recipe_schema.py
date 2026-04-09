from pydantic import BaseModel
from typing import Optional
from app.shared.models.recipe_model import RecipeStatus


# 레시피 분석 요청 바디 (video_id + 공유자 정보)
class RecipeRequest(BaseModel):
    video_id: str
    original_url: str
    sharer_nickname: str
    # 프론트엔드에서 못 받아오면 임시값을 쓰도록 기본값 세팅
    title: str = "레시피 분석 준비 중..."
    channel_name: str = "알 수 없음"


# 레시피 상태 조회 응답 (PROCESSING / COMPLETED / FAILED)
class RecipeResponse(BaseModel):
    status: RecipeStatus
    video_id: str
    thumbnail_url: str
    title: str
    channel_name: str
    data: Optional[dict] = None  # COMPLETED일 때만 전체 레시피 데이터 포함


# 댓글 작성 요청 바디
class RecipeCommentCreateRequest(BaseModel):
    content: str
    like_count: int = 0


# 댓글 단건 응답 (목록 조회/생성/수정 공통)
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


# 댓글 수정 요청 바디 (comment_id + 변경할 내용)
class RecipeCommentUpdateRequest(BaseModel):
    comment_id: str
    content: str


# 댓글 삭제 요청 바디
class RecipeCommentDeleteRequest(BaseModel):
    comment_id: str


# 좋아요/북마크/공유/댓글삭제 등 액션 공통 응답
class RecipeActionResponse(BaseModel):
    success: bool
    action: str
    video_id: str
    user_id: str
    created_at: Optional[str] = None
    already_exists: bool = False  # 중복 액션 여부


# 트렌딩 레시피 단건 응답
class RecipeTrendingResponse(BaseModel):
    video_id: str
    title: str
    channel_name: str
    thumbnail_url: str
    channel_profile_url: Optional[str] = ""
    url: str
    category: str
    like_count: int
    comment_count: int
    share_count: int


# 카테고리 기반 추천 레시피 단건 응답
class RecipeRecommendationResponse(BaseModel):
    video_id: str
    title: str
    channel_name: str
    thumbnail_url: str
    channel_profile_url: Optional[str] = ""
    url: str
    category: str
    like_count: Optional[int] = 0
    comment_count: Optional[int] = 0
    share_count: Optional[int] = 0
    total_estimated_price: Optional[str] = None


# 전체 레시피 최신순 단건 응답
class RecipeLatestResponse(BaseModel):
    video_id: str
    title: str
    channel_name: str
    thumbnail_url: str
    channel_profile_url: Optional[str] = ""
    url: str
    category: str
    created_at: str
    like_count: Optional[int] = 0
    comment_count: Optional[int] = 0
    share_count: Optional[int] = 0
    total_estimated_price: Optional[str] = None
    sharer_nickname: Optional[str] = ""


# 재료 검색 결과의 연관 재료 집계 단건 (이름 + 등장 횟수)
class IngredientCountResponse(BaseModel):
    name: str
    count: int


# 재료 검색 결과 레시피 단건 응답
class RecipeSearchResultResponse(BaseModel):
    video_id: str
    title: str
    channel_name: str
    thumbnail_url: str
    channel_profile_url: Optional[str] = ""
    url: str
    category: str


# 재료 검색 최종 응답 (레시피 목록 + 연관 재료 집계)
class RecipeSearchResponse(BaseModel):
    recipes: list[RecipeSearchResultResponse]
    available_ingredients: list[IngredientCountResponse]
