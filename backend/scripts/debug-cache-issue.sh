#!/bin/bash

# Comprehensive cache debugging

MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"

echo "=== Comprehensive Cache Debugging ==="
echo ""

echo "1. Checking backend response headers directly:"
echo "   (Bypassing NGINX to see what backend sends)"
curl -sI "http://127.0.0.1:5000/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1 | head -15
echo ""

echo "2. Checking response through NGINX:"
HEADERS=$(curl -sI "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1)
echo "$HEADERS" | head -15
echo ""

echo "3. Checking for cache-preventing headers:"
if echo "$HEADERS" | grep -qi "Cache-Control.*no-store\|Cache-Control.*no-cache"; then
    echo "   ❌ Found cache-preventing Cache-Control:"
    echo "$HEADERS" | grep -i "Cache-Control"
else
    echo "   ✓ No cache-preventing Cache-Control found"
fi
echo ""

echo "4. Full stream location block:"
sudo grep -A 35 "location ^~ /api/media/stream" /etc/nginx/sites-available/ifilm
echo ""

echo "5. Checking if proxy_ignore_headers is set:"
if sudo grep -A 35 "location ^~ /api/media/stream" /etc/nginx/sites-available/ifilm | grep -q "proxy_ignore_headers"; then
    echo "   ✓ proxy_ignore_headers is set"
    sudo grep -A 35 "location ^~ /api/media/stream" /etc/nginx/sites-available/ifilm | grep "proxy_ignore_headers"
else
    echo "   ❌ proxy_ignore_headers is NOT set - this might be the issue!"
fi
echo ""

echo "6. Testing with verbose curl to see all headers:"
curl -v "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1 | grep -E "< HTTP|< X-Cache|< Cache-Control" | head -5
echo ""

echo "7. Checking NGINX error log for cache issues:"
sudo tail -20 /var/log/nginx/error.log | grep -i cache || echo "   No cache errors found"
echo ""

echo "8. Checking cache directory permissions:"
ls -ld /var/cache/nginx/videos
echo ""

echo "9. Testing cache key generation:"
echo "   NGINX cache key is based on: \$scheme\$proxy_host\$request_uri"
echo "   Request URI: /api/media/stream/${MOVIE_ID}/master.m3u8"
echo ""

