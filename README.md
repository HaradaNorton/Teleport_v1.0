# 📱 Teleport Messenger v1.0

Современный мессенджер с поддержкой личных и групповых чатов, медиа-контента, голосовых сообщений и real-time коммуникации.

## 🎯 Статус разработки

### ✅ Реализованные функции

- ✅ **Аутентификация**: Вход по номеру телефона с SMS-кодом
- ✅ **Личные чаты**: Создание и управление личными диалогами
- ✅ **Групповые чаты**: Создание групп, управление участниками и ролями (Owner/Admin/Member)
- ✅ **Медиа-контент**: Отправка изображений, видео, документов с автоматическими thumbnails
- ✅ **Голосовые сообщения**: Запись и воспроизведение голосовых сообщений с waveform
- ✅ **WebSocket Real-time**: Мгновенная доставка сообщений, typing indicators, online/offline статусы
- ✅ **Push-уведомления**: Expo Notifications для уведомлений о новых сообщениях
- ✅ **Поиск пользователей**: По имени и номеру телефона
- ✅ **Unread counters**: Счетчики непрочитанных сообщений

## 🛠 Технологический стек

### Backend
- **Язык**: Go 1.21
- **Framework**: Gin
- **База данных**: PostgreSQL 15
- **Кэш**: Redis 7.2
- **WebSocket**: gorilla/websocket
- **Аутентификация**: JWT (access + refresh tokens)
- **Image Processing**: github.com/disintegration/imaging
- **Архитектура**: Clean Architecture

### Mobile (iOS/Android)
- **Framework**: React Native + Expo ~50.0.0
- **Язык**: TypeScript
- **State Management**: Zustand
- **Навигация**: React Navigation Stack
- **API клиент**: Axios
- **Медиа**: expo-image-picker, expo-document-picker, expo-av
- **Push Notifications**: expo-notifications, expo-device
- **Платформы**: iOS, Android, Web

## 📁 Структура проекта

```
Teleport_v1.0/
├── backend/
│   ├── cmd/api/                    # Entry point приложения
│   ├── config/                     # Конфигурация (env)
│   ├── internal/
│   │   ├── handlers/               # HTTP и WebSocket handlers
│   │   │   ├── auth.go            # Аутентификация
│   │   │   ├── chat.go            # Чаты и сообщения
│   │   │   ├── user.go            # Пользователи
│   │   │   ├── media.go           # Загрузка медиа
│   │   │   └── websocket.go       # WebSocket real-time
│   │   ├── models/                 # Модели данных и DTOs
│   │   ├── database/               # PostgreSQL и Redis
│   │   └── middleware/             # CORS, Auth middleware
│   └── pkg/
│       └── auth/                   # JWT сервис
├── mobile/
│   ├── src/
│   │   ├── components/             # UI компоненты
│   │   │   └── VoiceMessagePlayer.tsx
│   │   ├── screens/                # Экраны приложения
│   │   │   ├── AuthScreen.tsx
│   │   │   ├── ChatListScreen.tsx
│   │   │   ├── ChatScreen.tsx
│   │   │   ├── ProfileScreen.tsx
│   │   │   ├── CreateGroupScreen.tsx
│   │   │   └── GroupInfoScreen.tsx
│   │   ├── navigation/             # React Navigation
│   │   ├── store/                  # Zustand stores
│   │   │   ├── authStore.ts
│   │   │   └── chatStore.ts
│   │   ├── services/               # Сервисы
│   │   │   ├── api.ts             # REST API client
│   │   │   └── websocket.ts       # WebSocket service
│   │   ├── hooks/                  # Custom hooks
│   │   │   └── useVoiceRecorder.ts
│   │   └── types/                  # TypeScript types
│   └── package.json
├── TESTING_GUIDE.md               # Полное руководство по тестированию
└── README.md                       # Этот файл
```

## 🚀 Быстрый старт

### Требования

- Go 1.21+
- PostgreSQL 15+
- Redis 7.2+
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)

### Backend

1. **Клонируйте репозиторий** и перейдите в директорию backend:
```bash
cd backend
```

