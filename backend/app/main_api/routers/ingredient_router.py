from fastapi import APIRouter
from app.main_api.schemas.recipe_schema import IngredientCountResponse
from app.shared.repositories import recipe_repo

router = APIRouter(prefix="/api/ingredients")


@router.get("", response_model=list[IngredientCountResponse])
def get_popular_ingredients():
    """인기 재료 목록을 등장 횟수 기준 내림차순으로 반환."""
    counts: dict = recipe_repo.get_ingredient_list()
    sorted_items = sorted(counts.items(), key=lambda x: x[1], reverse=True)
    return [{"name": name, "count": int(count)} for name, count in sorted_items]
