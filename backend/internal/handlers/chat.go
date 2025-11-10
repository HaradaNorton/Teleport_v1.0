package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teleport/backend/internal/database"
	"github.com/teleport/backend/internal/models"
	"github.com/teleport/backend/pkg/notifications"
)

type ChatHandler struct {
	db         *database.PostgresDB
	redis      *database.RedisClient
	wsHandler  *WebSocketHandler
	fcmService *notifications.FCMService
}

func NewChatHandler(db *database.PostgresDB, redis *database.RedisClient, wsHandler *WebSocketHandler, fcmService *notifications.FCMService) *ChatHandler {
	return &ChatHandler{
		db:         db,
		redis:      redis,
		wsHandler:  wsHandler,
		fcmService: fcmService,
	}
}

// GetChats возвращает список чатов пользователя
func (h *ChatHandler) GetChats(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	rows, err := h.db.Query(`
		SELECT c.id, c.type, c.title, c.avatar_url, c.created_at, c.updated_at, c.last_message_at,
		       cm.unread_count
		FROM chats c
		INNER JOIN chat_members cm ON c.id = cm.chat_id
		WHERE cm.user_id = $1 AND cm.left_at IS NULL
		ORDER BY c.last_message_at DESC NULLS LAST
	`, userID)

	if err != nil {
		log.Printf("Failed to get chats: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get chats"})
		return
	}
	defer rows.Close()

	var chats []models.ChatResponse
	for rows.Next() {
		var chat models.Chat
		var unreadCount int
		var lastMessageAt sql.NullTime

		err := rows.Scan(
			&chat.ID,
			&chat.Type,
			&chat.Title,
			&chat.AvatarURL,
			&chat.CreatedAt,
			&chat.UpdatedAt,
			&lastMessageAt,
			&unreadCount,
		)

		if err != nil {
			log.Printf("Failed to scan chat: %v", err)
			continue
		}

		if lastMessageAt.Valid {
			chat.LastMessageAt = &lastMessageAt.Time
		}

		// TODO: Получить последнее сообщение и участников

		chats = append(chats, models.ChatResponse{
			Chat:        &chat,
			UnreadCount: unreadCount,
		})
	}

	c.JSON(http.StatusOK, models.ChatListResponse{
		Chats:      chats,
		TotalCount: len(chats),
	})
}