2. **Установите зависимости**:
```bash
go mod download
```

3. **Настройте PostgreSQL и Redis**:
```bash
# PostgreSQL
createdb teleport

# Redis (должен быть запущен)
redis-server
```

4. **Создайте файл `.env`** в директории `backend/`:
```env
SERVER_PORT=8080
SERVER_ENV=development
SERVER_API_VERSION=v1

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=teleport

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=your_secret_key_change_in_production
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Push Notifications (optional)
FCM_ENABLED=false
FCM_SERVER_KEY=your_fcm_server_key
```

> **Note:** FCM (Firebase Cloud Messaging) можно отключить установив `FCM_ENABLED=false`. Все остальные функции будут работать. Для включения push-уведомлений установите `FCM_ENABLED=true` и укажите FCM Server Key.

5. **Запустите сервер**:
```bash
go run cmd/api/main.go
```

Сервер запустится на `http://localhost:8080`

### Mobile

1. **Перейдите в директорию mobile**:
```bash
cd mobile
```

2. **Установите зависимости**:
```bash
npm install
```

3. **Обновите IP адрес** (если тестируете на физическом устройстве):

Откройте `src/services/api.ts` и замените `localhost` на IP вашего компьютера:
```typescript
baseURL: 'http://192.168.1.XXX:8080/api/v1' // Замените на ваш IP
```

4. **Запустите приложение**:
```bash
# iOS (требуется Mac с Xcode)
npm run ios

# Android
npm run android

# Web (для разработки)
npm run web
```

## 📚 API Документация

### Аутентификация

#### Отправка SMS-кода
```http
POST /api/v1/auth/send-code
Content-Type: application/json

{
  "phone_number": "+79001111111"
}
```

**Response:**
```json
{
  "message": "Code sent successfully"
}
```

> **Note:** В dev окружении код всегда `12345`

#### Верификация кода
```http
POST /api/v1/auth/verify
Content-Type: application/json

{
  "phone_number": "+79001111111",
  "code": "12345"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "phone_number": "+79001111111",
    "name": null,
    "is_online": true
  },
  "is_new_user": true
}
```

### Чаты

#### Получить список чатов
```http
GET /api/v1/chats
Authorization: Bearer {access_token}
```

#### Создать чат
```http
POST /api/v1/chats
Authorization: Bearer {access_token}
Content-Type: application/json

# Личный чат
{
  "type": "personal",
  "user_ids": ["user-uuid"]
}

# Групповой чат
{
  "type": "group",
  "user_ids": ["user-uuid-1", "user-uuid-2"],
  "title": "My Group"
}
```

#### Получить сообщения
```http
GET /api/v1/chats/{chatId}/messages
Authorization: Bearer {access_token}
```

#### Отправить сообщение
```http
POST /api/v1/chats/{chatId}/messages
Authorization: Bearer {access_token}
Content-Type: application/json

# Текстовое сообщение
{
  "content": "Hello!",
  "type": "text"
}

# Медиа сообщение
{
  "type": "image",
  "media_url": "/api/v1/media/files/images/uuid.jpg",
  "thumbnail_url": "/api/v1/media/files/thumbnails/uuid.jpg",
  "file_name": "photo.jpg",
  "mime_type": "image/jpeg",
  "media_size": 123456
}
```

### Групповые чаты

#### Получить участников
```http
GET /api/v1/chats/{chatId}/members
Authorization: Bearer {access_token}
```

#### Добавить участника (Owner/Admin)
```http
POST /api/v1/chats/{chatId}/members
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "user_id": "user-uuid"
}
```

#### Изменить роль (только Owner)
```http
PUT /api/v1/chats/{chatId}/members/{userId}/role
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "role": "admin"  // "admin" или "member"
}
```

#### Удалить участника (Owner/Admin)
```http
DELETE /api/v1/chats/{chatId}/members/{userId}
Authorization: Bearer {access_token}
```

#### Выйти из группы
```http
POST /api/v1/chats/{chatId}/leave
Authorization: Bearer {access_token}
```

### Медиа

