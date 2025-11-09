package database

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	"github.com/teleport/backend/config"
)

type PostgresDB struct {
	*sql.DB
}

func NewPostgresDB(cfg *config.Config) (*PostgresDB, error) {
	db, err := sql.Open("postgres", cfg.DatabaseDSN())
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Настройка connection pool
	db.SetMaxOpenConns(cfg.Database.MaxConnections)
	db.SetMaxIdleConns(cfg.Database.MaxIdleConns)
	db.SetConnMaxLifetime(time.Hour)

	// Проверка подключения
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("✅ Connected to PostgreSQL database")

	return &PostgresDB{db}, nil
}

func (db *PostgresDB) Close() error {
	log.Println("Closing database connection...")
	return db.DB.Close()
}

// InitSchema создает базовые таблицы если их нет
func (db *PostgresDB) InitSchema() error {
	schema := `
	-- Users table
	CREATE TABLE IF NOT EXISTS users (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		phone_number VARCHAR(20) UNIQUE NOT NULL,
		name VARCHAR(100),
		avatar_url VARCHAR(500),
		bio TEXT,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		is_online BOOLEAN DEFAULT false
	);

	CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
	CREATE INDEX IF NOT EXISTS idx_users_online ON users(is_online, last_seen);

	-- Auth codes table (для SMS кодов)
	CREATE TABLE IF NOT EXISTS auth_codes (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		phone_number VARCHAR(20) NOT NULL,
		code VARCHAR(6) NOT NULL,
		expires_at TIMESTAMP NOT NULL,
		verified BOOLEAN DEFAULT false,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_auth_codes_phone ON auth_codes(phone_number, verified);

	-- Refresh tokens table
	CREATE TABLE IF NOT EXISTS refresh_tokens (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		token VARCHAR(500) UNIQUE NOT NULL,
		expires_at TIMESTAMP NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
	CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

	-- Chats table
	CREATE TABLE IF NOT EXISTS chats (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		type VARCHAR(20) NOT NULL CHECK (type IN ('personal', 'group', 'channel')),
		title VARCHAR(200),
		avatar_url VARCHAR(500),
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		last_message_at TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_chats_type ON chats(type);
	CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);

	-- Chat members table
	CREATE TABLE IF NOT EXISTS chat_members (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
		joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		left_at TIMESTAMP,
		unread_count INTEGER DEFAULT 0,
		last_read_message_id UUID,
		UNIQUE(chat_id, user_id)
	);

	CREATE INDEX IF NOT EXISTS idx_chat_members_chat ON chat_members(chat_id);
	CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members(user_id);

	-- Messages table
	CREATE TABLE IF NOT EXISTS messages (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
		sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
		content TEXT,
		type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'video', 'file', 'voice', 'system')),
		media_url VARCHAR(500),
		media_size INTEGER,
		media_duration INTEGER,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		edited_at TIMESTAMP,
		deleted_at TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at DESC);
	CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

	-- Message reads table (кто прочитал сообщение)
	CREATE TABLE IF NOT EXISTS message_reads (
		message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		PRIMARY KEY (message_id, user_id)
	);

	CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id);

	-- Contacts table (адресная книга)
	CREATE TABLE IF NOT EXISTS contacts (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		display_name VARCHAR(100),
		is_blocked BOOLEAN DEFAULT false,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(user_id, contact_user_id)
	);

	CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	log.Println("✅ Database schema initialized")
	return nil
}
