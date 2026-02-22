import boto3
from datetime import datetime, timezone
from app.shared.config import settings

dynamodb = boto3.resource('dynamodb', region_name=settings.REGION)
user_table = dynamodb.Table(settings.USER_TABLE)
recipe_table = dynamodb.Table(settings.RECIPE_TABLE)

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