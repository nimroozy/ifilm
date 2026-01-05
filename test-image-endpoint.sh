#!/bin/bash

echo "🔍 Testing image endpoint..."
echo ""

# Get a movie ID
echo "1. Fetching a movie..."
MOVIE_RESPONSE=$(curl -s http://localhost:5000/api/media/movies?limit=1)
echo "Response: $MOVIE_RESPONSE" | head -c 200
echo ""
echo ""

MOVIE_ID=$(echo "$MOVIE_RESPONSE" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$MOVIE_ID" ]; then
    echo "❌ Could not get movie ID"
    echo "Full response:"
    echo "$MOVIE_RESPONSE"
    exit 1
fi

echo "✅ Found movie ID: $MOVIE_ID"
echo ""

# Test backend directly
echo "2. Testing backend image endpoint directly..."
BACKEND_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:5000/api/media/images/$MOVIE_ID/Primary")
echo "Backend HTTP status: $BACKEND_STATUS"

if [ "$BACKEND_STATUS" = "200" ]; then
    echo "✅ Backend image endpoint works!"
elif [ "$BACKEND_STATUS" = "404" ]; then
    echo "❌ Backend returns 404 - route not found"
    echo "Testing with curl verbose:"
    curl -v "http://localhost:5000/api/media/images/$MOVIE_ID/Primary" 2>&1 | head -20
elif [ "$BACKEND_STATUS" = "503" ]; then
    echo "⚠️  Backend returns 503 - Jellyfin not configured"
else
    echo "⚠️  Backend returns HTTP $BACKEND_STATUS"
fi
echo ""

# Test via NGINX
echo "3. Testing via NGINX..."
NGINX_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/media/images/$MOVIE_ID/Primary")
echo "NGINX HTTP status: $NGINX_STATUS"

if [ "$NGINX_STATUS" = "200" ]; then
    echo "✅ NGINX proxy works!"
elif [ "$NGINX_STATUS" = "404" ]; then
    echo "❌ NGINX returns 404"
    echo "Checking NGINX config..."
    echo "Location /api block:"
    grep -A 10 "location /api" /etc/nginx/sites-available/ifilm || echo "Config not found"
else
    echo "⚠️  NGINX returns HTTP $NGINX_STATUS"
fi
echo ""

# Check backend logs
echo "4. Recent backend logs (last 10 lines)..."
pm2 logs ifilm-backend --lines 10 --nostream | tail -10
echo ""

echo "📋 Summary:"
echo "==========="
if [ "$BACKEND_STATUS" = "200" ] && [ "$NGINX_STATUS" != "200" ]; then
    echo "Backend works but NGINX doesn't - check NGINX config"
elif [ "$BACKEND_STATUS" != "200" ]; then
    echo "Backend issue - check routes and Jellyfin configuration"
fi

