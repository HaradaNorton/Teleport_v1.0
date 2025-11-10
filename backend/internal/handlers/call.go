package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teleport/backend/internal/database"
	"github.com/teleport/backend/internal/models"
)

type CallHandler struct {
	db        *database.PostgresDB
	wsHandler *WebSocketHandler
}

func NewCallHandler(db *database.PostgresDB, wsHandler *WebSocketHandler) *CallHandler {
	return &CallHandler{
		db:        db,
		wsHandler: wsHandler,
	}
}

// InitiateCall - начать звонок
func (h *CallHandler) InitiateCall(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req struct {
		ReceiverID string `json:"receiver_id" binding:"required"`
		ChatID     string `json:"chat_id" binding:"required"`
		Type       string `json:"type" binding:"required,oneof=audio video"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	callerUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid caller id"})
		return
	}

	receiverUUID, err := uuid.Parse(req.ReceiverID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid receiver id"})
		return
	}

	chatUUID, err := uuid.Parse(req.ChatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	// Создаем звонок
	callID := uuid.New()
	query := `
		INSERT INTO calls (id, chat_id, caller_id, receiver_id, type, status, started_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`

	now := time.Now()
	err = h.db.QueryRow(
		query,
		callID,
		chatUUID,
		callerUUID,
		receiverUUID,
		req.Type,
		models.CallStatusRinging,
		now,
		now,
	).Scan(&callID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create call"})
		return
	}

	// Получаем информацию о звонящем
	var caller models.User
	err = h.db.QueryRow(`
		SELECT id, phone_number, COALESCE(name, ''), COALESCE(avatar_url, ''), COALESCE(bio, '')
		FROM users WHERE id = $1
	`, callerUUID).Scan(
		&caller.ID,
		&caller.PhoneNumber,
		&caller.Name,
		&caller.AvatarURL,
		&caller.Bio,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get caller info"})
		return
	}

	// Отправляем WebSocket уведомление получателю
	if h.wsHandler != nil {
		wsMsg := models.WSMessage{
			Type: "call.incoming",
			Payload: map[string]interface{}{
				"call_id":     callID.String(),
				"caller_id":   callerUUID.String(),
				"receiver_id": receiverUUID.String(),
				"chat_id":     chatUUID.String(),
				"type":        req.Type,
				"status":      models.CallStatusRinging,
				"caller": map[string]interface{}{
					"id":           caller.ID.String(),
					"name":         caller.Name,
					"phone_number": caller.PhoneNumber,
					"avatar_url":   caller.AvatarURL,
				},
			},
		}
		data, _ := json.Marshal(wsMsg)
		h.wsHandler.Hub().SendToUser(receiverUUID, data)
	}

	c.JSON(http.StatusOK, gin.H{
		"call_id": callID.String(),
		"status":  models.CallStatusRinging,
	})
}

// AnswerCall - принять звонок
func (h *CallHandler) AnswerCall(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	callID := c.Param("id")
	callUUID, err := uuid.Parse(callID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid call id"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// Проверяем, что пользователь является получателем
	var receiverID uuid.UUID
	var callerID uuid.UUID
	err = h.db.QueryRow(`
		SELECT receiver_id, caller_id FROM calls WHERE id = $1
	`, callUUID).Scan(&receiverID, &callerID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "call not found"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	if receiverID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not the receiver of this call"})
		return
	}

	// Обновляем статус звонка
	now := time.Now()
	_, err = h.db.Exec(`
		UPDATE calls
		SET status = $1, answered_at = $2
		WHERE id = $3
	`, models.CallStatusAccepted, now, callUUID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update call"})
		return
	}

	// Уведомляем звонящего
	if h.wsHandler != nil {
		wsMsg := models.WSMessage{
			Type: "call.answered",
			Payload: map[string]interface{}{
				"call_id":   callID,
				"status":    models.CallStatusAccepted,
				"user_id":   userID,
				"caller_id": callerID.String(),
			},
		}
		data, _ := json.Marshal(wsMsg)
		h.wsHandler.Hub().SendToUser(callerID, data)
	}

	c.JSON(http.StatusOK, gin.H{"status": "accepted"})
}

// RejectCall - отклонить звонок
func (h *CallHandler) RejectCall(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	callID := c.Param("id")
	callUUID, err := uuid.Parse(callID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid call id"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// Проверяем, что пользователь является получателем
	var receiverID uuid.UUID
	var callerID uuid.UUID
	err = h.db.QueryRow(`
		SELECT receiver_id, caller_id FROM calls WHERE id = $1
	`, callUUID).Scan(&receiverID, &callerID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "call not found"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	if receiverID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not the receiver of this call"})
		return
	}

	// Обновляем статус звонка
	now := time.Now()
	_, err = h.db.Exec(`
		UPDATE calls
		SET status = $1, ended_at = $2
		WHERE id = $3
	`, models.CallStatusRejected, now, callUUID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update call"})
		return
	}

	// Уведомляем звонящего
	if h.wsHandler != nil {
		wsMsg := models.WSMessage{
			Type: "call.rejected",
			Payload: map[string]interface{}{
				"call_id": callID,
				"status":  models.CallStatusRejected,
				"user_id": userID,
			},
		}
		data, _ := json.Marshal(wsMsg)
		h.wsHandler.Hub().SendToUser(callerID, data)
	}

	c.JSON(http.StatusOK, gin.H{"status": "rejected"})
}

// EndCall - завершить звонок
func (h *CallHandler) EndCall(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	callID := c.Param("id")
	callUUID, err := uuid.Parse(callID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid call id"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// Получаем информацию о звонке
	var receiverID uuid.UUID
	var callerID uuid.UUID
	var answeredAt sql.NullTime
	var startedAt time.Time

	err = h.db.QueryRow(`
		SELECT receiver_id, caller_id, answered_at, started_at FROM calls WHERE id = $1
	`, callUUID).Scan(&receiverID, &callerID, &answeredAt, &startedAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "call not found"})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	// Проверяем, что пользователь участвует в звонке
	if receiverID != userUUID && callerID != userUUID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a participant of this call"})
		return
	}

	// Вычисляем длительность
	now := time.Now()
	var duration int
	if answeredAt.Valid {
		duration = int(now.Sub(answeredAt.Time).Seconds())
	}

	// Обновляем статус звонка
	_, err = h.db.Exec(`
		UPDATE calls
		SET status = $1, ended_at = $2, duration = $3
		WHERE id = $4
	`, models.CallStatusEnded, now, duration, callUUID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update call"})
		return
	}

	// Уведомляем другого участника
	var otherUserID uuid.UUID
	if userUUID == callerID {
		otherUserID = receiverID
	} else {
		otherUserID = callerID
	}

	if h.wsHandler != nil {
		wsMsg := models.WSMessage{
			Type: "call.ended",
			Payload: map[string]interface{}{
				"call_id":  callID,
				"status":   models.CallStatusEnded,
				"duration": duration,
			},
		}
		data, _ := json.Marshal(wsMsg)
		h.wsHandler.Hub().SendToUser(otherUserID, data)
	}

	c.JSON(http.StatusOK, gin.H{
		"status":   "ended",
		"duration": duration,
	})
}

// GetCallHistory - получить историю звонков
func (h *CallHandler) GetCallHistory(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	rows, err := h.db.Query(`
		SELECT c.id, c.chat_id, c.caller_id, c.receiver_id, c.type, c.status,
			   c.started_at, c.answered_at, c.ended_at, c.duration, c.created_at,
			   caller.id, caller.phone_number, COALESCE(caller.name, ''), COALESCE(caller.avatar_url, ''),
			   receiver.id, receiver.phone_number, COALESCE(receiver.name, ''), COALESCE(receiver.avatar_url, '')
		FROM calls c
		JOIN users caller ON c.caller_id = caller.id
		JOIN users receiver ON c.receiver_id = receiver.id
		WHERE c.caller_id = $1 OR c.receiver_id = $1
		ORDER BY c.created_at DESC
		LIMIT 50
	`, userUUID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	var calls []models.Call

	for rows.Next() {
		var call models.Call
		var caller models.User
		var receiver models.User

		err := rows.Scan(
			&call.ID,
			&call.ChatID,
			&call.CallerID,
			&call.ReceiverID,
			&call.Type,
			&call.Status,
			&call.StartedAt,
			&call.AnsweredAt,
			&call.EndedAt,
			&call.Duration,
			&call.CreatedAt,
			&caller.ID,
			&caller.PhoneNumber,
			&caller.Name,
			&caller.AvatarURL,
			&receiver.ID,
			&receiver.PhoneNumber,
			&receiver.Name,
			&receiver.AvatarURL,
		)

		if err != nil {
			continue
		}

		call.Caller = &caller
		call.Receiver = &receiver

		calls = append(calls, call)
	}

	c.JSON(http.StatusOK, gin.H{
		"calls": calls,
		"total": len(calls),
	})
}
