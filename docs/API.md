# Teleport API Documentation

Base URL: `http://localhost:8080/api/v1`

## Authentication

### Send Verification Code

Отправляет SMS код на номер телефона.

**Endpoint:** `POST /auth/send-code`

**Request:**
```json
{
  "phone_number": "+79001234567"
}
```

**Response:** `200 OK`
```json
{
  "message": "Code sent successfully",
  "expires_in": 300
}
```

**Note:** В режиме разработки код будет `12345` и выводится в логи сервера.

---

### Verify Code

Проверяет SMS код и возвращает JWT токены.

**Endpoint:** `POST /auth/verify`

**Request:**
```json
{
  "phone_number": "+79001234567",
  "code": "12345"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "phone_number": "+79001234567",
    "name": "",
    "avatar_url": "",
    "bio": "",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z",
    "last_seen": "2024-01-01T00:00:00Z",
    "is_online": false
  },
  "is_new_user": true
}
```

---

### Refresh Token

Обновляет access token используя refresh token.

**Endpoint:** `POST /auth/refresh`

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGc..."
}
```

---

## Users

All user endpoints require `Authorization: Bearer <access_token>` header.

### Get Current User

**Endpoint:** `GET /users/me`

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "phone_number": "+79001234567",
  "name": "John Doe",
  "avatar_url": "https://...",
  "bio": "Hello!",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "last_seen": "2024-01-01T00:00:00Z",
  "is_online": true
}
```

---

### Update Profile

**Endpoint:** `PUT /users/me`

**Request:**
```json
{
  "name": "John Doe",
  "bio": "Hello from Teleport!",
  "avatar_url": "https://..."
}
```

**Response:** `200 OK` - Returns updated user object

---

### Get User by ID

**Endpoint:** `GET /users/:id`

**Response:** `200 OK` - Returns user object

---

## Chats

### Get Chats

Возвращает список чатов пользователя.

**Endpoint:** `GET /chats`

**Response:** `200 OK`
```json
{
  "chats": [
    {
      "chat": {
        "id": "uuid",
        "type": "personal",
        "title": "",
        "avatar_url": "",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z",
        "last_message_at": "2024-01-01T00:00:00Z"
      },
      "unread_count": 5
    }
  ],
  "total_count": 1
}
```

---

### Create Chat

**Endpoint:** `POST /chats`

**Request:**
```json
{
  "type": "personal",
  "user_ids": ["uuid"],
  "title": "Group Name",
  "avatar_url": "https://..."
}
```

**Response:** `201 Created`
```json
{
  "chat_id": "uuid"
}
```

---

### Get Chat

**Endpoint:** `GET /chats/:id`

**Response:** `200 OK` - Returns chat object

---

### Get Messages

**Endpoint:** `GET /chats/:id/messages`

**Query params:**
- `limit` (default: 50)
- `offset` (default: 0)

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "id": "uuid",
      "chat_id": "uuid",
      "sender_id": "uuid",
      "content": "Hello!",
      "type": "text",
      "created_at": "2024-01-01T00:00:00Z",
      "sender": {
        "id": "uuid",
        "name": "John",
        "avatar_url": "https://..."
      }
    }
  ],
  "total_count": 1,
  "has_more": false
}
```

---

### Send Message

**Endpoint:** `POST /chats/:id/messages`

**Request:**
```json
{
  "chat_id": "uuid",
  "content": "Hello!",
  "type": "text",
  "reply_to_id": "uuid"
}
```

**Response:** `201 Created` - Returns message object

---

### Edit Message

**Endpoint:** `PUT /chats/messages/:messageId`

**Request:**
```json
{
  "message_id": "uuid",
  "content": "Updated text"
}
```

**Response:** `200 OK`

---

### Delete Message

**Endpoint:** `DELETE /chats/messages/:messageId`

**Response:** `200 OK`

---

### Mark as Read

**Endpoint:** `POST /chats/messages/:messageId/read`

**Response:** `200 OK`

---

## WebSocket

### Connect

**Endpoint:** `WS /ws?token=<access_token>`

**Message Format:**
```json
{
  "type": "message.new|message.edit|message.delete|typing|user.online|user.offline",
  "payload": {}
}
```

**Example - Typing indicator:**
```json
{
  "type": "typing",
  "payload": {
    "chat_id": "uuid",
    "typing": true
  }
}
```

**Server messages:**

New message:
```json
{
  "type": "message.new",
  "payload": { /* message object */ }
}
```

User online status:
```json
{
  "type": "user.online",
  "payload": {
    "user_id": "uuid",
    "is_online": true
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "error message"
}
```

**Status Codes:**
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error
