from app.main_api.main import app
from app.main_api.routers import recipe_router


def _override_auth():
    # 인증 필수 API 테스트를 위해 공통 인증 의존성을 오버라이드한다.
    app.dependency_overrides[recipe_router.get_current_auth_user] = lambda: {
        "user_id": "user123",
        "nickname": "요리왕",
        "is_anonymous": False,
    }


# 제목 검색 성공 케이스
def test_search_by_title_success(client, monkeypatch):
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "search_recipes_by_title",
        lambda keyword, limit=20: [
            {
                "video_id": "abc123",
                "title": "맛있는 김치찌개 만들기",
                "thumbnail_url": "https://img.youtube.com/vi/abc123/hqdefault.jpg",
            },
            {
                "video_id": "def456",
                "title": "김치볶음밥 레시피",
                "thumbnail_url": "https://img.youtube.com/vi/def456/hqdefault.jpg",
            },
        ],
    )
    res = client.get("/api/recipes/search/title?keyword=김치")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 2
    assert all("김치" in item["title"] for item in body)


# 제목 검색 결과 없음 케이스
def test_search_by_title_empty(client, monkeypatch):
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "search_recipes_by_title",
        lambda keyword, limit=20: [],
    )
    res = client.get("/api/recipes/search/title?keyword=없는레시피")
    assert res.status_code == 200
    assert res.json() == []


# 제목 검색 keyword 누락 시 422 반환
def test_search_by_title_missing_keyword(client):
    res = client.get("/api/recipes/search/title")
    assert res.status_code == 422


# 레시피 요청 기본 성공 케이스
def test_request_recipe(client, monkeypatch):
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "process_recipe_request",
        lambda video_id, original_url, sharer_nickname, title, channel_name: {
            "status": "PROCESSING",
            "video_id": video_id,
            "thumbnail_url": "https://img.youtube.com/vi/test/hqdefault.jpg",
            "title": title,
            "channel_name": channel_name,
            "data": None,
        },
    )

    res = client.post(
        "/api/recipes/",
        json={
            "video_id": "test",
            "original_url": "https://youtube.com/watch?v=test",
            "sharer_nickname": "tester",
            "title": "title",
            "channel_name": "channel",
        },
    )
    assert res.status_code == 200
    assert res.json()["status"] == "PROCESSING"


# 카테고리별 추천 조회 성공 케이스
def test_get_recommendations_by_category_success(client, monkeypatch):
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "get_recommended_videos_by_category",
        lambda category, limit=20: [
            {
                "video_id": "abc123",
                "title": "간단 김치볶음밥",
                "channel_name": "요리왕",
                "thumbnail_url": "https://img.youtube.com/vi/abc123/hqdefault.jpg",
                "url": "https://www.youtube.com/watch?v=abc123",
                "category": category,
            }
        ],
    )

    res = client.get("/api/recipes/recommendations/한식?limit=10")
    assert res.status_code == 200
    body = res.json()
    assert isinstance(body, list)
    assert body[0]["video_id"] == "abc123"
    assert body[0]["category"] == "한식"


# 지원하지 않는 카테고리 요청 시 400 반환
def test_get_recommendations_by_category_invalid(client, monkeypatch):
    from fastapi import HTTPException

    def _raise_invalid(category, limit=20):
        raise HTTPException(status_code=400, detail="지원하지 않는 카테고리입니다.")

    monkeypatch.setattr(
        recipe_router.recipe_service,
        "get_recommended_videos_by_category",
        _raise_invalid,
    )

    res = client.get("/api/recipes/recommendations/기타")
    assert res.status_code == 400


# 레시피 상태 조회 성공 케이스
def test_get_recipe_success(client, monkeypatch):
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "get_recipe_info",
        lambda video_id: {
            "status": "COMPLETED",
            "thumbnail_url": "https://img.youtube.com/vi/test/hqdefault.jpg",
            "title": "title",
            "channel_name": "channel",
            "category": "한식",
        },
    )
    res = client.get("/api/recipes/test")
    assert res.status_code == 200
    assert res.json()["status"] == "COMPLETED"
    assert res.json()["data"]["category"] == "한식"


# 레시피 미존재 404 케이스
def test_get_recipe_not_found(client, monkeypatch):
    monkeypatch.setattr(recipe_router.recipe_service, "get_recipe_info", lambda video_id: None)
    res = client.get("/api/recipes/missing")
    assert res.status_code == 404


# 비로그인 댓글은 익명으로 저장되어야 한다.
def test_create_comment_anonymous(client, monkeypatch):
    app.dependency_overrides[recipe_router.get_current_auth_user] = lambda: {
        "user_id": "anonuid123",
        "nickname": "익명",
        "is_anonymous": True,
    }

    def fake_create_comment(video_id, content, like_count=0, user_id=None, nickname=None, is_anonymous=False):
        assert user_id == "anonuid123"
        assert nickname == "익명"
        assert is_anonymous is True
        return {
            "comment_id": "COMMENT#1#ANON#1",
            "video_id": video_id,
            "user_id": "ANON#1",
            "nickname": "익명1",
            "content": content,
            "like_count": like_count,
            "created_at": "2026-02-26T00:00:00Z",
        }

    monkeypatch.setattr(recipe_router.recipe_service, "create_comment", fake_create_comment)
    res = client.post("/api/recipes/test/comments", json={"content": "익명 댓글", "like_count": 0})
    assert res.status_code == 200
    assert res.json()["nickname"] == "익명1"


