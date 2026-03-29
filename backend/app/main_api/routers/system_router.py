from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/ping")
def ping():
    # 콜드스타트 예열용 최소 응답
    return {"status": "ok"}
