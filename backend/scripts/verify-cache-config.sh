#!/bin/bash

# Comprehensive cache configuration verification

echo "=== NGINX Cache Configuration Verification ==="
echo ""

echo "1. Stream location block (full):"
sudo grep -A 30 "location ^~ /api/media/stream" /etc/nginx/sites-available/ifilm
echo ""

echo "2. Checking proxy_buffering in stream location:"
sudo grep -A 30 "location ^~ /api/media/stream" /etc/nginx/sites-available/ifilm | grep -E "proxy_buffering|proxy_cache"
echo ""

echo "3. Cache zones in main nginx.conf:"
sudo grep -A 2 "proxy_cache_path" /etc/nginx/nginx.conf
echo ""

echo "4. Testing which location block matches:"
echo "   Making test request..."
curl -sI "http://127.0.0.1/api/media/stream/test/master.m3u8" > /dev/null 2>&1
echo "   Check access log:"
sudo tail -1 /var/log/nginx/access.log | grep stream || echo "   No stream request in log"
echo ""

echo "5. Checking for cache bypass conditions:"
sudo grep -E "proxy_cache_bypass|proxy_no_cache" /etc/nginx/sites-available/ifilm || echo "   No bypass conditions found"
echo ""

echo "6. Current cache directory:"
sudo du -sh /var/cache/nginx/videos
sudo ls -la /var/cache/nginx/videos/ | head -10
echo ""

echo "7. NGINX error log (last 10 lines):"
sudo tail -10 /var/log/nginx/error.log | grep -i cache || echo "   No cache errors"
echo ""

echo "8. Testing actual request with verbose output:"
MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"
echo "   Request: http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8"
curl -v "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1 | grep -E "X-Cache-Status|HTTP/|location" | head -5

