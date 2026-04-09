import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from app.shared.config import settings
from botocore.exceptions import ClientError
from typing import Optional, List

dynamodb = boto3.resource('dynamodb', region_name=settings.REGION)
user_table = dynamodb.Table(settings.USER_TABLE)
recipe_table = dynamodb.Table(settings.RECIPE_TABLE)


# UTC ISO 타임스탬프 생성
def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

# 레시피 기본 정보 조회
def get_recipe(video_id: str):
    response = recipe_table.get_item(
        Key={
            'PK': f'VIDEO#{video_id}',
            'SK': 'INFO'
        }
    )
    return response.get('Item')

# 초기 요청 시 PROCESSING 상태 저장
def save_initial_recipe(video_id: str, original_url: str, sharer_nickname: str, title: str, channel_name: str):
    thumbnail_url = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
    
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    recipe_table.put_item(
        Item={
            'PK': f'VIDEO#{video_id}',
            'SK': 'INFO',
            'original_url': original_url,
            'sharer_nickname': sharer_nickname,
            'title': title,
            'channel_name': channel_name,
            'thumbnail_url': thumbnail_url,
            'status': 'PROCESSING',
            'created_at': now,
            "comment_count": 0,
            "like_count": 0,
            "share_count": 0
        }
    )
    return thumbnail_url

# 분석 완료 데이터 반영 및 COMPLETED 상태 변경
def update_completed_recipe(video_id: str, extracted_data: dict, channel_profile_url: str = None):
    update_expr = """
            SET #st = :status_val,
                category = :cat_val,
                difficulty = :diff_val,
                servings = :servings_val,
                total_estimated_price = :price_val,
                total_calorie = :cal_val,
                nutrition_details = :nutri_val,
                ingredients = :ing_val,
                steps = :steps_val
    """
    expr_values = {
        ":status_val": "COMPLETED",
        ":cat_val": extracted_data.get("category"),
        ":diff_val": extracted_data.get("difficulty"),
        ":servings_val": extracted_data.get("servings"),
        ":price_val": extracted_data.get("total_estimated_price"),
        ":cal_val": extracted_data.get("total_calorie"),
        ":nutri_val": extracted_data.get("nutrition_details"),
        ":ing_val": extracted_data.get("ingredients"),
        ":steps_val": extracted_data.get("steps"),
    }

    if channel_profile_url:
        update_expr += ", channel_profile_url = :cp_val"
        expr_values[":cp_val"] = channel_profile_url

    recipe_table.update_item(
        Key={'PK': f'VIDEO#{video_id}', 'SK': 'INFO'},
        UpdateExpression=update_expr,
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues=expr_values,
    )

# 레시피 처리 상태 갱신
def update_status(video_id: str, new_status: str):
    recipe_table.update_item(
        Key={'PK': f'VIDEO#{video_id}', 'SK': 'INFO'},
        UpdateExpression="SET #st = :status_val",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":status_val": new_status}
    )


# 익명 댓글 번호 원자적 증가
def _increment_anonymous_counter(video_id: str) -> int:
    response = recipe_table.update_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": "INFO"},
        UpdateExpression="ADD anon_comment_seq :inc",
        ExpressionAttributeValues={":inc": 1},
        ReturnValues="UPDATED_NEW",
    )
    return int(response.get("Attributes", {}).get("anon_comment_seq", 1))


# 익명 UID -> 번호 매핑 조회
def _get_anonymous_mapping(video_id: str, anon_uid: str) -> Optional[int]:
    response = recipe_table.get_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": f"ANON#{anon_uid}"}
    )
    item = response.get("Item")
    if not item:
        return None
    return item.get("anonymous_number")


# 익명 UID -> 번호 매핑 생성 (중복 방지)
def _put_anonymous_mapping(video_id: str, anon_uid: str, anonymous_number: int) -> bool:
    now = _utc_now_iso()
    try:
        recipe_table.put_item(
            Item={
                "PK": f"VIDEO#{video_id}",
                "SK": f"ANON#{anon_uid}",
                "user_id": anon_uid,
                "anonymous_number": anonymous_number,
                "created_at": now,
            },
            ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)",
        )
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


# 익명 댓글 번호 확보 (UID 있으면 고정)
def get_or_create_anonymous_number(video_id: str, anon_uid: Optional[str]) -> int:
    if anon_uid:
        existing = _get_anonymous_mapping(video_id, anon_uid)
        if existing is not None:
            return int(existing)

        new_number = _increment_anonymous_counter(video_id)
        created = _put_anonymous_mapping(video_id, anon_uid, new_number)
        if created:
            return new_number

        existing = _get_anonymous_mapping(video_id, anon_uid)
        if existing is not None:
            return int(existing)
        return new_number

    return _increment_anonymous_counter(video_id)


