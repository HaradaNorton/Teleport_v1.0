import axios, { AxiosInstance } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  VerifyRequest,
  AuthResponse,
  User,
  Chat,
  Message,
  Call,
  PaginatedResponse,
} from '../types';

const API_URL = 'http://192.168.1.109:8080/api/v1';

class APIService {
  private client: AxiosInstance;
  private accessToken: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Load token from localStorage
    this.loadToken();

    // Add request interceptor to include token
    this.client.interceptors.request.use(
      (config) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retried, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = localStorage.getItem('refresh_token');
            if (refreshToken) {
              const response = await axios.post(`${API_URL}/auth/refresh`, {
                refresh_token: refreshToken,
              });

              const { access_token } = response.data;
              this.setToken(access_token);

              originalRequest.headers.Authorization = `Bearer ${access_token}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            // Refresh failed, logout
            this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private loadToken() {
    this.accessToken = localStorage.getItem('access_token');
  }

  private setToken(token: string) {
    this.accessToken = token;
    localStorage.setItem('access_token', token);
  }

  private clearToken() {
    this.accessToken = null;
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  // Auth endpoints
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.client.post('/auth/send-code', data);
    return response.data;
  }

  async verify(data: VerifyRequest): Promise<AuthResponse> {
    const response = await this.client.post('/auth/verify', data);
    const { access_token, refresh_token, user } = response.data;

    this.setToken(access_token);
    localStorage.setItem('refresh_token', refresh_token);

    return response.data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get('/users/me');
    return response.data;
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.client.put('/users/me', data);
    return response.data;
  }

  // Chat endpoints
  async getChats(page = 1, perPage = 20): Promise<PaginatedResponse<Chat>> {
    const response = await this.client.get('/chats', {
      params: { page, per_page: perPage },
    });
    return response.data;
  }

  async getChat(chatId: string): Promise<Chat> {
    const response = await this.client.get(`/chats/${chatId}`);
    return response.data;
  }

  async createChat(userId: string): Promise<Chat> {
    const response = await this.client.post('/chats', {
      type: 'private',
      participant_ids: [userId],
    });
    return response.data;
  }

  async createGroup(name: string, participantIds: string[]): Promise<Chat> {
    const response = await this.client.post('/chats', {
      type: 'group',
      name,
      participant_ids: participantIds,
    });
    return response.data;
  }

  async createChannel(name: string, description?: string): Promise<Chat> {
    const response = await this.client.post('/chats', {
      type: 'channel',
      name,
      description,
    });
    return response.data;
  }

  // Message endpoints
  async getMessages(
    chatId: string,
    page = 1,
    perPage = 50
  ): Promise<PaginatedResponse<Message>> {
    const response = await this.client.get(`/chats/${chatId}/messages`, {
      params: { page, per_page: perPage },
    });
    return response.data;
  }

  async sendMessage(chatId: string, content: string, type = 'text'): Promise<Message> {
    const response = await this.client.post(`/chats/${chatId}/messages`, {
      content,
      type,
    });
    return response.data;
  }

  async editMessage(chatId: string, messageId: string, content: string): Promise<Message> {
    const response = await this.client.put(`/chats/${chatId}/messages/${messageId}`, {
      content,
    });
    return response.data;
  }

  async deleteMessage(chatId: string, messageId: string): Promise<void> {
    await this.client.delete(`/chats/${chatId}/messages/${messageId}`);
  }

  async replyToMessage(
    chatId: string,
    messageId: string,
    content: string
  ): Promise<Message> {
    const response = await this.client.post(`/chats/${chatId}/messages`, {
      content,
      type: 'text',
      reply_to_id: messageId,
    });
    return response.data;
  }

  async forwardMessage(
    fromChatId: string,
    messageId: string,
    toChatId: string
  ): Promise<Message> {
    const response = await this.client.post(`/chats/${toChatId}/messages/forward`, {
      from_chat_id: fromChatId,
      message_id: messageId,
    });
    return response.data;
  }

  async markAsRead(chatId: string, messageIds: string[]): Promise<void> {
    await this.client.post(`/chats/${chatId}/messages/read`, {
      message_ids: messageIds,
    });
  }

  // Upload file
  async uploadFile(file: File): Promise<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }

  // Call endpoints
  async initiateCall(data: {
    receiver_id: string;
    chat_id: string;
    type: 'audio' | 'video';
  }): Promise<Call> {
    const response = await this.client.post('/calls/initiate', data);
    return response.data;
  }

  async answerCall(callId: string): Promise<Call> {
    const response = await this.client.post(`/calls/${callId}/answer`);
    return response.data;
  }

  async rejectCall(callId: string): Promise<void> {
    await this.client.post(`/calls/${callId}/reject`);
  }

  async endCall(callId: string): Promise<Call> {
    const response = await this.client.post(`/calls/${callId}/end`);
    return response.data;
  }

  async getCallHistory(page = 1, perPage = 20): Promise<PaginatedResponse<Call>> {
    const response = await this.client.get('/calls/history', {
      params: { page, per_page: perPage },
    });
    return response.data;
  }

  // User search
  async searchUsers(query: string): Promise<User[]> {
    const response = await this.client.get('/users/search', {
      params: { q: query },
    });
    return response.data;
  }

  // Helper to check if logged in
  isLoggedIn(): boolean {
    return this.accessToken !== null;
  }
}

export default new APIService();
