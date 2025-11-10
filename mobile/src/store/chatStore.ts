import { create } from 'zustand';
import type { ChatResponse, Message, WSMessage } from '../types';
import api from '../services/api';
import websocket from '../services/websocket';

interface TypingUser {
  userId: string;
  userName?: string;
}

interface ChatState {
  chats: ChatResponse[];
  currentChatId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  typingUsers: Record<string, TypingUser[]>; // chatId -> users typing

  // Actions
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string) => Promise<void>;
  sendMediaMessage: (
    chatId: string,
    mediaData: {
      type: 'image' | 'video' | 'file' | 'voice';
      media_url: string;
      thumbnail_url?: string;
      file_name: string;
      mime_type: string;
      media_size: number;
    }
  ) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, content: string) => void;
  removeMessage: (messageId: string) => void;
  setCurrentChat: (chatId: string | null) => void;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
  sendTyping: (chatId: string, typing: boolean) => void;
  handleWebSocketMessage: (message: WSMessage) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: {},
  isLoading: false,
  typingUsers: {},

  loadChats: async () => {
    set({ isLoading: true });
    try {
      const response = await api.getChats();
      set({ chats: response.chats, isLoading: false });
    } catch (error) {
      console.error('Load chats error:', error);
      set({ isLoading: false });
    }
  },

  loadMessages: async (chatId: string) => {
    try {
      const response = await api.getMessages(chatId);
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: response.messages.reverse(), // Новые сообщения внизу
        },
      }));
    } catch (error) {
      console.error('Load messages error:', error);
    }
  },

  sendMessage: async (chatId: string, content: string) => {
    try {
      const message = await api.sendMessage(chatId, { content });
      get().addMessage(message);
    } catch (error) {
      console.error('Send message error:', error);
      throw error;
    }
  },

  sendMediaMessage: async (
    chatId: string,
    mediaData: {
      type: 'image' | 'video' | 'file' | 'voice';
      media_url: string;
      thumbnail_url?: string;
      file_name: string;
      mime_type: string;
      media_size: number;
    }
  ) => {
    try {
      const message = await api.sendMessage(chatId, {
        type: mediaData.type,
        media_url: mediaData.media_url,
        thumbnail_url: mediaData.thumbnail_url,
        file_name: mediaData.file_name,
        mime_type: mediaData.mime_type,
        media_size: mediaData.media_size,
      });
      get().addMessage(message);
    } catch (error) {
      console.error('Send media message error:', error);
      throw error;
    }
  },

  editMessage: async (messageId: string, content: string) => {
    try {
      await api.editMessage(messageId, content);
      get().updateMessage(messageId, content);
    } catch (error) {
      console.error('Edit message error:', error);
      throw error;
    }
  },

  deleteMessage: async (messageId: string) => {
    try {
      await api.deleteMessage(messageId);
      get().removeMessage(messageId);
    } catch (error) {
      console.error('Delete message error:', error);
      throw error;
    }
  },

  addMessage: (message: Message) => {
    set((state) => {
      const chatMessages = state.messages[message.chat_id] || [];
      return {
        messages: {
          ...state.messages,
          [message.chat_id]: [...chatMessages, message],
        },
      };
    });
  },

  updateMessage: (messageId: string, content: string) => {
    set((state) => {
      const updatedMessages: Record<string, Message[]> = {};

      Object.keys(state.messages).forEach((chatId) => {
        updatedMessages[chatId] = state.messages[chatId].map((msg) =>
          msg.id === messageId
            ? { ...msg, content, edited_at: new Date().toISOString() }
            : msg
        );
      });

      return { messages: updatedMessages };
    });
  },

  removeMessage: (messageId: string) => {
    set((state) => {
      const updatedMessages: Record<string, Message[]> = {};

      Object.keys(state.messages).forEach((chatId) => {
        updatedMessages[chatId] = state.messages[chatId].filter(
          (msg) => msg.id !== messageId
        );
      });

      return { messages: updatedMessages };
    });
  },

  setCurrentChat: (chatId: string | null) => {
    set({ currentChatId: chatId });
  },

  connectWebSocket: () => {
    websocket.connect();

    // Subscribe to WebSocket messages
    websocket.onMessage((message) => {
      get().handleWebSocketMessage(message);
    });
  },

  disconnectWebSocket: () => {
    websocket.disconnect();
  },

  sendTyping: (chatId: string, typing: boolean) => {
    websocket.sendTyping(chatId, typing);
  },

  handleWebSocketMessage: (message: WSMessage) => {
    switch (message.type) {
      case 'message.new':
        // Add new message to chat
        const newMessage = message.payload as Message;
        get().addMessage(newMessage);

        // Update last message in chat list
        set((state) => ({
          chats: state.chats.map((chat) =>
            chat.chat.id === newMessage.chat_id
              ? { ...chat, last_message: newMessage }
              : chat
          ),
        }));
        break;

      case 'typing':
        // Handle typing indicator
        const typingPayload = message.payload as any;
        const { chat_id, user_id, typing } = typingPayload;

        set((state) => {
          const chatTypingUsers = state.typingUsers[chat_id] || [];

          if (typing) {
            // Add user to typing list
            if (!chatTypingUsers.find((u) => u.userId === user_id)) {
              return {
                typingUsers: {
                  ...state.typingUsers,
                  [chat_id]: [...chatTypingUsers, { userId: user_id }],
                },
              };
            }
          } else {
            // Remove user from typing list
            return {
              typingUsers: {
                ...state.typingUsers,
                [chat_id]: chatTypingUsers.filter((u) => u.userId !== user_id),
              },
            };
          }

          return state;
        });
        break;

      case 'user.online':
      case 'user.offline':
        // Handle online/offline status
        const { user_id: userId, is_online } = message.payload as any;

        // Update user status in chats
        set((state) => ({
          chats: state.chats.map((chat) => {
            if (chat.members) {
              return {
                ...chat,
                members: chat.members.map((member) =>
                  member.id === userId ? { ...member, is_online } : member
                ),
              };
            }
            return chat;
          }),
        }));
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  },
}));
