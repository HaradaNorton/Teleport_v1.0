@echo off
echo ========================================
echo Starting Teleport Backend Server
echo ========================================
echo.

cd backend
go run cmd/api/main.go

pause
