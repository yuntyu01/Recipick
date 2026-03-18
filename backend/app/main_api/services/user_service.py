from decimal import Decimal
from typing import Optional
from app.shared.repositories import user_repo


# Boto3 Decimal JSON 변환
def _replace_decimals(obj):
    if isinstance(obj, list):
        return [_replace_decimals(i) for i in obj]
    if isinstance(obj, dict):
        return {k: _replace_decimals(v) for k, v in obj.items()}
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj


# 유저 프로필 생성/갱신
def upsert_user_profile(user_id: str, nickname: str, profile_image: Optional[str]):
    item = user_repo.upsert_user_profile(
        user_id=user_id,
        nickname=nickname,
        profile_image=profile_image
    )
    return _replace_decimals(item)


# 유저 프로필 조회
def get_user_profile(user_id: str):
    item = user_repo.get_user_profile(user_id)
    if not item:
        return None
    return _replace_decimals(item)


# 유저 레시피 사용 이력 기록
def create_user_history(
    user_id: str,
    video_id: str,
    recipe_title: str,
    thumbnail_url: str,
    created_at: Optional[str] = None
):
    item = user_repo.add_user_history(
        user_id=user_id,
        video_id=video_id,
        recipe_title=recipe_title,
        thumbnail_url=thumbnail_url,
        created_at=created_at
    )
    return _replace_decimals(item)


# 유저 최근 사용 이력 조회
def get_user_history(user_id: str, limit: int = 20):
    items = user_repo.list_user_history(user_id=user_id, limit=limit)
    return _replace_decimals(items)


# 유저 활동 로그 정규화/반환
def get_user_activities(user_id: str, limit: int = 20):
    items = user_repo.list_user_activities(user_id=user_id, limit=limit)
    normalized = []
    for item in items:
        sk = item.get("SK", "")
        activity_type = sk.split("#", 1)[0] if "#" in sk else sk
        normalized.append(
            {
                "user_id": item.get("user_id"),
                "video_id": item.get("PK", "").replace("VIDEO#", ""),
                "activity_type": activity_type,
                "created_at": item.get("created_at"),
                "recipe_title": item.get("recipe_title"),
                "thumbnail_url": item.get("thumbnail_url"),
                "nickname": item.get("nickname"),
                "content": item.get("content"),
                "like_count": item.get("like_count"),
            }
        )
    return _replace_decimals(normalized)


# 유저 계정 데이터 삭제/익명화
def delete_user_account_data(user_id: str):
    deleted_profile = user_repo.delete_user_profile(user_id)
    deleted_history_count = user_repo.delete_all_user_history(user_id)
    activity_result = user_repo.delete_all_user_activities(user_id)

    return {
        "success": True,
        "user_id": user_id,
        "deleted_profile": deleted_profile,
        "deleted_history_count": deleted_history_count,
        "deleted_activity_count": activity_result.get("deleted_activity_count", 0),
        "anonymized_comment_count": activity_result.get("anonymized_comment_count", 0),
    }
