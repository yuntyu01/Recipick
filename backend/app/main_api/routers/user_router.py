from fastapi import APIRouter, Depends, HTTPException, Query
from app.main_api.schemas.user_schema import (
    UserProfileUpsertRequest,
    UserProfileResponse,
    UserHistoryCreateRequest,
    UserHistoryResponse,
    UserActivityResponse,
    UserHistoryMemoRequest,
    UserHistoryMemoResponse,
    ProfileImagePresignRequest,
    ProfileImagePresignResponse,
    ProfileImageConfirmRequest,
    ProfileImageConfirmResponse,
)
from app.main_api.dependencies.auth import get_current_auth_user
from app.main_api.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/me/profile-image/presign", response_model=ProfileImagePresignResponse)
def get_profile_image_presign(
    req: ProfileImagePresignRequest,
    auth_user: dict = Depends(get_current_auth_user),
):
    # S3 presigned PUT URL 발급 — 클라이언트가 S3에 직접 업로드
    allowed = {"image/jpeg", "image/png", "image/webp"}
    if req.content_type not in allowed:
        raise HTTPException(status_code=400, detail="jpeg, png, webp 형식만 허용됩니다.")
    return user_service.generate_profile_image_presign(auth_user["user_id"], req.content_type)


@router.put("/me/profile-image/confirm", response_model=ProfileImageConfirmResponse)
def confirm_profile_image(
    req: ProfileImageConfirmRequest,
    auth_user: dict = Depends(get_current_auth_user),
):
    # s3_key 검증 후 DB URL 갱신 (서버가 직접 URL 조합)
    try:
        public_url = user_service.confirm_profile_image(auth_user["user_id"], req.s3_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"profile_image_url": public_url}


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
        title=req.title,
        thumbnail_url=req.thumbnail_url,
        created_at=req.created_at
    )


@router.get("/{user_id}/history", response_model=list[UserHistoryResponse])
def get_user_history(user_id: str, limit: int = Query(default=20, ge=1, le=100)):
    # 유저 레시피 사용 이력 최신순 조회
    return user_service.get_user_history(user_id=user_id, limit=limit)


@router.get("/{user_id}/history/{video_id}/memo", response_model=UserHistoryMemoResponse)
def get_history_memo(user_id: str, video_id: str):
    # 유저 히스토리 메모 조회
    result = user_service.get_history_memo(user_id=user_id, video_id=video_id)
    if not result:
        return {"video_id": video_id, "memo": ""}
    return result


@router.put("/{user_id}/history/{video_id}/memo", response_model=UserHistoryMemoResponse)
def update_history_memo(user_id: str, video_id: str, req: UserHistoryMemoRequest):
    # 유저 히스토리 메모 저장/수정
    result = user_service.update_history_memo(
        user_id=user_id,
        video_id=video_id,
        memo=req.memo,
    )
    if not result:
        raise HTTPException(status_code=404, detail="해당 레시피 히스토리를 찾을 수 없습니다.")
    return {"video_id": video_id, "memo": req.memo}


@router.get("/{user_id}/activities", response_model=list[UserActivityResponse])
def get_user_activities(user_id: str, limit: int = Query(default=20, ge=1, le=100)):
    # UserActivityIndex 기반 유저 활동 최신순 조회
    return user_service.get_user_activities(user_id=user_id, limit=limit)