#### Загрузить файл
```http
POST /api/v1/media/upload
Authorization: Bearer {access_token}
Content-Type: multipart/form-data

file: [binary data]
```

**Response:**
```json
{
  "media_url": "/api/v1/media/files/images/uuid.jpg",
  "thumbnail_url": "/api/v1/media/files/thumbnails/uuid.jpg",
  "file_name": "image.jpg",
  "mime_type": "image/jpeg",
  "file_size": 123456,
  "media_type": "image"
}
```

**Поддерживаемые типы:**
- Images: JPEG, PNG, GIF
- Videos: MP4, MOV, AVI
- Audio: M4A, MP3
- Documents: PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP

**Лимиты:**
- Максимальный размер: 50MB
- Автоматическая генерация thumbnails для изображений (300x300px)

### Push-уведомления

#### Регистрация устройства
```http
POST /api/v1/devices/register
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios",
  "device_id": "optional-device-id"
}
```

**Response:**
```json
{
  "message": "Device token registered successfully"
}
```

**Platform values:** `ios`, `android`

#### Отмена регистрации устройства
```http
POST /api/v1/devices/unregister
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
}
```

**Response:**
```json
{
  "message": "Device token unregistered successfully"
}
```

**Поведение:**
- Push-уведомления отправляются автоматически при получении нового сообщения
- Уведомления НЕ отправляются отправителю сообщения
- Уведомления отправляются только активным участникам чата
- Каждое уведомление содержит `chat_id` и `message_id` в payload
- При нажатии на уведомление приложение открывается в соответствующем чате

**Формат уведомления:**
```json
{
  "title": "John Doe",
  "body": "Hello! How are you?",
  "data": {
    "chat_id": "uuid",
    "message_id": "uuid",
    "type": "text"
  }
}
```

**Типы сообщений в уведомлениях:**
- `text` - Текст сообщения (до 100 символов)
- `image` - "📷 Photo"
- `video` - "🎥 Video"
- `voice` - "🎤 Voice message"
- `file` - "📎 Filename" или "📎 File"

### WebSocket

#### Подключение
```
ws://localhost:8080/api/v1/ws?token={access_token}
```

#### Типы сообщений

**Новое сообщение:**
```json
{
  "type": "message.new",
  "payload": {
    "id": "uuid",
    "chat_id": "uuid",
    "sender_id": "uuid",
    "content": "Hello!",
    "type": "text",
    "created_at": "2025-01-10T12:00:00Z",
    "sender": {
      "id": "uuid",
      "name": "John",
      "is_online": true
    }
  }
}
```

**Typing indicator:**
```json
{
  "type": "typing",
  "payload": {
    "chat_id": "uuid",
    "user_id": "uuid",
    "typing": true
  }
}
```

**Online/Offline:**
```json
{
  "type": "user.online",
  "payload": {
    "user_id": "uuid",
    "is_online": true
  }
}
```

## 🎨 Основные функции

### 1. Аутентификация
- SMS-код (в dev всегда `12345`)
- JWT токены (access 15 мин, refresh 7 дней)
- Auto-refresh при истечении access token
- Persistent auth (AsyncStorage)

### 2. Личные чаты
- Поиск пользователей по имени/телефону
- Создание личных диалогов (без дубликатов)
- Отправка текстовых сообщений
- Unread counter с автосбросом

### 3. Групповые чаты
- **Создание**: Минимум 2 участника, обязательное название
- **Роли**:
  - 👑 **Owner**: Полный контроль, не может выйти или быть удален
  - ⭐ **Admin**: Добавление/удаление участников, редактирование группы
  - 👤 **Member**: Только чтение и отправка сообщений
- **Управление**: Добавление/удаление участников, изменение ролей, редактирование названия
- **UI**: Имя отправителя в групповых сообщениях, кнопка "Info" в header

### 4. Медиа-контент
- **Изображения**:
  - Загрузка из галереи (expo-image-picker)
  - Съемка камерой
  - Автоматическая генерация thumbnails (300x300, Lanczos)
  - Compression (0.8 quality)
