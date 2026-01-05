#!/bin/bash

echo "=== Checking Backend Response Headers ==="
echo ""

MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"
TEST_URL="http://127.0.0.1:5000/api/media/stream/${MOVIE_ID}/master.m3u8"

echo "1. Direct backend request (bypassing NGINX):"
echo "   URL: $TEST_URL"
echo ""
BACKEND_RESPONSE=$(curl -sI "$TEST_URL" 2>&1)
echo "$BACKEND_RESPONSE" | head -25
echo ""

echo "2. Checking for cache-preventing headers:"
echo "$BACKEND_RESPONSE" | grep -iE "(cache-control|set-cookie|vary|expires|pragma)" || echo "   None found (good!)"
echo ""

echo "3. Checking Content-Length:"
CL=$(echo "$BACKEND_RESPONSE" | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
if [ -n "$CL" ]; then
    echo "   Content-Length: $CL bytes"
    if [ "$CL" -lt 1000 ]; then
        echo "   ⚠️  Response is very small - might affect caching"
    fi
else
    echo "   ⚠️  No Content-Length header"
fi
echo ""

echo "4. Checking Connection header:"
echo "$BACKEND_RESPONSE" | grep -i "connection" || echo "   Not set"
echo ""

echo "5. Full response via NGINX:"
NGINX_RESPONSE=$(curl -sI "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1)
echo "$NGINX_RESPONSE" | head -25
echo ""

echo "6. Comparing Cache-Control headers:"
echo "   Backend:"
echo "$BACKEND_RESPONSE" | grep -i "cache-control" || echo "      Not set"
echo "   NGINX:"
echo "$NGINX_RESPONSE" | grep -i "cache-control" || echo "      Not set"
echo ""

echo "=== Analysis Complete ==="
