import os
import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _install_test_stubs():
    # 테스트는 외부 SDK 없이 돌아야 하므로 import 시점 의존성을 스텁으로 대체한다.
    if "boto3" not in sys.modules:
        fake_boto3 = types.ModuleType("boto3")

        class _FakeTable:
            def get_item(self, *args, **kwargs):
                return {}

            def put_item(self, *args, **kwargs):
                return {}

            def update_item(self, *args, **kwargs):
                return {}

            def query(self, *args, **kwargs):
                return {"Items": []}

            def delete_item(self, *args, **kwargs):
                return {}

        class _FakeDynamoResource:
            def Table(self, name):
                return _FakeTable()

        class _FakeSqsClient:
            def send_message(self, *args, **kwargs):
                return {"MessageId": "test"}

        fake_boto3.resource = lambda *args, **kwargs: _FakeDynamoResource()
        fake_boto3.client = lambda *args, **kwargs: _FakeSqsClient()
        sys.modules["boto3"] = fake_boto3

        fake_boto3_dynamodb = types.ModuleType("boto3.dynamodb")
        sys.modules["boto3.dynamodb"] = fake_boto3_dynamodb

        fake_boto3_conditions = types.ModuleType("boto3.dynamodb.conditions")

        class _FakeKey:
            def __init__(self, name):
                self.name = name

            def eq(self, value):
                return self

            def begins_with(self, value):
                return self

            def __and__(self, other):
                return self

        class _FakeAttr:
            def __init__(self, name):
                self.name = name

            def eq(self, value):
                return self

            def not_exists(self):
                return self

            def __and__(self, other):
                return self

            def __or__(self, other):
                return self

        fake_boto3_conditions.Key = _FakeKey
        fake_boto3_conditions.Attr = _FakeAttr
        sys.modules["boto3.dynamodb.conditions"] = fake_boto3_conditions

    if "botocore.exceptions" not in sys.modules:
        fake_botocore_ex = types.ModuleType("botocore.exceptions")

        class ClientError(Exception):
            def __init__(self, response=None, operation_name=None):
                self.response = response or {"Error": {"Code": "Unknown"}}
                self.operation_name = operation_name
                super().__init__(str(self.response))

        fake_botocore_ex.ClientError = ClientError
        sys.modules["botocore.exceptions"] = fake_botocore_ex

    if "firebase_admin" not in sys.modules:
        fake_fb = types.ModuleType("firebase_admin")
        fake_fb._apps = []
        fake_fb.get_app = lambda: object()
        fake_fb.initialize_app = lambda cred: object()
        sys.modules["firebase_admin"] = fake_fb

        fake_fb_auth = types.ModuleType("firebase_admin.auth")
        fake_fb_auth.verify_id_token = lambda token: {"uid": "uid123"}
        sys.modules["firebase_admin.auth"] = fake_fb_auth

        fake_fb_credentials = types.ModuleType("firebase_admin.credentials")
        fake_fb_credentials.Certificate = lambda d: d
        sys.modules["firebase_admin.credentials"] = fake_fb_credentials

    if "mangum" not in sys.modules:
        fake_mangum = types.ModuleType("mangum")
        fake_mangum.Mangum = lambda app: app
        sys.modules["mangum"] = fake_mangum


_install_test_stubs()


os.environ.setdefault("USER_TABLE_NAME", "test-users")
os.environ.setdefault("RECIPE_TABLE_NAME", "test-recipes")
os.environ.setdefault("SQS_QUEUE_URL", "https://example.com/test-queue")
os.environ.setdefault("S3_BUCKET_NAME", "test-bucket")
os.environ.setdefault("RAPIDAPI_KEY", "test-key")
os.environ.setdefault("AWS_REGION", "ap-northeast-2")
os.environ.setdefault("FIREBASE_SERVICE_ACCOUNT", "{}")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")

from app.main_api.main import app  # noqa: E402


@pytest.fixture()
def client():
    # 테스트 간 dependency override가 누적되지 않도록 매 테스트 초기화
    app.dependency_overrides = {}
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides = {}
