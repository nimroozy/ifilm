#!/bin/bash

echo "=== Comprehensive NGINX Cache Diagnostic ==="
echo ""

CONFIG_FILE="/etc/nginx/sites-available/ifilm"

echo "1. Checking which location blocks exist:"
grep -n "location" "$CONFIG_FILE" | grep -E "(/api|/api/media)"
echo ""

echo "2. Checking stream location block:"
grep -A 30 "location ^~ /api/media/stream" "$CONFIG_FILE" | head -35
echo ""

echo "3. Checking if proxy_cache is enabled in stream location:"
grep -A 30 "location ^~ /api/media/stream" "$CONFIG_FILE" | grep "proxy_cache"
echo ""

echo "4. Checking proxy_buffering in stream location:"
grep -A 30 "location ^~ /api/media/stream" "$CONFIG_FILE" | grep "proxy_buffering"
echo ""

echo "5. Checking cache zone definition:"
sudo nginx -T 2>/dev/null | grep -A 2 "videos_cache" | head -5
echo ""

echo "6. Making test request and checking headers:"
RESPONSE=$(curl -sI "http://127.0.0.1/api/media/stream/724b048230b301b9d16fc3864d910dd4/master.m3u8" 2>&1)
echo "$RESPONSE" | head -20
echo ""

echo "7. Checking NGINX access log (last entry):"
sudo tail -1 /var/log/nginx/access.log 2>/dev/null || echo "No access log entry"
echo ""

echo "8. Checking NGINX error log for cache-related messages:"
sudo grep -i "cache" /var/log/nginx/error.log 2>/dev/null | tail -5 || echo "No cache errors"
echo ""

echo "9. Verifying cache directory permissions:"
ls -ld /var/cache/nginx/videos 2>/dev/null || echo "Cache directory doesn't exist"
echo ""

echo "10. Checking if cache directory is writable:"
sudo touch /var/cache/nginx/videos/test.txt 2>&1 && sudo rm -f /var/cache/nginx/videos/test.txt && echo "✅ Writable" || echo "❌ Not writable"
echo ""

echo "=== Diagnostic Complete ==="

