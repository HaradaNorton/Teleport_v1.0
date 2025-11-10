# 🚀 Teleport - Быстрый запуск

## ✅ Что уже запущено:

### 1. База данных (Docker) ✅
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- Статус: `docker-compose ps`

### 2. Backend API ✅
- **URL**: `http://localhost:8080`
- **Health**: `http://localhost:8080/health`
- **API**: `http://localhost:8080/api/v1`
- Работает в фоновом режиме

### 3. Mobile App (Expo) ✅
- **Metro Bundler**: `http://localhost:8081`
- Expo запускается...

---

## 📱 Как подключиться к мобильному приложению:

### Вариант 1: Через Expo Go (рекомендуется для быстрого теста)

1. **Установите Expo Go на телефон:**
   - Android: [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - iOS: [App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Подключитесь к приложению:**
   - Посмотрите в терминал где запущен `npm start`
   - Найдите QR-код или URL
   - Отсканируйте QR-код в Expo Go
   - Или введите URL вручную

3. **Если QR-код не показывается:**
   ```bash
   # В новом терминале
   cd C:\Users\Artem\go\src\Teleport_v1.0\mobile
   npx expo start --tunnel
   ```

### Вариант 2: Через Android Emulator

```bash
# Убедитесь что Android Studio установлен
# Запустите эмулятор
# В терминале Expo нажмите 'a'
```

### Вариант 3: Через iOS Simulator (только macOS)

```bash
# В терминале Expo нажмите 'i'
```

---

## 🔍 Проверка работы:

### Backend API
```bash
# Проверить health endpoint
curl http://localhost:8080/health

# Должно вернуть:
# {"status":"ok","time":...}
```

### База данных
```bash
# PostgreSQL
docker exec -it teleport_postgres psql -U teleport_user -d teleport -c "\dt"

# Redis
docker exec -it teleport_redis redis-cli -a redis_pass_2024 ping
```

### Metro Bundler
Откройте в браузере: http://localhost:8081

---

## 📊 Просмотр логов:

### Backend логи
```bash
# Посмотреть логи бэкенда (он работает в фоне)
# Логи видны в терминале где запущен
```

### Mobile логи
```bash
# В терминале где запущен Expo:
# j - открыть DevTools
# r - перезагрузить приложение
# m - переключить меню
```

### Docker логи
```bash
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## 🧪 Тестирование приложения:

### 1. Регистрация
- Введите любой номер телефона (формат: +1234567890)
- Код для входа: **12345** (это mock код для разработки)

### 2. Основные функции для проверки:
- ✅ Регистрация/вход
- ✅ Поиск пользователей
- ✅ Создание личного чата
- ✅ Отправка текстовых сообщений
- ✅ Отправка изображений (если есть permissions)
- ✅ Создание группы
- ✅ Создание канала

---

## ⚠️ Важные замечания:

### IP адрес для мобильного приложения
В файле `mobile/app.json` указан IP: `192.168.1.109`

Если ваш компьютер имеет другой IP адрес:

1. **Узнайте свой IP:**
   ```bash
   ipconfig  # Windows
   # Ищите "IPv4 Address" в WiFi адаптере
   ```

2. **Обновите app.json:**
   ```json
   "extra": {
     "apiUrl": "http://ВАШ_IP:8080/api/v1",
     "wsUrl": "ws://ВАШ_IP:8080/api/v1/ws"
   }
   ```

3. **Перезапустите Expo:**
   ```bash
   # Ctrl+C в терминале Expo
   npm start
   ```

### Телефон и компьютер должны быть в одной WiFi сети!

---

## 🛑 Остановка сервисов:

```bash
# Остановить Expo (в терминале где запущен)
Ctrl + C

# Остановить Backend (остановить фоновый процесс)
# Найти процесс: tasklist | findstr "main.exe"
# Убить процесс: taskkill /F /PID <PID>

# Остановить Docker
docker-compose down
```

---

## 🐛 Troubleshooting:

### Mobile не подключается к Backend

1. Проверьте IP адрес в `app.json`
2. Убедитесь что телефон и ПК в одной сети
3. Проверьте firewall Windows (разрешите порт 8080)
4. Попробуйте `npm start -- --tunnel`

### "Cannot connect to Metro"
```bash
cd mobile
npm start -- --clear
```

### Backend не отвечает
```bash
# Проверить что работает
curl http://localhost:8080/health

# Проверить Docker
docker-compose ps

# Перезапустить Backend
cd backend
go run cmd/api/main.go
```

---

## 📁 Полезные команды:

```bash
# Перезапустить всё с нуля
docker-compose down -v  # Очистить БД
cd backend && go run cmd/api/main.go  # Запустить Backend
cd mobile && npm start  # Запустить Mobile

# Очистить кеши
cd mobile && npm start -- --clear

# Пересобрать Docker
docker-compose up -d --build
```

---

## 🎯 Следующие шаги:

1. ✅ Откройте Expo приложение на телефоне
2. ✅ Отсканируйте QR-код
3. ✅ Зарегистрируйтесь (код: 12345)
4. ✅ Создайте чат и отправьте сообщение

**Готово! Приложение работает! 🎉**

---

## 📞 Дополнительные возможности:

- **Push уведомления**: Требуется настройка FCM
- **Audio/Video звонки**: Работают через WebRTC
- **Загрузка файлов**: Доступна через API

Подробнее см. [START.md](START.md)
