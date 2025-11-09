package handlers

import (
	"database/sql"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teleport/backend/internal/database"
	"github.com/teleport/backend/internal/models"
)

type UserHandler struct {
	db    *database.PostgresDB
	redis *database.RedisClient
}

func NewUserHandler(db *database.PostgresDB, redis *database.RedisClient) *UserHandler {
	return &UserHandler{
		db:    db,
		redis: redis,
	}
}

// GetMe возвращает информацию о текущем пользователе
func (h *UserHandler) GetMe(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	user, err := h.getUserByID(userID)
	if err != nil {
		log.Printf("Failed to get user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// UpdateProfile обновляет профиль пользователя
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req models.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Динамическое построение запроса обновления
	query := "UPDATE users SET updated_at = CURRENT_TIMESTAMP"
	args := []interface{}{}
	argCount := 1

	if req.Name != nil {
		query += ", name = $" + string(rune(argCount+'0'))
		args = append(args, *req.Name)
		argCount++
	}

	if req.Bio != nil {
		query += ", bio = $" + string(rune(argCount+'0'))
		args = append(args, *req.Bio)
		argCount++
	}

	if req.AvatarURL != nil {
		query += ", avatar_url = $" + string(rune(argCount+'0'))
		args = append(args, *req.AvatarURL)
		argCount++
	}

	query += " WHERE id = $" + string(rune(argCount+'0'))
	args = append(args, userID)

	_, err := h.db.Exec(query, args...)
	if err != nil {
		log.Printf("Failed to update profile: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}

	// Получаем обновленного пользователя
	user, err := h.getUserByID(userID)
	if err != nil {
		log.Printf("Failed to get updated user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// GetUser возвращает информацию о пользователе по ID
func (h *UserHandler) GetUser(c *gin.Context) {
	userIDStr := c.Param("id")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	user, err := h.getUserByID(userID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}
	if err != nil {
		log.Printf("Failed to get user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *UserHandler) getUserByID(userID uuid.UUID) (*models.User, error) {
	var user models.User
	err := h.db.QueryRow(`
		SELECT id, phone_number, name, avatar_url, bio, created_at, updated_at, last_seen, is_online
		FROM users
		WHERE id = $1
	`, userID).Scan(
		&user.ID,
		&user.PhoneNumber,
		&user.Name,
		&user.AvatarURL,
		&user.Bio,
		&user.CreatedAt,
		&user.UpdatedAt,
		&user.LastSeen,
		&user.IsOnline,
	)

	if err != nil {
		return nil, err
	}

	return &user, nil
}
