#!/bin/bash

# Simple cache test script - uses movie ID from URL or environment

MOVIE_ID="${1:-b3cc75881cd1d27fc13b3e34e1f271ac}"

echo "=== Testing NGINX Cache for Video Streams ==="
echo ""
echo "Using movie ID: $MOVIE_ID"
echo ""

STREAM_URL="http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8"

echo "1. Making first request (should be MISS)..."
RESPONSE1=$(curl -sI "$STREAM_URL" 2>&1)
HTTP_CODE1=$(echo "$RESPONSE1" | head -1 | grep -oP '\d{3}')
CACHE_STATUS1=$(echo "$RESPONSE1" | grep -i "X-Cache-Status" || echo "X-Cache-Status: (not found)")

echo "   HTTP Status: $HTTP_CODE1"
echo "   $CACHE_STATUS1"
echo ""

if [ "$HTTP_CODE1" != "200" ]; then
    echo "⚠️  Request failed with HTTP $HTTP_CODE1"
    echo "   Full response:"
    echo "$RESPONSE1" | head -5
    echo ""
    echo "   This might mean:"
    echo "   - Movie ID is incorrect"
    echo "   - Backend is not running"
    echo "   - Authentication required"
    exit 1
fi

echo "2. Waiting 2 seconds..."
sleep 2

echo "3. Making second request (should be HIT if cache works)..."
RESPONSE2=$(curl -sI "$STREAM_URL" 2>&1)
HTTP_CODE2=$(echo "$RESPONSE2" | head -1 | grep -oP '\d{3}')
CACHE_STATUS2=$(echo "$RESPONSE2" | grep -i "X-Cache-Status" || echo "X-Cache-Status: (not found)")

echo "   HTTP Status: $HTTP_CODE2"
echo "   $CACHE_STATUS2"
echo ""

echo "4. Checking cache directory:"
CACHE_SIZE=$(sudo du -sh /var/cache/nginx/videos 2>/dev/null | cut -f1)
CACHE_FILES=$(sudo find /var/cache/nginx/videos -type f 2>/dev/null | wc -l)
echo "   Size: $CACHE_SIZE"
echo "   Files: $CACHE_FILES"
echo ""

echo "5. Summary:"
if echo "$CACHE_STATUS1" | grep -qi "MISS" && echo "$CACHE_STATUS2" | grep -qi "HIT"; then
    echo "   ✅ Cache is WORKING!"
    echo "   First request: MISS (fetched from backend)"
    echo "   Second request: HIT (served from cache)"
elif echo "$CACHE_STATUS1" | grep -qi "MISS" && echo "$CACHE_STATUS2" | grep -qi "MISS"; then
    echo "   ❌ Cache is NOT working"
    echo "   Both requests show MISS - cache not storing responses"
    echo ""
    echo "   Possible causes:"
    echo "   - proxy_buffering might be off"
    echo "   - Location block not matching correctly"
    echo "   - Cache zone not configured"
    echo ""
    echo "   Check: sudo grep -A 15 'location ~\* \^\/api\/media\/stream' /etc/nginx/sites-available/ifilm"
elif echo "$CACHE_STATUS1" | grep -qi "BYPASS"; then
    echo "   ⚠️  Cache is being BYPASSED"
    echo "   Check for proxy_cache_bypass directives"
else
    echo "   ⚠️  Could not determine cache status"
    echo "   X-Cache-Status header might not be present"
    echo ""
    echo "   First response headers:"
    echo "$RESPONSE1" | head -10
fi

echo ""
echo "6. To test with a different movie ID:"
echo "   sudo bash $0 YOUR_MOVIE_ID"

