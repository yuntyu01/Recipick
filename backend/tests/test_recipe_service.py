import pytest

from fastapi import HTTPException

from app.main_api.services import recipe_service


def test_create_comment_anonymous_with_uid(monkeypatch):
    captured = {}

    def fake_get_or_create_anonymous_number(video_id, anon_uid):
        assert video_id == "vid1"
        assert anon_uid == "anonuid123"
        return 7

    def fake_create_comment(*, video_id, user_id, nickname, content, like_count, is_anonymous, anonymous_number=None):
        captured.update(
            {
                "video_id": video_id,
                "user_id": user_id,
                "nickname": nickname,
                "content": content,
                "like_count": like_count,
                "is_anonymous": is_anonymous,
                "anonymous_number": anonymous_number,
            }
        )
        return captured

    monkeypatch.setattr(recipe_service.recipe_repo, "get_or_create_anonymous_number", fake_get_or_create_anonymous_number)
    monkeypatch.setattr(recipe_service.recipe_repo, "create_comment", fake_create_comment)

    result = recipe_service.create_comment(
        video_id="vid1",
        content="hi",
        like_count=0,
        user_id="anonuid123",
        nickname=None,
        is_anonymous=True,
    )

    assert result["is_anonymous"] is True
    assert result["anonymous_number"] == 7
    assert result["nickname"] == "익명7"
    assert result["user_id"] == "anonuid123"


def test_create_comment_anonymous_without_uid(monkeypatch):
    captured = {}

    def fake_get_or_create_anonymous_number(video_id, anon_uid):
        assert anon_uid is None
        return 3

    def fake_create_comment(*, video_id, user_id, nickname, content, like_count, is_anonymous, anonymous_number=None):
        captured.update(
            {
                "video_id": video_id,
                "user_id": user_id,
                "nickname": nickname,
                "content": content,
                "like_count": like_count,
                "is_anonymous": is_anonymous,
                "anonymous_number": anonymous_number,
            }
        )
        return captured

    monkeypatch.setattr(recipe_service.recipe_repo, "get_or_create_anonymous_number", fake_get_or_create_anonymous_number)
    monkeypatch.setattr(recipe_service.recipe_repo, "create_comment", fake_create_comment)

    result = recipe_service.create_comment(
        video_id="vid2",
        content="anon",
        like_count=0,
        user_id=None,
        nickname=None,
        is_anonymous=True,
    )

    assert result["is_anonymous"] is True
    assert result["anonymous_number"] == 3
    assert result["nickname"] == "익명3"
    assert result["user_id"] == "ANON#3"


def test_create_comment_requires_auth_for_non_anonymous():
    with pytest.raises(HTTPException) as exc:
        recipe_service.create_comment(
            video_id="vid3",
            content="hi",
            like_count=0,
            user_id=None,
            nickname=None,
            is_anonymous=False,
        )
    assert exc.value.status_code == 400
