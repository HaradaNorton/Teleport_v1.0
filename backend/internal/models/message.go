package models

import (
	"time"

	"github.com/google/uuid"
)

type MessageType string

const (
	MessageTypeText   MessageType = "text"
	MessageTypeImage  MessageType = "image"
	MessageTypeVideo  MessageType = "video"
	MessageTypeFile   MessageType = "file"
	MessageTypeVoice  MessageType = "voice"
	MessageTypeSystem MessageType = "system"
)

type Message struct {
	ID            uuid.UUID    `json:"id"`
	ChatID        uuid.UUID    `json:"chat_id"`
	SenderID      uuid.UUID    `json:"sender_id"`
	ReplyToID     *uuid.UUID   `json:"reply_to_id,omitempty"`
	Content       string       `json:"content,omitempty"`
	Type          MessageType  `json:"type"`
	MediaURL      string       `json:"media_url,omitempty"`
	ThumbnailURL  string       `json:"thumbnail_url,omitempty"`
	FileName      string       `json:"file_name,omitempty"`
	MimeType      string       `json:"mime_type,omitempty"`
	MediaSize     int          `json:"media_size,omitempty"`
	MediaDuration int          `json:"media_duration,omitempty"`
	CreatedAt     time.Time    `json:"created_at"`
	EditedAt      *time.Time   `json:"edited_at,omitempty"`
	DeletedAt     *time.Time   `json:"deleted_at,omitempty"`
	Sender        *User        `json:"sender,omitempty"`
	ReplyTo       *Message     `json:"reply_to,omitempty"`
	ReadBy        []uuid.UUID  `json:"read_by,omitempty"`
}

type MessageRead struct {
	MessageID uuid.UUID `json:"message_id"`
	UserID    uuid.UUID `json:"user_id"`
	ReadAt    time.Time `json:"read_at"`
}

// DTOs
type SendMessageRequest struct {
	ChatID        uuid.UUID   `json:"chat_id" binding:"required"`
	Content       string      `json:"content"`
	Type          MessageType `json:"type" binding:"required"`
	ReplyToID     *uuid.UUID  `json:"reply_to_id,omitempty"`
	MediaURL      string      `json:"media_url,omitempty"`
	ThumbnailURL  string      `json:"thumbnail_url,omitempty"`
	FileName      string      `json:"file_name,omitempty"`
	MimeType      string      `json:"mime_type,omitempty"`
	MediaSize     int         `json:"media_size,omitempty"`
	MediaDuration int         `json:"media_duration,omitempty"`
}

type MessageListRequest struct {
	ChatID uuid.UUID `json:"chat_id" binding:"required"`
	Limit  int       `json:"limit"`
	Offset int       `json:"offset"`
	Before *uuid.UUID `json:"before,omitempty"` // Для пагинации по ID
}

type MessageListResponse struct {
	Messages   []Message `json:"messages"`
	TotalCount int       `json:"total_count"`
	HasMore    bool      `json:"has_more"`
}

type EditMessageRequest struct {
	MessageID uuid.UUID `json:"message_id" binding:"required"`
	Content   string    `json:"content" binding:"required"`
}

type DeleteMessageRequest struct {
	MessageID uuid.UUID `json:"message_id" binding:"required"`
	ForEveryone bool    `json:"for_everyone"`
}

type MarkAsReadRequest struct {
	ChatID    uuid.UUID `json:"chat_id" binding:"required"`
	MessageID uuid.UUID `json:"message_id" binding:"required"`
}

// WebSocket message types
type WSMessageType string

const (
	WSMessageTypeNew      WSMessageType = "message.new"
	WSMessageTypeEdit     WSMessageType = "message.edit"
	WSMessageTypeDelete   WSMessageType = "message.delete"
	WSMessageTypeRead     WSMessageType = "message.read"
	WSMessageTypeTyping   WSMessageType = "typing"
	WSMessageTypeOnline   WSMessageType = "user.online"
	WSMessageTypeOffline  WSMessageType = "user.offline"
)

type WSMessage struct {
	Type    WSMessageType `json:"type"`
	Payload interface{}   `json:"payload"`
}

type TypingPayload struct {
	ChatID uuid.UUID `json:"chat_id"`
	UserID uuid.UUID `json:"user_id"`
	Typing bool      `json:"typing"`
}
