export interface User {
  id: string;
  phone_number: string;
  name?: string;
  avatar_url?: string;
  bio?: string;
  created_at: string;
  updated_at: string;
  last_seen: string;
  is_online: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  is_new_user: boolean;
}

export interface Chat {
  id: string;
  type: 'personal' | 'group' | 'channel';
  title?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  reply_to_id?: string;
  content?: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';
  media_url?: string;
  media_size?: number;
  media_duration?: number;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
  sender?: User;
  reply_to?: Message;
  read_by?: string[];
}

export interface ChatResponse {
  chat: Chat;
  members?: User[];
  last_message?: Message;
  unread_count: number;
}

export interface ChatListResponse {
  chats: ChatResponse[];
  total_count: number;
}

export interface MessageListResponse {
  messages: Message[];
  total_count: number;
  has_more: boolean;
}

export interface WSMessage {
  type: 'message.new' | 'message.edit' | 'message.delete' | 'message.read' | 'typing' | 'user.online' | 'user.offline';
  payload: any;
}