// CreateChat создает новый чат
func (h *ChatHandler) CreateChat(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.CreateChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Для личного чата проверяем что участников ровно 1 (кроме создателя)
	if req.Type == models.ChatTypePersonal && len(req.UserIDs) != 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "personal chat must have exactly 1 other user"})
		return
	}

	// Проверка существования личного чата
	if req.Type == models.ChatTypePersonal {
		existingChatID, err := h.findPersonalChat(userID, req.UserIDs[0])
		if err == nil {
			// Чат уже существует
			c.JSON(http.StatusOK, gin.H{"chat_id": existingChatID})
			return
		}
	}

	// Создание чата
	chatID := uuid.New()
	_, err := h.db.Exec(`
		INSERT INTO chats (id, type, title, avatar_url, created_at, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, chatID, req.Type, req.Title, req.AvatarURL)

	if err != nil {
		log.Printf("Failed to create chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create chat"})
		return
	}

	// Добавление создателя как владельца
	_, err = h.db.Exec(`
		INSERT INTO chat_members (chat_id, user_id, role)
		VALUES ($1, $2, 'owner')
	`, chatID, userID)

	if err != nil {
		log.Printf("Failed to add chat owner: %v", err)
	}

	// Добавление остальных участников
	for _, memberID := range req.UserIDs {
		_, err = h.db.Exec(`
			INSERT INTO chat_members (chat_id, user_id, role)
			VALUES ($1, $2, 'member')
		`, chatID, memberID)

		if err != nil {
			log.Printf("Failed to add chat member %s: %v", memberID, err)
		}
	}

	c.JSON(http.StatusCreated, gin.H{"chat_id": chatID})
}

// GetChat возвращает информацию о чате
func (h *ChatHandler) GetChat(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	// Проверка что пользователь является участником
	var memberID uuid.UUID
	err = h.db.QueryRow(`
		SELECT id FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL
	`, chatID, userID).Scan(&memberID)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a chat member"})
		return
	}

	var chat models.Chat
	err = h.db.QueryRow(`
		SELECT id, type, title, avatar_url, created_at, updated_at, last_message_at
		FROM chats
		WHERE id = $1
	`, chatID).Scan(
		&chat.ID,
		&chat.Type,
		&chat.Title,
		&chat.AvatarURL,
		&chat.CreatedAt,
		&chat.UpdatedAt,
		&chat.LastMessageAt,
	)

	if err != nil {
		log.Printf("Failed to get chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get chat"})
		return
	}

	c.JSON(http.StatusOK, chat)
}

// GetMessages возвращает сообщения чата
func (h *ChatHandler) GetMessages(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	// Проверка членства
	if !h.isChatMember(chatID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a chat member"})
		return
	}

	// Параметры пагинации
	limit := 50
	offset := 0

	rows, err := h.db.Query(`
		SELECT m.id, m.chat_id, m.sender_id, m.reply_to_id, m.content, m.type,
		       m.media_url, m.thumbnail_url, m.file_name, m.mime_type, m.media_size, m.media_duration,
		       m.created_at, m.edited_at, m.deleted_at,
		       u.id, u.phone_number, u.name, u.avatar_url
		FROM messages m
		INNER JOIN users u ON m.sender_id = u.id
		WHERE m.chat_id = $1 AND m.deleted_at IS NULL
		ORDER BY m.created_at DESC
		LIMIT $2 OFFSET $3
	`, chatID, limit, offset)

	if err != nil {
		log.Printf("Failed to get messages: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get messages"})
		return
	}
	defer rows.Close()

	var messages []models.Message
	for rows.Next() {
		var msg models.Message
		var sender models.User
		var replyToID, thumbnailURL, fileName, mimeType sql.NullString
		var mediaSize, mediaDuration sql.NullInt32
		var editedAt, deletedAt sql.NullTime

		err := rows.Scan(
			&msg.ID,
			&msg.ChatID,
			&msg.SenderID,
			&replyToID,
			&msg.Content,
			&msg.Type,
			&msg.MediaURL,
			&thumbnailURL,
			&fileName,
			&mimeType,
			&mediaSize,
			&mediaDuration,
			&msg.CreatedAt,
			&editedAt,
			&deletedAt,
			&sender.ID,
			&sender.PhoneNumber,
			&sender.Name,
			&sender.AvatarURL,
		)

		if err != nil {
			log.Printf("Failed to scan message: %v", err)
			continue
		}

		if thumbnailURL.Valid {
			msg.ThumbnailURL = thumbnailURL.String
		}
		if fileName.Valid {
			msg.FileName = fileName.String
		}
		if mimeType.Valid {
			msg.MimeType = mimeType.String
		}
		if mediaSize.Valid {
			msg.MediaSize = int(mediaSize.Int32)
		}
		if mediaDuration.Valid {
			msg.MediaDuration = int(mediaDuration.Int32)
		}
		if editedAt.Valid {
			msg.EditedAt = &editedAt.Time
		}
		if deletedAt.Valid {
			msg.DeletedAt = &deletedAt.Time
		}

		msg.Sender = &sender

		// Load read_by users for this message
		readRows, err := h.db.Query(`
			SELECT user_id FROM message_reads WHERE message_id = $1
		`, msg.ID)
		if err == nil {
			var readByUsers []string
			for readRows.Next() {
				var userID uuid.UUID
				if err := readRows.Scan(&userID); err == nil {
					readByUsers = append(readByUsers, userID.String())
				}
			}
			readRows.Close()
			msg.ReadBy = readByUsers
		}

		messages = append(messages, msg)
	}

	c.JSON(http.StatusOK, models.MessageListResponse{
		Messages:   messages,
		TotalCount: len(messages),
		HasMore:    len(messages) == limit,
	})
}

// SendMessage отправляет сообщение в чат
func (h *ChatHandler) SendMessage(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	if !h.isChatMember(chatID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a chat member"})
		return
	}

	// Проверка прав для каналов - только admin/owner могут постить
	var chatType string
	var memberRole string
	err = h.db.QueryRow(`
		SELECT c.type, cm.role
		FROM chats c
		INNER JOIN chat_members cm ON c.id = cm.chat_id
		WHERE c.id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL
	`, chatID, userID).Scan(&chatType, &memberRole)

	if err != nil {
		log.Printf("Failed to get chat type and role: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify permissions"})
		return
	}

	// В каналах только owner и admin могут отправлять сообщения
	if chatType == string(models.ChatTypeChannel) && memberRole != "owner" && memberRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only admins can post in channels"})
		return
	}

	var req models.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	messageID := uuid.New()
	now := time.Now()

	_, err = h.db.Exec(`
		INSERT INTO messages (id, chat_id, sender_id, reply_to_id, content, type, media_url, thumbnail_url, file_name, mime_type, media_size, media_duration, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, messageID, chatID, userID, req.ReplyToID, req.Content, req.Type, req.MediaURL, req.ThumbnailURL, req.FileName, req.MimeType, req.MediaSize, req.MediaDuration, now)

	if err != nil {
		log.Printf("Failed to send message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send message"})
		return
	}

	// Обновление last_message_at у чата
	_, err = h.db.Exec(`
		UPDATE chats SET last_message_at = $1, updated_at = $1
		WHERE id = $2
	`, now, chatID)

	if err != nil {
		log.Printf("Failed to update chat timestamp: %v", err)
	}

	// Увеличение unread_count для всех участников кроме отправителя
	_, err = h.db.Exec(`
		UPDATE chat_members
		SET unread_count = unread_count + 1
		WHERE chat_id = $1 AND user_id != $2 AND left_at IS NULL
	`, chatID, userID)

	if err != nil {
		log.Printf("Failed to update unread counts: %v", err)
	}

	// Получение информации об отправителе
	var sender models.User
	err = h.db.QueryRow(`
		SELECT id, phone_number, name, avatar_url, bio, created_at, updated_at, last_seen, is_online
		FROM users WHERE id = $1
	`, userID).Scan(
		&sender.ID, &sender.PhoneNumber, &sender.Name, &sender.AvatarURL,
		&sender.Bio, &sender.CreatedAt, &sender.UpdatedAt, &sender.LastSeen, &sender.IsOnline,
	)
	if err != nil {
		log.Printf("Failed to get sender info: %v", err)
	}

	message := models.Message{
		ID:            messageID,
		ChatID:        chatID,
		SenderID:      userID,
		Content:       req.Content,
		Type:          req.Type,
		MediaURL:      req.MediaURL,
		ThumbnailURL:  req.ThumbnailURL,
		FileName:      req.FileName,
		MimeType:      req.MimeType,
		MediaSize:     req.MediaSize,
		MediaDuration: req.MediaDuration,
		CreatedAt:     now,
		Sender:        &sender,
	}

	// Broadcast сообщения через WebSocket
	if h.wsHandler != nil {
		h.wsHandler.BroadcastMessage(chatID, &message)
	}

	// Отправка push-уведомления
	if h.fcmService != nil {
		// Получаем название чата для уведомления
		var chatTitle string
		err = h.db.QueryRow(`SELECT COALESCE(title, '') FROM chats WHERE id = $1`, chatID).Scan(&chatTitle)
		if err != nil {
			log.Printf("Failed to get chat title: %v", err)
		}

		// Отправляем уведомление асинхронно, чтобы не блокировать ответ
		go func() {
			if err := h.fcmService.SendMessageNotification(c.Request.Context(), &message, chatTitle); err != nil {
				log.Printf("Failed to send push notification: %v", err)
			}
		}()
	}

	c.JSON(http.StatusCreated, message)
}

