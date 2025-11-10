import React, { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import type { Chat } from '../types';
import '../styles/ChatListPage.css';

interface Props {
  onSelectChat: (chatId: string) => void;
  onStartCall: (chatId: string, callType: 'audio' | 'video') => void;
}

export default function ChatListPage({ onSelectChat, onStartCall }: Props) {
  const { user, logout } = useAuthStore();
  const { chats, loadChats, isLoading } = useChatStore();

  useEffect(() => {
    loadChats();
  }, []);

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 86400000) {
      // Less than 24 hours
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diff < 604800000) {
      // Less than 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getChatName = (chat: Chat): string => {
    if (chat.name) return chat.name;
    if (chat.type === 'private' && chat.participants) {
      const otherUser = chat.participants.find((p) => p.id !== user?.id);
      return otherUser?.name || otherUser?.phone_number || 'Unknown';
    }
    return 'Chat';
  };

  const getChatAvatar = (chat: Chat): string => {
    if (chat.type === 'private' && chat.participants) {
      const otherUser = chat.participants.find((p) => p.id !== user?.id);
      return otherUser?.name?.charAt(0).toUpperCase() || '?';
    }
    return chat.name?.charAt(0).toUpperCase() || '#';
  };

  return (
    <div className="chat-list-container">
      <div className="chat-list-header">
        <h2>Teleport</h2>
        <div className="header-actions">
          <button className="icon-btn" title="Settings">
            ⚙️
          </button>
          <button className="icon-btn" onClick={logout} title="Logout">
            🚪
          </button>
        </div>
      </div>

      <div className="user-profile">
        <div className="user-avatar">
          {user?.name?.charAt(0).toUpperCase() || '👤'}
        </div>
        <div className="user-info">
          <div className="user-name">{user?.name || 'User'}</div>
          <div className="user-phone">{user?.phone_number}</div>
        </div>
      </div>

      <div className="search-bar">
        <input type="text" placeholder="Search chats..." />
      </div>

      <div className="chat-list">
        {isLoading ? (
          <div className="loading-state">Loading chats...</div>
        ) : chats.length === 0 ? (
          <div className="empty-state">
            <p>No chats yet</p>
            <p className="empty-hint">Start a new conversation</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className="chat-item"
              onClick={() => onSelectChat(chat.id)}
            >
              <div className="chat-avatar">
                {getChatAvatar(chat)}
              </div>

              <div className="chat-info">
                <div className="chat-header-row">
                  <div className="chat-name">{getChatName(chat)}</div>
                  {chat.last_message && (
                    <div className="chat-time">
                      {formatTime(chat.last_message.created_at)}
                    </div>
                  )}
                </div>

                <div className="chat-preview-row">
                  <div className="chat-preview">
                    {chat.last_message?.content || 'No messages yet'}
                  </div>
                  {chat.unread_count > 0 && (
                    <div className="unread-badge">{chat.unread_count}</div>
                  )}
                </div>
              </div>

              <div className="chat-actions">
                <button
                  className="icon-btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartCall(chat.id, 'audio');
                  }}
                  title="Audio call"
                >
                  📞
                </button>
                <button
                  className="icon-btn-small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartCall(chat.id, 'video');
                  }}
                  title="Video call"
                >
                  📹
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="chat-list-footer">
        <button className="btn-new-chat">
          ➕ New Chat
        </button>
      </div>
    </div>
  );
}