# 로그인 댓글은 토큰 사용자 정보로 저장되어야 한다.
def test_create_comment_authenticated(client, monkeypatch):
    _override_auth()

    def fake_create_comment(video_id, content, like_count=0, user_id=None, nickname=None, is_anonymous=False):
        assert user_id == "user123"
        assert nickname == "요리왕"
        return {
            "comment_id": "COMMENT#1#user123",
            "video_id": video_id,
            "user_id": user_id,
            "nickname": nickname,
            "content": content,
            "like_count": like_count,
            "created_at": "2026-02-26T00:00:00Z",
        }

    monkeypatch.setattr(recipe_router.recipe_service, "create_comment", fake_create_comment)
    res = client.post("/api/recipes/test/comments", json={"content": "로그인 댓글", "like_count": 0})
    assert res.status_code == 200
    assert res.json()["user_id"] == "user123"


# 댓글 목록 조회 케이스
def test_list_comments(client, monkeypatch):
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "list_comments",
        lambda video_id, limit=20: [
            {
                "comment_id": "COMMENT#1#user123",
                "video_id": video_id,
                "user_id": "user123",
                "nickname": "요리왕",
                "content": "hi",
                "like_count": 0,
                "created_at": "2026-02-26T00:00:00Z",
            }
        ],
    )
    res = client.get("/api/recipes/test/comments?limit=5")
    assert res.status_code == 200
    assert len(res.json()) == 1


# 댓글 수정은 인증 필수
def test_update_comment_requires_auth(client):
    res = client.patch("/api/recipes/test/comments", json={"comment_id": "COMMENT#1", "content": "edit"})
    assert res.status_code == 401


# 댓글 생성은 인증 필수
def test_create_comment_requires_auth(client):
    res = client.post("/api/recipes/test/comments", json={"content": "익명 댓글", "like_count": 0})
    assert res.status_code == 401


# 댓글 수정 성공 케이스
def test_update_comment_success(client, monkeypatch):
    _override_auth()
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "update_comment",
        lambda video_id, comment_id, user_id, content: {
            "comment_id": comment_id,
            "video_id": video_id,
            "user_id": user_id,
            "nickname": "요리왕",
            "content": content,
            "like_count": 0,
            "created_at": "2026-02-26T00:00:00Z",
        },
    )
    res = client.patch("/api/recipes/test/comments", json={"comment_id": "COMMENT#1#user123", "content": "edited"})
    assert res.status_code == 200
    assert res.json()["content"] == "edited"


# 댓글 삭제 성공 케이스
def test_delete_comment_success(client, monkeypatch):
    _override_auth()
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "delete_comment",
        lambda video_id, comment_id, user_id: {
            "success": True,
            "action": "DELETE_COMMENT",
            "video_id": video_id,
            "user_id": user_id,
            "created_at": None,
            "already_exists": False,
        },
    )
    res = client.request("DELETE", "/api/recipes/test/comments", json={"comment_id": "COMMENT#1#user123"})
    assert res.status_code == 200
    assert res.json()["action"] == "DELETE_COMMENT"


# 좋아요는 인증 필수
def test_like_requires_auth(client):
    res = client.post("/api/recipes/test/likes")
    assert res.status_code == 401


# 좋아요 성공 케이스
def test_like_success(client, monkeypatch):
    _override_auth()
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "like_recipe",
        lambda video_id, user_id: {
            "success": True,
            "action": "LIKE",
            "video_id": video_id,
            "user_id": user_id,
            "created_at": "2026-02-26T00:00:00Z",
            "already_exists": False,
        },
    )
    res = client.post("/api/recipes/test/likes")
    assert res.status_code == 200
    assert res.json()["action"] == "LIKE"


# 좋아요 취소 성공 케이스
def test_unlike_success(client, monkeypatch):
    _override_auth()
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "unlike_recipe",
        lambda video_id, user_id: {
            "success": True,
            "action": "UNLIKE",
            "video_id": video_id,
            "user_id": user_id,
            "created_at": None,
            "already_exists": False,
        },
    )
    res = client.request("DELETE", "/api/recipes/test/likes")
    assert res.status_code == 200
    assert res.json()["action"] == "UNLIKE"


# 북마크 성공 케이스
def test_bookmark_success(client, monkeypatch):
    _override_auth()
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "bookmark_recipe",
        lambda video_id, user_id: {
            "success": True,
            "action": "BOOKMARK",
            "video_id": video_id,
            "user_id": user_id,
            "created_at": "2026-02-26T00:00:00Z",
            "already_exists": False,
        },
    )
    res = client.post("/api/recipes/test/bookmarks")
    assert res.status_code == 200
    assert res.json()["action"] == "BOOKMARK"


# 북마크 취소 성공 케이스
def test_unbookmark_success(client, monkeypatch):
    _override_auth()
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "unbookmark_recipe",
        lambda video_id, user_id: {
            "success": True,
            "action": "UNBOOKMARK",
            "video_id": video_id,
            "user_id": user_id,
            "created_at": None,
            "already_exists": False,
        },
    )
    res = client.request("DELETE", "/api/recipes/test/bookmarks")
    assert res.status_code == 200
    assert res.json()["action"] == "UNBOOKMARK"


# 공유 이벤트 기록 성공 케이스
def test_share_success(client, monkeypatch):
    _override_auth()
    monkeypatch.setattr(
        recipe_router.recipe_service,
        "share_recipe",
        lambda video_id, user_id: {
            "success": True,
            "action": "SHARE",
            "video_id": video_id,
            "user_id": user_id,
            "created_at": "2026-02-26T00:00:00Z",
            "already_exists": False,
        },
    )
    res = client.post("/api/recipes/test/shares")
    assert res.status_code == 200
    assert res.json()["action"] == "SHARE"
