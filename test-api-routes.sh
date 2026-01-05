#!/bin/bash

echo "🔍 Testing API routes..."
echo ""

# Test 1: Backend health
echo "1. Testing backend health..."
BACKEND_HEALTH=$(curl -s http://localhost:5000/health)
if [[ "$BACKEND_HEALTH" == *"ok"* ]]; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not responding"
    exit 1
fi

# Test 2: Backend API health
echo ""
echo "2. Testing backend /api/health..."
API_HEALTH=$(curl -s http://localhost:5000/api/health)
if [[ "$API_HEALTH" == *"ok"* ]]; then
    echo "✅ Backend /api/health works"
else
    echo "❌ Backend /api/health failed: $API_HEALTH"
fi

# Test 3: Get a movie ID
echo ""
echo "3. Getting a movie ID..."
MOVIE_RESPONSE=$(curl -s http://localhost:5000/api/media/movies?limit=1)
MOVIE_ID=$(echo "$MOVIE_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$MOVIE_ID" ]; then
    echo "❌ Could not get movie ID"
    echo "Response: $MOVIE_RESPONSE"
    exit 1
fi

echo "✅ Found movie ID: $MOVIE_ID"

# Test 4: Test image endpoint on backend
echo ""
echo "4. Testing image endpoint on backend..."
IMAGE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:5000/api/media/images/$MOVIE_ID/Primary")
echo "Backend image endpoint HTTP status: $IMAGE_STATUS"

if [ "$IMAGE_STATUS" = "200" ]; then
    echo "✅ Backend image endpoint works"
elif [ "$IMAGE_STATUS" = "404" ]; then
    echo "❌ Backend image endpoint returns 404"
    echo "Testing with verbose output:"
    curl -v "http://localhost:5000/api/media/images/$MOVIE_ID/Primary" 2>&1 | grep -E "(< HTTP|404|Not Found)" | head -5
elif [ "$IMAGE_STATUS" = "503" ]; then
    echo "⚠️  Backend returns 503 - Jellyfin not configured"
else
    echo "⚠️  Backend returns HTTP $IMAGE_STATUS"
fi

# Test 5: Test stream endpoint on backend
echo ""
echo "5. Testing stream endpoint on backend..."
STREAM_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:5000/api/media/stream/$MOVIE_ID/master.m3u8")
echo "Backend stream endpoint HTTP status: $STREAM_STATUS"

if [ "$STREAM_STATUS" = "200" ] || [ "$STREAM_STATUS" = "302" ]; then
    echo "✅ Backend stream endpoint works"
elif [ "$STREAM_STATUS" = "404" ]; then
    echo "❌ Backend stream endpoint returns 404"
    echo "Testing with verbose output:"
    curl -v "http://localhost:5000/api/media/stream/$MOVIE_ID/master.m3u8" 2>&1 | grep -E "(< HTTP|404|Not Found)" | head -5
elif [ "$STREAM_STATUS" = "401" ]; then
    echo "⚠️  Backend returns 401 - Authentication required"
else
    echo "⚠️  Backend returns HTTP $STREAM_STATUS"
fi

# Test 6: Test via NGINX
echo ""
echo "6. Testing via NGINX..."
NGINX_HEALTH=$(curl -s http://localhost/api/health)
if [[ "$NGINX_HEALTH" == *"ok"* ]]; then
    echo "✅ NGINX /api/health works"
else
    echo "❌ NGINX /api/health failed: $NGINX_HEALTH"
fi

NGINX_IMAGE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/media/images/$MOVIE_ID/Primary")
echo "NGINX image endpoint HTTP status: $NGINX_IMAGE_STATUS"

if [ "$NGINX_IMAGE_STATUS" = "200" ]; then
    echo "✅ NGINX image endpoint works"
elif [ "$NGINX_IMAGE_STATUS" = "404" ]; then
    echo "❌ NGINX image endpoint returns 404"
    echo "Checking NGINX error log:"
    sudo tail -5 /var/log/nginx/error.log 2>/dev/null || echo "Could not read error log"
else
    echo "⚠️  NGINX returns HTTP $NGINX_IMAGE_STATUS"
fi

echo ""
echo "📋 Summary:"
echo "==========="
if [ "$IMAGE_STATUS" = "200" ] && [ "$NGINX_IMAGE_STATUS" != "200" ]; then
    echo "Backend works but NGINX doesn't - check NGINX proxy configuration"
elif [ "$IMAGE_STATUS" != "200" ]; then
    echo "Backend issue - check routes and Jellyfin configuration"
    echo "Check backend logs: pm2 logs ifilm-backend --lines 20"
fi