# 댓글 이벤트 저장 및 카운트 증가
def create_comment(
    video_id: str,
    user_id: str,
    nickname: str,
    content: str,
    like_count: int = 0,
    is_anonymous: bool = False,
    anonymous_number: Optional[int] = None,
):
    now = _utc_now_iso()
    comment_sk = f"COMMENT#{now}#{user_id}"
    recipe = get_recipe(video_id)
    item = {
        "PK": f"VIDEO#{video_id}",
        "SK": comment_sk,
        "user_id": user_id,
        "nickname": nickname,
        "is_anonymous": is_anonymous,
        "content": content,
        "like_count": like_count,
        "created_at": now,
        "title": recipe.get("title") if recipe else None,
        "thumbnail_url": recipe.get("thumbnail_url") if recipe else None,
    }
    if anonymous_number is not None:
        item["anonymous_number"] = anonymous_number

    recipe_table.put_item(Item=item)
    recipe_table.update_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": "INFO"},
        UpdateExpression="SET comment_count = if_not_exists(comment_count, :zero) + :inc",
        ExpressionAttributeValues={":inc": 1, ":zero": 0}
    )
    return {
        "comment_id": comment_sk,
        "video_id": video_id,
        "user_id": user_id,
        "nickname": nickname,
        "is_anonymous": is_anonymous,
        "anonymous_number": anonymous_number,
        "content": content,
        "like_count": like_count,
        "created_at": now
    }


# 댓글 목록 최신순 조회
def list_comments(video_id: str, limit: int = 20):
    response = recipe_table.query(
        KeyConditionExpression=Key("PK").eq(f"VIDEO#{video_id}") & Key("SK").begins_with("COMMENT#"),
        ScanIndexForward=False,
        Limit=limit
    )
    items = []
    for item in response.get("Items", []):
        items.append(
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
    return items


# 단일 댓글 조회
def get_comment(video_id: str, comment_id: str):
    response = recipe_table.get_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": comment_id}
    )
    return response.get("Item")


# 본인 댓글만 수정되도록 조건부 업데이트
def update_comment(video_id: str, comment_id: str, user_id: str, content: str):
    now = _utc_now_iso()
    try:
        response = recipe_table.update_item(
            Key={"PK": f"VIDEO#{video_id}", "SK": comment_id},
            UpdateExpression="SET content = :content_val, updated_at = :updated_at_val",
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK) AND user_id = :uid",
            ExpressionAttributeValues={
                ":content_val": content,
                ":updated_at_val": now,
                ":uid": user_id,
            },
            ReturnValues="ALL_NEW",
        )
        return {"status": "OK", "item": response.get("Attributes", {})}
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
        existing = get_comment(video_id=video_id, comment_id=comment_id)
        if not existing:
            return {"status": "NOT_FOUND"}
        return {"status": "FORBIDDEN"}


# 본인 댓글만 삭제되도록 조건부 삭제 및 카운트 감소
def delete_comment(video_id: str, comment_id: str, user_id: str):
    try:
        response = recipe_table.delete_item(
            Key={"PK": f"VIDEO#{video_id}", "SK": comment_id},
            ConditionExpression="attribute_exists(PK) AND attribute_exists(SK) AND user_id = :uid",
            ExpressionAttributeValues={":uid": user_id},
            ReturnValues="ALL_OLD",
        )
        deleted_item = response.get("Attributes", {})
        try:
            recipe_table.update_item(
                Key={"PK": f"VIDEO#{video_id}", "SK": "INFO"},
                UpdateExpression="SET comment_count = comment_count - :dec",
                ConditionExpression="attribute_exists(comment_count) AND comment_count >= :dec",
                ExpressionAttributeValues={":dec": 1},
            )
        except ClientError:
            pass

        return {"status": "OK", "item": deleted_item}
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
            raise
        existing = get_comment(video_id=video_id, comment_id=comment_id)
        if not existing:
            return {"status": "NOT_FOUND"}
        return {"status": "FORBIDDEN"}