// EditMessage редактирует сообщение
func (h *ChatHandler) EditMessage(c *gin.Context) {
	messageIDStr := c.Param("messageId")
	messageID, err := uuid.Parse(messageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.EditMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Проверка что пользователь - отправитель сообщения
	var senderID uuid.UUID
	err = h.db.QueryRow(`SELECT sender_id FROM messages WHERE id = $1`, messageID).Scan(&senderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	if senderID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not message sender"})
		return
	}

	_, err = h.db.Exec(`
		UPDATE messages
		SET content = $1, edited_at = CURRENT_TIMESTAMP
		WHERE id = $2
	`, req.Content, messageID)

	if err != nil {
		log.Printf("Failed to edit message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to edit message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "message edited"})
}

// DeleteMessage удаляет сообщение
func (h *ChatHandler) DeleteMessage(c *gin.Context) {
	messageIDStr := c.Param("messageId")
	messageID, err := uuid.Parse(messageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	// Проверка что пользователь - отправитель
	var senderID uuid.UUID
	err = h.db.QueryRow(`SELECT sender_id FROM messages WHERE id = $1`, messageID).Scan(&senderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "message not found"})
		return
	}

	if senderID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "not message sender"})
		return
	}

	_, err = h.db.Exec(`
		UPDATE messages
		SET deleted_at = CURRENT_TIMESTAMP
		WHERE id = $1
	`, messageID)

	if err != nil {
		log.Printf("Failed to delete message: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete message"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "message deleted"})
}

