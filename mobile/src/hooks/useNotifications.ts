import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useNavigation } from '@react-navigation/native';
import notificationService from '../services/notifications';

export function useNotifications() {
  const navigation = useNavigation();
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    // Обработчик уведомлений в foreground (когда приложение открыто)
    notificationListener.current = notificationService.addNotificationReceivedListener(
      (notification) => {
        console.log('📬 Notification received:', notification);
        // Можно показать локальное уведомление или обновить UI
      }
    );

    // Обработчик нажатий на уведомления
    responseListener.current = notificationService.addNotificationResponseReceivedListener(
      (response) => {
        console.log('👆 Notification tapped:', response);

        // Получаем данные из уведомления
        const data = response.notification.request.content.data;
        const chatId = data?.chat_id as string;

        if (chatId) {
          // Навигация в чат
          (navigation as any).navigate('Chat', { chatId });

          // Очистка уведомления
          notificationService.dismissNotification(
            response.notification.request.identifier
          );
        }
      }
    );

    return () => {
      // Очистка подписок при размонтировании
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [navigation]);
}
