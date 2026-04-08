import boto3
import json
import random
from collections import Counter
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException
from app.shared.config import settings
from app.shared.repositories import recipe_repo
from app.shared.models.recipe_model import RecipeStatus

sqs = boto3.client('sqs', region_name=settings.REGION)
SUPPORTED_RECIPE_CATEGORIES = {"한식", "중식", "일식", "양식", "분식", "디저트"}

# Boto3 Decimal JSON 변환
def replace_decimals(obj):
    if isinstance(obj, list):
        return [replace_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: replace_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj

# 레시피 요청 처리(캐시 확인/초기 저장/SQS 위임)
def process_recipe_request(video_id: str, original_url: str, sharer_nickname: str, title: str, channel_name: str):
    # 1) 캐시 확인: 완료된 레시피면 즉시 반환
    existing = recipe_repo.get_recipe(video_id)
    if existing:
        if existing.get('status') == RecipeStatus.COMPLETED:
            return {
                "status": RecipeStatus.COMPLETED,
                "video_id": video_id,
                "thumbnail_url": existing.get('thumbnail_url'),
                "title": title,
                "channel_name": channel_name,
                "data": existing
            }
        if existing.get('status') == RecipeStatus.NOT_RECIPE:
            return {
                "status": RecipeStatus.NOT_RECIPE,
                "video_id": video_id,
                "thumbnail_url": existing.get('thumbnail_url'),
                "title": title,
                "channel_name": channel_name,
            }
  
    # 2) 최초 요청은 PROCESSING 상태로 뼈대 저장
    thumb = recipe_repo.save_initial_recipe(video_id, original_url, sharer_nickname, title, channel_name)
    
    # 3) LLM 분석 작업을 SQS로 비동기 위임
    sqs.send_message(
        QueueUrl=settings.SQS_QUEUE_URL,
        MessageBody=json.dumps({"video_id": video_id, "original_url": original_url})
    )
    
    # 4) 프론트는 즉시 PROCESSING 상태로 렌더링
    return {
        "status": RecipeStatus.PROCESSING,
        "video_id": video_id,
        "thumbnail_url": thumb,
        "title": title,
        "channel_name": channel_name
    }

# 프론트 폴링용 레시피 상태/데이터 조회
def get_recipe_info(video_id: str):
    # 1. DB에서 영상 정보(PK: VIDEO#id, SK: INFO)를 가져옴
    item = recipe_repo.get_recipe(video_id)
    
    if not item:
        return None
    return replace_decimals(item)


# 댓글 생성(익명 처리 포함)
def create_comment(
    video_id: str,
    content: str,
    like_count: int = 0,
    user_id: Optional[str] = None,
    nickname: Optional[str] = None,
    is_anonymous: bool = False,
):
    # 익명 댓글은 영상 단위 원자 카운터로 번호 부여
    if is_anonymous:
        anonymous_number = recipe_repo.get_or_create_anonymous_number(video_id, user_id)
        nickname = f"익명{anonymous_number}"
        stored_user_id = user_id or f"ANON#{anonymous_number}"
        return replace_decimals(
            recipe_repo.create_comment(
                video_id=video_id,
                user_id=stored_user_id,
                nickname=nickname,
                content=content,
                like_count=like_count,
                is_anonymous=True,
                anonymous_number=anonymous_number,
            )
        )

    if not user_id or not nickname:
        raise HTTPException(status_code=400, detail="로그인 사용자 정보가 필요합니다.")

    return replace_decimals(
        recipe_repo.create_comment(
            video_id=video_id,
            user_id=user_id,
            nickname=nickname,
            content=content,
            like_count=like_count,
            is_anonymous=False,
        )
    )


# 레시피 댓글 목록 최신순 조회
def list_comments(video_id: str, limit: int = 20):
    return replace_decimals(recipe_repo.list_comments(video_id=video_id, limit=limit))


# 댓글 수정 검증/정규화
def update_comment(video_id: str, comment_id: str, user_id: str, content: str):
    # 저장소 계층 본인/존재 여부 판별 및 상태코드 반환
    result = recipe_repo.update_comment(
        video_id=video_id,
        comment_id=comment_id,
        user_id=user_id,
        content=content
    )
    if result["status"] == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if result["status"] == "FORBIDDEN":
        raise HTTPException(status_code=403, detail="본인이 작성한 댓글만 수정할 수 있습니다.")

    item = result["item"]
    return replace_decimals(
        {
            "comment_id": item.get("SK"),
            "video_id": video_id,
            "user_id": item.get("user_id"),
            "nickname": item.get("nickname"),
            "is_anonymous": item.get("is_anonymous", False),
            "anonymous_number": item.get("anonymous_number"),
            "content": item.get("content"),
            "like_count": item.get("like_count", 0),
            "created_at": item.get("created_at"),
        }
    )


# 댓글 삭제 검증/응답 생성
def delete_comment(video_id: str, comment_id: str, user_id: str):
    # 저장소 계층 본인/존재 여부 판별 및 상태코드 반환
    result = recipe_repo.delete_comment(
        video_id=video_id,
        comment_id=comment_id,
        user_id=user_id
    )
    if result["status"] == "NOT_FOUND":
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다.")
    if result["status"] == "FORBIDDEN":
        raise HTTPException(status_code=403, detail="본인이 작성한 댓글만 삭제할 수 있습니다.")

    return {
        "success": True,
        "action": "DELETE_COMMENT",
        "video_id": video_id,
        "user_id": user_id,
        "created_at": None,
        "already_exists": False
    }


# 좋아요 이벤트 기록
def like_recipe(video_id: str, user_id: str):
    result = recipe_repo.create_like(video_id=video_id, user_id=user_id)
    return {
        "success": result.get("success", True),
        "action": "LIKE",
        "video_id": video_id,
        "user_id": user_id,
        "created_at": result.get("created_at"),
        "already_exists": result.get("already_exists", False)
    }


# 좋아요 취소 이벤트 기록
def unlike_recipe(video_id: str, user_id: str):
    result = recipe_repo.delete_like(video_id=video_id, user_id=user_id)
    return {
        "success": result.get("success", True),
        "action": "UNLIKE",
        "video_id": video_id,
        "user_id": user_id,
        "created_at": None,
        "already_exists": result.get("already_exists", False)
    }


# 북마크 이벤트 기록
def bookmark_recipe(video_id: str, user_id: str):
    result = recipe_repo.create_bookmark(video_id=video_id, user_id=user_id)
    return {
        "success": result.get("success", True),
        "action": "BOOKMARK",
        "video_id": video_id,
        "user_id": user_id,
        "created_at": result.get("created_at"),
        "already_exists": result.get("already_exists", False)
    }


# 북마크 취소 이벤트 기록
def unbookmark_recipe(video_id: str, user_id: str):
    result = recipe_repo.delete_bookmark(video_id=video_id, user_id=user_id)
    return {
        "success": result.get("success", True),
        "action": "UNBOOKMARK",
        "video_id": video_id,
        "user_id": user_id,
        "created_at": None,
        "already_exists": result.get("already_exists", False)
    }


# 공유 이벤트 기록
def share_recipe(video_id: str, user_id: str):
    result = recipe_repo.create_share(video_id=video_id, user_id=user_id)
    return {
        "success": result.get("success", True),
        "action": "SHARE",
        "video_id": video_id,
        "user_id": user_id,
        "created_at": result.get("created_at"),
        "already_exists": False
    }


# 트렌딩 레시피 (좋아요·댓글·공유 기반 인기 점수 + 시간 감쇠)
def get_trending_recipes(limit: int = 20) -> list:
    def _hot_score(item: dict) -> float:
        raw = (
            item["like_count"] * 3
            + item["comment_count"] * 2
            + item["share_count"] * 5
        )
        try:
            dt = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
            age_days = max((datetime.now(timezone.utc) - dt).days, 0)
        except Exception:
            age_days = 0
        return raw / (1 + age_days * 0.1)

    pool = recipe_repo.get_trending_recipe_pool()
    weights = [_hot_score(r) + 1 for r in pool]  # +1로 0점도 뽑힐 기회 부여

    selected = []
    remaining = list(zip(pool, weights))
    for _ in range(min(limit, len(pool))):
        items, w = zip(*remaining)
        pick = random.choices(items, weights=w, k=1)[0]
        selected.append(pick)
        remaining = [(r, wt) for r, wt in remaining if r["video_id"] != pick["video_id"]]

    return replace_decimals([
        {
            "video_id":      r["video_id"],
            "title":         r["title"],
            "channel_name":  r["channel_name"],
            "thumbnail_url": r["thumbnail_url"],
            "channel_profile_url": r.get("channel_profile_url") or "",
            "url":           r["url"],
            "category":      r["category"],
            "like_count":    r["like_count"],
            "comment_count": r["comment_count"],
            "share_count":   r["share_count"],
        }
        for r in selected
    ])


# 전체 레시피 최신순 조회
def get_latest_recipes(limit: int = 20) -> list:
    return replace_decimals(recipe_repo.get_latest_recipes(limit=limit))


# 카테고리 기반 추천 레시피 목록 조회
def get_recommended_videos_by_category(category: str, limit: int = 20):
    if category not in SUPPORTED_RECIPE_CATEGORIES:
        raise HTTPException(status_code=400, detail="지원하지 않는 카테고리입니다.")
    items = recipe_repo.list_recommended_videos_by_category(category=category, limit=limit)
    return replace_decimals(items)


# 다중 재료 교집합 레시피 검색 + 연관 재료 집계
def search_recipes_by_ingredients(names: list[str]) -> dict:
    # 각 재료의 video_id 목록을 개별 GetItem으로 조회
    video_sets = []
    for name in names:
        ids = recipe_repo.get_ingredient_index(name)
        video_sets.append(set(ids))

    if not video_sets:
        return {"recipes": [], "available_ingredients": []}

    # set 교집합으로 모든 재료가 포함된 video_id만 남김
    intersection = video_sets[0]
    for s in video_sets[1:]:
        intersection = intersection & s

    if not intersection:
        return {"recipes": [], "available_ingredients": []}

    # BatchGetItem으로 레시피 정보 일괄 조회 (ingredients 포함)
    items = replace_decimals(recipe_repo.batch_get_recipes_info(list(intersection)))

    # 검색어로 입력된 재료명 집합 (집계 제외용)
    excluded_names = {name.strip() for name in names}

    # 모든 레시피의 ingredients에서 normalized_names 배열 집계
    ingredient_counter: Counter = Counter()
    for item in items:
        for ingredient in item.get('ingredients') or []:
            for norm_name in ingredient.get('normalized_names', []):
                name = norm_name.strip()
                if name and name not in excluded_names:
                    ingredient_counter[name] += 1

    # count 내림차순 정렬
    aggregated_ingredients = [
        {"name": name, "count": count}
        for name, count in ingredient_counter.most_common()
    ]

    # 응답 전 ingredients 필드 제거 (페이로드 경량화)
    for item in items:
        item.pop('ingredients', None)

    return {"recipes": items, "available_ingredients": aggregated_ingredients}