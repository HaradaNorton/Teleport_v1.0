import { create } from 'zustand';
import type { ChatResponse, Message, WSMessage } from '../types';
import api from '../services/api';
import websocket from '../services/websocket';

interface TypingUser {
  userId: string;
  userName?: string;
}

// Callback types for WebRTC and calls
export type IncomingCallHandler = (callInfo: {
  call_id: string;
  caller_id: string;
  receiver_id: string;
  chat_id: string;
  type: 'audio' | 'video';
  caller: {
    id: string;
    name?: string;
    phone_number: string;
    avatar_url?: string;
  };
}) => void;

export type WebRTCSignalHandler = (signal: {
  type: string;
  call_id: string;
  from_user_id: string;
  to_user_id: string;
  offer?: any;
  answer?: any;
  candidate?: any;
}) => void;

export type CallStatusHandler = (status: {
  call_id: string;
  status: string;
  [key: string]: any;
}) => void;

interface ChatState {
  chats: ChatResponse[];
  currentChatId: string | null;
  messages: Record<string, Message[]>;
  isLoading: boolean;
  typingUsers: Record<string, TypingUser[]>; // chatId -> users typing

  // Callback handlers for external components
  onIncomingCall?: IncomingCallHandler;
  onWebRTCSignal?: WebRTCSignalHandler;
  onCallStatus?: CallStatusHandler;

  // Actions
  loadChats: () => Promise<void>;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, replyToId?: string) => Promise<void>;
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
  sendWebRTCSignal: (signal: any) => void;
  setIncomingCallHandler: (handler: IncomingCallHandler) => void;
  setWebRTCSignalHandler: (handler: WebRTCSignalHandler) => void;
  setCallStatusHandler: (handler: CallStatusHandler) => void;
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

  sendMessage: async (chatId: string, content: string, replyToId?: string) => {
    try {
      const message = await api.sendMessage(chatId, { content, reply_to_id: replyToId });
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

      case 'message.read':
        // Handle read receipt
        const readPayload = message.payload as any;
        const { message_id, user_id: readUserId } = readPayload;

        set((state) => {
          const updatedMessages: Record<string, Message[]> = {};

          Object.keys(state.messages).forEach((chatId) => {
            updatedMessages[chatId] = state.messages[chatId].map((msg) => {
              if (msg.id === message_id) {
                const readBy = msg.read_by || [];
                if (!readBy.includes(readUserId)) {
                  return { ...msg, read_by: [...readBy, readUserId] };
                }
              }
              return msg;
            });
          });

          return { messages: updatedMessages };
        });
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

      case 'call.incoming':
        // Handle incoming call
        const callInfo = message.payload as any;
        console.log('Incoming call:', callInfo);

        const onIncomingCall = get().onIncomingCall;
        if (onIncomingCall) {
          onIncomingCall(callInfo);
        }
        break;

      case 'webrtc.signal':
        // Handle WebRTC signaling
        const signal = message.payload as any;
        console.log('WebRTC signal received:', signal.type);

        const onWebRTCSignal = get().onWebRTCSignal;
        if (onWebRTCSignal) {
          onWebRTCSignal(signal);
        }
        break;

      case 'call.answered':
      case 'call.rejected':
      case 'call.ended':
        // Handle call status updates
        const statusPayload = message.payload as any;
        console.log('Call status update:', message.type, statusPayload);

        const onCallStatus = get().onCallStatus;
        if (onCallStatus) {
          onCallStatus({
            ...statusPayload,
            status: message.type.replace('call.', ''),
          });
        }
        break;

      default:
        console.log('Unknown WebSocket message type:', message.type);
    }
  },
}));
