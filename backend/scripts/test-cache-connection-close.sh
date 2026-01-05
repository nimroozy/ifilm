#!/bin/bash

MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"
TEST_URL="http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8"

echo "=== Testing Cache with Connection: close ==="
echo ""

# Clear cache directory
echo "1. Clearing cache directory..."
sudo rm -rf /var/cache/nginx/videos/*
sudo mkdir -p /var/cache/nginx/videos
sudo chown -R www-data:www-data /var/cache/nginx/videos
sudo chmod -R 755 /var/cache/nginx/videos
echo "   Cache cleared"
echo ""

echo "2. First GET request with Connection: close header..."
RESPONSE1=$(curl -sI -H "Connection: close" "$TEST_URL" 2>&1)
echo "$RESPONSE1" | grep -E "(HTTP|X-Cache-Status|Content-Length|Connection)"
CACHE_STATUS1=$(echo "$RESPONSE1" | grep -i "X-Cache-Status" | awk '{print $2}' | tr -d '\r')
echo "   Cache Status: $CACHE_STATUS1"
echo ""

# Fetch content
curl -s -H "Connection: close" "$TEST_URL" > /dev/null
echo "   Content fetched with Connection: close"
echo ""

echo "3. Waiting 3 seconds..."
sleep 3

echo "4. Checking cache directory:"
CACHE_FILES=$(sudo find /var/cache/nginx/videos -type f 2>/dev/null | wc -l)
echo "   Cache files: $CACHE_FILES"
if [ "$CACHE_FILES" -gt 0 ]; then
    echo "   ✅ Cache files created!"
    sudo find /var/cache/nginx/videos -type f 2>/dev/null | head -3
    echo ""
    echo "5. Second request (should be HIT):"
    RESPONSE2=$(curl -sI "$TEST_URL" 2>&1)
    CACHE_STATUS2=$(echo "$RESPONSE2" | grep -i "X-Cache-Status" | awk '{print $2}' | tr -d '\r')
    echo "   Cache Status: $CACHE_STATUS2"
else
    echo "   ❌ Still no cache files"
    echo ""
    echo "5. Checking NGINX cache status with nginx -T:"
    sudo nginx -T 2>/dev/null | grep -A 10 "proxy_cache videos_cache" | head -15
fi

echo ""
echo "=== Test Complete ==="