// MarkAsRead отмечает сообщение как прочитанное
func (h *ChatHandler) MarkAsRead(c *gin.Context) {
	messageIDStr := c.Param("messageId")
	messageID, err := uuid.Parse(messageIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid message id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	// Добавляем запись о прочтении
	result, err := h.db.Exec(`
		INSERT INTO message_reads (message_id, user_id, read_at)
		VALUES ($1, $2, CURRENT_TIMESTAMP)
		ON CONFLICT (message_id, user_id) DO NOTHING
	`, messageID, userID)

	if err != nil {
		log.Printf("Failed to mark as read: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark as read"})
		return
	}

	// Check if actually inserted (not conflict)
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 && h.wsHandler != nil {
		// Get chat_id for this message
		var chatID uuid.UUID
		var senderID uuid.UUID
		err = h.db.QueryRow(`
			SELECT chat_id, sender_id FROM messages WHERE id = $1
		`, messageID).Scan(&chatID, &senderID)

		if err == nil {
			// Broadcast read receipt to message sender via WebSocket
			wsMsg := models.WSMessage{
				Type: "message.read",
				Payload: map[string]interface{}{
					"message_id": messageID.String(),
					"user_id":    userID.String(),
					"chat_id":    chatID.String(),
				},
			}
			data, _ := json.Marshal(wsMsg)
			h.wsHandler.Hub().SendToUser(senderID, data)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

// SubscribeToChannel подписывает пользователя на канал
func (h *ChatHandler) SubscribeToChannel(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	// Проверка что это канал
	var chatType string
	err = h.db.QueryRow(`SELECT type FROM chats WHERE id = $1`, chatID).Scan(&chatType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "chat not found"})
		return
	}

	if chatType != string(models.ChatTypeChannel) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "can only subscribe to channels"})
		return
	}

	// Проверка что пользователь еще не подписан
	var memberID uuid.UUID
	err = h.db.QueryRow(`
		SELECT id FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL
	`, chatID, userID).Scan(&memberID)

	if err == nil {
		c.JSON(http.StatusOK, gin.H{"message": "already subscribed"})
		return
	}

	// Подписка на канал
	_, err = h.db.Exec(`
		INSERT INTO chat_members (chat_id, user_id, role, joined_at)
		VALUES ($1, $2, 'member', CURRENT_TIMESTAMP)
	`, chatID, userID)

	if err != nil {
		log.Printf("Failed to subscribe to channel: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to subscribe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "subscribed successfully"})
}

// UnsubscribeFromChannel отписывает пользователя от канала
func (h *ChatHandler) UnsubscribeFromChannel(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	// Проверка что это канал
	var chatType string
	err = h.db.QueryRow(`SELECT type FROM chats WHERE id = $1`, chatID).Scan(&chatType)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "chat not found"})
		return
	}

	if chatType != string(models.ChatTypeChannel) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "can only unsubscribe from channels"})
		return
	}

	// Получение роли пользователя
	var memberRole string
	err = h.db.QueryRow(`
		SELECT role FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL
	`, chatID, userID).Scan(&memberRole)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not subscribed"})
		return
	}

	// Владелец не может отписаться
	if memberRole == "owner" {
		c.JSON(http.StatusForbidden, gin.H{"error": "owner cannot unsubscribe"})
		return
	}

	// Отписка от канала (soft delete)
	_, err = h.db.Exec(`
		UPDATE chat_members
		SET left_at = CURRENT_TIMESTAMP
		WHERE chat_id = $1 AND user_id = $2
	`, chatID, userID)

	if err != nil {
		log.Printf("Failed to unsubscribe from channel: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unsubscribe"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "unsubscribed successfully"})
}

