# 🚀 Teleport Messenger - Quick Start Guide

## Что уже готово ✅

### Backend (Go)
- ✅ REST API на Gin
- ✅ WebSocket для real-time сообщений
- ✅ JWT аутентификация
- ✅ PostgreSQL + Redis
- ✅ Все основные endpoints
- ✅ Docker Compose настроен

### Mobile (React Native + Expo)
- ✅ Экраны авторизации
- ✅ Список чатов
- ✅ Экран диалога
- ✅ Профиль пользователя
- ✅ API клиент с автоматическим refresh токена
- ✅ State management (Zustand)

---

## Запуск проекта на Windows

### Шаг 1: Установите необходимые инструменты

**Обязательно:**
1. **Go 1.21+** - https://go.dev/dl/
2. **Node.js 18+** - https://nodejs.org/
3. **Docker Desktop** - https://www.docker.com/products/docker-desktop/ (уже установлен ✅)
4. **Git** - https://git-scm.com/

**Для мобильного приложения:**
5. **Expo Go** - Установите на iPhone из App Store

---

### Шаг 2: Запуск Backend

Откройте **PowerShell** или **CMD** в папке проекта:

```bash
# 1. Запустить базы данных (PostgreSQL + Redis)
docker-compose up -d

# 2. Подождать 5 секунд пока БД запустятся
# Проверить что контейнеры работают:
docker ps

# 3. Установить Go зависимости
cd backend
go mod download

# 4. Запустить backend сервер
go run cmd/api/main.go
```

**Вы должны увидеть:**
```
✅ Connected to PostgreSQL database
✅ Database schema initialized
✅ Connected to Redis
🚀 Server starting on port 8080
```

Backend API: **http://localhost:8080/api/v1**

---

### Шаг 3: Запуск Mobile приложения

Откройте **НОВЫЙ** терминал:

```bash
cd mobile

# Установить зависимости
npm install

# Запустить Expo dev server
npx expo start
```

**Вы увидите QR код в терминале.**

---

### Шаг 4: Открыть на iPhone

1. Откройте **Expo Go** на iPhone
2. **Отсканируйте QR код** из терминала
3. Приложение загрузится и откроется

**ВАЖНО:** Компьютер и iPhone должны быть в **одной Wi-Fi сети!**

---

## Тестирование приложения

### 1. Регистрация

1. На экране входа введите любой номер телефона (например: `+79001234567`)
2. Нажмите "Send Code"
3. Введите код: **12345** (в режиме разработки всегда этот код)
4. Нажмите "Verify"

**Готово!** Вы авторизованы 🎉

### 2. Проверка через API

Откройте браузер или Postman:

**Health check:**
```
GET http://localhost:8080/health
```

**Отправка кода:**
```
POST http://localhost:8080/api/v1/auth/send-code
Content-Type: application/json

{
  "phone_number": "+79001234567"
}
```

**Проверка кода:**
```
POST http://localhost:8080/api/v1/auth/verify
Content-Type: application/json

{
  "phone_number": "+79001234567",
  "code": "12345"
}
```

Вы получите `access_token` и `refresh_token`.

---

## Полезные команды

### Backend

```bash
# Перезапустить БД (если что-то сломалось)
docker-compose down -v
docker-compose up -d

# Посмотреть логи БД
docker-compose logs -f

# Остановить всё
docker-compose down

# Запустить сервер
cd backend && go run cmd/api/main.go
```

### Mobile

```bash
# Запустить на iOS (если есть симулятор)
npm run ios

# Установить зависимости заново
rm -rf node_modules && npm install

# Очистить кэш Expo
npx expo start -c
```

---

## Структура API

### Авторизация (без токена)
- `POST /api/v1/auth/send-code` - Отправка SMS кода
- `POST /api/v1/auth/verify` - Проверка кода
- `POST /api/v1/auth/refresh` - Обновление токена

### Пользователи (требуется токен)
- `GET /api/v1/users/me` - Текущий пользователь
- `PUT /api/v1/users/me` - Обновить профиль
- `GET /api/v1/users/:id` - Получить пользователя

### Чаты (требуется токен)
- `GET /api/v1/chats` - Список чатов
- `POST /api/v1/chats` - Создать чат
- `GET /api/v1/chats/:id/messages` - Сообщения чата
- `POST /api/v1/chats/:id/messages` - Отправить сообщение

### WebSocket
- `WS /api/v1/ws?token=<access_token>` - Real-time соединение

**Полная документация:** `docs/API.md`

---

## Решение проблем

### "Cannot connect to backend"

**На iPhone измените API_URL:**

1. Откройте `mobile/src/services/api.ts`
2. Замените `localhost` на **IP адрес вашего компьютера**:

```typescript
const API_URL = 'http://192.168.1.100:8080/api/v1'; // Ваш IP
```

**Узнать IP Windows:**
```bash
ipconfig
# Ищите IPv4 Address в секции Wi-Fi
```

### "Database connection failed"

```bash
# Перезапустить Docker контейнеры
docker-compose down
docker-compose up -d

# Подождать 10 секунд
```

### "Port 8080 already in use"

```bash
# Найти процесс
netstat -ano | findstr :8080

# Убить процесс (замените PID)
taskkill /PID <номер> /F
```

---

## Следующие шаги 📋

### Готово сейчас:
- ✅ Авторизация
- ✅ Список чатов (пустой пока)
- ✅ Отправка сообщений
- ✅ Профиль пользователя

### TODO (следующие этапы):
- [ ] Создание личных чатов
- [ ] Создание групп
- [ ] Загрузка медиа (фото, видео)
- [ ] Голосовые сообщения
- [ ] Push уведомления
- [ ] WebRTC звонки
- [ ] Секретные чаты с E2E

---

## Помощь

**Проблемы с запуском?**
- Убедитесь что Docker Desktop запущен
- Проверьте что порты 8080, 5432, 6379 свободны
- Компьютер и iPhone в одной сети

**Вопросы по коду?**
- Смотрите `docs/API.md` для API документации
- Backend код: `backend/internal/handlers/`
- Frontend код: `mobile/src/screens/`

---

## Архитектура

```
Backend:
- Gin (HTTP server)
- Gorilla WebSocket (real-time)
- PostgreSQL (данные)
- Redis (кэш, сессии)
- JWT (аутентификация)

Mobile:
- React Native + Expo
- TypeScript
- Zustand (state)
- Axios (HTTP)
- React Navigation

Infrastructure:
- Docker Compose (development)
- Makefile (команды)
```

---

**Всё готово к разработке! 🎉**

Теперь вы можете:
1. Тестировать существующий функционал
2. Добавлять новые фичи
3. Деплоить на сервер

Удачи! 🚀
