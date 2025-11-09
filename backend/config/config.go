package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	JWT      JWTConfig
	SMS      SMSConfig
	Upload   UploadConfig
}

type ServerConfig struct {
	Port       string
	Env        string
	APIVersion string
	CORSOrigins []string
}

type DatabaseConfig struct {
	Host            string
	Port            string
	User            string
	Password        string
	Name            string
	SSLMode         string
	MaxConnections  int
	MaxIdleConns    int
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

type JWTConfig struct {
	Secret        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type SMSConfig struct {
	MockEnabled bool
	MockCode    string
	TwilioSID   string
	TwilioToken string
	TwilioPhone string
}

type UploadConfig struct {
	Directory   string
	MaxFileSize int64
}

func Load() (*Config, error) {
	// Загружаем .env файл (игнорируем ошибку если файл не существует)
	_ = godotenv.Load()

	cfg := &Config{
		Server: ServerConfig{
			Port:       getEnv("PORT", "8080"),
			Env:        getEnv("ENV", "development"),
			APIVersion: getEnv("API_VERSION", "v1"),
			CORSOrigins: []string{
				"http://localhost:3000",
				"http://localhost:19000",
				"http://localhost:19006",
			},
		},
		Database: DatabaseConfig{
			Host:           getEnv("DB_HOST", "localhost"),
			Port:           getEnv("DB_PORT", "5432"),
			User:           getEnv("DB_USER", "teleport_user"),
			Password:       getEnv("DB_PASSWORD", "teleport_pass_2024"),
			Name:           getEnv("DB_NAME", "teleport"),
			SSLMode:        getEnv("DB_SSLMODE", "disable"),
			MaxConnections: getEnvAsInt("DB_MAX_CONNECTIONS", 25),
			MaxIdleConns:   getEnvAsInt("DB_MAX_IDLE_CONNECTIONS", 5),
		},
		Redis: RedisConfig{
			Host:     getEnv("REDIS_HOST", "localhost"),
			Port:     getEnv("REDIS_PORT", "6379"),
			Password: getEnv("REDIS_PASSWORD", "redis_pass_2024"),
			DB:       getEnvAsInt("REDIS_DB", 0),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production"),
			AccessExpiry:  parseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"), 15*time.Minute),
			RefreshExpiry: parseDuration(getEnv("JWT_REFRESH_EXPIRY", "720h"), 720*time.Hour),
		},
		SMS: SMSConfig{
			MockEnabled: getEnv("MOCK_SMS", "true") == "true",
			MockCode:    getEnv("MOCK_SMS_CODE", "12345"),
			TwilioSID:   getEnv("TWILIO_ACCOUNT_SID", ""),
			TwilioToken: getEnv("TWILIO_AUTH_TOKEN", ""),
			TwilioPhone: getEnv("TWILIO_PHONE_NUMBER", ""),
		},
		Upload: UploadConfig{
			Directory:   getEnv("UPLOAD_DIR", "./uploads"),
			MaxFileSize: int64(getEnvAsInt("MAX_UPLOAD_SIZE", 104857600)), // 100MB
		},
	}

	return cfg, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	valueStr := getEnv(key, "")
	if value, err := strconv.Atoi(valueStr); err == nil {
		return value
	}
	return defaultValue
}

func parseDuration(value string, defaultValue time.Duration) time.Duration {
	if d, err := time.ParseDuration(value); err == nil {
		return d
	}
	return defaultValue
}

func (c *Config) DatabaseDSN() string {
	return fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		c.Database.Host,
		c.Database.Port,
		c.Database.User,
		c.Database.Password,
		c.Database.Name,
		c.Database.SSLMode,
	)
}

func (c *Config) RedisAddr() string {
	return fmt.Sprintf("%s:%s", c.Redis.Host, c.Redis.Port)
}
