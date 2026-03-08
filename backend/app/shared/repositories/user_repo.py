import boto3
from datetime import datetime, timezone
from typing import Optional
from boto3.dynamodb.conditions import Key
from app.shared.config import settings

dynamodb = boto3.resource('dynamodb', region_name=settings.REGION)
user_table = dynamodb.Table(settings.USER_TABLE)
recipe_table = dynamodb.Table(settings.RECIPE_TABLE)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def get_user_profile(user_id: str):
    response = user_table.get_item(
        Key={"user_id": user_id}
    )
    return response.get("Item")


def upsert_user_profile(user_id: str, nickname: str, profile_image: Optional[str]):
    existing = get_user_profile(user_id)
    created_at = existing.get("created_at") if existing else _utc_now_iso()

    item = {
        "user_id": user_id,
        "nickname": nickname,
        "profile_image": profile_image,
        "created_at": created_at
    }
    user_table.put_item(Item=item)
    return item


def add_user_history(
    user_id: str,
    video_id: str,
    recipe_title: str,
    thumbnail_url: str,
    created_at: Optional[str] = None
):
    event_time = created_at or _utc_now_iso()
    recipe = recipe_table.get_item(
        Key={
            "PK": f"VIDEO#{video_id}",
            "SK": "INFO"
        }
    ).get("Item", {})
    item = {
        "PK": f"USER#{user_id}",
        "SK": f"HISTORY#{event_time}",
        "video_id": video_id,
        "recipe_title": recipe.get("title") or recipe_title,
        "thumbnail_url": recipe.get("thumbnail_url") or thumbnail_url,
        "created_at": event_time,
        "saved_at": event_time,
        "channel_name": recipe.get("channel_name"),
        "category": recipe.get("category"),
        "difficulty": recipe.get("difficulty"),
        "servings": recipe.get("servings"),
        "total_estimated_price": recipe.get("total_estimated_price"),
        "total_calorie": recipe.get("total_calorie"),
        "like_count": recipe.get("like_count", 0),
        "comment_count": recipe.get("comment_count", 0),
        "share_count": recipe.get("share_count", 0),
        "status": recipe.get("status"),
    }
    recipe_table.put_item(Item=item)
    return item


def list_user_history(user_id: str, limit: int = 20):
    response = recipe_table.query(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("HISTORY#"),
        ScanIndexForward=False,
        Limit=limit
    )
    return response.get("Items", [])


def list_user_activities(user_id: str, limit: int = 20):
    response = recipe_table.query(
        IndexName="UserActivityIndex",
        KeyConditionExpression=Key("user_id").eq(user_id),
        ScanIndexForward=False,
        Limit=limit
    )
    return response.get("Items", [])


def delete_user_profile(user_id: str) -> bool:
    response = user_table.delete_item(
        Key={"user_id": user_id},
        ReturnValues="ALL_OLD"
    )
    return bool(response.get("Attributes"))


def delete_all_user_history(user_id: str) -> int:
    deleted_count = 0
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("HISTORY#")
    }

    while True:
        response = recipe_table.query(**query_kwargs)
        items = response.get("Items", [])
        if items:
            with recipe_table.batch_writer() as batch:
                for item in items:
                    batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
                    deleted_count += 1

        if "LastEvaluatedKey" not in response:
            break
        query_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return deleted_count


def delete_all_user_activities(user_id: str) -> int:
    deleted_count = 0
    anonymized_comment_count = 0
    query_kwargs = {
        "IndexName": "UserActivityIndex",
        "KeyConditionExpression": Key("user_id").eq(user_id)
    }

    while True:
        response = recipe_table.query(**query_kwargs)
        items = response.get("Items", [])
        if items:
            for item in items:
                pk = item.get("PK")
                sk = item.get("SK")
                if not pk or not sk:
                    continue

                # 댓글은 데이터 무결성을 위해 남기고 작성자 정보만 익명화한다.
                if str(sk).startswith("COMMENT#"):
                    recipe_table.update_item(
                        Key={"PK": pk, "SK": sk},
                        UpdateExpression="SET user_id = :uid, nickname = :nickname",
                        ExpressionAttributeValues={
                            ":uid": "DELETED_USER",
                            ":nickname": "알수없음"
                        }
                    )
                    anonymized_comment_count += 1
                else:
                    recipe_table.delete_item(Key={"PK": pk, "SK": sk})
                    deleted_count += 1

        if "LastEvaluatedKey" not in response:
            break
        query_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return {
        "deleted_activity_count": deleted_count,
        "anonymized_comment_count": anonymized_comment_count
    }
