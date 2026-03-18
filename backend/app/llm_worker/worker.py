import json
from app.llm_worker.services import extraction_service
from app.shared.repositories import recipe_repo

# SQS 이벤트 수신/처리 엔트리포인트
def sqs_handler(event, context):
    for record in event['Records']:
        body = json.loads(record['body'])
        video_id = body.get('video_id')
        original_url = body.get('original_url')
        
        try:
            # LLM ETL 파이프라인 실행
            extraction_service.run_etl_pipeline(video_id, original_url)
        except Exception as e:
            # 비동기 처리 실패 로그/상태 전환
            print(f"[ERROR] 비동기 분석 실패 - {video_id}: {e}")
            recipe_repo.update_status(video_id, "FAILED") 
            
    return {"statusCode": 200}
