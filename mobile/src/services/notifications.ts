import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

// Настройка поведения уведомлений в foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  private token: string | null = null;

  // Регистрация для push-уведомлений
  async registerForPushNotifications(): Promise<string | null> {
    // Проверяем что это реальное устройство
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Проверяем существующие разрешения
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Запрашиваем разрешения если еще не получены
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push notification permissions');
      return null;
    }

    try {
      // Получаем Expo Push Token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: projectId,
      });

      this.token = tokenData.data;

      // Отправляем токен на сервер
      await this.sendTokenToServer(this.token);

      console.log('✅ Push notification token registered:', this.token);
      return this.token;
    } catch (error) {
      console.error('Error getting push token:', error);
      return null;
    }
  }

  // Отправка токена на backend
  async sendTokenToServer(token: string): Promise<void> {
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const deviceId = Constants.sessionId || 'unknown';

      await api.registerDeviceToken({
        token,
        platform,
        device_id: deviceId,
      });

      console.log('✅ Device token sent to server');
    } catch (error) {
      console.error('Failed to send device token to server:', error);
      throw error;
    }
  }

  // Удаление токена с сервера (при logout)
  async unregisterFromServer(): Promise<void> {
    if (!this.token) {
      return;
    }

    try {
      await api.unregisterDeviceToken(this.token);
      this.token = null;
      console.log('✅ Device token unregistered from server');
    } catch (error) {
      console.error('Failed to unregister device token:', error);
    }
  }

  // Подписка на уведомления в foreground
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  // Подписка на нажатия по уведомлениям
  addNotificationResponseReceivedListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Получение всех доставленных уведомлений
  async getPresentedNotifications() {
    return await Notifications.getPresentedNotificationsAsync();
  }

  // Очистка всех уведомлений
  async dismissAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }

  // Очистка конкретного уведомления
  async dismissNotification(notificationId: string) {
    await Notifications.dismissNotificationAsync(notificationId);
  }

  // Получение количества badge (для iOS)
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync();
  }

  // Установка количества badge
  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count);
  }
}

export default new NotificationService();
