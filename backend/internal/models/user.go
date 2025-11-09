package models

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID          uuid.UUID  `json:"id"`
	PhoneNumber string     `json:"phone_number"`
	Name        string     `json:"name,omitempty"`
	AvatarURL   string     `json:"avatar_url,omitempty"`
	Bio         string     `json:"bio,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	LastSeen    time.Time  `json:"last_seen"`
	IsOnline    bool       `json:"is_online"`
}

type AuthCode struct {
	ID          uuid.UUID `json:"id"`
	PhoneNumber string    `json:"phone_number"`
	Code        string    `json:"code"`
	ExpiresAt   time.Time `json:"expires_at"`
	Verified    bool      `json:"verified"`
	CreatedAt   time.Time `json:"created_at"`
}

type RefreshToken struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// DTOs для API
type SendCodeRequest struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
}

type SendCodeResponse struct {
	Message   string `json:"message"`
	ExpiresIn int    `json:"expires_in"` // секунды
}

type VerifyCodeRequest struct {
	PhoneNumber string `json:"phone_number" binding:"required"`
	Code        string `json:"code" binding:"required"`
}

type AuthResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	User         *User  `json:"user"`
	IsNewUser    bool   `json:"is_new_user"`
}

type UpdateProfileRequest struct {
	Name      *string `json:"name,omitempty"`
	Bio       *string `json:"bio,omitempty"`
	AvatarURL *string `json:"avatar_url,omitempty"`
}
