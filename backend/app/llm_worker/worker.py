import json
from app.llm_worker.services import extraction_service
from app.shared.repositories import recipe_repo

def sqs_handler(event, context):
    for record in event['Records']:
        body = json.loads(record['body'])
        video_id = body.get('video_id')
        original_url = body.get('original_url')
        
        try:
            # 여기서 yt-dlp랑 Gemini 지뢰밭 진입
            extraction_service.run_etl_pipeline(video_id, original_url)
        except Exception as e:
            # [현실적인 장애 처리] yt-dlp가 IP 밴을 먹든, 람다가 터지든 조용히 잡아냄
            print(f"[ERROR] 비동기 분석 실패 - {video_id}: {e}")
            # DB 상태를 FAILED로 덮어씌워서 프론트엔드가 폴링하다가 에러 화면을 띄우게 만듦
            recipe_repo.update_status(video_id, "FAILED") 
            
    return {"statusCode": 200}