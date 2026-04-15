import boto3
from datetime import datetime, timezone
from typing import Optional
from boto3.dynamodb.conditions import Key, Attr
from app.shared.config import settings

dynamodb = boto3.resource('dynamodb', region_name=settings.REGION)
user_table = dynamodb.Table(settings.USER_TABLE)
recipe_table = dynamodb.Table(settings.RECIPE_TABLE)


# UTC ISO 타임스탬프 생성
def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# 사용자 프로필 조회
def get_user_profile(user_id: str):
    response = user_table.get_item(
        Key={"user_id": user_id}
    )
    return response.get("Item")


# 사용자 프로필 생성/갱신
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


# 유저 히스토리 추가
def add_user_history(
    user_id: str,
    video_id: str,
    title: str,
    thumbnail_url: str,
    created_at: Optional[str] = None
):
    # 중복 체크: 같은 user_id + video_id가 이미 있으면 저장하지 않음
    # DynamoDB FilterExpression은 페이지 단위로 적용되므로 전체 페이지를 순회해야 함
    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("HISTORY#"),
        "FilterExpression": Attr("video_id").eq(video_id),
    }
    while True:
        existing = recipe_table.query(**query_kwargs)
        if existing.get("Items"):
            return existing["Items"][0]
        if "LastEvaluatedKey" not in existing:
            break
        query_kwargs["ExclusiveStartKey"] = existing["LastEvaluatedKey"]

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
        "title": recipe.get("title") or title,
        "thumbnail_url": recipe.get("thumbnail_url") or thumbnail_url,
        "created_at": event_time,
        "saved_at": event_time,
        "channel_name": recipe.get("channel_name"),
        "channel_profile_url": recipe.get("channel_profile_url") or "",
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


# 유저 히스토리 최신순 조회
def list_user_history(user_id: str, limit: int = 20):
    response = recipe_table.query(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("HISTORY#"),
        ScanIndexForward=False,
        Limit=limit
    )
    return response.get("Items", [])


# 유저 히스토리 메모 조회
def get_history_memo(user_id: str, video_id: str):
    response = recipe_table.query(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("HISTORY#"),
        FilterExpression=Attr("video_id").eq(video_id),
    )
    items = response.get("Items", [])
    if not items:
        return None
    item = items[0]
    return {"video_id": video_id, "memo": item.get("memo", "")}


# 유저 히스토리 메모 업데이트
def update_history_memo(user_id: str, video_id: str, memo: str):
    # video_id로 해당 히스토리 아이템의 SK를 찾은 뒤 memo 업데이트
    response = recipe_table.query(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("HISTORY#"),
        FilterExpression=Attr("video_id").eq(video_id),
    )
    items = response.get("Items", [])
    if not items:
        return None

    item = items[0]
    recipe_table.update_item(
        Key={"PK": item["PK"], "SK": item["SK"]},
        UpdateExpression="SET memo = :memo",
        ExpressionAttributeValues={":memo": memo},
    )
    item["memo"] = memo
    return item


# 유저 활동 로그 최신순 조회
def list_user_activities(user_id: str, limit: int = 20):
    response = recipe_table.query(
        IndexName="UserActivityIndex",
        KeyConditionExpression=Key("user_id").eq(user_id),
        ScanIndexForward=False,
        Limit=limit
    )
    return response.get("Items", [])


# 사용자 프로필 삭제 및 삭제 여부 반환
def delete_user_profile(user_id: str) -> bool:
    response = user_table.delete_item(
        Key={"user_id": user_id},
        ReturnValues="ALL_OLD"
    )
    return bool(response.get("Attributes"))


# 유저 히스토리 전체 삭제 및 삭제 건수 반환
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


# 유저 활동 로그 삭제/익명화 및 결과 반환
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

                # 댓글 유지 + 작성자 정보 익명화(데이터 무결성)
                if str(sk).startswith("COMMENT#"):
                    recipe_table.update_item(
                        Key={"PK": pk, "SK": sk},
                        UpdateExpression="SET user_id = :uid, nickname = :nickname, is_anonymous = :is_anonymous",
                        ExpressionAttributeValues={
                            ":uid": "DELETED_USER",
                            ":nickname": "알수없음",
                            ":is_anonymous": True,
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
