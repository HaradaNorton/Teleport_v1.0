// User types
export interface User {
  id: string;
  phone_number: string;
  name?: string;
  bio?: string;
  avatar_url?: string;
  last_seen?: string;
  is_online?: boolean;
  created_at: string;
}

// Auth types
export interface LoginRequest {
  phone_number: string;
}

export interface LoginResponse {
  user_id: string;
  verification_required: boolean;
}

export interface VerifyRequest {
  user_id: string;
  code: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

// Chat types
export interface Chat {
  id: string;
  type: 'private' | 'group' | 'channel';
  name?: string;
  avatar_url?: string;
  participants?: User[];
  last_message?: Message;
  unread_count: number;
  created_at: string;
  updated_at: string;
}

// Message types
export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  sender?: User;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'voice';
  media_url?: string;
  reply_to?: Message;
  forwarded_from?: {
    chat_id: string;
    message_id: string;
  };
  read_by: string[];
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
  is_deleted?: boolean;
}

// Call types
export interface Call {
  id: string;
  chat_id: string;
  caller_id: string;
  receiver_id: string;
  type: 'audio' | 'video';
  status: 'pending' | 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended' | 'failed';
  started_at: string;
  answered_at?: string;
  ended_at?: string;
  duration: number;
}

export interface IncomingCallInfo {
  call_id: string;
  type: 'audio' | 'video';
  caller: User;
}

// WebSocket types
export interface WSMessage {
  type: string;
  payload: any;
}

export interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  call_id: string;
  from_user_id: string;
  to_user_id: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

// Typing indicator
export interface TypingInfo {
  chat_id: string;
  user_id: string;
  typing: boolean;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}
