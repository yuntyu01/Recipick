from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.main_api.schemas.auth_schema import (
    FirebaseAuthRequest,
    FirebaseAuthResponse,
    AuthUserResponse,
    DeleteAccountResponse,
)
from app.main_api.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])
bearer = HTTPBearer(auto_error=False)


@router.post("/firebase/signup", response_model=FirebaseAuthResponse)
def firebase_signup(req: FirebaseAuthRequest):
    # Firebase 토큰 검증 및 유저 프로필 생성/동기화
    return auth_service.signup_with_firebase(
        id_token=req.id_token,
        nickname=req.nickname,
        profile_image=req.profile_image
    )


@router.post("/firebase/login", response_model=FirebaseAuthResponse)
def firebase_login(req: FirebaseAuthRequest):
    # Firebase 토큰 검증 및 유저 프로필 동기화
    return auth_service.login_with_firebase(
        id_token=req.id_token,
        nickname=req.nickname,
        profile_image=req.profile_image
    )


@router.get("/me", response_model=AuthUserResponse)
def get_me(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    # 토큰 기반 현재 사용자 조회
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization Bearer 토큰이 필요합니다.")
    return auth_service.me_from_firebase_token(credentials.credentials)


@router.delete("/me", response_model=DeleteAccountResponse)
def delete_me(credentials: HTTPAuthorizationCredentials = Depends(bearer)):
    # Firebase 계정 유지, 앱 데이터 삭제
    if not credentials:
        raise HTTPException(status_code=401, detail="Authorization Bearer 토큰이 필요합니다.")
    return auth_service.delete_my_account_data(credentials.credentials)