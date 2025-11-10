@echo off
echo ========================================
echo Starting Teleport Mobile App (Expo)
echo ========================================
echo.
echo QR-код появится через 1-2 минуты (Metro собирает бандл)...
echo Отсканируйте его в приложении Expo Go на iPhone
echo.
echo ✅ Проект обновлен до SDK 54!
echo ✅ Совместим с вашим Expo Go
echo.

cd mobile
npm start -- --clear

pause
