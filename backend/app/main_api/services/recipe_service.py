import boto3
import json
from decimal import Decimal
from app.shared.config import settings
from app.shared.repositories import recipe_repo
from app.shared.models.recipe_model import RecipeStatus

sqs = boto3.client('sqs', region_name=settings.REGION)

# Boto3가 숫자 데이터를 가져올 때 Decimal 객체로 가져와서 FastAPI가 500 에러를 뱉는 걸 막음
def replcae_decimals(obj):
    if isinstance(obj, list):
        return [replcae_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: replcae_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return obj

def process_recipe_request(video_id: str, original_url: str, sharer_nickname: str, title: str, channel_name: str):
    # 1. DB 캐싱 확인
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
  
    # 2. DB 초기 뼈대 저장
    thumb = recipe_repo.save_initial_recipe(video_id, original_url, sharer_nickname, title, channel_name)
    
    # 3. SQS로 비동기 작업 던지기
    sqs.send_message(
        QueueUrl=settings.SQS_QUEUE_URL,
        MessageBody=json.dumps({"video_id": video_id, "original_url": original_url})
    )
    
    # 4. 프론트엔드가 즉시 렌더링할 수 있도록 데이터 반환 
    return {
        "status": RecipeStatus.PROCESSING,
        "video_id": video_id,
        "thumbnail_url": thumb,
        "title": title,
        "channel_name": channel_name
    }