- **Документы**: Поддержка PDF, DOC, XLSX, ZIP, TXT
- **Preview**: Модал с preview перед отправкой
- **UI**: Показ размера файла, имени, thumbnail

### 5. Голосовые сообщения
- **Запись**:
  - Кнопка микрофона (когда поле ввода пустое)
  - Таймер записи в реальном времени
  - Красная кнопка отмены, синяя кнопка отправки
  - Permission handling
- **Воспроизведение**:
  - Кнопка play/pause
  - Waveform визуализация (20 полосок)
  - Прогресс playback
  - Показ длительности (MM:SS)
- **Формат**: M4A, HIGH_QUALITY preset

### 6. WebSocket Real-time
- **Мгновенная доставка**: Сообщения доставляются без refresh
- **Typing indicators**: 3-секундный debounce, показ "typing..." или "N user(s) typing..."
- **Online/Offline**: Автоматическое обновление статусов
- **Auto-reconnection**: 5 попыток с 3-секундной задержкой
- **Lifecycle**: Подключение при login/app load, отключение при logout

### 7. Push-уведомления
- **Автоматическая регистрация**: При login и app load
- **Expo Notifications**: Cross-platform поддержка (iOS/Android)
- **Backend интеграция**: FCM для доставки уведомлений
- **Device token management**: Регистрация/отмена при login/logout
- **Smart delivery**:
  - Уведомления НЕ отправляются отправителю
  - Только активным участникам чата
  - Асинхронная отправка (не блокирует ответ API)
- **Rich content**:
  - Название чата и имя отправителя
  - Превью сообщения (текст до 100 символов)
  - Иконки для медиа-контента (📷 🎥 🎤 📎)
  - Payload с `chat_id` и `message_id`
- **Навигация**: Tap на уведомление открывает соответствующий чат
- **Badge management**: API для управления badge count (iOS)
- **Foreground/Background**: Обработка уведомлений в любом состоянии приложения
- **Опциональность**: Можно отключить на backend (FCM_ENABLED=false)

## 🏗 Архитектура

### Backend (Clean Architecture)

```
cmd/api/main.go
    ↓
handlers → models → database
    ↑          ↑         ↑
middleware  DTOs    PostgreSQL/Redis
```

