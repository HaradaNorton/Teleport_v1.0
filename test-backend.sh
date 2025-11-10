#!/bin/bash

echo "🔍 Testing Teleport Backend..."
echo ""

# Test 1: Health check
echo "1️⃣ Testing health endpoint..."
HEALTH=$(curl -s http://192.168.1.109:8080/health)
if [ $? -eq 0 ]; then
    echo "✅ Health check passed: $HEALTH"
else
    echo "❌ Health check failed - backend may not be running"
    exit 1
fi
echo ""

# Test 2: Send verification code
echo "2️⃣ Testing send-code endpoint..."
SEND_CODE=$(curl -s -X POST http://192.168.1.109:8080/api/v1/auth/send-code \
    -H "Content-Type: application/json" \
    -d '{"phone_number":"+79379761898"}')
echo "Response: $SEND_CODE"
echo ""

# Test 3: Verify code
echo "3️⃣ Testing verify endpoint..."
VERIFY=$(curl -s -X POST http://192.168.1.109:8080/api/v1/auth/verify \
    -H "Content-Type: application/json" \
    -d '{"phone_number":"+79379761898","code":"12345"}')
echo "Response: $VERIFY"
echo ""

# Test 4: Extract token and test /users/me
if echo "$VERIFY" | grep -q "access_token"; then
    echo "4️⃣ Testing /users/me endpoint..."
    TOKEN=$(echo "$VERIFY" | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)
    ME=$(curl -s http://192.168.1.109:8080/api/v1/users/me \
        -H "Authorization: Bearer $TOKEN")
    echo "Response: $ME"
else
    echo "❌ No access token received, skipping /users/me test"
fi

echo ""
echo "✅ Test complete"
