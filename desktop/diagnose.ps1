# Teleport Desktop Diagnostic Script
# Run this on Windows to diagnose backend connection issues

Write-Host ""
Write-Host "🔍 Teleport Desktop Diagnostic Tool" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0

# Test 1: Check Docker containers
Write-Host "1️⃣  Checking Docker containers..." -ForegroundColor Yellow
try {
    $containers = docker ps --format "{{.Names}}" 2>&1
    if ($containers -match "teleport-postgres") {
        Write-Host "   ✅ PostgreSQL container is running" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PostgreSQL container is NOT running" -ForegroundColor Red
        $ErrorCount++
    }

    if ($containers -match "teleport-redis") {
        Write-Host "   ✅ Redis container is running" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Redis container is NOT running" -ForegroundColor Red
        $ErrorCount++
    }
} catch {
    Write-Host "   ❌ Docker is not running or not installed" -ForegroundColor Red
    $ErrorCount++
}
Write-Host ""

# Test 2: Check if backend is listening on port 8080
Write-Host "2️⃣  Checking if backend is listening on port 8080..." -ForegroundColor Yellow
try {
    $listener = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
    if ($listener) {
        Write-Host "   ✅ Backend is listening on port 8080" -ForegroundColor Green
        Write-Host "   Process ID: $($listener.OwningProcess)" -ForegroundColor Gray
    } else {
        Write-Host "   ❌ Nothing is listening on port 8080" -ForegroundColor Red
        Write-Host "   You need to start the backend: cd backend && go run cmd/api/main.go" -ForegroundColor Yellow
        $ErrorCount++
    }
} catch {
    Write-Host "   ❌ Failed to check port 8080" -ForegroundColor Red
    $ErrorCount++
}
Write-Host ""

# Test 3: Check backend health endpoint
Write-Host "3️⃣  Testing backend health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8080/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    $body = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Health check passed" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Health check failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    $ErrorCount++
}
Write-Host ""

# Test 4: Test send-code endpoint
Write-Host "4️⃣  Testing /auth/send-code endpoint..." -ForegroundColor Yellow
try {
    $body = @{
        phone_number = "+79379761898"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/auth/send-code" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -ErrorAction Stop

    Write-Host "   ✅ Send-code endpoint working" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "   ❌ Send-code endpoint failed" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    $ErrorCount++
}
Write-Host ""

# Test 5: Test verify endpoint
Write-Host "5️⃣  Testing /auth/verify endpoint..." -ForegroundColor Yellow
try {
    $body = @{
        phone_number = "+79379761898"
        code = "12345"
    } | ConvertTo-Json

    $response = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/auth/verify" `
        -Method POST `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -ErrorAction Stop

    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Verify endpoint working" -ForegroundColor Green
    Write-Host "   User created: $($data.is_new_user)" -ForegroundColor Gray
    Write-Host "   User ID: $($data.user.id)" -ForegroundColor Gray

    # Test 6: Test /users/me with token
    Write-Host ""
    Write-Host "6️⃣  Testing /users/me endpoint with token..." -ForegroundColor Yellow
    try {
        $headers = @{
            Authorization = "Bearer $($data.access_token)"
        }

        $meResponse = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/users/me" `
            -Method GET `
            -Headers $headers `
            -TimeoutSec 10 `
            -ErrorAction Stop

        Write-Host "   ✅ /users/me endpoint working" -ForegroundColor Green
        Write-Host "   Response: $($meResponse.Content)" -ForegroundColor Gray
    } catch {
        Write-Host "   ❌ /users/me endpoint failed" -ForegroundColor Red
        Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
        $ErrorCount++
    }
} catch {
    Write-Host "   ❌ Verify endpoint failed" -ForegroundColor Red
    Write-Host "   Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   ⚠️  This is likely the root cause of your 500 error!" -ForegroundColor Yellow
    Write-Host "   Check the backend terminal logs for error details" -ForegroundColor Yellow
    $ErrorCount++
}
Write-Host ""

# Test 7: Check network IP
Write-Host "7️⃣  Checking network configuration..." -ForegroundColor Yellow
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" }).IPAddress
if ($ip) {
    Write-Host "   ✅ Local IP: $ip" -ForegroundColor Green
    if ($ip -ne "192.168.1.109") {
        Write-Host "   ⚠️  Warning: Desktop app expects 192.168.1.109" -ForegroundColor Yellow
        Write-Host "   Update desktop/src/services/api.ts line 14 to use: $ip" -ForegroundColor Yellow
        $WarningCount++
    }
} else {
    Write-Host "   ❌ Could not determine local IP" -ForegroundColor Red
    $ErrorCount++
}
Write-Host ""

# Summary
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "📊 Diagnostic Summary" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "✅ All tests passed! Your setup looks good." -ForegroundColor Green
    Write-Host ""
    Write-Host "If you're still having issues:" -ForegroundColor Yellow
    Write-Host "1. Check Electron DevTools console for errors" -ForegroundColor Yellow
    Write-Host "2. Verify the desktop app is running: npm run dev" -ForegroundColor Yellow
    Write-Host "3. Try clearing localStorage and logging in again" -ForegroundColor Yellow
} else {
    Write-Host "❌ Found $ErrorCount error(s) and $WarningCount warning(s)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common fixes:" -ForegroundColor Yellow
    Write-Host "1. Start Docker containers: docker-compose up -d" -ForegroundColor White
    Write-Host "2. Wait 5 seconds for database to initialize" -ForegroundColor White
    Write-Host "3. Start backend: cd backend && go run cmd/api/main.go" -ForegroundColor White
    Write-Host "4. Check backend terminal for error messages" -ForegroundColor White
    Write-Host "5. If all else fails, restart everything (see TROUBLESHOOTING.md)" -ForegroundColor White
}

Write-Host ""
Write-Host "For detailed troubleshooting, see: desktop/TROUBLESHOOTING.md" -ForegroundColor Cyan
Write-Host ""
