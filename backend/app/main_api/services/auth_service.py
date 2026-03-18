from fastapi import HTTPException, status
from typing import Optional

from app.main_api.services import user_service
from app.shared.utils.firebase_auth import verify_firebase_id_token


# 토큰 정보 기반 기본 닉네임 생성
def _build_default_nickname(decoded_token: dict) -> str:
    if decoded_token.get("name"):
        return decoded_token["name"]
    email = decoded_token.get("email")
    if email and "@" in email:
        return email.split("@")[0]
    return f"user_{decoded_token.get('uid', 'unknown')[:8]}"


# 토큰/입력값 기반 유저 프로필 동기화
def _sync_user_profile(decoded_token: dict, nickname: Optional[str], profile_image: Optional[str]):
    user_id = decoded_token["uid"]
    existing = user_service.get_user_profile(user_id)
    is_new_user = existing is None

    final_nickname = nickname or (existing.get("nickname") if existing else _build_default_nickname(decoded_token))
    final_profile_image = profile_image or decoded_token.get("picture") or (existing.get("profile_image") if existing else None)

    saved = user_service.upsert_user_profile(
        user_id=user_id,
        nickname=final_nickname,
        profile_image=final_profile_image
    )
    return saved, is_new_user


# Firebase 토큰 검증 및 프로필 동기화
def login_with_firebase(id_token: str, nickname: Optional[str] = None, profile_image: Optional[str] = None):
    try:
        decoded = verify_firebase_id_token(id_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 Firebase 토큰입니다: {exc}"
        )

    is_anonymous = decoded.get("firebase", {}).get("sign_in_provider") == "anonymous"
    user, is_new_user = _sync_user_profile(decoded, nickname, profile_image)
    user["is_anonymous"] = is_anonymous
    return {"success": True, "is_new_user": is_new_user, "user": user}


# 회원가입은 토큰 검증/동기화로 처리
def signup_with_firebase(id_token: str, nickname: Optional[str] = None, profile_image: Optional[str] = None):
    # Firebase 기준으로 signup/login은 동일하게 ID 토큰 검증 후 동기화 처리
    return login_with_firebase(id_token=id_token, nickname=nickname, profile_image=profile_image)


# 토큰 기반 현재 사용자 프로필 조회
def me_from_firebase_token(id_token: str):
    try:
        decoded = verify_firebase_id_token(id_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 Firebase 토큰입니다: {exc}"
        )

    is_anonymous = decoded.get("firebase", {}).get("sign_in_provider") == "anonymous"
    user = user_service.get_user_profile(decoded["uid"])
    if not user:
        user, _ = _sync_user_profile(decoded, None, None)
    user["is_anonymous"] = is_anonymous
    return user


# 토큰 기반 사용자 계정 데이터 삭제
def delete_my_account_data(id_token: str):
    try:
        decoded = verify_firebase_id_token(id_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"유효하지 않은 Firebase 토큰입니다: {exc}"
        )

    return user_service.delete_user_account_data(decoded["uid"])
