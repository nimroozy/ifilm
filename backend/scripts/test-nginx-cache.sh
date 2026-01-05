#!/bin/bash

# Test script to verify NGINX cache is working

echo "=== Testing NGINX Cache ==="
echo ""

# Get a real movie ID from the database or use a test one
# For now, let's test with a sample request

echo "1. Testing cache with a sample stream request..."
echo "   (Replace {id} with an actual movie ID from your database)"
echo ""

# Check if we can get a movie ID
MOVIE_ID=$(psql -h localhost -U postgres -d ifilm -t -c "SELECT id FROM movies LIMIT 1" 2>/dev/null | xargs)

if [ -z "$MOVIE_ID" ]; then
    echo "⚠️  Could not get movie ID from database"
    echo "   Please provide a movie ID to test with"
    echo ""
    echo "   Usage: curl -I http://127.0.0.1/api/media/stream/{MOVIE_ID}/master.m3u8"
    exit 1
fi

echo "   Using movie ID: $MOVIE_ID"
echo ""

# Test first request (should be MISS)
echo "2. Making first request (should be MISS)..."
RESPONSE1=$(curl -sI "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1)
CACHE_STATUS1=$(echo "$RESPONSE1" | grep -i "X-Cache-Status" || echo "X-Cache-Status: not found")

echo "   Response:"
echo "$RESPONSE1" | head -10
echo ""
echo "   Cache Status: $CACHE_STATUS1"
echo ""

# Wait a moment
sleep 1

# Test second request (should be HIT if cache works)
echo "3. Making second request (should be HIT if cache works)..."
RESPONSE2=$(curl -sI "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1)
CACHE_STATUS2=$(echo "$RESPONSE2" | grep -i "X-Cache-Status" || echo "X-Cache-Status: not found")

echo "   Response:"
echo "$RESPONSE2" | head -10
echo ""
echo "   Cache Status: $CACHE_STATUS2"
echo ""

# Check cache directory
echo "4. Checking cache directory:"
sudo du -sh /var/cache/nginx/videos
sudo find /var/cache/nginx/videos -type f | wc -l
echo ""

# Check NGINX access log for the requests
echo "5. Checking NGINX access log (last 5 lines):"
sudo tail -5 /var/log/nginx/access.log | grep "stream" || echo "No stream requests in log"
echo ""

# Summary
if echo "$CACHE_STATUS1" | grep -qi "MISS" && echo "$CACHE_STATUS2" | grep -qi "HIT"; then
    echo "✅ Cache is working! First request was MISS, second was HIT"
elif echo "$CACHE_STATUS1" | grep -qi "MISS" && echo "$CACHE_STATUS2" | grep -qi "MISS"; then
    echo "❌ Cache is NOT working - both requests show MISS"
    echo ""
    echo "   Possible issues:"
    echo "   - Location block not matching correctly"
    echo "   - proxy_buffering might be off"
    echo "   - Cache zone not properly configured"
    echo ""
    echo "   Check: sudo grep -A 10 'location ~\* \^\/api\/media\/stream' /etc/nginx/sites-available/ifilm"
else
    echo "⚠️  Could not determine cache status from headers"
    echo "   Check if X-Cache-Status header is being added"
fi

