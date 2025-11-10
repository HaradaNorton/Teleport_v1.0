# Teleport Mobile - React Native Messenger

Мобильное приложение мессенджера Teleport на React Native с Expo.

## Возможности

- 📱 Аутентификация по номеру телефона
- 💬 Личные чаты, групповые чаты и каналы
- 📝 Текстовые, медиа и голосовые сообщения
- 📞 Аудио и видео звонки (WebRTC)
- 🔔 Push-уведомления
- ⚡ Реал-тайм обновления (WebSocket)
- ✏️ Редактирование и удаление сообщений
- ↩️ Пересылка сообщений
- 👀 Статусы прочтения
- 🟢 Онлайн статусы

## Технологии

- React Native 0.73.0
- Expo SDK 50
- TypeScript
- React Navigation
- Zustand (управление состоянием)
- Axios (HTTP клиент)
- WebSocket (реал-тайм)
- WebRTC (звонки)
- Expo Notifications (push)

## Установка

### Требования

- Node.js 18+
- npm или yarn
- Expo CLI
- Для iOS: Xcode и CocoaPods
- Для Android: Android Studio

### Шаги установки

1. **Установите зависимости:**
   ```bash
   npm install
   ```

2. **Создайте файл .env:**
   ```bash
   cp .env.example .env
   ```

   Отредактируйте `.env` и укажите правильные URL вашего бэкенда:
   ```
   API_URL=http://your-backend-ip:8080/api/v1
   WS_URL=ws://your-backend-ip:8080/api/v1/ws
   ```

3. **Обновите app.json:**

   Измените `extra` секцию в [app.json](app.json) с вашими URL:
   ```json
   "extra": {
     "apiUrl": "http://your-backend-ip:8080/api/v1",
     "wsUrl": "ws://your-backend-ip:8080/api/v1/ws"
   }
   ```

4. **Добавьте ассеты (опционально):**

   Создайте иконки и splash screen в папке `assets/`:
   - `icon.png` (1024x1024)
   - `splash.png` (1284x2778)
   - `adaptive-icon.png` (1024x1024)
   - `notification-icon.png` (96x96)
   - `favicon.png` (48x48)

   Или временно закомментируйте эти пути в app.json.

## Запуск для разработки

### Expo Go (быстрый старт)

```bash
# Запустить Metro bundler
npm start

# Или для конкретной платформы
npm run android
npm run ios
npm run web
```

Затем:
- **Android:** Отсканируйте QR-код в Expo Go приложении
- **iOS:** Отсканируйте QR-код в камере iPhone
- **Web:** Откроется в браузере автоматически

### Development Build (с нативными модулями)

Приложение использует native модули (WebRTC, notifications), поэтому для полной функциональности нужен Development Build:

```bash
# Установите EAS CLI
npm install -g eas-cli

# Войдите в Expo аккаунт
eas login

# Создайте development build
eas build --profile development --platform android
# или для iOS
eas build --profile development --platform ios
```

## Структура проекта

```
mobile/
├── src/
│   ├── components/       # Переиспользуемые компоненты
│   ├── hooks/           # Кастомные React hooks
│   ├── navigation/      # Навигация приложения
│   ├── screens/         # Экраны приложения
│   ├── services/        # API, WebSocket, WebRTC сервисы
│   ├── store/           # Zustand store (состояние)
│   └── types/           # TypeScript типы
├── assets/              # Изображения и ассеты
├── app.json            # Expo конфигурация
├── eas.json            # EAS Build конфигурация
├── package.json        # NPM зависимости
└── tsconfig.json       # TypeScript конфигурация
```

## Конфигурация

### Environment Variables

В [app.json](app.json) вы можете настроить:
- `extra.apiUrl` - URL вашего бэкенд API
- `extra.wsUrl` - URL WebSocket сервера

### Permissions

Приложение запрашивает следующие разрешения:
- **Камера** - для видео звонков
- **Микрофон** - для аудио/видео звонков
- **Notifications** - для push уведомлений
- **Storage** - для кэширования медиа

## Сборка для продакшена

### Android APK/AAB

```bash
# AAB для Google Play
eas build --profile production --platform android

# APK для прямой установки
eas build --profile preview --platform android
```

### iOS IPA

```bash
eas build --profile production --platform ios
```

## Известные проблемы

1. **WebRTC на Expo Go не работает** - используйте Development Build
2. **Push уведомления требуют FCM** - настройте Firebase для продакшена
3. **Некоторые TypeScript ошибки** - связаны с типами WebRTC, не критично для работы

## Отладка

### Логи

```bash
# Expo логи
npx expo start --dev-client

# React Native логи
npx react-native log-android
npx react-native log-ios
```

### Очистка кэша

```bash
# Очистить Metro cache
npm start -- --clear

# Очистить node_modules
rm -rf node_modules && npm install
```

## Проблемы и решения

### "Cannot find module" ошибки

Убедитесь, что все зависимости установлены:
```bash
npm install
```

### Красные подсветки в IDE

1. Перезапустите TypeScript сервер в VSCode
2. Убедитесь, что установлены все пакеты
3. Проверьте, что node_modules существует

### Не подключается к бэкенду

1. Проверьте что бэкенд запущен
2. Используйте правильный IP адрес (не localhost для физических устройств)
3. Убедитесь, что устройство в той же сети

### Белый экран при запуске

1. Проверьте Metro bundler логи
2. Очистите кэш: `npm start -- --clear`
3. Переустановите приложение

## Полезные ссылки

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [WebRTC for React Native](https://github.com/react-native-webrtc/react-native-webrtc)

## Лицензия

Proprietary
