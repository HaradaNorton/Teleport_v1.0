package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/teleport/backend/config"
	"github.com/teleport/backend/internal/database"
	"github.com/teleport/backend/internal/handlers"
	"github.com/teleport/backend/internal/middleware"
	"github.com/teleport/backend/pkg/auth"
)

func main() {
	// Загрузка конфигурации
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// Подключение к PostgreSQL
	db, err := database.NewPostgresDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	// Инициализация схемы БД
	if err := db.InitSchema(); err != nil {
		log.Fatalf("Failed to initialize database schema: %v", err)
	}

	// Подключение к Redis
	redisClient, err := database.NewRedisClient(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer redisClient.Close()

	// JWT сервис
	jwtService := auth.NewJWTService(cfg)

	// Создание директории для загрузок
	uploadsDir := "./uploads"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		log.Fatalf("Failed to create uploads directory: %v", err)
	}

	// Настройка Gin
	if cfg.Server.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Middleware
	router.Use(middleware.SetupCORS(cfg))

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
			"time":   time.Now().Unix(),
		})
	})

	// WebSocket handler (создаем заранее для использования в других handlers)
	wsHandler := handlers.NewWebSocketHandler(db, redisClient, jwtService)

	// API routes
	apiV1 := router.Group(fmt.Sprintf("/api/%s", cfg.Server.APIVersion))
	{
		// Auth handlers (без авторизации)
		authHandler := handlers.NewAuthHandler(cfg, db, redisClient, jwtService)
		auth := apiV1.Group("/auth")
		{
			auth.POST("/send-code", authHandler.SendCode)
			auth.POST("/verify", authHandler.VerifyCode)
			auth.POST("/refresh", authHandler.RefreshToken)
		}

		// Protected routes (требуют авторизации)
		protected := apiV1.Group("")
		protected.Use(middleware.AuthMiddleware(jwtService))
		{
			// User routes
			userHandler := handlers.NewUserHandler(db, redisClient)
			users := protected.Group("/users")
			{
				users.GET("/search", userHandler.SearchUsers)
				users.GET("/me", userHandler.GetMe)
				users.PUT("/me", userHandler.UpdateProfile)
				users.GET("/:id", userHandler.GetUser)
			}

			// Chat routes
			chatHandler := handlers.NewChatHandler(db, redisClient, wsHandler)
			chats := protected.Group("/chats")
			{
				chats.GET("", chatHandler.GetChats)
				chats.POST("", chatHandler.CreateChat)
				chats.GET("/:id", chatHandler.GetChat)
				chats.PUT("/:id", chatHandler.UpdateChatInfo)
				chats.GET("/:id/messages", chatHandler.GetMessages)
				chats.POST("/:id/messages", chatHandler.SendMessage)
				chats.PUT("/messages/:messageId", chatHandler.EditMessage)
				chats.DELETE("/messages/:messageId", chatHandler.DeleteMessage)
				chats.POST("/messages/:messageId/read", chatHandler.MarkAsRead)

				// Group management
				chats.GET("/:id/members", chatHandler.GetChatMembers)
				chats.POST("/:id/members", chatHandler.AddChatMember)
				chats.DELETE("/:id/members/:userId", chatHandler.RemoveChatMember)
				chats.PUT("/:id/members/:userId/role", chatHandler.UpdateMemberRole)
				chats.POST("/:id/leave", chatHandler.LeaveChat)
			}

			// Media routes
			mediaHandler := handlers.NewMediaHandler(uploadsDir)
			media := protected.Group("/media")
			{
				media.POST("/upload", mediaHandler.UploadMedia)
				media.GET("/files/:subdir/:filename", mediaHandler.ServeFile)
				media.DELETE("/files/:subdir/:filename", mediaHandler.DeleteFile)
			}
		}

		// WebSocket
		apiV1.GET("/ws", wsHandler.HandleWebSocket)
	}

	// HTTP сервер
	srv := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: router,
	}

	// Graceful shutdown
	go func() {
		log.Printf("🚀 Server starting on port %s", cfg.Server.Port)
		log.Printf("📝 Environment: %s", cfg.Server.Env)
		log.Printf("🔗 API endpoint: http://localhost:%s/api/%s", cfg.Server.Port, cfg.Server.APIVersion)

		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Ожидание сигнала завершения
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("✅ Server exited gracefully")
}
