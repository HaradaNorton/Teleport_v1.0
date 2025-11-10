import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import type { Message } from '../types';
import '../styles/ChatPage.css';

interface Props {
  chatId: string;
  onBack: () => void;
  onStartCall: (callType: 'audio' | 'video') => void;
}

export default function ChatPage({ chatId, onBack, onStartCall }: Props) {
  const [messageText, setMessageText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuthStore();
  const {
    activeChat,
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    replyToMessage,
    sendTyping,
    typingUsers,
  } = useChatStore();

  const chatMessages = messages[chatId] || [];
  const typingUsersList = typingUsers[chatId] || [];

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const text = messageText;
    setMessageText('');

    if (replyTo) {
      await replyToMessage(chatId, replyTo.id, text);
      setReplyTo(null);
    } else {
      await sendMessage(chatId, text);
    }

    inputRef.current?.focus();
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);

    // Send typing indicator
    if (e.target.value.length > 0) {
      sendTyping(chatId, true);
    } else {
      sendTyping(chatId, false);
    }
  };

  const formatMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getChatName = (): string => {
    if (activeChat?.name) return activeChat.name;
    if (activeChat?.type === 'private' && activeChat.participants) {
      const otherUser = activeChat.participants.find((p) => p.id !== user?.id);
      return otherUser?.name || otherUser?.phone_number || 'Unknown';
    }
    return 'Chat';
  };

  const isMyMessage = (message: Message): boolean => {
    return message.sender_id === user?.id;
  };

  const handleReply = (message: Message) => {
    setReplyTo(message);
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="btn-back" onClick={onBack}>
          ←
        </button>

        <div className="chat-header-info">
          <div className="chat-title">{getChatName()}</div>
          <div className="chat-status">
            {typingUsersList.length > 0 ? 'typing...' : 'online'}
          </div>
        </div>

        <div className="chat-header-actions">
          <button
            className="icon-btn"
            onClick={() => onStartCall('audio')}
            title="Audio call"
          >
            📞
          </button>
          <button
            className="icon-btn"
            onClick={() => onStartCall('video')}
            title="Video call"
          >
            📹
          </button>
          <button className="icon-btn" title="More">
            ⋮
          </button>
        </div>
      </div>

      <div className="messages-container">
        {chatMessages.length === 0 ? (
          <div className="empty-messages">
            <p>No messages yet</p>
            <p className="empty-hint">Send a message to start the conversation</p>
          </div>
        ) : (
          chatMessages.map((message) => (
            <div
              key={message.id}
              className={`message ${isMyMessage(message) ? 'message-outgoing' : 'message-incoming'}`}
            >
              {!isMyMessage(message) && message.sender && (
                <div className="message-sender">{message.sender.name || 'User'}</div>
              )}

              {message.reply_to && (
                <div className="message-reply">
                  <div className="reply-line" />
                  <div className="reply-content">
                    <div className="reply-author">
                      {message.reply_to.sender?.name || 'User'}
                    </div>
                    <div className="reply-text">{message.reply_to.content}</div>
                  </div>
                </div>
              )}

              {message.forwarded_from && (
                <div className="message-forwarded">Forwarded message</div>
              )}

              <div className="message-content">
                {message.is_deleted ? (
                  <em className="message-deleted">Message deleted</em>
                ) : (
                  <>
                    {message.content}
                    {message.is_edited && (
                      <span className="message-edited"> (edited)</span>
                    )}
                  </>
                )}
              </div>

              <div className="message-meta">
                <span className="message-time">
                  {formatMessageTime(message.created_at)}
                </span>
                {isMyMessage(message) && (
                  <span className="message-status">
                    {message.read_by?.length > 1 ? '✓✓' : '✓'}
                  </span>
                )}
              </div>

              {!message.is_deleted && (
                <div className="message-actions">
                  <button
                    className="message-action-btn"
                    onClick={() => handleReply(message)}
                    title="Reply"
                  >
                    ↩️
                  </button>
                  {isMyMessage(message) && (
                    <>
                      <button
                        className="message-action-btn"
                        onClick={() => {
                          const newContent = prompt('Edit message:', message.content);
                          if (newContent && newContent !== message.content) {
                            editMessage(chatId, message.id, newContent);
                          }
                        }}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      <button
                        className="message-action-btn"
                        onClick={() => {
                          if (confirm('Delete this message?')) {
                            deleteMessage(chatId, message.id);
                          }
                        }}
                        title="Delete"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {replyTo && (
        <div className="reply-preview">
          <div className="reply-preview-content">
            <div className="reply-preview-label">Replying to:</div>
            <div className="reply-preview-text">{replyTo.content}</div>
          </div>
          <button className="reply-preview-close" onClick={cancelReply}>
            ✕
          </button>
        </div>
      )}

      <form className="message-input-container" onSubmit={handleSend}>
        <button type="button" className="icon-btn" title="Attach">
          📎
        </button>

        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={messageText}
          onChange={handleTyping}
          className="message-input"
        />

        <button
          type="submit"
          className="btn-send"
          disabled={!messageText.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