# 좋아요 이벤트 저장 및 중복 방지
def create_like(video_id: str, user_id: str):
    now = _utc_now_iso()
    recipe = get_recipe(video_id)

    try:
        recipe_table.put_item(
            Item={
                "PK": f"VIDEO#{video_id}",
                "SK": f"LIKE#{user_id}",
                "user_id": user_id,
                "created_at": now,
                "title": recipe.get("title") if recipe else None,
                "thumbnail_url": recipe.get("thumbnail_url") if recipe else None
            },
            ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)"
        )
        recipe_table.update_item(
            Key={"PK": f"VIDEO#{video_id}", "SK": "INFO"},
            UpdateExpression="SET like_count = if_not_exists(like_count, :zero) + :inc",
            ExpressionAttributeValues={":inc": 1, ":zero": 0}
        )
        return {"success": True, "already_exists": False, "created_at": now}
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return {"success": True, "already_exists": True, "created_at": None}
        raise


# 좋아요 삭제 및 카운트 감소
def delete_like(video_id: str, user_id: str):
    response = recipe_table.delete_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": f"LIKE#{user_id}"},
        ReturnValues="ALL_OLD"
    )
    deleted = bool(response.get("Attributes"))
    if deleted:
        recipe_table.update_item(
            Key={"PK": f"VIDEO#{video_id}", "SK": "INFO"},
            UpdateExpression="SET like_count = like_count - :dec",
            ConditionExpression="attribute_exists(like_count) AND like_count >= :dec",
            ExpressionAttributeValues={":dec": 1}
        )
    return {"success": True, "already_exists": not deleted}


# 북마크 저장 및 중복 방지
def create_bookmark(video_id: str, user_id: str):
    now = _utc_now_iso()
    recipe = get_recipe(video_id)

    try:
        recipe_table.put_item(
            Item={
                "PK": f"VIDEO#{video_id}",
                "SK": f"BOOKMARK#{user_id}",
                "user_id": user_id,
                "created_at": now,
                "title": recipe.get("title") if recipe else None,
                "thumbnail_url": recipe.get("thumbnail_url") if recipe else None
            },
            ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)"
        )
        return {"success": True, "already_exists": False, "created_at": now}
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return {"success": True, "already_exists": True, "created_at": None}
        raise


# 북마크 삭제
def delete_bookmark(video_id: str, user_id: str):
    response = recipe_table.delete_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": f"BOOKMARK#{user_id}"},
        ReturnValues="ALL_OLD"
    )
    deleted = bool(response.get("Attributes"))
    return {"success": True, "already_exists": not deleted}


# 공유 이벤트 기록 및 카운트 증가
def create_share(video_id: str, user_id: str):
    now = _utc_now_iso()
    recipe = get_recipe(video_id)
    share_sk = f"SHARE#{now}#{user_id}"

    recipe_table.put_item(
        Item={
            "PK": f"VIDEO#{video_id}",
            "SK": share_sk,
            "user_id": user_id,
            "created_at": now,
            "title": recipe.get("title") if recipe else None,
            "thumbnail_url": recipe.get("thumbnail_url") if recipe else None
        }
    )
    recipe_table.update_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": "INFO"},
        UpdateExpression="SET share_count = if_not_exists(share_count, :zero) + :inc",
        ExpressionAttributeValues={":inc": 1, ":zero": 0}
    )
    return {"success": True, "created_at": now}


# ─────────────────────────────────────────────────────────────
# 레시피 추천 풀 수집
# ─────────────────────────────────────────────────────────────

def get_recipe_pool_for_recommendation(per_category: int = 20, categories: list = None) -> list:
    """지정 카테고리(없으면 전체)에서 COMPLETED 레시피를 per_category개씩 수집해 추천 풀 반환."""
    if categories is None:
        categories = ["한식", "중식", "일식", "양식", "분식", "디저트"]
    pool = []
    for category in categories:
        response = recipe_table.query(
            IndexName="CategoryIndex",
            KeyConditionExpression=Key("category").eq(category),
            ScanIndexForward=False,
            Limit=per_category * 3,
        )
        count = 0
        for item in response.get("Items", []):
            if not str(item.get("PK", "")).startswith("VIDEO#"):
                continue
            if item.get("SK") != "INFO":
                continue
            if item.get("status") != "COMPLETED":
                continue
            video_id = str(item["PK"]).replace("VIDEO#", "")
            nutrition = item.get("nutrition_details") or {}
            pool.append({
                "video_id":              video_id,
                "title":                 item.get("title") or "",
                "channel_name":          item.get("channel_name") or "",
                "thumbnail_url":         item.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                "url":                   item.get("original_url") or f"https://www.youtube.com/watch?v={video_id}",
                "category":              item.get("category") or category,
                "difficulty":            item.get("difficulty") or "",
                "total_calorie":         item.get("total_calorie"),
                "total_estimated_price": item.get("total_estimated_price"),
                "protein_g":             nutrition.get("protein_g"),
                "servings":              item.get("servings"),
                "like_count":            item.get("like_count") or 0,
                "comment_count":         item.get("comment_count") or 0,
                "share_count":           item.get("share_count") or 0,
                "created_at":            item.get("created_at") or "",
            })
            count += 1
            if count >= per_category:
                break
    return pool


