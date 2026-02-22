import os

class Settings:
    USER_TABLE = os.environ["USER_TABLE_NAME"]
    RECIPE_TABLE = os.environ["RECIPE_TABLE_NAME"]
    SQS_QUEUE_URL: str = os.environ["SQS_QUEUE_URL"]
    REGION: str = os.getenv("AWS_REGION", "ap-northeast-2")
    S3_BUCKET_NAME: str = os.environ["S3_BUCKET_NAME"]
    RAPIDAPI_KEY: str = os.environ["RAPIDAPI_KEY"]
    
settings = Settings()