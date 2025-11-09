package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teleport/backend/internal/database"
	"github.com/teleport/backend/internal/models"
)

type ChatHandler struct {
	db    *database.PostgresDB
	redis *database.RedisClient
}

func NewChatHandler(db *database.PostgresDB, redis *database.RedisClient) *ChatHandler {
	return &ChatHandler{
		db:    db,
		redis: redis,
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
		       m.media_url, m.media_size, m.media_duration, m.created_at, m.edited_at, m.deleted_at,
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
		var replyToID sql.NullString
		var editedAt, deletedAt sql.NullTime

		err := rows.Scan(
			&msg.ID,
			&msg.ChatID,
			&msg.SenderID,
			&replyToID,
			&msg.Content,
			&msg.Type,
			&msg.MediaURL,
			&msg.MediaSize,
			&msg.MediaDuration,
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

		if editedAt.Valid {
			msg.EditedAt = &editedAt.Time
		}
		if deletedAt.Valid {
			msg.DeletedAt = &deletedAt.Time
		}

		msg.Sender = &sender
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

	var req models.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	messageID := uuid.New()
	now := time.Now()

	_, err = h.db.Exec(`
		INSERT INTO messages (id, chat_id, sender_id, reply_to_id, content, type, media_url, media_size, media_duration, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, messageID, chatID, userID, req.ReplyToID, req.Content, req.Type, req.MediaURL, req.MediaSize, req.MediaDuration, now)

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

	message := models.Message{
		ID:            messageID,
		ChatID:        chatID,
		SenderID:      userID,
		Content:       req.Content,
		Type:          req.Type,
		MediaURL:      req.MediaURL,
		MediaSize:     req.MediaSize,
		MediaDuration: req.MediaDuration,
		CreatedAt:     now,
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
	_, err = h.db.Exec(`
		INSERT INTO message_reads (message_id, user_id, read_at)
		VALUES ($1, $2, CURRENT_TIMESTAMP)
		ON CONFLICT (message_id, user_id) DO NOTHING
	`, messageID, userID)

	if err != nil {
		log.Printf("Failed to mark as read: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mark as read"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
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
