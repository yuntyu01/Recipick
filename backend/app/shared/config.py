import os

class Settings:
    USER_TABLE = os.environ["USER_TABLE_NAME"]
    RECIPE_TABLE = os.environ["RECIPE_TABLE_NAME"]
    SQS_QUEUE_URL: str = os.environ["SQS_QUEUE_URL"]
    REGION: str = os.getenv("AWS_REGION", "ap-northeast-2")
    S3_BUCKET_NAME: str = os.environ["S3_BUCKET_NAME"]
    FIREBASE_SERVICE_ACCOUNT: str = os.getenv("FIREBASE_SERVICE_ACCOUNT", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_CHAT_MODEL: str = os.getenv("GEMINI_CHAT_MODEL", "gemini-3-flash-preview")
    AI_DAILY_LIMIT: int = int(os.getenv("AI_DAILY_LIMIT", "5"))
    
settings = Settings()
