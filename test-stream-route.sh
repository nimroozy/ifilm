#!/bin/bash

echo "🔍 Testing stream route..."
echo ""

# Get a movie ID
MOVIE_ID=$(curl -s http://localhost:5000/api/media/movies?limit=1 | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$MOVIE_ID" ]; then
    echo "❌ Could not get movie ID"
    exit 1
fi

echo "Movie ID: $MOVIE_ID"
echo ""

# Test 1: Check if route exists
echo "1. Testing stream endpoint on backend directly..."
STREAM_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:5000/api/media/stream/$MOVIE_ID/master.m3u8")
echo "HTTP Status: $STREAM_STATUS"

if [ "$STREAM_STATUS" = "200" ]; then
    echo "✅ Stream endpoint works!"
elif [ "$STREAM_STATUS" = "404" ]; then
    echo "❌ Stream endpoint returns 404"
    echo ""
    echo "Testing with verbose output:"
    curl -v "http://localhost:5000/api/media/stream/$MOVIE_ID/master.m3u8" 2>&1 | grep -E "(< HTTP|404|Not Found|path|url)" | head -10
    echo ""
    echo "Checking backend logs..."
    pm2 logs ifilm-backend --lines 20 --nostream | grep -E "(proxyStream|stream|404)" | tail -10
else
    echo "⚠️  Stream endpoint returned HTTP $STREAM_STATUS"
fi

echo ""
echo "2. Testing different path formats..."
echo "Testing: /api/media/stream/$MOVIE_ID/master.m3u8"
curl -s -o /dev/null -w "Status: %{http_code}\n" "http://localhost:5000/api/media/stream/$MOVIE_ID/master.m3u8"

echo ""
echo "3. Checking backend route registration..."
echo "Routes should include: router.get(/^\/stream\/(.+)$/, proxyStream);"
echo "Checking if route file exists and has the route..."
grep -n "stream" backend/src/routes/media.routes.ts | head -5

echo ""
echo "4. Testing via NGINX..."
NGINX_STREAM_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/media/stream/$MOVIE_ID/master.m3u8")
echo "NGINX HTTP Status: $NGINX_STREAM_STATUS"

if [ "$NGINX_STREAM_STATUS" = "200" ]; then
    echo "✅ NGINX proxy works!"
else
    echo "⚠️  NGINX returns HTTP $NGINX_STREAM_STATUS"
fi

