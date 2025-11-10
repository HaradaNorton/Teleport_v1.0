package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/teleport/backend/pkg/notifications"
)

type DeviceHandler struct {
	fcmService *notifications.FCMService
}

func NewDeviceHandler(fcmService *notifications.FCMService) *DeviceHandler {
	return &DeviceHandler{
		fcmService: fcmService,
	}
}

type RegisterTokenRequest struct {
	Token    string `json:"token" binding:"required"`
	Platform string `json:"platform" binding:"required,oneof=ios android"`
	DeviceID string `json:"device_id"`
}

// RegisterToken регистрирует FCM токен устройства
func (h *DeviceHandler) RegisterToken(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req RegisterTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.fcmService.RegisterDeviceToken(
		c.Request.Context(),
		userID.(uuid.UUID),
		req.Token,
		req.Platform,
		req.DeviceID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to register device token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device token registered successfully"})
}

type UnregisterTokenRequest struct {
	Token string `json:"token" binding:"required"`
}

// UnregisterToken деактивирует FCM токен (при logout)
func (h *DeviceHandler) UnregisterToken(c *gin.Context) {
	var req UnregisterTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.fcmService.UnregisterDeviceToken(c.Request.Context(), req.Token); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unregister device token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device token unregistered successfully"})
}
