import { create } from 'zustand';
import type { ChatResponse, Message } from '../types';
import api from '../services/api';

interface ChatState {
  chats: ChatResponse[];
  currentChatId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;

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
  addMessage: (message: Message) => void;
  setCurrentChat: (chatId: string | null) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  currentChatId: null,
  messages: {},
  isLoading: false,

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

  setCurrentChat: (chatId: string | null) => {
    set({ currentChatId: chatId });
  },
}));
