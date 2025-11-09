.PHONY: help setup docker-up docker-down backend-run backend-build mobile-install mobile-start clean

help:
	@echo "Teleport Messenger - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make setup         - Первоначальная настройка проекта"
	@echo "  make docker-up     - Запуск PostgreSQL и Redis"
	@echo "  make docker-down   - Остановка Docker контейнеров"
	@echo ""
	@echo "Backend:"
	@echo "  make backend-deps  - Установка Go зависимостей"
	@echo "  make backend-run   - Запуск backend сервера"
	@echo "  make backend-build - Сборка backend бинарника"
	@echo ""
	@echo "Mobile:"
	@echo "  make mobile-install - Установка npm зависимостей"
	@echo "  make mobile-start   - Запуск Expo dev server"
	@echo ""
	@echo "Other:"
	@echo "  make clean         - Очистка временных файлов"
	@echo "  make logs          - Просмотр логов Docker"

setup:
	@echo "🚀 Setting up Teleport project..."
	@make docker-up
	@make backend-deps
	@echo "✅ Setup complete!"

docker-up:
	@echo "🐳 Starting Docker containers..."
	docker-compose up -d
	@echo "⏳ Waiting for databases to be ready..."
	@sleep 5
	@echo "✅ Docker containers are running"

docker-down:
	@echo "🛑 Stopping Docker containers..."
	docker-compose down

docker-logs:
	docker-compose logs -f

backend-deps:
	@echo "📦 Installing Go dependencies..."
	cd backend && go mod download && go mod tidy

backend-run:
	@echo "🚀 Starting backend server..."
	cd backend && go run cmd/api/main.go

backend-build:
	@echo "🔨 Building backend..."
	cd backend && go build -o bin/api cmd/api/main.go
	@echo "✅ Binary created at backend/bin/api"

backend-test:
	@echo "🧪 Running backend tests..."
	cd backend && go test -v ./...

mobile-install:
	@echo "📦 Installing mobile dependencies..."
	cd mobile && npm install

mobile-start:
	@echo "📱 Starting Expo dev server..."
	cd mobile && npx expo start

mobile-ios:
	@echo "📱 Starting on iOS..."
	cd mobile && npx expo start --ios

mobile-android:
	@echo "📱 Starting on Android..."
	cd mobile && npx expo start --android

clean:
	@echo "🧹 Cleaning temporary files..."
	rm -rf backend/bin
	rm -rf backend/tmp
	rm -rf mobile/node_modules
	rm -rf mobile/.expo
	@echo "✅ Cleanup complete"

db-reset:
	@echo "⚠️  Resetting database..."
	docker-compose down -v
	docker-compose up -d
	@sleep 5
	@echo "✅ Database reset complete"

.DEFAULT_GOAL := help
