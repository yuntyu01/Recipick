from fastapi import APIRouter, HTTPException, Query
from app.main_api.schemas.user_schema import (
    UserProfileUpsertRequest,
    UserProfileResponse,
    UserHistoryCreateRequest,
    UserHistoryResponse,
    UserActivityResponse,
)
from app.main_api.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.put("/{user_id}/profile", response_model=UserProfileResponse)
def upsert_user_profile(user_id: str, req: UserProfileUpsertRequest):
    # 유저 프로필 생성/수정
    return user_service.upsert_user_profile(
        user_id=user_id,
        nickname=req.nickname,
        profile_image=req.profile_image
    )


@router.get("/{user_id}/profile", response_model=UserProfileResponse)
def get_user_profile(user_id: str):
    # 유저 프로필 조회
    user = user_service.get_user_profile(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")
    return user


@router.post("/{user_id}/history", response_model=UserHistoryResponse)
def create_user_history(user_id: str, req: UserHistoryCreateRequest):
    # 유저 레시피 사용 이력 기록
    return user_service.create_user_history(
        user_id=user_id,
        video_id=req.video_id,
        recipe_title=req.recipe_title,
        thumbnail_url=req.thumbnail_url,
        created_at=req.created_at
    )


@router.get("/{user_id}/history", response_model=list[UserHistoryResponse])
def get_user_history(user_id: str, limit: int = Query(default=20, ge=1, le=100)):
    # 유저 레시피 사용 이력 최신순 조회
    return user_service.get_user_history(user_id=user_id, limit=limit)


@router.get("/{user_id}/activities", response_model=list[UserActivityResponse])
def get_user_activities(user_id: str, limit: int = Query(default=20, ge=1, le=100)):
    # UserActivityIndex 기반 유저 활동 최신순 조회
    return user_service.get_user_activities(user_id=user_id, limit=limit)