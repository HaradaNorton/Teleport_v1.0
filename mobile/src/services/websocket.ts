import AsyncStorage from '@react-native-async-storage/async-storage';
import { WSMessage } from '../types';

type MessageHandler = (message: WSMessage) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private messageHandlers: MessageHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000;
  private isIntentionalClose = false;

  async connect() {
    try {
      // Get access token
      const token = await AsyncStorage.getItem('access_token');
      if (!token) {
        console.log('No access token, cannot connect to WebSocket');
        return;
      }

      // Close existing connection
      if (this.ws) {
        this.isIntentionalClose = true;
        this.ws.close();
      }

      // Create WebSocket connection
      const wsUrl = `ws://localhost:8080/api/v1/ws?token=${token}`;
      this.ws = new WebSocket(wsUrl);
      this.isIntentionalClose = false;

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.ws = null;

        // Auto-reconnect if not intentional close
        if (!this.isIntentionalClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.log(`Reconnecting... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          setTimeout(() => this.connect(), this.reconnectDelay);
        }
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }

  disconnect() {
    this.isIntentionalClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers = [];
  }

  send(message: WSMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler);
    };
  }

  private handleMessage(message: WSMessage) {
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  sendTyping(chatId: string, typing: boolean) {
    this.send({
      type: 'typing',
      payload: {
        chat_id: chatId,
        typing,
      },
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}

export default new WebSocketService();
