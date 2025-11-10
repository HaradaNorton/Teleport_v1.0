@echo off
echo ========================================
echo Stopping Teleport Services
echo ========================================
echo.

echo Stopping Docker containers...
docker-compose down

echo.
echo ✅ Docker containers stopped
echo.
echo Закройте окна Backend и Mobile вручную (Ctrl+C)
echo.
pause
