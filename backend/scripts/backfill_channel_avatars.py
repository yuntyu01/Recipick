"""
기존 레시피에 channel_profile_url을 채워넣는 마이그레이션 스크립트.

사용법:
  # 환경변수 세팅 후 실행
  export AWS_REGION=ap-northeast-2
  export RECIPE_TABLE_NAME=Recipick-Recipes
  export S3_BUCKET_NAME=recipick-static-bucket

  # 미리보기 (실제 변경 없음)
  python3 scripts/backfill_channel_avatars.py --dry-run

  # 실제 실행
  python scripts/backfill_channel_avatars.py
"""

from __future__ import annotations

import os
import re
import time
import argparse

import boto3
import requests
from boto3.dynamodb.conditions import Attr

REGION = os.getenv("AWS_REGION", "ap-northeast-2")
TABLE_NAME = os.environ["RECIPE_TABLE_NAME"]
BUCKET_NAME = os.environ["S3_BUCKET_NAME"]
CHANNEL_AVATAR_PREFIX = "channel-avatars"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
s3 = boto3.client("s3", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)


def fetch_channel_avatar_url(video_url: str) -> str | None:
    try:
        resp = requests.get(video_url, timeout=10, headers={"Accept-Language": "ko"})
        resp.raise_for_status()
        match = re.search(
            r'"channelThumbnail"\s*:\s*\{\s*"thumbnails"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"',
            resp.text,
        )
        if match:
            return match.group(1).replace(
                "s48-c-k-c0x00ffffff-no-rj", "s176-c-k-c0x00ffffff-no-rj"
            )
        return None
    except Exception as e:
        print(f"  [WARN] 프로필 URL 추출 실패: {e}")
        return None


def upload_to_s3(video_id: str, image_url: str) -> str | None:
    try:
        resp = requests.get(image_url, timeout=10)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "image/jpeg")
        ext = "jpg" if "jpeg" in content_type or "jpg" in content_type else "png"
        s3_key = f"{CHANNEL_AVATAR_PREFIX}/{video_id}.{ext}"
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=s3_key,
            Body=resp.content,
            ContentType=content_type,
        )
        return f"https://{BUCKET_NAME}.s3.{REGION}.amazonaws.com/{s3_key}"
    except Exception as e:
        print(f"  [WARN] S3 업로드 실패: {e}")
        return None


def scan_completed_recipes():
    """COMPLETED 상태이고 channel_profile_url이 없는 레시피를 스캔."""
    items = []
    scan_kwargs = {
        "FilterExpression": Attr("status").eq("COMPLETED")
        & Attr("SK").eq("INFO")
        & (
            Attr("channel_profile_url").not_exists()
            | Attr("channel_profile_url").eq("")
        ),
        "ProjectionExpression": "PK, original_url",
    }

    while True:
        response = table.scan(**scan_kwargs)
        items.extend(response.get("Items", []))
        if "LastEvaluatedKey" not in response:
            break
        scan_kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    return items


def update_recipe(video_id: str, channel_profile_url: str):
    table.update_item(
        Key={"PK": f"VIDEO#{video_id}", "SK": "INFO"},
        UpdateExpression="SET channel_profile_url = :url",
        ExpressionAttributeValues={":url": channel_profile_url},
    )


def main():
    parser = argparse.ArgumentParser(description="기존 레시피에 채널 프로필 이미지 채우기")
    parser.add_argument("--dry-run", action="store_true", help="실제 변경 없이 미리보기만")
    args = parser.parse_args()

    print(f"[INFO] 테이블: {TABLE_NAME}, 버킷: {BUCKET_NAME}")
    print("[INFO] channel_profile_url이 없는 COMPLETED 레시피 스캔 중...")

    recipes = scan_completed_recipes()
    print(f"[INFO] 대상 레시피: {len(recipes)}개\n")

    success = 0
    failed = 0

    for i, item in enumerate(recipes, 1):
        video_id = str(item["PK"]).replace("VIDEO#", "")
        original_url = item.get("original_url", f"https://www.youtube.com/watch?v={video_id}")

        print(f"[{i}/{len(recipes)}] {video_id}")

        if args.dry_run:
            print(f"  → (dry-run) {original_url}")
            continue

        avatar_url = fetch_channel_avatar_url(original_url)
        if not avatar_url:
            print("  → 채널 프로필 URL을 찾을 수 없음, 건너뜀")
            failed += 1
            continue

        s3_url = upload_to_s3(video_id, avatar_url)
        if not s3_url:
            failed += 1
            continue

        update_recipe(video_id, s3_url)
        print(f"  → 완료: {s3_url}")
        success += 1

        # YouTube 요청 제한 방지
        time.sleep(1)

    print(f"\n[결과] 성공: {success}, 실패: {failed}, 전체: {len(recipes)}")


if __name__ == "__main__":
    main()
