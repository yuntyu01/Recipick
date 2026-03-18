from app.main_api.routers import auth_router


# Firebase 회원가입 API 응답 스키마 검증
def test_firebase_signup(client, monkeypatch):
    def fake_signup_with_firebase(id_token, nickname=None, profile_image=None):
        return {
            "success": True,
            "is_new_user": True,
            "user": {
                "user_id": "uid123",
                "nickname": nickname or "tester",
                "profile_image": profile_image,
                "created_at": "2026-02-26T00:00:00Z",
                "is_anonymous": False,
            },
        }

    monkeypatch.setattr(auth_router.auth_service, "signup_with_firebase", fake_signup_with_firebase)

    res = client.post(
        "/api/auth/firebase/signup",
        json={"id_token": "token", "nickname": "tester", "profile_image": "https://img.test/p.png"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["is_new_user"] is True
    assert body["user"]["user_id"] == "uid123"


# Firebase 로그인 API 응답 스키마 검증
def test_firebase_login(client, monkeypatch):
    def fake_login_with_firebase(id_token, nickname=None, profile_image=None):
        return {
            "success": True,
            "is_new_user": False,
            "user": {
                "user_id": "uid123",
                "nickname": "tester",
                "profile_image": None,
                "created_at": "2026-02-26T00:00:00Z",
                "is_anonymous": False,
            },
        }

    monkeypatch.setattr(auth_router.auth_service, "login_with_firebase", fake_login_with_firebase)

    res = client.post("/api/auth/firebase/login", json={"id_token": "token"})
    assert res.status_code == 200
    body = res.json()
    assert body["success"] is True
    assert body["is_new_user"] is False


# /me는 토큰이 없으면 401이어야 한다.
def test_auth_me_requires_bearer(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401


# /me는 Bearer 토큰 기반으로 사용자 정보를 반환한다.
def test_auth_me_success(client, monkeypatch):
    def fake_me_from_firebase_token(id_token):
        assert id_token == "token"
        return {
            "user_id": "uid123",
            "nickname": "tester",
            "profile_image": None,
            "created_at": "2026-02-26T00:00:00Z",
            "is_anonymous": False,
        }

    monkeypatch.setattr(auth_router.auth_service, "me_from_firebase_token", fake_me_from_firebase_token)
    res = client.get("/api/auth/me", headers={"Authorization": "Bearer token"})
    assert res.status_code == 200
    assert res.json()["user_id"] == "uid123"


def test_delete_me_success(client, monkeypatch):
    def fake_delete_my_account_data(id_token):
        assert id_token == "token"
        return {
            "success": True,
            "user_id": "uid123",
            "deleted_profile": True,
            "deleted_history_count": 1,
            "deleted_activity_count": 2,
            "anonymized_comment_count": 1,
        }

    monkeypatch.setattr(auth_router.auth_service, "delete_my_account_data", fake_delete_my_account_data)
    res = client.delete("/api/auth/me", headers={"Authorization": "Bearer token"})
    assert res.status_code == 200
    assert res.json()["success"] is True
