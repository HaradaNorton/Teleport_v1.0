import { create } from 'zustand';
import type { User } from '../types';
import api from '../services/api';
import websocket from '../services/websocket';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadUser: () => Promise<void>;
  login: (phoneNumber: string) => Promise<{ userId: string }>;
  verify: (userId: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  error: null,

  loadUser: async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const user = await api.getCurrentUser();
      set({ user, isLoading: false });

      // Connect WebSocket
      await websocket.connect();
    } catch (error: any) {
      console.error('Failed to load user:', error);
      set({
        user: null,
        isLoading: false,
        error: error.response?.data?.message || 'Failed to load user',
      });

      // If token is invalid, clear it
      if (error.response?.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
    }
  },

  login: async (phoneNumber: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.login({ phone_number: phoneNumber });
      set({ isLoading: false });
      return { userId: response.user_id };
    } catch (error: any) {
      console.error('Login failed:', error);
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Login failed',
      });
      throw error;
    }
  },

  verify: async (userId: string, code: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.verify({ user_id: userId, code });
      set({ user: response.user, isLoading: false });

      // Connect WebSocket
      await websocket.connect();
    } catch (error: any) {
      console.error('Verification failed:', error);
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Verification failed',
      });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true, error: null });

    try {
      await api.logout();
      websocket.disconnect();
      set({ user: null, isLoading: false });
    } catch (error: any) {
      console.error('Logout failed:', error);
      set({ isLoading: false });
    }
  },

  updateProfile: async (data: Partial<User>) => {
    set({ isLoading: true, error: null });

    try {
      const updatedUser = await api.updateProfile(data);
      set({ user: updatedUser, isLoading: false });
    } catch (error: any) {
      console.error('Profile update failed:', error);
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Profile update failed',
      });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
