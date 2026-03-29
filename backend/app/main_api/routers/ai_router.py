from fastapi import APIRouter, Depends

from app.main_api.dependencies.auth import get_current_auth_user
from app.main_api.schemas.ai_schema import AiAskRequest, AiAskResponse
from app.main_api.services import ai_service

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/ask", response_model=AiAskResponse)
def ask_ai(req: AiAskRequest, auth_user: dict = Depends(get_current_auth_user)):
    return ai_service.ask_ai(
        user_id=auth_user["user_id"],
        video_id=req.video_id,
        question=req.question,
        current_step=req.current_step,
    )
