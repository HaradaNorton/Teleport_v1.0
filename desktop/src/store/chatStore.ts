import { create } from 'zustand';
import type { Chat, Message, TypingInfo, IncomingCallInfo, WebRTCSignal } from '../types';
import api from '../services/api';
import websocket from '../services/websocket';

type IncomingCallHandler = (callInfo: IncomingCallInfo) => void;
type WebRTCSignalHandler = (signal: WebRTCSignal) => void;
type CallStatusHandler = (status: any) => void;

interface ChatState {
  chats: Chat[];
  activeChat: Chat | null;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, string[]>;
  isLoading: boolean;
  error: string | null;

  // Handlers for real-time events
  onIncomingCall?: IncomingCallHandler;
  onWebRTCSignal?: WebRTCSignalHandler;
  onCallStatus?: CallStatusHandler;

  // Actions
  loadChats: () => Promise<void>;
  selectChat: (chatId: string) => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string) => Promise<void>;
  editMessage: (chatId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (chatId: string, messageId: string) => Promise<void>;
  replyToMessage: (chatId: string, messageId: string, content: string) => Promise<void>;
  forwardMessage: (fromChatId: string, messageId: string, toChatId: string) => Promise<void>;
  markAsRead: (chatId: string, messageIds: string[]) => Promise<void>;
  sendTyping: (chatId: string, typing: boolean) => void;
  createPrivateChat: (userId: string) => Promise<Chat>;
  createGroup: (name: string, participantIds: string[]) => Promise<Chat>;

  // WebSocket handlers
  handleWebSocketMessage: (message: any) => void;
  sendWebRTCSignal: (signal: any) => void;
  setIncomingCallHandler: (handler: IncomingCallHandler) => void;
  setWebRTCSignalHandler: (handler: WebRTCSignalHandler) => void;
  setCallStatusHandler: (handler: CallStatusHandler) => void;

  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChat: null,
  messages: {},
  typingUsers: {},
  isLoading: false,
  error: null,

  loadChats: async () => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.getChats();
      set({ chats: response.data, isLoading: false });
    } catch (error: any) {
      console.error('Failed to load chats:', error);
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Failed to load chats',
      });
    }
  },

  selectChat: async (chatId: string) => {
    const chat = get().chats.find((c) => c.id === chatId);
    if (chat) {
      set({ activeChat: chat });
      await get().loadMessages(chatId);
    }
  },

  loadMessages: async (chatId: string) => {
    set({ isLoading: true, error: null });

    try {
      const response = await api.getMessages(chatId);
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: response.data.reverse(), // Reverse to show oldest first
        },
        isLoading: false,
      }));
    } catch (error: any) {
      console.error('Failed to load messages:', error);
      set({
        isLoading: false,
        error: error.response?.data?.message || 'Failed to load messages',
      });
    }
  },

  sendMessage: async (chatId: string, content: string) => {
    try {
      const message = await api.sendMessage(chatId, content);

      // Optimistically add message to state
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: [...(state.messages[chatId] || []), message],
        },
      }));
    } catch (error: any) {
      console.error('Failed to send message:', error);
      set({
        error: error.response?.data?.message || 'Failed to send message',
      });
    }
  },

  editMessage: async (chatId: string, messageId: string, content: string) => {
    try {
      const updatedMessage = await api.editMessage(chatId, messageId, content);

      // Update message in state
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map((msg) =>
            msg.id === messageId ? updatedMessage : msg
          ),
        },
      }));
    } catch (error: any) {
      console.error('Failed to edit message:', error);
      set({
        error: error.response?.data?.message || 'Failed to edit message',
      });
    }
  },

  deleteMessage: async (chatId: string, messageId: string) => {
    try {
      await api.deleteMessage(chatId, messageId);

      // Remove message from state or mark as deleted
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map((msg) =>
            msg.id === messageId ? { ...msg, is_deleted: true, content: 'Message deleted' } : msg
          ),
        },
      }));
    } catch (error: any) {
      console.error('Failed to delete message:', error);
      set({
        error: error.response?.data?.message || 'Failed to delete message',
      });
    }
  },

  replyToMessage: async (chatId: string, messageId: string, content: string) => {
    try {
      const message = await api.replyToMessage(chatId, messageId, content);

      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: [...(state.messages[chatId] || []), message],
        },
      }));
    } catch (error: any) {
      console.error('Failed to reply to message:', error);
      set({
        error: error.response?.data?.message || 'Failed to reply to message',
      });
    }
  },

  forwardMessage: async (fromChatId: string, messageId: string, toChatId: string) => {
    try {
      const message = await api.forwardMessage(fromChatId, messageId, toChatId);

      set((state) => ({
        messages: {
          ...state.messages,
          [toChatId]: [...(state.messages[toChatId] || []), message],
        },
      }));
    } catch (error: any) {
      console.error('Failed to forward message:', error);
      set({
        error: error.response?.data?.message || 'Failed to forward message',
      });
    }
  },

  markAsRead: async (chatId: string, messageIds: string[]) => {
    try {
      await api.markAsRead(chatId, messageIds);

      // Update messages as read in state
      set((state) => ({
        messages: {
          ...state.messages,
          [chatId]: (state.messages[chatId] || []).map((msg) =>
            messageIds.includes(msg.id)
              ? { ...msg, read_by: [...(msg.read_by || []), 'current_user_id'] }
              : msg
          ),
        },
      }));
    } catch (error: any) {
      console.error('Failed to mark as read:', error);
    }
  },

  sendTyping: (chatId: string, typing: boolean) => {
    websocket.sendTyping(chatId, typing);
  },

  createPrivateChat: async (userId: string) => {
    try {
      const chat = await api.createChat(userId);
      set((state) => ({
        chats: [chat, ...state.chats],
      }));
      return chat;
    } catch (error: any) {
      console.error('Failed to create chat:', error);
      set({
        error: error.response?.data?.message || 'Failed to create chat',
      });
      throw error;
    }
  },

  createGroup: async (name: string, participantIds: string[]) => {
    try {
      const chat = await api.createGroup(name, participantIds);
      set((state) => ({
        chats: [chat, ...state.chats],
      }));
      return chat;
    } catch (error: any) {
      console.error('Failed to create group:', error);
      set({
        error: error.response?.data?.message || 'Failed to create group',
      });
      throw error;
    }
  },

  handleWebSocketMessage: (message: any) => {
    const { type, payload } = message;

    switch (type) {
      case 'message.new':
        // Add new message to chat
        set((state) => {
          const chatId = payload.chat_id;
          return {
            messages: {
              ...state.messages,
              [chatId]: [...(state.messages[chatId] || []), payload],
            },
          };
        });
        break;

      case 'message.updated':
        // Update existing message
        set((state) => {
          const chatId = payload.chat_id;
          return {
            messages: {
              ...state.messages,
              [chatId]: (state.messages[chatId] || []).map((msg) =>
                msg.id === payload.id ? payload : msg
              ),
            },
          };
        });
        break;

      case 'message.deleted':
        // Mark message as deleted
        set((state) => {
          const chatId = payload.chat_id;
          return {
            messages: {
              ...state.messages,
              [chatId]: (state.messages[chatId] || []).map((msg) =>
                msg.id === payload.message_id
                  ? { ...msg, is_deleted: true, content: 'Message deleted' }
                  : msg
              ),
            },
          };
        });
        break;

      case 'typing':
        // Handle typing indicator
        set((state) => {
          const { chat_id, user_id, typing } = payload;
          const currentTyping = state.typingUsers[chat_id] || [];

          return {
            typingUsers: {
              ...state.typingUsers,
              [chat_id]: typing
                ? [...currentTyping, user_id]
                : currentTyping.filter((id) => id !== user_id),
            },
          };
        });
        break;

      case 'call.incoming':
        // Handle incoming call
        if (get().onIncomingCall) {
          get().onIncomingCall!(payload);
        }
        break;

      case 'call.status':
        // Handle call status update
        if (get().onCallStatus) {
          get().onCallStatus!(payload);
        }
        break;

      case 'webrtc.signal':
        // Handle WebRTC signal
        if (get().onWebRTCSignal) {
          get().onWebRTCSignal!(payload);
        }
        break;

      default:
        console.log('Unknown message type:', type);
    }
  },

  sendWebRTCSignal: (signal: any) => {
    websocket.sendWebRTCSignal(signal);
  },

  setIncomingCallHandler: (handler: IncomingCallHandler) => {
    set({ onIncomingCall: handler });
  },

  setWebRTCSignalHandler: (handler: WebRTCSignalHandler) => {
    set({ onWebRTCSignal: handler });
  },

  setCallStatusHandler: (handler: CallStatusHandler) => {
    set({ onCallStatus: handler });
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Setup WebSocket message handler when store is created
websocket.onMessage((message) => {
  useChatStore.getState().handleWebSocketMessage(message);
});
