package models

import (
	"time"

	"github.com/google/uuid"
)

type ChatType string

const (
	ChatTypePersonal ChatType = "personal"
	ChatTypeGroup    ChatType = "group"
	ChatTypeChannel  ChatType = "channel"
)

type Chat struct {
	ID            uuid.UUID  `json:"id"`
	Type          ChatType   `json:"type"`
	Title         string     `json:"title,omitempty"`
	AvatarURL     string     `json:"avatar_url,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	LastMessageAt *time.Time `json:"last_message_at,omitempty"`
}

type MemberRole string

const (
	RoleOwner  MemberRole = "owner"
	RoleAdmin  MemberRole = "admin"
	RoleMember MemberRole = "member"
)

type ChatMember struct {
	ID                uuid.UUID  `json:"id"`
	ChatID            uuid.UUID  `json:"chat_id"`
	UserID            uuid.UUID  `json:"user_id"`
	Role              MemberRole `json:"role"`
	JoinedAt          time.Time  `json:"joined_at"`
	LeftAt            *time.Time `json:"left_at,omitempty"`
	UnreadCount       int        `json:"unread_count"`
	LastReadMessageID *uuid.UUID `json:"last_read_message_id,omitempty"`
}

type Contact struct {
	ID            uuid.UUID `json:"id"`
	UserID        uuid.UUID `json:"user_id"`
	ContactUserID uuid.UUID `json:"contact_user_id"`
	DisplayName   string    `json:"display_name,omitempty"`
	IsBlocked     bool      `json:"is_blocked"`
	CreatedAt     time.Time `json:"created_at"`
}

// DTOs
type CreateChatRequest struct {
	Type      ChatType    `json:"type" binding:"required"`
	UserIDs   []uuid.UUID `json:"user_ids" binding:"required"`
	Title     string      `json:"title,omitempty"`
	AvatarURL string      `json:"avatar_url,omitempty"`
}

type ChatResponse struct {
	Chat         *Chat        `json:"chat"`
	Members      []User       `json:"members,omitempty"`
	LastMessage  *Message     `json:"last_message,omitempty"`
	UnreadCount  int          `json:"unread_count"`
}

type ChatListResponse struct {
	Chats      []ChatResponse `json:"chats"`
	TotalCount int            `json:"total_count"`
}
