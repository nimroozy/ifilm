#!/bin/bash

# Check actual response headers from backend

MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"

echo "=== Checking Backend Response Headers ==="
echo ""

echo "1. Direct backend request (bypassing NGINX):"
curl -sI "http://127.0.0.1:5000/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1 | head -20
echo ""

echo "2. Through NGINX:"
curl -sI "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1 | head -20
echo ""

echo "3. Checking for cache-preventing headers:"
HEADERS=$(curl -sI "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1)

echo "Cache-Control:"
echo "$HEADERS" | grep -i "Cache-Control" || echo "  (not found)"
echo ""

echo "Set-Cookie:"
echo "$HEADERS" | grep -i "Set-Cookie" || echo "  (not found)"
echo ""

echo "X-Cache-Status:"
echo "$HEADERS" | grep -i "X-Cache-Status" || echo "  (not found)"
echo ""

echo "Content-Length:"
echo "$HEADERS" | grep -i "Content-Length" || echo "  (not found - might be chunked)"
echo ""

echo "Transfer-Encoding:"
echo "$HEADERS" | grep -i "Transfer-Encoding" || echo "  (not found)"
echo ""

