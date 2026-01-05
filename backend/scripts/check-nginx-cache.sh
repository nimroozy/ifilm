#!/bin/bash

# Diagnostic script to check NGINX cache configuration

echo "=== NGINX Cache Configuration Check ==="
echo ""

echo "1. Checking cache zones in main nginx.conf:"
sudo grep -A 2 "proxy_cache_path" /etc/nginx/nginx.conf
echo ""

echo "2. Checking cache directives in site config:"
echo "--- Images location block:"
sudo grep -A 15 "location ~\* \^\/api\/media\/images" /etc/nginx/sites-available/ifilm | head -20
echo ""
echo "--- Stream location block:"
sudo grep -A 15 "location ~\* \^\/api\/media\/stream" /etc/nginx/sites-available/ifilm | head -20
echo ""

echo "3. Checking if cache directives are enabled (should NOT have #):"
echo "--- proxy_cache directive:"
sudo grep "proxy_cache" /etc/nginx/sites-available/ifilm | grep -v "^[[:space:]]*#"
echo ""
echo "--- proxy_buffering:"
sudo grep "proxy_buffering" /etc/nginx/sites-available/ifilm
echo ""

echo "4. Checking cache directory permissions:"
ls -ld /var/cache/nginx/videos
ls -ld /var/cache/nginx/images
echo ""

echo "5. Checking NGINX error log for cache issues (last 20 lines):"
sudo tail -20 /var/log/nginx/error.log | grep -i cache || echo "No cache-related errors found"
echo ""

echo "6. Testing NGINX config:"
sudo nginx -t
echo ""

echo "7. Current cache directory size:"
sudo du -sh /var/cache/nginx/videos
sudo du -sh /var/cache/nginx/images
echo ""

echo "8. Cache zone status (if available):"
# This requires nginx-module-vts or similar, but let's try
echo "Run 'curl -I http://127.0.0.1/api/media/stream/test/master.m3u8' to test"
echo ""

echo "=== To test cache manually ==="
echo "1. Make a request: curl -I http://127.0.0.1/api/media/stream/{id}/master.m3u8"
echo "2. Check response headers for X-Cache-Status"
echo "3. Make same request again - should show HIT"
echo "4. Check cache directory: sudo du -sh /var/cache/nginx/videos"

