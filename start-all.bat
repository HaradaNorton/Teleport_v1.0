@echo off
echo ========================================
echo Starting Teleport - Full Stack
echo ========================================
echo.

REM Запуск Docker контейнеров
echo [1/3] Starting Database (Docker)...
docker-compose up -d
if %errorlevel% neq 0 (
    echo ERROR: Failed to start Docker containers
    pause
    exit /b 1
)
echo ✅ Database started successfully
echo.

REM Проверка что Docker контейнеры запущены
timeout /t 3 /nobreak >nul
docker-compose ps

echo.
echo ========================================
echo [2/3] Backend будет запущен в новом окне
echo [3/3] Mobile будет запущен в новом окне
echo ========================================
echo.
echo После запуска:
echo 1. Backend API: http://localhost:8080
echo 2. Mobile - отсканируйте QR-код в Expo Go
echo.
echo Нажмите любую клавишу для запуска...
pause >nul

REM Запуск Backend в новом окне
start "Teleport Backend" cmd /k "cd /d %~dp0 && start-backend.bat"

REM Ждем 5 секунд чтобы backend запустился
timeout /t 5 /nobreak >nul

REM Запуск Mobile в новом окне
start "Teleport Mobile" cmd /k "cd /d %~dp0 && start-mobile.bat"

echo.
echo ========================================
echo ✅ Все сервисы запускаются!
echo ========================================
echo.
echo Открыты 2 новых окна:
echo   - Backend (Go API)
echo   - Mobile (Expo)
echo.
echo Для остановки: закройте оба окна или используйте Ctrl+C
echo.
pause
