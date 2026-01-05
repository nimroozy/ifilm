#!/bin/bash

MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"
TEST_URL="http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8"

echo "=== Testing Cache with Detailed Debugging ==="
echo ""

echo "1. First request (should be MISS and store in cache):"
RESPONSE1=$(curl -sI "$TEST_URL" 2>&1)
echo "$RESPONSE1" | grep -E "(HTTP|X-Cache-Status|Content-Length|Connection|Transfer-Encoding)"
CACHE_STATUS1=$(echo "$RESPONSE1" | grep -i "X-Cache-Status" | awk '{print $2}' | tr -d '\r')
echo "   Cache Status: $CACHE_STATUS1"
echo ""

echo "2. Waiting 3 seconds for cache to be written..."
sleep 3

echo "3. Checking cache directory:"
CACHE_SIZE=$(sudo du -sh /var/cache/nginx/videos 2>/dev/null | awk '{print $1}')
CACHE_FILES=$(sudo find /var/cache/nginx/videos -type f 2>/dev/null | wc -l)
echo "   Cache size: $CACHE_SIZE"
echo "   Cache files: $CACHE_FILES"
echo ""

echo "4. Second request (should be HIT if cache works):"
RESPONSE2=$(curl -sI "$TEST_URL" 2>&1)
echo "$RESPONSE2" | grep -E "(HTTP|X-Cache-Status|Content-Length|Connection|Transfer-Encoding)"
CACHE_STATUS2=$(echo "$RESPONSE2" | grep -i "X-Cache-Status" | awk '{print $2}' | tr -d '\r')
echo "   Cache Status: $CACHE_STATUS2"
echo ""

echo "5. Checking NGINX error log for cache-related messages:"
sudo grep -i "cache" /var/log/nginx/error.log 2>/dev/null | tail -3 || echo "   No cache errors"
echo ""

echo "6. Checking if response has Content-Length:"
CL1=$(echo "$RESPONSE1" | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
CL2=$(echo "$RESPONSE2" | grep -i "content-length" | awk '{print $2}' | tr -d '\r')
echo "   First request Content-Length: $CL1"
echo "   Second request Content-Length: $CL2"
echo ""

echo "7. Checking Connection header:"
CONN1=$(echo "$RESPONSE1" | grep -i "connection" | awk '{print $2}' | tr -d '\r')
CONN2=$(echo "$RESPONSE2" | grep -i "connection" | awk '{print $2}' | tr -d '\r')
echo "   First request Connection: $CONN1"
echo "   Second request Connection: $CONN2"
echo ""

if [ "$CACHE_STATUS2" = "HIT" ]; then
    echo "✅ Cache is working! Second request was served from cache."
elif [ "$CACHE_STATUS2" = "MISS" ] && [ "$CACHE_FILES" -gt 0 ]; then
    echo "⚠️  Cache files exist but NGINX isn't using them (status: $CACHE_STATUS2)"
    echo "   This might indicate a cache key mismatch or other issue"
elif [ "$CACHE_STATUS2" = "MISS" ] && [ "$CACHE_FILES" -eq 0 ]; then
    echo "❌ Cache is NOT working - no files in cache directory"
    echo "   Possible causes:"
    echo "   - Response not being buffered completely"
    echo "   - Backend sending headers that prevent caching"
    echo "   - proxy_buffering might not be working correctly"
fi

echo ""
echo "=== Test Complete ==="

