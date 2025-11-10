# 🚀 Быстрый запуск - 3 простых шага

## Способ 1: Автоматический (самый простой)

### Просто двойной клик на файл:
```
start-all.bat
```

Это откроет 2 окна:
1. **Backend** - Go сервер
2. **Mobile** - Expo с QR-кодом

---

## Способ 2: Вручную через терминал

### Шаг 1: Запустить Backend

Откройте **новый терминал** (CMD или PowerShell) и выполните:

```bash
cd C:\Users\Artem\go\src\Teleport_v1.0\backend
go run cmd/api/main.go
```

Вы должны увидеть:
```
✅ Connected to PostgreSQL database
✅ Connected to Redis
🚀 Server starting on port 8080
```

**Оставьте это окно открытым!**

---

### Шаг 2: Запустить Mobile (Expo)

Откройте **еще один новый терминал** и выполните:

```bash
cd C:\Users\Artem\go\src\Teleport_v1.0\mobile
npm start
```

**Подождите 1-2 минуты** пока Metro соберет бандл.

Вы увидите:
```
Starting Metro Bundler
warning: Bundler cache is empty, rebuilding (this may take a minute)
```

Затем появится **QR-код** или URL.

**Оставьте это окно открытым!**

---

### Шаг 3: Подключиться с iPhone

1. **Откройте Expo Go** на iPhone
2. **Нажмите "Scan QR code"**
3. **Наведите камеру** на QR-код в терминале
4. **Дождитесь загрузки** приложения (30-60 сек)
5. **Войдите с кодом:** `12345`

---

## ✅ Проверка что всё работает:

### Backend API (в браузере):
```
http://localhost:8080/health
```
Должно показать: `{"status":"ok","time":...}`

### Metro Bundler (в браузере):
```
http://localhost:8081
```
Должен показать JSON с конфигурацией

### База данных:
```bash
docker-compose ps
```
Оба контейнера должны быть "healthy"

---

## 🛑 Остановка:

В каждом терминале нажмите: **Ctrl + C**

Или просто закройте окна терминалов.

Для остановки Docker:
```bash
docker-compose down
```

---

## 📝 Краткая шпаргалка:

### Терминал 1 (Backend):
```bash
cd C:\Users\Artem\go\src\Teleport_v1.0\backend
go run cmd/api/main.go
```

### Терминал 2 (Mobile):
```bash
cd C:\Users\Artem\go\src\Teleport_v1.0\mobile
npm start
```

### iPhone:
Expo Go → Scan QR → Код: 12345

---

## 💡 Полезные команды:

### Очистить кеш и перезапустить Mobile:
```bash
cd mobile
npm start -- --clear
```

### Перезапустить Backend:
```bash
# Ctrl+C в терминале Backend
go run cmd/api/main.go
```

### Посмотреть логи Docker:
```bash
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## ⚠️ Troubleshooting:

### Порт занят (8080 или 8081):

Найдите процесс:
```bash
# Windows PowerShell
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.ProcessName -like "*main*"}
```

Или просто закройте все окна терминалов и запустите заново.

### QR-код не появляется:

Подождите 2-3 минуты. Metro собирает бандл при первом запуске.

Или попробуйте:
```bash
cd mobile
npm start -- --tunnel
```

### iPhone не может подключиться:

1. Проверьте что iPhone и ПК в одной WiFi сети
2. Проверьте IP адрес в `mobile/app.json`
3. Проверьте Windows Firewall (разрешите порты 8080, 8081)

---

**Готово! Запускайте и тестируйте! 🚀📱**