**Слои:**
- **handlers/**: HTTP endpoints, WebSocket hub
- **models/**: Domain модели, DTOs, валидация
- **database/**: Repository pattern, миграции
- **middleware/**: CORS, JWT auth
- **pkg/auth/**: JWT generation/validation

**Паттерны:**
- Repository для БД операций
- Hub pattern для WebSocket (gorilla)
- Dependency injection через конструкторы
- Graceful shutdown с context timeout

### Frontend (MVVM + State Management)

```
Screens → Stores → Services → API
    ↓        ↓         ↓
Components  Zustand  Axios/WebSocket
```

**Архитектура:**
- **Screens**: Контейнеры с бизнес-логикой
- **Components**: Переиспользуемые UI элементы
- **Stores**: Zustand для глобального state
  - `authStore`: Аутентификация, user info
  - `chatStore`: Чаты, сообщения, WebSocket handling
- **Services**: API client, WebSocket service
- **Hooks**: Custom hooks (useVoiceRecorder)

**State Flow:**
```
User Action → Screen → Store Action → Service → API
                ↓          ↓              ↓
            UI Update ← State Update ← Response
```

## 📝 База данных

### Схема

```sql
users                 chats
  ├─ id                ├─ id
  ├─ phone_number      ├─ type (personal/group/channel)
  ├─ name              ├─ title
  ├─ avatar_url        ├─ avatar_url
  ├─ is_online         └─ last_message_at
  └─ last_seen

messages              chat_members
  ├─ id                ├─ chat_id (FK)
  ├─ chat_id (FK)      ├─ user_id (FK)
  ├─ sender_id (FK)    ├─ role (owner/admin/member)
  ├─ content           ├─ unread_count
  ├─ type              └─ left_at
  ├─ media_url
  ├─ thumbnail_url
  └─ created_at
```

### Индексы

- `messages(chat_id, created_at DESC)` - быстрая выборка сообщений
- `chat_members(user_id, left_at)` - список чатов пользователя
- `users(phone_number)` - поиск по телефону

## 🧪 Тестирование

Полное руководство по тестированию в [TESTING_GUIDE.md](./TESTING_GUIDE.md).

### Быстрый тест:

1. Запустите backend и mobile app
2. Создайте 2 пользователя (Alice: +79001111111, Bob: +79002222222, код: 12345)
3. От Bob найдите Alice и создайте чат
4. Отправьте текстовое сообщение
5. Отправьте изображение (📎 → Gallery)
6. Запишите голосовое сообщение (🎤)
7. Войдите как Alice и проверьте, что все сообщения получены в реальном времени

## 🔒 Безопасность

- ✅ JWT аутентификация с refresh tokens
- ✅ CORS middleware (настраивается через env)
- ✅ Валидация file types при загрузке
- ✅ Ограничение размера файлов (50MB)
- ✅ Проверка прав доступа в группах
- ✅ SQL injection protection (prepared statements)
- ✅ Валидация subdirectories при file serving

## 🚧 Roadmap

### Следующие шаги:
- [ ] **Push-уведомления** (Firebase Cloud Messaging)
- [ ] Редактирование сообщений
- [ ] Удаление сообщений
- [ ] Ответы на сообщения (reply_to)
- [ ] Read receipts (прочитано)
- [ ] Пересылка сообщений

### Долгосрочные планы:
- [ ] Каналы (channels) для трансляций
- [ ] Видеозвонки (WebRTC)
- [ ] Статусы/истории (24 часа)
- [ ] Стикеры и GIF
- [ ] Темная тема
- [ ] Локализация (i18n)
- [ ] Desktop app (Electron)
- [ ] End-to-end шифрование

## 📦 Зависимости

### Backend
```go
github.com/gin-gonic/gin v1.9.1
github.com/lib/pq v1.10.9
github.com/redis/go-redis/v9 v9.4.0
github.com/golang-jwt/jwt/v5 v5.2.0
github.com/gorilla/websocket v1.5.1
github.com/google/uuid v1.5.0
github.com/disintegration/imaging v1.6.2
golang.org/x/crypto v0.18.0
```

### Mobile
```json
{
  "expo": "~50.0.0",
  "react-native": "0.73.0",
  "@react-navigation/native": "^6.1.9",
  "@react-navigation/stack": "^6.3.20",
  "zustand": "^4.4.7",
  "axios": "^1.6.2",
  "expo-image-picker": "~14.7.1",
  "expo-document-picker": "~11.10.1",
  "expo-av": "~13.10.4"
}
```

## 🤝 Контрибьюция

Проект в активной разработке. Для контрибьюции:

1. Fork репозитория
2. Создайте feature branch: `git checkout -b feature/amazing-feature`
3. Commit изменений: `git commit -m 'Add amazing feature'`
4. Push в branch: `git push origin feature/amazing-feature`
5. Откройте Pull Request

## 📄 Лицензия

MIT License - см. LICENSE file

## 💡 Tips & Tricks

### Разработка на физическом устройстве

1. Убедитесь что компьютер и устройство в одной сети
2. Найдите IP адрес компьютера: `ifconfig` (Mac/Linux) или `ipconfig` (Windows)
3. Обновите `mobile/src/services/api.ts`: `baseURL: 'http://YOUR_IP:8080/api/v1'`
4. Убедитесь что firewall не блокирует порт 8080

### Debug WebSocket

```javascript
// В браузере console (ws:// соединения видны в Network tab)
const ws = new WebSocket('ws://localhost:8080/api/v1/ws?token=YOUR_TOKEN');
ws.onmessage = (event) => console.log('Received:', JSON.parse(event.data));
ws.send(JSON.stringify({ type: 'typing', payload: { chat_id: 'uuid', typing: true } }));
```

### Очистка БД для тестирования

```sql
TRUNCATE TABLE message_reads, messages, chat_members, chats, users RESTART IDENTITY CASCADE;
```

---

**Made with ❤️ using Go, React Native, and Expo**
