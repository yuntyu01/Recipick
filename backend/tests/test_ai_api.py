import types

import pytest

from app.main_api.dependencies import auth as auth_dep
from app.main_api.services import ai_service
from app.shared.repositories import rate_limit_repo, recipe_repo


class _FakeResponse:
    text = "요리 관련 질문만 도와드릴 수 있어요"


class _FakeModels:
    def generate_content(self, *args, **kwargs):
        return _FakeResponse()


class _FakeClient:
    def __init__(self, api_key=None):
        self.models = _FakeModels()


def _override_auth():
    return {"user_id": "user-1"}


def test_ping_ok(client):
    response = client.get("/api/ping")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_ai_ask_success(client, monkeypatch):
    app = client.app
    app.dependency_overrides[auth_dep.get_current_auth_user] = _override_auth

    monkeypatch.setattr(rate_limit_repo, "increment_daily_ai_count", lambda user_id, limit: {
        "allowed": True,
        "ai_ask_count": 1,
        "ttl_expire_at": 1711756799,
    })
    monkeypatch.setattr(recipe_repo, "get_recipe", lambda video_id: {
        "title": "계란말이",
        "category": "한식",
        "difficulty": "중",
        "servings": 2,
        "ingredients": [{"name": "계란"}],
        "steps": [{"desc": "팬에 붓기"}],
    })
    monkeypatch.setattr(ai_service, "genai", types.SimpleNamespace(Client=_FakeClient))
    ai_service.settings.GEMINI_API_KEY = "test-key"

    response = client.post(
        "/api/ai/ask",
        json={"video_id": "video-1", "question": "간장 대신 뭐 넣어?", "current_step": 1},
        headers={"Authorization": "Bearer test"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"]
    assert body["ai_ask_count"] == 1
    assert body["ai_ask_limit"] == ai_service.settings.AI_DAILY_LIMIT


def test_ai_ask_rate_limited(client, monkeypatch):
    app = client.app
    app.dependency_overrides[auth_dep.get_current_auth_user] = _override_auth

    monkeypatch.setattr(rate_limit_repo, "increment_daily_ai_count", lambda user_id, limit: {
        "allowed": False,
        "ai_ask_count": limit,
        "ttl_expire_at": 1711756799,
    })
    monkeypatch.setattr(recipe_repo, "get_recipe", lambda video_id: {
        "title": "계란말이",
        "category": "한식",
        "ingredients": [{"name": "계란"}],
        "steps": [{"desc": "팬에 붓기"}],
    })
    monkeypatch.setattr(ai_service, "genai", types.SimpleNamespace(Client=_FakeClient))
    ai_service.settings.GEMINI_API_KEY = "test-key"

    response = client.post(
        "/api/ai/ask",
        json={"video_id": "video-1", "question": "간장 대신 뭐 넣어?", "current_step": 1},
        headers={"Authorization": "Bearer test"},
    )

    assert response.status_code == 429
