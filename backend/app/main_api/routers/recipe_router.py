from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.main_api.schemas.recipe_schema import (
    RecipeRequest,
    RecipeResponse,
    RecipeRecommendationResponse,
    RecipeTrendingResponse,
    RecipeCommentCreateRequest,
    RecipeCommentUpdateRequest,
    RecipeCommentDeleteRequest,
    RecipeCommentResponse,
    RecipeActionResponse,
    RecipeSearchResultResponse,
    RecipeSearchResponse,
    RecipeLatestResponse,
)
from app.main_api.dependencies.auth import get_current_auth_user, get_optional_auth_user
from app.main_api.services import recipe_service

router = APIRouter(prefix="/api/recipes")

@router.post("/", response_model=RecipeResponse)
def request_recipe(req: RecipeRequest):
    # 최초 요청 캐시 확인 및 상태 반환
    return recipe_service.process_recipe_request(
        req.video_id, 
        req.original_url, 
        req.sharer_nickname,
        req.title,
        req.channel_name
    )


@router.get("/trending", response_model=list[RecipeTrendingResponse])
def get_trending_recipes(limit: int = Query(default=20, ge=1, le=100)):
    return recipe_service.get_trending_recipes(limit=limit)


@router.get("/latest", response_model=list[RecipeLatestResponse])
def get_latest_recipes(limit: int = Query(default=20, ge=1, le=100)):
    return recipe_service.get_latest_recipes(limit=limit)


@router.get("/recommendations/{category}", response_model=list[RecipeRecommendationResponse])
def get_recommendations_by_category(category: str, limit: int = Query(default=20, ge=1, le=100)):
    # 카테고리별 추천 레시피 목록 조회 (홈 화면/카테고리 탭)
    return recipe_service.get_recommended_videos_by_category(category=category, limit=limit)


@router.get("/search", response_model=RecipeSearchResponse)
def search_recipes_by_ingredients(
    ingredients: str = Query(..., description="쉼표로 구분된 재료 목록 (예: 양파,돼지고기,파)")
):
    # 쉼표로 분리 후 공백 제거, 빈 값 필터
    names = [name.strip() for name in ingredients.split(",") if name.strip()]
    if not names:
        return []
    return recipe_service.search_recipes_by_ingredients(names)


@router.get("/{video_id}", response_model=RecipeResponse)
def get_recipe_status(video_id: str):
    # 프론트 폴링용 상태 조회
    recipe = recipe_service.get_recipe_info(video_id)
    
    if not recipe:
        raise HTTPException(status_code=404, detail="레시피를 찾을 수 없습니다.")

    return {
        "status": recipe.get("status"),
        "video_id": video_id,
        "thumbnail_url": recipe.get("thumbnail_url"),
        "title": recipe.get("title"),
        "channel_name": recipe.get("channel_name"),
        "data": recipe if recipe.get("status") == "COMPLETED" else None
    }

@router.post("/{video_id}/comments", response_model=RecipeCommentResponse)
def create_comment(
    video_id: str,
    req: RecipeCommentCreateRequest,
    auth_user: dict = Depends(get_current_auth_user),
):
    # 댓글 인증 필수(익명도 Firebase 토큰 필요)
    user_id = auth_user.get("user_id")
    nickname = auth_user.get("nickname")
    is_anonymous = bool(auth_user.get("is_anonymous", False))
    return recipe_service.create_comment(
        video_id=video_id,
        content=req.content,
        like_count=req.like_count,
        user_id=user_id,
        nickname=nickname,
        is_anonymous=is_anonymous,
    )


@router.get("/{video_id}/comments", response_model=list[RecipeCommentResponse])
def list_comments(video_id: str, limit: int = Query(default=20, ge=1, le=100)):
    # 레시피 댓글 목록 최신순 조회
    return recipe_service.list_comments(video_id=video_id, limit=limit)


@router.patch("/{video_id}/comments", response_model=RecipeCommentResponse)
def update_comment(
    video_id: str,
    req: RecipeCommentUpdateRequest,
    auth_user: dict = Depends(get_current_auth_user),
):
    # 댓글 수정 인증 필수/본인만
    return recipe_service.update_comment(
        video_id=video_id,
        comment_id=req.comment_id,
        user_id=auth_user["user_id"],
        content=req.content,
    )


@router.delete("/{video_id}/comments", response_model=RecipeActionResponse)
def delete_comment(
    video_id: str,
    req: RecipeCommentDeleteRequest,
    auth_user: dict = Depends(get_current_auth_user),
):
    # 댓글 삭제 인증 필수/본인만
    return recipe_service.delete_comment(
        video_id=video_id,
        comment_id=req.comment_id,
        user_id=auth_user["user_id"],
    )


@router.post("/{video_id}/likes", response_model=RecipeActionResponse)
def like_recipe(video_id: str, auth_user: dict = Depends(get_current_auth_user)):
    # 좋아요 인증 필수
    return recipe_service.like_recipe(video_id=video_id, user_id=auth_user["user_id"])


@router.delete("/{video_id}/likes", response_model=RecipeActionResponse)
def unlike_recipe(video_id: str, auth_user: dict = Depends(get_current_auth_user)):
    # 좋아요 취소 인증 필수
    return recipe_service.unlike_recipe(video_id=video_id, user_id=auth_user["user_id"])


@router.post("/{video_id}/bookmarks", response_model=RecipeActionResponse)
def bookmark_recipe(video_id: str, auth_user: dict = Depends(get_current_auth_user)):
    # 북마크 인증 필수
    return recipe_service.bookmark_recipe(video_id=video_id, user_id=auth_user["user_id"])


@router.delete("/{video_id}/bookmarks", response_model=RecipeActionResponse)
def unbookmark_recipe(video_id: str, auth_user: dict = Depends(get_current_auth_user)):
    # 북마크 취소 인증 필수
    return recipe_service.unbookmark_recipe(video_id=video_id, user_id=auth_user["user_id"])


@router.post("/{video_id}/shares", response_model=RecipeActionResponse)
def share_recipe(video_id: str, auth_user: dict = Depends(get_current_auth_user)):
    # 공유 이벤트 기록 인증 필수
    return recipe_service.share_recipe(video_id=video_id, user_id=auth_user["user_id"])