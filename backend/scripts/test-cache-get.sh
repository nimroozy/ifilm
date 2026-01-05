#!/bin/bash

MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"
TEST_URL="http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8"

echo "=== Testing Cache with GET Requests (not HEAD) ==="
echo ""

echo "1. First GET request (should be MISS and store in cache):"
RESPONSE1=$(curl -sI "$TEST_URL" 2>&1)
echo "$RESPONSE1" | grep -E "(HTTP|X-Cache-Status|Content-Length)"
CACHE_STATUS1=$(echo "$RESPONSE1" | grep -i "X-Cache-Status" | awk '{print $2}' | tr -d '\r')
echo "   Cache Status: $CACHE_STATUS1"
echo ""

# Actually fetch the content (GET request with body)
echo "2. Fetching actual content (GET request)..."
curl -s "$TEST_URL" > /dev/null
echo "   Content fetched"
echo ""

echo "3. Waiting 2 seconds for cache to be written..."
sleep 2

echo "4. Checking cache directory:"
CACHE_SIZE=$(sudo du -sh /var/cache/nginx/videos 2>/dev/null | awk '{print $1}')
CACHE_FILES=$(sudo find /var/cache/nginx/videos -type f 2>/dev/null | wc -l)
echo "   Cache size: $CACHE_SIZE"
echo "   Cache files: $CACHE_FILES"
if [ "$CACHE_FILES" -gt 0 ]; then
    echo "   Cache file list:"
    sudo find /var/cache/nginx/videos -type f 2>/dev/null | head -5
fi
echo ""

echo "5. Second GET request (should be HIT if cache works):"
RESPONSE2=$(curl -sI "$TEST_URL" 2>&1)
echo "$RESPONSE2" | grep -E "(HTTP|X-Cache-Status|Content-Length)"
CACHE_STATUS2=$(echo "$RESPONSE2" | grep -i "X-Cache-Status" | awk '{print $2}' | tr -d '\r')
echo "   Cache Status: $CACHE_STATUS2"
echo ""

echo "6. Third GET request to confirm:"
RESPONSE3=$(curl -sI "$TEST_URL" 2>&1)
CACHE_STATUS3=$(echo "$RESPONSE3" | grep -i "X-Cache-Status" | awk '{print $2}' | tr -d '\r')
echo "   Cache Status: $CACHE_STATUS3"
echo ""

if [ "$CACHE_STATUS2" = "HIT" ] || [ "$CACHE_STATUS3" = "HIT" ]; then
    echo "✅ Cache is working! Requests are being served from cache."
elif [ "$CACHE_FILES" -gt 0 ]; then
    echo "⚠️  Cache files exist ($CACHE_FILES files) but NGINX isn't using them"
    echo "   Cache status: $CACHE_STATUS2"
    echo "   This might indicate a cache key mismatch"
else
    echo "❌ Cache is NOT working - no files in cache directory"
    echo "   Possible causes:"
    echo "   - NGINX not writing cache entries"
    echo "   - Response not being fully buffered"
    echo "   - Some other caching condition not met"
fi

echo ""
echo "=== Test Complete ==="

