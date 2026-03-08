import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from app.shared.config import settings
from botocore.exceptions import ClientError

dynamodb = boto3.resource('dynamodb', region_name=settings.REGION)
user_table = dynamodb.Table(settings.USER_TABLE)
recipe_table = dynamodb.Table(settings.RECIPE_TABLE)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

def get_recipe(video_id: str):
    """
    DB에 해당 레시피가 있는지 확인 (캐싱용)
    """
    response = recipe_table.get_item(
        Key={
            'PK': f'VIDEO#{video_id}',
            'SK': 'INFO'
        }
    )
    return response.get('Item')

def save_initial_recipe(video_id: str, original_url: str, sharer_nickname: str, title: str, channel_name: str):
    """
    최초 요청 시 "PROCESSING" 상태로 DB에 우선 저장, URL로 썸네일 만들어서 저장
    """
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

def update_completed_recipe(video_id: str, extracted_data: dict):
    """
    LLM 분석 완료 후 데이터를 추가로 넣고 상태를 COMPLETED로 변경
    """
    recipe_table.update_item(
        Key={'PK': f'VIDEO#{video_id}', 'SK': 'INFO'},
        UpdateExpression="""
            SET #st = :status_val, 
                category = :cat_val, 
                difficulty = :diff_val,
                servings = :servings_val,
                total_estimated_price = :price_val,
                total_calorie = :cal_val,
                nutrition_details = :nutri_val,
                ingredients = :ing_val, 
                steps = :steps_val
        """,
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={
            ":status_val": "COMPLETED",
            ":cat_val": extracted_data.get("category"),
            ":diff_val": extracted_data.get("difficulty"),
            ":servings_val": extracted_data.get("servings"),
            ":price_val": extracted_data.get("total_estimated_price"),
            ":cal_val": extracted_data.get("total_calorie"),
            ":nutri_val": extracted_data.get("nutrition_details"),
            ":ing_val": extracted_data.get("ingredients"),
            ":steps_val": extracted_data.get("steps")
        }
    )

def update_status(video_id: str, new_status: str):
    """
    비동기 처리 중 에러 발생 시 상태를 FAILED로 변경하여 프론트 무한 로딩 방지
    """
    recipe_table.update_item(
        Key={'PK': f'VIDEO#{video_id}', 'SK': 'INFO'},
        UpdateExpression="SET #st = :status_val",
        ExpressionAttributeNames={"#st": "status"},
        ExpressionAttributeValues={":status_val": new_status}
    )


def create_comment(video_id: str, user_id: str, nickname: str, content: str, like_count: int = 0):
    # COMMENT#{timestamp}#{user_id} 키로 이벤트를 적재한다.
    now = _utc_now_iso()
    comment_sk = f"COMMENT#{now}#{user_id}"
    recipe = get_recipe(video_id)

    recipe_table.put_item(
        Item={
            "PK": f"VIDEO#{video_id}",
            "SK": comment_sk,
            "user_id": user_id,
            "nickname": nickname,
            "content": content,
            "like_count": like_count,
            "created_at": now,
            "recipe_title": recipe.get("title") if recipe else None,
            "thumbnail_url": recipe.get("thumbnail_url") if recipe else None
        }
    )
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
        "content": content,
        "like_count": like_count,
        "created_at": now
    }


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
                "content": item.get("content"),
                "like_count": item.get("like_count", 0),
                "created_at": item.get("created_at"),
            }
        )
    return items


def get_comment(video_id: str, comment_id: str):
    response = recipe_table.get_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": comment_id}
    )
    return response.get("Item")


def update_comment(video_id: str, comment_id: str, user_id: str, content: str):
    # 조건부 업데이트로 "본인 댓글만 수정"을 강제한다.
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


def delete_comment(video_id: str, comment_id: str, user_id: str):
    # 조건부 삭제로 "본인 댓글만 삭제"를 강제하고, 성공 시 comment_count를 감소시킨다.
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


