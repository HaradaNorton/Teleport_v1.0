# Teleport Messenger v1.0

Мессенджер реального времени с поддержкой текстовых сообщений, медиа, групповых чатов и звонков.

## Технологический стек

### Backend
- **Язык:** Go 1.21+
- **Web Framework:** Gin
- **База данных:** PostgreSQL 15
- **Кэш:** Redis 7.2
- **Real-time:** WebSocket (gorilla/websocket)
- **Аутентификация:** JWT

### Mobile
- **Framework:** React Native + Expo
- **Язык:** TypeScript
- **Навигация:** React Navigation
- **State Management:** Zustand/Redux
- **Real-time:** WebSocket

### Infrastructure
- **Контейнеризация:** Docker & Docker Compose
- **Reverse Proxy:** Nginx (production)

## Структура проекта

```
Teleport_v1.0/
├── backend/              # Go API сервер
│   ├── cmd/
│   │   └── api/         # Точка входа
│   ├── internal/        # Приватный код
│   │   ├── handlers/    # HTTP handlers
│   │   ├── models/      # Модели данных
│   │   ├── database/    # Database layer
│   │   ├── middleware/  # Middleware
│   │   └── websocket/   # WebSocket logic
│   ├── pkg/            # Публичные пакеты
│   │   ├── auth/       # JWT, аутентификация
│   │   └── utils/      # Утилиты
│   ├── migrations/     # SQL миграции
│   └── config/         # Конфигурации
├── mobile/             # React Native приложение
│   ├── src/
│   │   ├── screens/    # Экраны
│   │   ├── components/ # Компоненты
│   │   ├── services/   # API сервисы
│   │   ├── store/      # State management
│   │   └── navigation/ # Навигация
│   └── assets/         # Изображения, шрифты
├── docker/             # Docker конфигурации
└── docs/              # Документация
```

## Быстрый старт

### Требования
- Go 1.21+
- Node.js 18+
- Docker Desktop
- Expo CLI

### Backend

```bash
cd backend
go mod download
docker-compose up -d  # Запуск PostgreSQL + Redis
go run cmd/api/main.go
```

API будет доступен на: `http://localhost:8080`

### Mobile

```bash
cd mobile
npm install
npx expo start
```

Сканируйте QR код в Expo Go приложении на iPhone.

## Этапы разработки

- [x] **Этап 0:** Настройка проекта и структуры
- [ ] **Этап 1:** Backend API + Database
- [ ] **Этап 2:** Аутентификация (JWT)
- [ ] **Этап 3:** WebSocket для real-time
- [ ] **Этап 4:** React Native UI
- [ ] **Этап 5:** Интеграция frontend-backend
- [ ] **Этап 6:** Медиа загрузка
- [ ] **Этап 7:** Групповые чаты
- [ ] **Этап 8:** Звонки (WebRTC)

## API Endpoints (Planned)

### Auth
- `POST /api/v1/auth/send-code` - Отправка SMS кода
- `POST /api/v1/auth/verify` - Проверка кода
- `POST /api/v1/auth/refresh` - Обновление токена

### Users
- `GET /api/v1/users/me` - Текущий пользователь
- `PUT /api/v1/users/me` - Обновление профиля
- `GET /api/v1/users/:id` - Получить пользователя

### Chats
- `GET /api/v1/chats` - Список чатов
- `POST /api/v1/chats` - Создать чат
- `GET /api/v1/chats/:id/messages` - Сообщения чата
- `POST /api/v1/chats/:id/messages` - Отправить сообщение

### WebSocket
- `WS /ws` - WebSocket соединение для real-time

## License

MIT
