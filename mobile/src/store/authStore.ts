import { create } from 'zustand';
import type { User } from '../types';
import api from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChatStore } from './chatStore';
import notificationService from '../services/notifications';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  login: (phoneNumber: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (phoneNumber: string, code: string) => {
    try {
      const response = await api.verifyCode(phoneNumber, code);
      set({ user: response.user, isAuthenticated: true });

      // Connect to WebSocket after successful login
      useChatStore.getState().connectWebSocket();

      // Register for push notifications
      try {
        await notificationService.registerForPushNotifications();
      } catch (error) {
        console.error('Failed to register for push notifications:', error);
        // Don't throw error, push notifications are not critical
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  logout: async () => {
    // Unregister push notifications before logout
    try {
      await notificationService.unregisterFromServer();
    } catch (error) {
      console.error('Failed to unregister push notifications:', error);
    }

    // Disconnect WebSocket before logout
    useChatStore.getState().disconnectWebSocket();

    await api.logout();
    set({ user: null, isAuthenticated: false });
  },

  loadUser: async () => {
    try {
      const isAuth = await api.isAuthenticated();

      if (isAuth) {
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          set({ user, isAuthenticated: true, isLoading: false });
        } else {
          // Если нет сохраненного пользователя, получаем с сервера
          const user = await api.getMe();
          set({ user, isAuthenticated: true, isLoading: false });
        }

        // Connect to WebSocket if authenticated
        useChatStore.getState().connectWebSocket();

        // Register for push notifications if authenticated
        try {
          await notificationService.registerForPushNotifications();
        } catch (error) {
          console.error('Failed to register for push notifications:', error);
        }
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Load user error:', error);
      set({ isLoading: false });
    }
  },

  updateUser: (data: Partial<User>) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...data } : null,
    }));
  },
}));
