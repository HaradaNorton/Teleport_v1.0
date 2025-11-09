package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/teleport/backend/internal/database"
	"github.com/teleport/backend/internal/models"
	"github.com/teleport/backend/pkg/auth"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: Ограничить в продакшене
	},
}

type Client struct {
	ID       uuid.UUID
	UserID   uuid.UUID
	Conn     *websocket.Conn
	Send     chan []byte
	Hub      *Hub
}

type Hub struct {
	clients    map[uuid.UUID]*Client // userID -> client
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

type WebSocketHandler struct {
	db         *database.PostgresDB
	redis      *database.RedisClient
	jwtService *auth.JWTService
	hub        *Hub
}

func NewWebSocketHandler(db *database.PostgresDB, redis *database.RedisClient, jwtService *auth.JWTService) *WebSocketHandler {
	hub := &Hub{
		clients:    make(map[uuid.UUID]*Client),
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}

	go hub.run()

	return &WebSocketHandler{
		db:         db,
		redis:      redis,
		jwtService: jwtService,
		hub:        hub,
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.UserID] = client
			h.mu.Unlock()
			log.Printf("✅ Client connected: %s (total: %d)", client.UserID, len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.UserID]; ok {
				delete(h.clients, client.UserID)
				close(client.Send)
			}
			h.mu.Unlock()
			log.Printf("❌ Client disconnected: %s (total: %d)", client.UserID, len(h.clients))

		case message := <-h.broadcast:
			h.mu.RLock()
			for _, client := range h.clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.clients, client.UserID)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) SendToUser(userID uuid.UUID, message []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	if client, ok := h.clients[userID]; ok {
		select {
		case client.Send <- message:
		default:
			log.Printf("Failed to send message to user %s", userID)
		}
	}
}

func (h *Hub) SendToChat(chatID uuid.UUID, message []byte, db *database.PostgresDB) {
	// Получаем всех участников чата
	rows, err := db.Query(`
		SELECT user_id FROM chat_members
		WHERE chat_id = $1 AND left_at IS NULL
	`, chatID)

	if err != nil {
		log.Printf("Failed to get chat members: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var userID uuid.UUID
		if err := rows.Scan(&userID); err != nil {
			continue
		}

		h.SendToUser(userID, message)
	}
}

func (ws *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	// Получение токена из query параметра
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "token required"})
		return
	}

	// Валидация токена
	claims, err := ws.jwtService.ValidateToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
		return
	}

	// Upgrade HTTP to WebSocket
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("Failed to upgrade connection: %v", err)
		return
	}

	client := &Client{
		ID:     uuid.New(),
		UserID: claims.UserID,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		Hub:    ws.hub,
	}

	ws.hub.register <- client

	// Обновление статуса онлайн
	ws.setUserOnline(claims.UserID, true)

	// Запуск горутин для чтения и записи
	go client.writePump()
	go client.readPump(ws)
}

func (c *Client) readPump(ws *WebSocketHandler) {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
		ws.setUserOnline(c.UserID, false)
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Обработка входящего сообщения
		ws.handleIncomingMessage(c, message)
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Добавляем все ожидающие сообщения
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (ws *WebSocketHandler) handleIncomingMessage(client *Client, data []byte) {
	var msg models.WSMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("Failed to unmarshal message: %v", err)
		return
	}

	switch msg.Type {
	case models.WSMessageTypeTyping:
		ws.handleTyping(client, msg.Payload)
	case models.WSMessageTypeNew:
		// Сообщения обрабатываются через REST API
		// WebSocket только для уведомлений
	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

func (ws *WebSocketHandler) handleTyping(client *Client, payload interface{}) {
	data, err := json.Marshal(payload)
	if err != nil {
		return
	}

	var typing models.TypingPayload
	if err := json.Unmarshal(data, &typing); err != nil {
		return
	}

	typing.UserID = client.UserID

	// Отправка typing индикатора всем участникам чата
	message, err := json.Marshal(models.WSMessage{
		Type:    models.WSMessageTypeTyping,
		Payload: typing,
	})

	if err != nil {
		return
	}

	ws.hub.SendToChat(typing.ChatID, message, ws.db)
}

func (ws *WebSocketHandler) setUserOnline(userID uuid.UUID, online bool) {
	_, err := ws.db.Exec(`
		UPDATE users
		SET is_online = $1, last_seen = CURRENT_TIMESTAMP
		WHERE id = $2
	`, online, userID)

	if err != nil {
		log.Printf("Failed to update user online status: %v", err)
		return
	}

	// Отправка уведомления об изменении статуса
	msgType := models.WSMessageTypeOnline
	if !online {
		msgType = models.WSMessageTypeOffline
	}

	message, _ := json.Marshal(models.WSMessage{
		Type: msgType,
		Payload: map[string]interface{}{
			"user_id":   userID,
			"is_online": online,
		},
	})

	ws.hub.broadcast <- message
}

// BroadcastMessage отправляет сообщение всем участникам чата
func (ws *WebSocketHandler) BroadcastMessage(chatID uuid.UUID, message *models.Message) {
	wsMsg := models.WSMessage{
		Type:    models.WSMessageTypeNew,
		Payload: message,
	}

	data, err := json.Marshal(wsMsg)
	if err != nil {
		log.Printf("Failed to marshal message: %v", err)
		return
	}

	ws.hub.SendToChat(chatID, data, ws.db)
}