// Helper functions
func (h *ChatHandler) isChatMember(chatID, userID uuid.UUID) bool {
	var count int
	err := h.db.QueryRow(`
		SELECT COUNT(*)
		FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL
	`, chatID, userID).Scan(&count)

	return err == nil && count > 0
}

func (h *ChatHandler) findPersonalChat(user1ID, user2ID uuid.UUID) (uuid.UUID, error) {
	var chatID uuid.UUID
	err := h.db.QueryRow(`
		SELECT c.id
		FROM chats c
		INNER JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = $1
		INNER JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = $2
		WHERE c.type = 'personal'
		  AND cm1.left_at IS NULL
		  AND cm2.left_at IS NULL
		LIMIT 1
	`, user1ID, user2ID).Scan(&chatID)

	return chatID, err
}

// GetChatMembers возвращает список участников чата
func (h *ChatHandler) GetChatMembers(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	// Проверка что пользователь является участником
	if !h.isChatMember(chatID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "not a chat member"})
		return
	}

	rows, err := h.db.Query(`
		SELECT u.id, u.phone_number, u.name, u.avatar_url, u.bio, u.is_online,
		       cm.role, cm.joined_at
		FROM chat_members cm
		INNER JOIN users u ON cm.user_id = u.id
		WHERE cm.chat_id = $1 AND cm.left_at IS NULL
		ORDER BY cm.role DESC, cm.joined_at ASC
	`, chatID)

	if err != nil {
		log.Printf("Failed to get chat members: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get members"})
		return
	}
	defer rows.Close()

	type MemberWithRole struct {
		models.User
		Role     models.MemberRole `json:"role"`
		JoinedAt time.Time         `json:"joined_at"`
	}

	var members []MemberWithRole
	for rows.Next() {
		var member MemberWithRole
		err := rows.Scan(
			&member.ID,
			&member.PhoneNumber,
			&member.Name,
			&member.AvatarURL,
			&member.Bio,
			&member.IsOnline,
			&member.Role,
			&member.JoinedAt,
		)

		if err != nil {
			log.Printf("Failed to scan member: %v", err)
			continue
		}

		members = append(members, member)
	}

	c.JSON(http.StatusOK, gin.H{
		"members": members,
		"total":   len(members),
	})
}

