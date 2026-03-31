from pydantic import BaseModel
from typing import Optional
from app.shared.models.recipe_model import RecipeStatus


# presigned URL 발급 요청 바디 (업로드할 파일의 MIME 타입)
class ProfileImagePresignRequest(BaseModel):
    content_type: str  # "image/jpeg" | "image/png" | "image/webp"


# presigned URL 발급 응답 (클라이언트가 S3에 직접 PUT 업로드 후 s3_key를 confirm에 사용)
class ProfileImagePresignResponse(BaseModel):
    presigned_url: str  # 클라이언트가 PUT 업로드할 S3 URL (5분 유효)
    s3_key: str         # 업로드 완료 후 confirm에 그대로 돌려보낼 키


# S3 직접 업로드 완료 후 DB 갱신 요청 바디
class ProfileImageConfirmRequest(BaseModel):
    s3_key: str  # presign 응답에서 받은 키 그대로 전달


# 프로필 이미지 갱신 완료 응답 (저장된 S3 public URL)
class ProfileImageConfirmResponse(BaseModel):
    profile_image_url: str


# 프로필 생성/수정 요청 바디
class UserProfileUpsertRequest(BaseModel):
    nickname: str
    profile_image: Optional[str] = None


# 프로필 조회/생성/수정 공통 응답
class UserProfileResponse(BaseModel):
    user_id: str
    nickname: str
    profile_image: Optional[str] = None
    created_at: str


# 레시피 사용 이력 기록 요청 바디
class UserHistoryCreateRequest(BaseModel):
    video_id: str
    recipe_title: str
    thumbnail_url: str
    created_at: Optional[str] = None


# 레시피 사용 이력 단건 응답
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


# 유저 활동 로그 단건 응답 (댓글/좋아요/북마크/공유 등)
class UserActivityResponse(BaseModel):
    user_id: str
    video_id: str
    activity_type: str  # SK 앞부분 (COMMENT, LIKE, BOOKMARK, SHARE)
    created_at: str
    recipe_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    nickname: Optional[str] = None
    content: Optional[str] = None
    like_count: Optional[int] = None
