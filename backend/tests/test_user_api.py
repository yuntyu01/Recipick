from app.main_api.routers import user_router


# 프로필 업서트 기본 성공 케이스
def test_put_user_profile(client, monkeypatch):
    monkeypatch.setattr(
        user_router.user_service,
        "upsert_user_profile",
        lambda user_id, nickname, profile_image: {
            "user_id": user_id,
            "nickname": nickname,
            "profile_image": profile_image,
            "created_at": "2026-02-26T00:00:00Z",
        },
    )

    res = client.put("/api/users/user123/profile", json={"nickname": "요리왕", "profile_image": "https://img.test/p.png"})
    assert res.status_code == 200
    assert res.json()["user_id"] == "user123"


# 프로필 조회 성공 케이스
def test_get_user_profile_success(client, monkeypatch):
    monkeypatch.setattr(
        user_router.user_service,
        "get_user_profile",
        lambda user_id: {
            "user_id": user_id,
            "nickname": "요리왕",
            "profile_image": None,
            "created_at": "2026-02-26T00:00:00Z",
        },
    )

    res = client.get("/api/users/user123/profile")
    assert res.status_code == 200
    assert res.json()["nickname"] == "요리왕"


# 없는 유저 조회 시 404 케이스
def test_get_user_profile_not_found(client, monkeypatch):
    monkeypatch.setattr(user_router.user_service, "get_user_profile", lambda user_id: None)
    res = client.get("/api/users/missing/profile")
    assert res.status_code == 404


# 히스토리 생성 성공 케이스
def test_post_user_history(client, monkeypatch):
    monkeypatch.setattr(
        user_router.user_service,
        "create_user_history",
        lambda user_id, video_id, title, thumbnail_url, created_at=None: {
            "video_id": video_id,
            "title": title,
            "thumbnail_url": thumbnail_url,
            "created_at": created_at or "2026-02-26T00:00:00Z",
            "saved_at": created_at or "2026-02-26T00:00:00Z",
            "channel_name": "백종원 PAIK JONG WON",
            "category": "한식",
            "difficulty": "중",
            "servings": 2,
            "total_estimated_price": 12000,
            "total_calorie": 850,
            "like_count": 10,
            "comment_count": 3,
            "share_count": 1,
            "status": "COMPLETED",
        },
    )

    res = client.post(
        "/api/users/user123/history",
        json={
            "video_id": "abc123",
            "title": "비빔밥",
            "thumbnail_url": "https://img.youtube.com/vi/abc123/hqdefault.jpg",
        },
    )
    assert res.status_code == 200
    assert res.json()["video_id"] == "abc123"
    assert res.json()["saved_at"] == "2026-02-26T00:00:00Z"
    assert res.json()["category"] == "한식"
    assert res.json()["status"] == "COMPLETED"


# 히스토리 목록 조회 케이스
def test_get_user_history(client, monkeypatch):
    monkeypatch.setattr(
        user_router.user_service,
        "get_user_history",
        lambda user_id, limit=20: [
            {
                "video_id": "abc123",
                "title": "비빔밥",
                "thumbnail_url": "https://img.youtube.com/vi/abc123/hqdefault.jpg",
                "created_at": "2026-02-26T00:00:00Z",
                "saved_at": "2026-02-26T00:00:00Z",
                "channel_name": "백종원 PAIK JONG WON",
                "category": "한식",
                "difficulty": "중",
                "servings": 2,
                "total_estimated_price": 12000,
                "total_calorie": 850,
                "like_count": 10,
                "comment_count": 3,
                "share_count": 1,
                "status": "COMPLETED",
            }
        ],
    )
    res = client.get("/api/users/user123/history?limit=10")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
    assert res.json()[0]["video_id"] == "abc123"
    assert res.json()[0]["saved_at"] == "2026-02-26T00:00:00Z"
    assert res.json()[0]["channel_name"] == "백종원 PAIK JONG WON"


# 활동 목록 조회 케이스
def test_get_user_activities(client, monkeypatch):
    monkeypatch.setattr(
        user_router.user_service,
        "get_user_activities",
        lambda user_id, limit=20: [
            {
                "user_id": user_id,
                "video_id": "abc123",
                "activity_type": "LIKE",
                "created_at": "2026-02-26T00:00:00Z",
                "title": "비빔밥",
                "thumbnail_url": "https://img.youtube.com/vi/abc123/hqdefault.jpg",
                "nickname": None,
                "content": None,
                "like_count": None,
            }
        ],
    )
    res = client.get("/api/users/user123/activities")
    assert res.status_code == 200
    assert res.json()[0]["activity_type"] == "LIKE"
