package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teleport/backend/config"
	"github.com/teleport/backend/internal/database"
	"github.com/teleport/backend/internal/models"
	"github.com/teleport/backend/pkg/auth"
)

type AuthHandler struct {
	cfg        *config.Config
	db         *database.PostgresDB
	redis      *database.RedisClient
	jwtService *auth.JWTService
}

func NewAuthHandler(cfg *config.Config, db *database.PostgresDB, redis *database.RedisClient, jwtService *auth.JWTService) *AuthHandler {
	return &AuthHandler{
		cfg:        cfg,
		db:         db,
		redis:      redis,
		jwtService: jwtService,
	}
}

// SendCode отправляет SMS код на номер телефона
func (h *AuthHandler) SendCode(c *gin.Context) {
	var req models.SendCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Генерация 5-значного кода
	code := h.generateCode()
	expiresAt := time.Now().Add(5 * time.Minute)

	// Сохранение кода в БД
	_, err := h.db.Exec(`
		INSERT INTO auth_codes (phone_number, code, expires_at)
		VALUES ($1, $2, $3)
	`, req.PhoneNumber, code, expiresAt)

	if err != nil {
		log.Printf("Failed to save auth code: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to send code"})
		return
	}

	// Отправка SMS
	if h.cfg.SMS.MockEnabled {
		// Режим разработки - выводим код в лог
		log.Printf("📱 SMS Code for %s: %s (expires in 5 minutes)", req.PhoneNumber, code)
	} else {
		// TODO: Интеграция с Twilio
		// err = h.sendSMS(req.PhoneNumber, code)
	}

	c.JSON(http.StatusOK, models.SendCodeResponse{
		Message:   "Code sent successfully",
		ExpiresIn: 300, // 5 минут
	})
}

// VerifyCode проверяет SMS код и выдает токены
func (h *AuthHandler) VerifyCode(c *gin.Context) {
	var req models.VerifyCodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Проверка кода в БД
	var authCodeID uuid.UUID
	var expiresAt time.Time
	var verified bool

	err := h.db.QueryRow(`
		SELECT id, expires_at, verified
		FROM auth_codes
		WHERE phone_number = $1 AND code = $2
		ORDER BY created_at DESC
		LIMIT 1
	`, req.PhoneNumber, req.Code).Scan(&authCodeID, &expiresAt, &verified)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid code"})
		return
	}
	if err != nil {
		log.Printf("Failed to verify code: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "verification failed"})
		return
	}

	// Проверка срока действия
	if time.Now().After(expiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "code expired"})
		return
	}

	// Проверка что код не использован
	if verified {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "code already used"})
		return
	}

	// Отметка кода как использованного
	_, err = h.db.Exec(`UPDATE auth_codes SET verified = true WHERE id = $1`, authCodeID)
	if err != nil {
		log.Printf("Failed to mark code as verified: %v", err)
	}

	// Поиск или создание пользователя
	user, isNewUser, err := h.findOrCreateUser(req.PhoneNumber)
	if err != nil {
		log.Printf("Failed to find or create user: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "authentication failed"})
		return
	}

	// Генерация токенов
	accessToken, err := h.jwtService.GenerateAccessToken(user.ID, user.PhoneNumber)
	if err != nil {
		log.Printf("Failed to generate access token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	refreshToken, err := h.jwtService.GenerateRefreshToken(user.ID, user.PhoneNumber)
	if err != nil {
		log.Printf("Failed to generate refresh token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	// Сохранение refresh token в БД
	_, err = h.db.Exec(`
		INSERT INTO refresh_tokens (user_id, token, expires_at)
		VALUES ($1, $2, $3)
	`, user.ID, refreshToken, time.Now().Add(h.cfg.JWT.RefreshExpiry))

	if err != nil {
		log.Printf("Failed to save refresh token: %v", err)
	}

	c.JSON(http.StatusOK, models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
		IsNewUser:    isNewUser,
	})
}

// RefreshToken обновляет access token используя refresh token
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}

	// Валидация refresh token
	claims, err := h.jwtService.ValidateToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	// Проверка что токен существует в БД
	var tokenID uuid.UUID
	var expiresAt time.Time
	err = h.db.QueryRow(`
		SELECT id, expires_at
		FROM refresh_tokens
		WHERE token = $1 AND user_id = $2
	`, req.RefreshToken, claims.UserID).Scan(&tokenID, &expiresAt)

	if err == sql.ErrNoRows {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token not found"})
		return
	}
	if err != nil {
		log.Printf("Failed to find refresh token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token verification failed"})
		return
	}

	// Генерация нового access token
	accessToken, err := h.jwtService.GenerateAccessToken(claims.UserID, claims.PhoneNumber)
	if err != nil {
		log.Printf("Failed to generate access token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "token generation failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token": accessToken,
	})
}

func (h *AuthHandler) findOrCreateUser(phoneNumber string) (*models.User, bool, error) {
	var user models.User
	err := h.db.QueryRow(`
		SELECT id, phone_number, name, avatar_url, bio, created_at, updated_at, last_seen, is_online
		FROM users
		WHERE phone_number = $1
	`, phoneNumber).Scan(
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

	if err == sql.ErrNoRows {
		// Создаем нового пользователя
		newUser := &models.User{
			ID:          uuid.New(),
			PhoneNumber: phoneNumber,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
			LastSeen:    time.Now(),
			IsOnline:    false,
		}

		_, err = h.db.Exec(`
			INSERT INTO users (id, phone_number, created_at, updated_at, last_seen, is_online)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, newUser.ID, newUser.PhoneNumber, newUser.CreatedAt, newUser.UpdatedAt, newUser.LastSeen, newUser.IsOnline)

		if err != nil {
			return nil, false, err
		}

		return newUser, true, nil
	}

	if err != nil {
		return nil, false, err
	}

	return &user, false, nil
}

func (h *AuthHandler) generateCode() string {
	if h.cfg.SMS.MockEnabled {
		return h.cfg.SMS.MockCode
	}
	return fmt.Sprintf("%05d", rand.Intn(100000))
}
