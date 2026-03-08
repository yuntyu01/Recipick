import boto3
import json
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException
from app.shared.config import settings
from app.shared.repositories import recipe_repo
from app.shared.models.recipe_model import RecipeStatus

sqs = boto3.client('sqs', region_name=settings.REGION)
SUPPORTED_RECIPE_CATEGORIES = {"한식", "중식", "일식", "양식", "분식", "디저트"}

# Boto3가 숫자 데이터를 가져올 때 Decimal 객체로 가져와서 FastAPI가 500 에러를 뱉는 걸 막음
def replace_decimals(obj):
    if isinstance(obj, list):
        return [replace_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: replace_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj

def process_recipe_request(video_id: str, original_url: str, sharer_nickname: str, title: str, channel_name: str):
    # 1) 캐시 확인: 완료된 레시피면 즉시 반환
    existing = recipe_repo.get_recipe(video_id)
    if existing and existing.get('status') == RecipeStatus.COMPLETED:
        return {
            "status": RecipeStatus.COMPLETED,
            "video_id": video_id,
            "thumbnail_url": existing.get('thumbnail_url'),
            "title": title,
            "channel_name": channel_name,
            "data": existing
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

def get_recipe_info(video_id: str):
    """
    프론트엔드 폴링용: 특정 비디오의 현재 상태와 분석 데이터를 반환
    """
    # 1. DB에서 영상 정보(PK: VIDEO#id, SK: INFO)를 가져옴
    item = recipe_repo.get_recipe(video_id)
    
    if not item:
        return None
    return replace_decimals(item)


def create_comment(
    video_id: str,
    content: str,
    like_count: int = 0,
    user_id: Optional[str] = None,
    nickname: Optional[str] = None,
):
    # 비로그인 댓글은 영상 단위 익명 시퀀스로 닉네임 생성
    if not user_id or not nickname:
        anonymous_number = recipe_repo.count_anonymous_comments(video_id) + 1
        user_id = f"ANON#{anonymous_number}"
        nickname = f"익명{anonymous_number}"

    return replace_decimals(
        recipe_repo.create_comment(
            video_id=video_id,
            user_id=user_id,
            nickname=nickname,
            content=content,
            like_count=like_count
        )
    )


def list_comments(video_id: str, limit: int = 20):
    return replace_decimals(recipe_repo.list_comments(video_id=video_id, limit=limit))


def update_comment(video_id: str, comment_id: str, user_id: str, content: str):
    # 저장소 계층에서 본인 여부/존재 여부를 판별하고 상태코드로 반환한다.
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
            "content": item.get("content"),
            "like_count": item.get("like_count", 0),
            "created_at": item.get("created_at"),
        }
    )


def delete_comment(video_id: str, comment_id: str, user_id: str):
    # 저장소 계층에서 본인 여부/존재 여부를 판별하고 상태코드로 반환한다.
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


def get_recommended_videos_by_category(category: str, limit: int = 20):
    if category not in SUPPORTED_RECIPE_CATEGORIES:
        raise HTTPException(status_code=400, detail="지원하지 않는 카테고리입니다.")
    items = recipe_repo.list_recommended_videos_by_category(category=category, limit=limit)
    return replace_decimals(items)