# ─────────────────────────────────────────────────────────────
# 트렌딩 추천 풀 수집
# ─────────────────────────────────────────────────────────────

TRENDING_CATEGORIES = ["한식", "중식", "일식", "양식", "분식", "디저트"]

def get_trending_recipe_pool(per_category: int = 50) -> list:
    """카테고리별로 최근 레시피를 수집해 트렌딩 점수 계산용 풀 반환."""
    pool = []
    for category in TRENDING_CATEGORIES:
        response = recipe_table.query(
            IndexName="CategoryIndex",
            KeyConditionExpression=Key("category").eq(category),
            ScanIndexForward=False,
            Limit=per_category * 3,
        )
        count = 0
        for item in response.get("Items", []):
            if not str(item.get("PK", "")).startswith("VIDEO#"):
                continue
            if item.get("SK") != "INFO":
                continue
            if item.get("status") != "COMPLETED":
                continue
            video_id = str(item["PK"]).replace("VIDEO#", "")
            pool.append({
                "video_id":      video_id,
                "title":         item.get("title") or "",
                "channel_name":  item.get("channel_name") or "",
                "thumbnail_url": item.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                "channel_profile_url": item.get("channel_profile_url") or "",
                "url":           item.get("original_url") or f"https://www.youtube.com/watch?v={video_id}",
                "category":      item.get("category") or category,
                "like_count":    item.get("like_count") or 0,
                "comment_count": item.get("comment_count") or 0,
                "share_count":   item.get("share_count") or 0,
                "created_at":    item.get("created_at") or "",
            })
            count += 1
            if count >= per_category:
                break
    return pool


# ─────────────────────────────────────────────────────────────
# 전체 레시피 최신순 조회 (StatusCreatedIndex GSI)
# ─────────────────────────────────────────────────────────────

def get_latest_recipes(limit: int = 20) -> list:
    """COMPLETED 레시피를 분석 최신순으로 반환."""
    response = recipe_table.query(
        IndexName="StatusCreatedIndex",
        KeyConditionExpression=Key("status").eq("COMPLETED"),
        ScanIndexForward=False,
        Limit=limit * 3,
    )
    results = []
    for item in response.get("Items", []):
        if not str(item.get("PK", "")).startswith("VIDEO#"):
            continue
        if item.get("SK") != "INFO":
            continue
        video_id = str(item["PK"]).replace("VIDEO#", "")
        results.append({
            "video_id":            video_id,
            "title":               item.get("title") or "",
            "channel_name":        item.get("channel_name") or "",
            "thumbnail_url":       item.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
            "channel_profile_url": item.get("channel_profile_url") or "",
            "url":                 item.get("original_url") or f"https://www.youtube.com/watch?v={video_id}",
            "category":            item.get("category") or "",
            "created_at":          item.get("created_at") or "",
            "like_count":          item.get("like_count") or 0,
            "comment_count":       item.get("comment_count") or 0,
            "share_count":         item.get("share_count") or 0,
            "total_estimated_price": item.get("total_estimated_price"),
            "sharer_nickname":     item.get("sharer_nickname") or "",
        })
        if len(results) >= limit:
            break
    return results


# ─────────────────────────────────────────────────────────────
# 냉장고 파먹기 (역색인 + 카운터)
# ─────────────────────────────────────────────────────────────

def _ensure_counter_item_exists():
    """META#INGREDIENT_LIST COUNTER 아이템이 없으면 빈 counts 맵으로 초기화."""
    try:
        recipe_table.put_item(
            Item={'PK': 'META#INGREDIENT_LIST', 'SK': 'COUNTER', 'counts': {}},
            ConditionExpression="attribute_not_exists(PK)"
        )
    except ClientError as exc:
        if exc.response.get('Error', {}).get('Code') != 'ConditionalCheckFailedException':
            raise


def update_ingredient_index(video_id: str, normalized_names: List[str]):
    """각 표준 재료명에 대해 ING#{name} INDEX 아이템의 videos 리스트에 video_id를 추가."""
    for name in normalized_names:
        recipe_table.update_item(
            Key={'PK': f'ING#{name}', 'SK': 'INDEX'},
            UpdateExpression="SET #vids = list_append(if_not_exists(#vids, :empty), :new_vid)",
            ExpressionAttributeNames={"#vids": "videos"},
            ExpressionAttributeValues={
                ":new_vid": [video_id],
                ":empty": []
            }
        )