def count_anonymous_comments(video_id: str) -> int:
    # 익명 닉네임 번호 산정을 위해 영상 내 ANON 댓글 수를 센다.
    count = 0
    kwargs = {
        "KeyConditionExpression": Key("PK").eq(f"VIDEO#{video_id}") & Key("SK").begins_with("COMMENT#"),
        "ProjectionExpression": "user_id",
    }

    while True:
        response = recipe_table.query(**kwargs)
        for item in response.get("Items", []):
            if str(item.get("user_id", "")).startswith("ANON#"):
                count += 1

        if "LastEvaluatedKey" not in response:
            break
        kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return count


def create_like(video_id: str, user_id: str):
    # LIKE#{user_id} 단건 키 + ConditionExpression으로 중복 좋아요를 방지한다.
    now = _utc_now_iso()
    recipe = get_recipe(video_id)

    try:
        recipe_table.put_item(
            Item={
                "PK": f"VIDEO#{video_id}",
                "SK": f"LIKE#{user_id}",
                "user_id": user_id,
                "created_at": now,
                "recipe_title": recipe.get("title") if recipe else None,
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


def create_bookmark(video_id: str, user_id: str):
    # BOOKMARK#{user_id} 단건 키 + ConditionExpression으로 중복 북마크를 방지한다.
    now = _utc_now_iso()
    recipe = get_recipe(video_id)

    try:
        recipe_table.put_item(
            Item={
                "PK": f"VIDEO#{video_id}",
                "SK": f"BOOKMARK#{user_id}",
                "user_id": user_id,
                "created_at": now,
                "recipe_title": recipe.get("title") if recipe else None,
                "thumbnail_url": recipe.get("thumbnail_url") if recipe else None
            },
            ConditionExpression="attribute_not_exists(PK) AND attribute_not_exists(SK)"
        )
        return {"success": True, "already_exists": False, "created_at": now}
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return {"success": True, "already_exists": True, "created_at": None}
        raise


def delete_bookmark(video_id: str, user_id: str):
    response = recipe_table.delete_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": f"BOOKMARK#{user_id}"},
        ReturnValues="ALL_OLD"
    )
    deleted = bool(response.get("Attributes"))
    return {"success": True, "already_exists": not deleted}


def create_share(video_id: str, user_id: str):
    # 공유는 이벤트성 데이터라 SHARE#{timestamp}#{user_id}로 다건 기록한다.
    now = _utc_now_iso()
    recipe = get_recipe(video_id)
    share_sk = f"SHARE#{now}#{user_id}"

    recipe_table.put_item(
        Item={
            "PK": f"VIDEO#{video_id}",
            "SK": share_sk,
            "user_id": user_id,
            "created_at": now,
            "recipe_title": recipe.get("title") if recipe else None,
            "thumbnail_url": recipe.get("thumbnail_url") if recipe else None
        }
    )
    recipe_table.update_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": "INFO"},
        UpdateExpression="SET share_count = if_not_exists(share_count, :zero) + :inc",
        ExpressionAttributeValues={":inc": 1, ":zero": 0}
    )
    return {"success": True, "created_at": now}


def list_recommended_videos_by_category(category: str, limit: int = 20):
    response = recipe_table.query(
        IndexName="CategoryIndex",
        KeyConditionExpression=Key("category").eq(category),
        ScanIndexForward=False,
        Limit=max(limit * 3, limit),
    )

    items = []
    for item in response.get("Items", []):
        # CategoryIndex에는 다른 타입 엔티티도 섞일 수 있어 INFO/COMPLETED 레시피만 반환
        if not str(item.get("PK", "")).startswith("VIDEO#"):
            continue
        if item.get("SK") != "INFO":
            continue
        if item.get("status") != "COMPLETED":
            continue

        video_id = str(item.get("PK", "")).replace("VIDEO#", "")
        items.append(
            {
                "video_id": video_id,
                "title": item.get("title") or "",
                "channel_name": item.get("channel_name") or "",
                "thumbnail_url": item.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                "url": item.get("original_url") or f"https://www.youtube.com/watch?v={video_id}",
                "category": item.get("category") or category,
            }
        )
        if len(items) >= limit:
            break

    return items
