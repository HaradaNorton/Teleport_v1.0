package models

import (
	"time"

	"github.com/google/uuid"
)

type CallType string
type CallStatus string

const (
	CallTypeAudio CallType = "audio"
	CallTypeVideo CallType = "video"
)

const (
	CallStatusPending  CallStatus = "pending"
	CallStatusRinging  CallStatus = "ringing"
	CallStatusAccepted CallStatus = "accepted"
	CallStatusRejected CallStatus = "rejected"
	CallStatusMissed   CallStatus = "missed"
	CallStatusEnded    CallStatus = "ended"
	CallStatusFailed   CallStatus = "failed"
)

type Call struct {
	ID         uuid.UUID  `json:"id"`
	ChatID     uuid.UUID  `json:"chat_id"`
	CallerID   uuid.UUID  `json:"caller_id"`
	ReceiverID uuid.UUID  `json:"receiver_id"`
	Type       CallType   `json:"type"`
	Status     CallStatus `json:"status"`
	StartedAt  time.Time  `json:"started_at"`
	AnsweredAt *time.Time `json:"answered_at,omitempty"`
	EndedAt    *time.Time `json:"ended_at,omitempty"`
	Duration   int        `json:"duration"` // в секундах
	CreatedAt  time.Time  `json:"created_at"`

	// Дополнительная информация (для responses)
	Caller   *User `json:"caller,omitempty"`
	Receiver *User `json:"receiver,omitempty"`
}

// WebRTC signaling messages
type SignalType string

const (
	SignalTypeOffer     SignalType = "offer"
	SignalTypeAnswer    SignalType = "answer"
	SignalTypeCandidate SignalType = "ice-candidate"
	SignalTypeHangup    SignalType = "hangup"
)

type WebRTCSignal struct {
	Type       SignalType  `json:"type"`
	CallID     uuid.UUID   `json:"call_id"`
	FromUserID uuid.UUID   `json:"from_user_id"`
	ToUserID   uuid.UUID   `json:"to_user_id"`
	Offer      interface{} `json:"offer,omitempty"`
	Answer     interface{} `json:"answer,omitempty"`
	Candidate  interface{} `json:"candidate,omitempty"`
}
