# 🚀 Teleport - Инструкция по запуску

## Требования

- Docker Desktop (для PostgreSQL и Redis)
- Go 1.21+ (для бэкенда)
- Node.js 18+ (для мобильного приложения)
- Expo CLI
- Смартфон с Expo Go или эмулятор

## Быстрый старт

### 1. Запуск базы данных (Docker)

```bash
# Из корневой директории проекта
docker-compose up -d

# Проверить статус
docker-compose ps
```

Это запустит:
- PostgreSQL на порту 5432
- Redis на порту 6379

### 2. Запуск Backend (Go)

```bash
# Перейти в директорию backend
cd backend

# Установить зависимости (первый раз)
go mod download

# Запустить сервер
go run cmd/api/main.go
```

Backend будет доступен на `http://localhost:8080`

**Важно:** Убедитесь, что в `.env` указан правильный IP для CORS:
```
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19000,http://localhost:19006,http://192.168.1.109:19000
```

### 3. Запуск Mobile App (React Native + Expo)

```bash
# Открыть НОВЫЙ терминал
cd mobile

# Запустить Metro bundler
npm start
```

Expo покажет QR-код. Отсканируйте его в приложении Expo Go на телефоне.

**Важно:**
- Телефон и компьютер должны быть в одной WiFi сети
- В `mobile/app.json` должен быть указан правильный IP вашего компьютера:
  ```json
  "extra": {
    "apiUrl": "http://192.168.1.109:8080/api/v1",
    "wsUrl": "ws://192.168.1.109:8080/api/v1/ws"
  }
  ```

## Узнать IP адрес компьютера

### Windows:
```bash
ipconfig
```
Ищите "IPv4 Address" в разделе вашего WiFi адаптера.

### macOS/Linux:
```bash
ifconfig | grep "inet "
# или
ip addr show
```

## Порядок запуска (кратко)

1. **Запустить Docker** (база данных):
   ```bash
   docker-compose up -d
   ```

2. **Запустить Backend** (в отдельном терминале):
   ```bash
   cd backend && go run cmd/api/main.go
   ```

3. **Запустить Mobile** (в отдельном терминале):
   ```bash
   cd mobile && npm start
   ```

## Проверка работы

### Backend API
Откройте в браузере: http://localhost:8080/api/v1/health

Должно вернуть:
```json
{
  "status": "ok",
  "timestamp": "..."
}
```

### База данных
```bash
# Проверить подключение к PostgreSQL
docker exec -it teleport_postgres psql -U teleport_user -d teleport -c "\dt"

# Проверить подключение к Redis
docker exec -it teleport_redis redis-cli -a redis_pass_2024 ping
```

## Остановка сервисов

```bash
# Остановить Docker контейнеры
docker-compose down

# Остановить backend: Ctrl+C в терминале

# Остановить mobile: Ctrl+C в терминале
```

## Полная очистка (если нужно начать заново)

```bash
# Удалить все Docker данные
docker-compose down -v

# Удалить node_modules
cd mobile && rm -rf node_modules && npm install

# Очистить Go кеш
cd backend && go clean -cache
```

## Тестирование приложения

### 1. Регистрация
- Откройте мобильное приложение
- Введите номер телефона (любой в формате +1234567890)
- Введите код: `12345` (это mock код для разработки)

### 2. Создание чата
- Нажмите "New Chat"
- Найдите пользователя или создайте группу

### 3. Отправка сообщений
- Выберите чат
- Отправьте текстовое сообщение
- Попробуйте отправить изображение или файл

## Troubleshooting

### Backend не запускается
- Проверьте что Docker контейнеры запущены: `docker-compose ps`
- Проверьте логи: `docker-compose logs`
- Проверьте `.env` файл в `backend/`

### Mobile не подключается к Backend
1. Проверьте что backend запущен: `curl http://localhost:8080/api/v1/health`
2. Проверьте IP адрес в `mobile/app.json`
3. Убедитесь что телефон и компьютер в одной сети
4. Проверьте firewall (Windows: разрешите порт 8080)

### Expo не показывает QR код
```bash
cd mobile
npx expo start --clear
```

### "Cannot connect to Metro bundler"
```bash
cd mobile
npm start -- --reset-cache
```

## Логи для отладки

### Backend логи
Backend выводит логи в консоль в JSON формате

### Mobile логи
```bash
# В терминале где запущен Expo, нажмите:
# - j для открытия Chrome DevTools
# - r для перезагрузки приложения
```

### Database логи
```bash
docker-compose logs -f postgres
docker-compose logs -f redis
```

## Полезные команды

```bash
# Проверить что все сервисы работают
docker-compose ps
curl http://localhost:8080/api/v1/health
curl http://localhost:5432  # PostgreSQL
curl http://localhost:6379  # Redis

# Перезапустить только backend
cd backend && go run cmd/api/main.go

# Очистить Metro cache
cd mobile && npm start -- --clear

# Rebuild mobile app
cd mobile && npx expo start --clear
```

## Структура проекта

```
Teleport_v1.0/
├── backend/              # Go backend API
│   ├── cmd/api/         # Точка входа
│   ├── internal/        # Бизнес-логика
│   └── .env            # Конфигурация
├── mobile/              # React Native app
│   ├── src/            # Исходный код
│   ├── app.json        # Expo конфигурация
│   └── .env            # Переменные окружения
└── docker-compose.yml   # База данных
```

## Следующие шаги

1. ✅ Запустить все сервисы
2. ✅ Зарегистрироваться в приложении
3. ✅ Создать чат
4. ✅ Отправить сообщение
5. 🔔 Настроить push уведомления (опционально)
6. 📞 Протестировать звонки (опционально)

---

**Happy Coding! 🚀**
