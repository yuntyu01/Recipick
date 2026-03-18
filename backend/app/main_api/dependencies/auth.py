from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.main_api.services import auth_service

# 공통 Bearer 파서(auto_error=False)
bearer = HTTPBearer(auto_error=False)


def get_current_auth_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    # 인증 필수 API 의존성
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization Bearer 토큰이 필요합니다.",
        )
    return auth_service.me_from_firebase_token(credentials.credentials)


def get_optional_auth_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
):
    # 인증 선택 API 의존성
    if not credentials:
        return None
    return auth_service.me_from_firebase_token(credentials.credentials)
