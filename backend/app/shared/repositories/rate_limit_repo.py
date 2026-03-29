from datetime import datetime, timedelta, timezone
from typing import Tuple

import boto3
from botocore.exceptions import ClientError

from app.shared.config import settings

dynamodb = boto3.resource("dynamodb", region_name=settings.REGION)
recipe_table = dynamodb.Table(settings.RECIPE_TABLE)


def _today_key(user_id: str) -> Tuple[str, str]:
    """일자 단위 레이트리밋 키 생성"""
    now = datetime.now(timezone.utc)
    yyyymmdd = now.strftime("%Y%m%d")
    pk = f"RATE#{user_id}#{yyyymmdd}"
    sk = "LIMIT"
    return pk, sk


def _next_midnight_utc_ts() -> int:
    """다음 날 자정(UTC) TTL 시각 계산"""
    now = datetime.now(timezone.utc)
    next_day = datetime(year=now.year, month=now.month, day=now.day, tzinfo=timezone.utc) + timedelta(days=1)
    return int(next_day.timestamp())


def increment_daily_ai_count(user_id: str, limit: int) -> dict:
    """하루 질문 횟수 1 증가 및 제한 초과 여부 반환"""
    pk, sk = _today_key(user_id)
    ttl_expire_at = _next_midnight_utc_ts()

    try:
        # TTL과 카운트를 함께 갱신해 일자별 레이트리밋을 유지한다.
        response = recipe_table.update_item(
            Key={"PK": pk, "SK": sk},
            UpdateExpression="SET ttl_expire_at = :ttl ADD ai_ask_count :inc",
            ConditionExpression="attribute_not_exists(ai_ask_count) OR ai_ask_count < :limit",
            ExpressionAttributeValues={
                ":inc": 1,
                ":ttl": ttl_expire_at,
                ":limit": limit,
            },
            ReturnValues="UPDATED_NEW",
        )
        attrs = response.get("Attributes", {})
        return {
            "allowed": True,
            "ai_ask_count": int(attrs.get("ai_ask_count", 1)),
            "ttl_expire_at": int(attrs.get("ttl_expire_at", ttl_expire_at)),
        }
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            existing = recipe_table.get_item(Key={"PK": pk, "SK": sk}).get("Item", {})
            return {
                "allowed": False,
                "ai_ask_count": int(existing.get("ai_ask_count", limit)),
                "ttl_expire_at": int(existing.get("ttl_expire_at", ttl_expire_at)),
            }
        raise
