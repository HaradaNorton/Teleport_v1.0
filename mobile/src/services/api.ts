import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import type {
  AuthResponse,
  User,
  ChatListResponse,
  MessageListResponse,
  Message
} from '../types';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:8080/api/v1';

class ApiService {
  private client: AxiosInstance;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor для добавления токена
    this.client.interceptors.request.use(
      async (config) => {
        if (!this.accessToken) {
          this.accessToken = await AsyncStorage.getItem('access_token');
        }

        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor для обработки ошибок
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest: any = error.config;

        // Если 401 и еще не пытались обновить токен
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshAccessToken();
            if (newAccessToken) {
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Если refresh token тоже не валиден - logout
            await this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Auth
  async sendCode(phoneNumber: string): Promise<{ message: string; expires_in: number }> {
    const response = await this.client.post('/auth/send-code', {
      phone_number: phoneNumber,
    });
    return response.data;
  }

  async verifyCode(phoneNumber: string, code: string): Promise<AuthResponse> {
    const response = await this.client.post('/auth/verify', {
      phone_number: phoneNumber,
      code: code,
    });

    const data: AuthResponse = response.data;

    // Сохраняем токены
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;

    await AsyncStorage.setItem('access_token', data.access_token);
    await AsyncStorage.setItem('refresh_token', data.refresh_token);
    await AsyncStorage.setItem('user', JSON.stringify(data.user));

    return data;
  }

  async refreshAccessToken(): Promise<string | null> {
    if (!this.refreshToken) {
      this.refreshToken = await AsyncStorage.getItem('refresh_token');
    }

    if (!this.refreshToken) {
      return null;
    }

    try {
      const response = await this.client.post('/auth/refresh', {
        refresh_token: this.refreshToken,
      });

      this.accessToken = response.data.access_token;
      if (this.accessToken) {
        await AsyncStorage.setItem('access_token', this.accessToken);
      }

      return this.accessToken;
    } catch (error) {
      return null;
    }
  }

  async logout(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;

    await AsyncStorage.removeItem('access_token');
    await AsyncStorage.removeItem('refresh_token');
    await AsyncStorage.removeItem('user');
  }

  // Users
  async getMe(): Promise<User> {
    const response = await this.client.get('/users/me');
    return response.data;
  }

  async updateProfile(data: { name?: string; bio?: string; avatar_url?: string }): Promise<User> {
    const response = await this.client.put('/users/me', data);
    return response.data;
  }

  async getUser(userId: string): Promise<User> {
    const response = await this.client.get(`/users/${userId}`);
    return response.data;
  }

  async searchUsers(query: string): Promise<{ users: User[]; total: number }> {
    const response = await this.client.get('/users/search', {
      params: { q: query },
    });
    return response.data;
  }

  // Chats
  async getChats(): Promise<ChatListResponse> {
    const response = await this.client.get('/chats');
    return response.data;
  }

  async createChat(data: {
    type: 'personal' | 'group' | 'channel';
    user_ids: string[];
    title?: string;
  }): Promise<{ chat_id: string }> {
    const response = await this.client.post('/chats', data);
    return response.data;
  }

  async getMessages(chatId: string, limit = 50, offset = 0): Promise<MessageListResponse> {
    const response = await this.client.get(`/chats/${chatId}/messages`, {
      params: { limit, offset },
    });
    return response.data;
  }

  async sendMessage(chatId: string, data: {
    content?: string;
    type?: 'text' | 'image' | 'video' | 'file' | 'voice';
    reply_to_id?: string;
    media_url?: string;
    thumbnail_url?: string;
    file_name?: string;
    mime_type?: string;
    media_size?: number;
    media_duration?: number;
  }): Promise<Message> {
    const response = await this.client.post(`/chats/${chatId}/messages`, {
      chat_id: chatId,
      type: data.type || 'text',
      ...data,
    });
    return response.data;
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.client.post(`/chats/messages/${messageId}/read`);
  }

  async editMessage(messageId: string, content: string): Promise<void> {
    await this.client.put(`/chats/messages/${messageId}`, { content });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.client.delete(`/chats/messages/${messageId}`);
  }

  // Group management
  async getChatMembers(chatId: string): Promise<{ members: any[]; total: number }> {
    const response = await this.client.get(`/chats/${chatId}/members`);
    return response.data;
  }

  async addChatMember(chatId: string, userId: string): Promise<void> {
    await this.client.post(`/chats/${chatId}/members`, { user_id: userId });
  }

  async removeChatMember(chatId: string, userId: string): Promise<void> {
    await this.client.delete(`/chats/${chatId}/members/${userId}`);
  }

  async updateChatInfo(chatId: string, data: { title?: string; avatar_url?: string }): Promise<void> {
    await this.client.put(`/chats/${chatId}`, data);
  }

  async updateMemberRole(chatId: string, userId: string, role: string): Promise<void> {
    await this.client.put(`/chats/${chatId}/members/${userId}/role`, { role });
  }

  async leaveChat(chatId: string): Promise<void> {
    await this.client.post(`/chats/${chatId}/leave`);
  }

  // Channel operations
  async subscribeToChannel(chatId: string): Promise<void> {
    await this.client.post(`/chats/${chatId}/subscribe`);
  }

  async unsubscribeFromChannel(chatId: string): Promise<void> {
    await this.client.post(`/chats/${chatId}/unsubscribe`);
  }

  // Media
  async uploadMedia(file: {
    uri: string;
    type: string;
    name: string;
  }): Promise<{
    media_url: string;
    thumbnail_url?: string;
    file_name: string;
    mime_type: string;
    file_size: number;
    media_type: string;
  }> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    const response = await this.client.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  // Device tokens (Push Notifications)
  async registerDeviceToken(data: {
    token: string;
    platform: 'ios' | 'android';
    device_id: string;
  }): Promise<void> {
    await this.client.post('/devices/register', data);
  }

  async unregisterDeviceToken(token: string): Promise<void> {
    await this.client.post('/devices/unregister', { token });
  }

  // Call operations
  async initiateCall(data: {
    receiver_id: string;
    chat_id: string;
    type: 'audio' | 'video';
  }): Promise<{ call_id: string; status: string }> {
    const response = await this.client.post('/calls/initiate', data);
    return response.data;
  }

  async answerCall(callId: string): Promise<void> {
    await this.client.post(`/calls/${callId}/answer`);
  }

  async rejectCall(callId: string): Promise<void> {
    await this.client.post(`/calls/${callId}/reject`);
  }

  async endCall(callId: string): Promise<{ status: string; duration: number }> {
    const response = await this.client.post(`/calls/${callId}/end`);
    return response.data;
  }

  async getCallHistory(): Promise<{ calls: any[]; total: number }> {
    const response = await this.client.get('/calls/history');
    return response.data;
  }

  // Helper method для проверки авторизации
  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('access_token');
    return !!token;
  }
}

export default new ApiService();