def update_ingredient_counter(normalized_names: List[str]):
    """META#INGREDIENT_LIST COUNTER 아이템의 counts 맵에서 각 재료명의 카운트를 1 증가."""
    _ensure_counter_item_exists()
    for name in normalized_names:
        recipe_table.update_item(
            Key={'PK': 'META#INGREDIENT_LIST', 'SK': 'COUNTER'},
            UpdateExpression="SET #counts.#name = if_not_exists(#counts.#name, :zero) + :inc",
            ExpressionAttributeNames={"#counts": "counts", "#name": name},
            ExpressionAttributeValues={":zero": 0, ":inc": 1}
        )


def get_ingredient_list() -> dict:
    """META#INGREDIENT_LIST COUNTER에서 전체 재료 카운트 맵을 반환."""
    response = recipe_table.get_item(
        Key={'PK': 'META#INGREDIENT_LIST', 'SK': 'COUNTER'}
    )
    item = response.get('Item')
    if not item:
        return {}
    return item.get('counts', {})


def get_ingredient_index(name: str) -> List[str]:
    """ING#{name} INDEX 아이템에서 해당 재료가 포함된 video_id 목록을 반환."""
    response = recipe_table.get_item(
        Key={'PK': f'ING#{name}', 'SK': 'INDEX'}
    )
    item = response.get('Item')
    if not item:
        return []
    return item.get('videos', [])


def batch_get_recipes_info(video_ids: List[str]) -> List[dict]:
    """여러 video_id에 대해 BatchGetItem으로 INFO 아이템을 한 번에 조회. 100개 단위 청킹 처리."""
    if not video_ids:
        return []

    table_name = recipe_table.name
    all_items = []

    # DynamoDB BatchGetItem 100개 제한 방어: 100개 단위로 분할 호출
    for i in range(0, len(video_ids), 100):
        chunk = video_ids[i:i + 100]
        keys = [{'PK': f'VIDEO#{vid}', 'SK': 'INFO'} for vid in chunk]
        response = dynamodb.batch_get_item(
            RequestItems={table_name: {'Keys': keys}}
        )
        all_items.extend(response.get('Responses', {}).get(table_name, []))

    results = []
    for item in all_items:
        video_id = str(item.get('PK', '')).replace('VIDEO#', '')
        results.append({
            'video_id': video_id,
            'title': item.get('title') or '',
            'channel_name': item.get('channel_name') or '',
            'thumbnail_url': item.get('thumbnail_url') or f'https://img.youtube.com/vi/{video_id}/hqdefault.jpg',
            'channel_profile_url': item.get('channel_profile_url') or '',
            'url': item.get('original_url') or f'https://www.youtube.com/watch?v={video_id}',
            'category': item.get('category') or '',
            'ingredients': item.get('ingredients', []),
        })
    return results


# ─────────────────────────────────────────────────────────────
# 카테고리 인덱스 기반 추천 레시피 조회
# ─────────────────────────────────────────────────────────────

# 카테고리 인덱스 기반 추천 레시피 조회
def list_recommended_videos_by_category(category: str, limit: int = 20):
    response = recipe_table.query(
        IndexName="CategoryIndex",
        KeyConditionExpression=Key("category").eq(category),
        ScanIndexForward=False,
        Limit=max(limit * 3, limit),
    )

    items = []
    for item in response.get("Items", []):
        # CategoryIndex 혼합 엔티티 필터링(INFO/COMPLETED 레시피만)
        if not str(item.get("PK", "")).startswith("VIDEO#"):
            continue
        if item.get("SK") != "INFO":
            continue
        if item.get("status") != "COMPLETED":
            continue

        video_id = str(item.get("PK", "")).replace("VIDEO#", "")
        items.append(
            {
                "video_id":              video_id,
                "title":                 item.get("title") or "",
                "channel_name":          item.get("channel_name") or "",
                "thumbnail_url":         item.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                "channel_profile_url":   item.get("channel_profile_url") or "",
                "url":                   item.get("original_url") or f"https://www.youtube.com/watch?v={video_id}",
                "category":              item.get("category") or category,
                "like_count":            item.get("like_count") or 0,
                "comment_count":         item.get("comment_count") or 0,
                "share_count":           item.get("share_count") or 0,
                "total_estimated_price": item.get("total_estimated_price"),
            }
        )
        if len(items) >= limit:
            break

    return items
