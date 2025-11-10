# Desktop App Troubleshooting Guide

## Current Issue: 500 Internal Server Error

The desktop app is successfully connecting to the backend, but receiving **500 Internal Server Error** responses from `/auth/verify` and `/users/me` endpoints.

### Quick Diagnosis Steps

#### 1. Check Backend Logs

**On your Windows machine**, open the terminal where you ran `go run cmd/api/main.go` and look for error messages. You should see:

```
✅ Connected to PostgreSQL database
✅ Database schema initialized
✅ Connected to Redis
🚀 Server starting on port 8080
```

If you see any **error messages** after these, that's the root cause. Common errors:

**Error Example 1: Database Connection Failed**
```
❌ Failed to connect to database: password authentication failed
```
**Solution:** Check your `.env` file credentials match your Docker PostgreSQL settings

**Error Example 2: Table Does Not Exist**
```
❌ Failed to verify code: pq: relation "auth_codes" does not exist
```
**Solution:** Database schema not initialized. Restart the backend.

**Error Example 3: Column Does Not Exist**
```
❌ Failed to find or create user: pq: column "name" does not exist
```
**Solution:** Schema mismatch. Drop and recreate the database.

#### 2. Verify Docker Containers Are Running

```powershell
docker ps
```

You should see:
- `teleport-postgres` - PostgreSQL 15
- `teleport-redis` - Redis 7

If not running:
```powershell
cd C:\Users\Artem\go\src\Teleport_v1.0
docker-compose up -d
```

#### 3. Test Backend Manually

Open a new PowerShell window and test the endpoints:

```powershell
# Test 1: Health check
curl http://localhost:8080/health

# Test 2: Send code
curl -X POST http://localhost:8080/api/v1/auth/send-code `
  -H "Content-Type: application/json" `
  -d '{\"phone_number\":\"+79379761898\"}'

# Test 3: Verify code
curl -X POST http://localhost:8080/api/v1/auth/verify `
  -H "Content-Type: application/json" `
  -d '{\"phone_number\":\"+79379761898\",\"code\":\"12345\"}'
```

**Expected Response for Test 3:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": {
    "id": "...",
    "phone_number": "+79379761898",
    "created_at": "..."
  },
  "is_new_user": true
}
```

**If you get 500 error:** Check the backend terminal for error details.

#### 4. Common Fixes

##### Fix 1: Restart Backend

Sometimes the backend starts before the database is ready. Simply restart:

1. In the terminal running `go run cmd/api/main.go`, press `Ctrl+C`
2. Wait 2 seconds
3. Run again: `go run cmd/api/main.go`

##### Fix 2: Reset Database

If schema is corrupted or has missing tables:

```powershell
# Stop containers
docker-compose down

# Remove PostgreSQL volume (WARNING: deletes all data)
docker volume rm teleport_v10_postgres_data

# Start fresh
docker-compose up -d

# Wait 5 seconds for database to initialize
Start-Sleep -Seconds 5

# Start backend (it will create tables)
cd backend
go run cmd/api/main.go
```

##### Fix 3: Check .env Configuration

Open `backend\.env` and verify:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=teleport_user
DB_PASSWORD=teleport_pass_2024
DB_NAME=teleport
DB_SSLMODE=disable

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_pass_2024

MOCK_SMS=true
MOCK_SMS_CODE=12345
```

Must match `docker-compose.yml`:

```yaml
postgres:
  environment:
    POSTGRES_USER: teleport_user
    POSTGRES_PASSWORD: teleport_pass_2024
    POSTGRES_DB: teleport

redis:
  command: redis-server --requirepass redis_pass_2024
```

#### 5. Check Desktop App Logs

In the Electron DevTools (automatically opens in dev mode), check the Console tab for:

```
✅ Logged in: {user: {...}, access_token: "..."}
✅ WebSocket connected
```

Or errors like:
```
❌ POST http://192.168.1.109:8080/api/v1/auth/verify 500 (Internal Server Error)
```

### Network Configuration

The desktop app connects to backend at **192.168.1.109:8080**. This must be your local machine's IP address.

To verify:
```powershell
ipconfig
```

Look for **IPv4 Address** under your active network adapter. It should be `192.168.1.109`.

If your IP changed:
1. Open `desktop\src\services\api.ts`
2. Change line 14: `const API_URL = 'http://YOUR_NEW_IP:8080/api/v1';`
3. Restart the desktop app

### Still Having Issues?

1. **Check firewall:** Windows Firewall might be blocking port 8080
   - Go to Windows Defender Firewall → Advanced Settings → Inbound Rules
   - Ensure Go/Node processes are allowed

2. **Check antivirus:** Some antivirus software blocks local development servers

3. **Check backend is running:** In Task Manager, look for:
   - `main.exe` or `go.exe` (backend)
   - Multiple `node.exe` processes (Electron + Vite)

4. **Full system restart:**
   ```powershell
   # Stop everything
   docker-compose down
   # Kill Node processes
   Stop-Process -Name node -Force
   # Kill Electron
   Stop-Process -Name electron -Force

   # Start fresh
   docker-compose up -d
   Start-Sleep -Seconds 5
   cd backend
   go run cmd/api/main.go

   # In another terminal
   cd desktop
   npm run dev
   ```

## Common Error Messages

### Error: "invalid request"
**Cause:** Request body format is wrong
**Fix:** Check that you're sending `phone_number` (not `user_id`) to `/auth/verify`

### Error: "invalid code"
**Cause:** Code doesn't match or expired
**Fix:** Request a new code. Codes expire after 5 minutes.

### Error: "code expired"
**Cause:** More than 5 minutes passed since code was sent
**Fix:** Request a new code

### Error: "code already used"
**Cause:** Verification code was already used successfully
**Fix:** Request a new code

### Error: "authorization header required"
**Cause:** Missing or invalid access token
**Fix:** Login again to get a new token

### Error: "invalid or expired token"
**Cause:** Access token expired (expires after 15 minutes)
**Fix:** App should auto-refresh using refresh_token. If it doesn't, login again.

## Success Checklist

- [ ] Docker containers running (postgres + redis)
- [ ] Backend started without errors
- [ ] Backend shows "Server starting on port 8080"
- [ ] Health check returns `{"status":"ok"}`
- [ ] Can send verification code (returns 200 OK)
- [ ] Can verify code (returns access_token + user)
- [ ] Desktop app shows login screen
- [ ] Can enter phone number and get code
- [ ] Can enter code and see chat list
- [ ] WebSocket shows "connected" in console

## Log Messages to Look For

### Good Signs ✅

Backend startup:
```
✅ Connected to PostgreSQL database
✅ Database schema initialized
✅ Connected to Redis
🚀 Server starting on port 8080
📝 Environment: development
📱 SMS Code for +79379761898: 12345 (expires in 5 minutes)
```

Desktop app:
```
Logged in successfully
WebSocket connected
Loaded 0 chats
```

### Bad Signs ❌

Backend errors:
```
❌ Failed to connect to database
❌ Failed to initialize database schema
❌ Failed to verify code
❌ Failed to find or create user
❌ Failed to generate access token
```

Desktop app errors:
```
Login failed: Network Error
Verification failed: Request failed with status code 500
Failed to load user: Request failed with status code 401
WebSocket connection failed
```

## Need More Help?

If you're still stuck, please provide:

1. **Backend logs** (copy the entire terminal output where you run `go run cmd/api/main.go`)
2. **Desktop app console logs** (from Electron DevTools → Console tab)
3. **Docker status** (output of `docker ps`)
4. **Network info** (output of `ipconfig`)

This will help identify the exact issue.
