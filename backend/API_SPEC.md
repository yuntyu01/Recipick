# Recipick API Specification

## 1. 기본 정보
- Base URL: `/`
- Content-Type: `application/json`
- 인증 방식: `Authorization: Bearer {firebase_id_token}`
- 시간 포맷: ISO-8601 UTC (`2026-02-26T12:00:00Z`)

## 2. 인증 규칙 요약
- 인증 필수:
  - `POST /api/recipes/{video_id}/likes`
  - `DELETE /api/recipes/{video_id}/likes`
  - `POST /api/recipes/{video_id}/bookmarks`
  - `DELETE /api/recipes/{video_id}/bookmarks`
  - `POST /api/recipes/{video_id}/shares`
  - `PATCH /api/recipes/{video_id}/comments`
  - `DELETE /api/recipes/{video_id}/comments`
  - `GET /api/auth/me`
- 인증 선택:
  - `POST /api/recipes/{video_id}/comments` (미로그인 시 `익명N` 자동 부여)

## 3. Auth API

### POST `/api/auth/firebase/signup`
Firebase ID Token 검증 후 회원 프로필 생성/동기화

Request
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIs...",
  "nickname": "요리왕",
  "profile_image": "https://cdn.example.com/profiles/u1.png"
}
```

Response
```json
{
  "success": true,
  "is_new_user": true,
  "user": {
    "user_id": "firebase_uid_123",
    "nickname": "요리왕",
    "profile_image": "https://cdn.example.com/profiles/u1.png",
    "created_at": "2026-02-26T12:00:00Z"
  }
}
```

### POST `/api/auth/firebase/login`
Firebase ID Token 검증 후 로그인/프로필 동기화

### GET `/api/auth/me`
현재 로그인 사용자 조회 (인증 필수)

Response
```json
{
  "user_id": "firebase_uid_123",
  "nickname": "요리왕",
  "profile_image": "https://cdn.example.com/profiles/u1.png",
  "created_at": "2026-02-26T12:00:00Z"
}
```

### DELETE `/api/auth/me`
Recipick 앱 데이터만 탈퇴 처리 (인증 필수)
- Firebase 계정은 삭제하지 않음

Response
```json
{
  "success": true,
  "user_id": "firebase_uid_123",
  "deleted_profile": true,
  "deleted_history_count": 3,
  "deleted_activity_count": 5,
  "anonymized_comment_count": 2
}
```

## 4. User API

### PUT `/api/users/{user_id}/profile`
유저 프로필 생성/수정

Request
```json
{
  "nickname": "요리왕",
  "profile_image": "https://cdn.example.com/profiles/u1.png"
}
```

### GET `/api/users/{user_id}/profile`
유저 프로필 조회

### POST `/api/users/{user_id}/history`
유저 레시피 사용 이력 저장
- 요청 본문의 `recipe_title`, `thumbnail_url`는 fallback 값이며, 서버는 가능하면 `video_id`의 레시피 INFO에서 스냅샷을 채워 저장함

Request
```json
{
  "video_id": "dQw4w9WgXcQ",
  "recipe_title": "간장계란볶음밥",
  "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
}
```

Response
```json
{
  "video_id": "dQw4w9WgXcQ",
  "recipe_title": "간장계란볶음밥",
  "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "created_at": "2026-02-26T12:00:00Z",
  "saved_at": "2026-02-26T12:00:00Z",
  "channel_name": "백종원 PAIK JONG WON",
  "category": "한식",
  "difficulty": "중",
  "servings": 2,
  "total_estimated_price": 12000,
  "total_calorie": 850,
  "like_count": 10,
  "comment_count": 3,
  "share_count": 1,
  "status": "COMPLETED"
}
```

### GET `/api/users/{user_id}/history?limit=20`
유저 사용 이력 최신순 조회

### GET `/api/users/{user_id}/activities?limit=20`
유저 활동 최신순 조회 (댓글/좋아요/북마크/공유 등)

## 5. Recipe API

### POST `/api/recipes/`
레시피 분석 요청 (캐시 있으면 즉시 반환, 없으면 PROCESSING)

Request
```json
{
  "video_id": "dQw4w9WgXcQ",
  "original_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "sharer_nickname": "요리왕",
  "title": "레시피 분석 준비 중...",
  "channel_name": "알 수 없음"
}
```

Response
```json
{
  "status": "PROCESSING",
  "video_id": "dQw4w9WgXcQ",
  "thumbnail_url": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  "title": "레시피 분석 준비 중...",
  "channel_name": "알 수 없음",
  "data": null
}
```

### GET `/api/recipes/{video_id}`
레시피 상태/결과 조회

## 6. Recipe Comment API

### POST `/api/recipes/{video_id}/comments`
댓글 작성 (인증 선택)
- 로그인 사용자: 본인 `user_id/nickname` 사용
- 미로그인 사용자: `ANON#{n}`, `익명{n}` 자동 생성

Request
```json
{
  "content": "정말 맛있어요!",
  "like_count": 0
}
```

Response (미로그인 예시)
```json
{
  "comment_id": "COMMENT#2026-02-26T12:10:00Z#ANON#1",
  "video_id": "dQw4w9WgXcQ",
  "user_id": "ANON#1",
  "nickname": "익명1",
  "content": "정말 맛있어요!",
  "like_count": 0,
  "created_at": "2026-02-26T12:10:00Z"
}
```

### GET `/api/recipes/{video_id}/comments?limit=20`
댓글 최신순 조회

### PATCH `/api/recipes/{video_id}/comments`
댓글 수정 (인증 필수, 본인 댓글만 가능)

Request
```json
{
  "comment_id": "COMMENT#2026-02-26T12:10:00Z#firebase_uid_123",
  "content": "수정한 댓글입니다."
}
```

### DELETE `/api/recipes/{video_id}/comments`
댓글 삭제 (인증 필수, 본인 댓글만 가능)

Request
```json
{
  "comment_id": "COMMENT#2026-02-26T12:10:00Z#firebase_uid_123"
}
```

## 7. Recipe Interaction API

### POST `/api/recipes/{video_id}/likes`
좋아요 (인증 필수, 중복 방지)

### DELETE `/api/recipes/{video_id}/likes`
좋아요 취소 (인증 필수)

### POST `/api/recipes/{video_id}/bookmarks`
북마크 (인증 필수, 중복 방지)

### DELETE `/api/recipes/{video_id}/bookmarks`
북마크 취소 (인증 필수)

### POST `/api/recipes/{video_id}/shares`
공유 이벤트 기록 + `share_count` 증가 (인증 필수)

### 공통 응답 예시 (좋아요/북마크/공유/댓글삭제)
```json
{
  "success": true,
  "action": "LIKE",
  "video_id": "dQw4w9WgXcQ",
  "user_id": "firebase_uid_123",
  "created_at": "2026-02-26T12:20:00Z",
  "already_exists": false
}
```

## 8. 에러 응답 규칙

### 401 Unauthorized
```json
{
  "detail": "Authorization Bearer 토큰이 필요합니다."
}
```

### 403 Forbidden
```json
{
  "detail": "본인이 작성한 댓글만 수정할 수 있습니다."
}
```

### 404 Not Found
```json
{
  "detail": "레시피를 찾을 수 없습니다."
}
```