// AddChatMember добавляет участника в группу
func (h *ChatHandler) AddChatMember(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		UserID uuid.UUID `json:"user_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Проверка прав (только владельцы и админы могут добавлять)
	if !h.isAdminOrOwner(chatID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	// Добавляем участника
	_, err = h.db.Exec(`
		INSERT INTO chat_members (chat_id, user_id, role)
		VALUES ($1, $2, 'member')
		ON CONFLICT (chat_id, user_id) DO UPDATE SET left_at = NULL
	`, chatID, req.UserID)

	if err != nil {
		log.Printf("Failed to add member: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to add member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member added"})
}

// RemoveChatMember удаляет участника из группы
func (h *ChatHandler) RemoveChatMember(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userIDStr := c.Param("userId")
	targetUserID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	currentUserID := c.MustGet("user_id").(uuid.UUID)

	// Проверка прав (только владельцы и админы могут удалять)
	if !h.isAdminOrOwner(chatID, currentUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	// Нельзя удалить владельца
	var targetRole models.MemberRole
	err = h.db.QueryRow(`
		SELECT role FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL
	`, chatID, targetUserID).Scan(&targetRole)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not in chat"})
		return
	}

	if targetRole == models.RoleOwner {
		c.JSON(http.StatusForbidden, gin.H{"error": "cannot remove owner"})
		return
	}

	// Удаляем участника
	_, err = h.db.Exec(`
		UPDATE chat_members
		SET left_at = CURRENT_TIMESTAMP
		WHERE chat_id = $1 AND user_id = $2
	`, chatID, targetUserID)

	if err != nil {
		log.Printf("Failed to remove member: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove member"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "member removed"})
}

// UpdateChatInfo обновляет информацию о группе
func (h *ChatHandler) UpdateChatInfo(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		Title     *string `json:"title"`
		AvatarURL *string `json:"avatar_url"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Проверка прав
	if !h.isAdminOrOwner(chatID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	// Динамическое построение запроса
	query := "UPDATE chats SET updated_at = CURRENT_TIMESTAMP"
	args := []interface{}{}
	argCount := 1

	if req.Title != nil {
		query += ", title = $" + string(rune(argCount+'0'))
		args = append(args, *req.Title)
		argCount++
	}

	if req.AvatarURL != nil {
		query += ", avatar_url = $" + string(rune(argCount+'0'))
		args = append(args, *req.AvatarURL)
		argCount++
	}

	query += " WHERE id = $" + string(rune(argCount+'0'))
	args = append(args, chatID)

	_, err = h.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to update chat info: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update chat"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "chat updated"})
}

// UpdateMemberRole изменяет роль участника
func (h *ChatHandler) UpdateMemberRole(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userIDStr := c.Param("userId")
	targetUserID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	currentUserID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		Role models.MemberRole `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Только владелец может изменять роли
	if !h.isOwner(chatID, currentUserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only owner can change roles"})
		return
	}

	// Нельзя изменить роль владельца
	if req.Role == models.RoleOwner {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot set owner role"})
		return
	}

	_, err = h.db.Exec(`
		UPDATE chat_members
		SET role = $1
		WHERE chat_id = $2 AND user_id = $3 AND left_at IS NULL
	`, req.Role, chatID, targetUserID)

	if err != nil {
		log.Printf("Failed to update role: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "role updated"})
}

// LeaveChat выход из группы
func (h *ChatHandler) LeaveChat(c *gin.Context) {
	chatIDStr := c.Param("id")
	chatID, err := uuid.Parse(chatIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid chat id"})
		return
	}

	userID := c.MustGet("user_id").(uuid.UUID)

	// Проверка что это не владелец
	if h.isOwner(chatID, userID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "owner cannot leave, transfer ownership first"})
		return
	}

	_, err = h.db.Exec(`
		UPDATE chat_members
		SET left_at = CURRENT_TIMESTAMP
		WHERE chat_id = $1 AND user_id = $2
	`, chatID, userID)

	if err != nil {
		log.Printf("Failed to leave chat: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to leave chat"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "left chat"})
}

// Helper functions for permissions
func (h *ChatHandler) isAdminOrOwner(chatID, userID uuid.UUID) bool {
	var role models.MemberRole
	err := h.db.QueryRow(`
		SELECT role FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL
	`, chatID, userID).Scan(&role)

	if err != nil {
		return false
	}

	return role == models.RoleOwner || role == models.RoleAdmin
}

func (h *ChatHandler) isOwner(chatID, userID uuid.UUID) bool {
	var role models.MemberRole
	err := h.db.QueryRow(`
		SELECT role FROM chat_members
		WHERE chat_id = $1 AND user_id = $2 AND left_at IS NULL
	`, chatID, userID).Scan(&role)

	if err != nil {
		return false
	}

	return role == models.RoleOwner
}
