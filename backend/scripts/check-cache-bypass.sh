#!/bin/bash

CONFIG_FILE="/etc/nginx/sites-available/ifilm"

echo "=== Checking for Cache Bypass Issues ==="
echo ""

echo "1. Checking for proxy_cache_bypass in stream location:"
grep -A 60 "location ^~ /api/media/stream" "$CONFIG_FILE" | grep -E "(proxy_cache_bypass|proxy_no_cache)" || echo "   None found"
echo ""

echo "2. Full stream location block (checking for any bypass conditions):"
sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' "$CONFIG_FILE" | grep -v "^[[:space:]]*#" | grep -v "^[[:space:]]*$"
echo ""

echo "3. Checking NGINX error log for cache-related errors:"
sudo tail -20 /var/log/nginx/error.log 2>/dev/null | grep -i cache || echo "   No cache errors"
echo ""

echo "4. Testing with verbose curl to see all headers:"
curl -v "http://127.0.0.1/api/media/stream/724b048230b301b9d16fc3864d910dd4/master.m3u8" 2>&1 | grep -E "(< HTTP|< X-Cache|< Cache-Control|< ETag)" | head -10
echo ""

echo "5. Checking if response has any headers that might prevent caching:"
RESPONSE=$(curl -sI "http://127.0.0.1/api/media/stream/724b048230b301b9d16fc3864d910dd4/master.m3u8")
echo "$RESPONSE" | grep -E "(Cache-Control|ETag|Vary|Set-Cookie|Pragma|Expires)"
echo ""

echo "=== Check Complete ==="
