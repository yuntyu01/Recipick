from fastapi import APIRouter
from app.main_api.schemas.recipe_schema import RecipeRequest, RecipeResponse
from app.main_api.services import recipe_service

router = APIRouter(prefix="/api/recipes")

@router.post("/", response_model=RecipeResponse)
def request_recipe(req: RecipeRequest):
    return recipe_service.process_recipe_request(
        req.video_id, 
        req.original_url, 
        req.sharer_nickname,
        req.title,
        req.channel_name
    )

# @router.get("/api/recipe/{video_id}", response_model=RecipeResponse)
# def get_recipe_status(video_id: str):
#     # 프론트 분석 대기중에 폴링용 api
#     recipe = recipe_service.get_recipe_info(video_id)
    
#     if not recipe:
#         raise HTTPException(status_code=404, detail="레시피를 찾을 수 없습니다.")
        
#     return recipe