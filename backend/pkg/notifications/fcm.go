package notifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/teleport/backend/internal/database"
	"github.com/teleport/backend/internal/models"
)

type FCMService struct {
	serverKey string
	db        *database.PostgresDB
	client    *http.Client
}

type FCMMessage struct {
	To           string                 `json:"to"`
	Notification FCMNotification        `json:"notification"`
	Data         map[string]interface{} `json:"data"`
	Priority     string                 `json:"priority"`
}

type FCMNotification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Sound string `json:"sound"`
	Badge int    `json:"badge,omitempty"`
}

type FCMResponse struct {
	Success      int `json:"success"`
	Failure      int `json:"failure"`
	CanonicalIds int `json:"canonical_ids"`
}

func NewFCMService(serverKey string, db *database.PostgresDB) *FCMService {
	return &FCMService{
		serverKey: serverKey,
		db:        db,
		client:    &http.Client{},
	}
}

// SendMessageNotification отправляет push-уведомление о новом сообщении
func (s *FCMService) SendMessageNotification(ctx context.Context, message *models.Message, chatTitle string) error {
	// Получаем всех активных участников чата, кроме отправителя
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT dt.token
		FROM device_tokens dt
		INNER JOIN chat_members cm ON cm.user_id = dt.user_id
		WHERE cm.chat_id = $1
		  AND cm.user_id != $2
		  AND cm.left_at IS NULL
		  AND dt.is_active = true
	`, message.ChatID, message.SenderID)
	if err != nil {
		return fmt.Errorf("failed to get device tokens: %w", err)
	}
	defer rows.Close()

	var tokens []string
	for rows.Next() {
		var token string
		if err := rows.Scan(&token); err != nil {
			log.Printf("Error scanning token: %v", err)
			continue
		}
		tokens = append(tokens, token)
	}

	if len(tokens) == 0 {
		log.Printf("No device tokens found for chat %s", message.ChatID)
		return nil
	}

	// Формируем текст уведомления
	title := chatTitle
	if message.Sender != nil && message.Sender.Name != "" {
		title = fmt.Sprintf("%s", message.Sender.Name)
	}

	body := s.formatMessageBody(message)

	// Отправляем уведомление каждому устройству
	for _, token := range tokens {
		if err := s.sendToDevice(ctx, token, title, body, message); err != nil {
			log.Printf("Failed to send notification to token %s: %v", token[:10]+"...", err)
			// Продолжаем отправку остальным устройствам
			continue
		}
	}

	return nil
}

func (s *FCMService) formatMessageBody(message *models.Message) string {
	switch message.Type {
	case "text":
		if len(message.Content) > 100 {
			return message.Content[:100] + "..."
		}
		return message.Content
	case "image":
		return "📷 Photo"
	case "video":
		return "🎥 Video"
	case "voice":
		return "🎤 Voice message"
	case "file":
		if message.FileName != "" {
			return fmt.Sprintf("📎 %s", message.FileName)
		}
		return "📎 File"
	default:
		return "New message"
	}
}

func (s *FCMService) sendToDevice(ctx context.Context, token, title, body string, message *models.Message) error {
	fcmMessage := FCMMessage{
		To: token,
		Notification: FCMNotification{
			Title: title,
			Body:  body,
			Sound: "default",
		},
		Data: map[string]interface{}{
			"chat_id":    message.ChatID.String(),
			"message_id": message.ID.String(),
			"type":       message.Type,
		},
		Priority: "high",
	}

	payload, err := json.Marshal(fcmMessage)
	if err != nil {
		return fmt.Errorf("failed to marshal FCM message: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://fcm.googleapis.com/fcm/send", bytes.NewBuffer(payload))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("key=%s", s.serverKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("FCM request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var fcmResp FCMResponse
	if err := json.NewDecoder(resp.Body).Decode(&fcmResp); err != nil {
		return fmt.Errorf("failed to decode FCM response: %w", err)
	}

	if fcmResp.Failure > 0 {
		log.Printf("FCM notification failed for some recipients: success=%d, failure=%d", fcmResp.Success, fcmResp.Failure)
	}

	return nil
}

// RegisterDeviceToken регистрирует или обновляет FCM токен устройства
func (s *FCMService) RegisterDeviceToken(ctx context.Context, userID uuid.UUID, token, platform, deviceID string) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO device_tokens (user_id, token, platform, device_id, is_active, updated_at)
		VALUES ($1, $2, $3, $4, true, CURRENT_TIMESTAMP)
		ON CONFLICT (user_id, token)
		DO UPDATE SET
			is_active = true,
			platform = EXCLUDED.platform,
			device_id = EXCLUDED.device_id,
			updated_at = CURRENT_TIMESTAMP
	`, userID, token, platform, deviceID)

	if err != nil {
		return fmt.Errorf("failed to register device token: %w", err)
	}

	return nil
}

// UnregisterDeviceToken деактивирует токен устройства (при logout)
func (s *FCMService) UnregisterDeviceToken(ctx context.Context, token string) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE device_tokens
		SET is_active = false, updated_at = CURRENT_TIMESTAMP
		WHERE token = $1
	`, token)

	if err != nil {
		return fmt.Errorf("failed to unregister device token: %w", err)
	}

	return nil
}
