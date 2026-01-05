#!/bin/bash

echo "=== Comparing Image vs Stream Location Blocks ==="
echo ""

CONFIG_FILE="/etc/nginx/sites-available/ifilm"

echo "1. Image location block:"
echo "---"
sed -n '/location ^~ \/api\/media\/images\//,/^[[:space:]]*}/p' "$CONFIG_FILE" | grep -E "(proxy_cache|proxy_buffering|proxy_cache_valid|proxy_cache_methods|proxy_ignore_headers|proxy_max_temp_file_size)"
echo ""

echo "2. Stream location block:"
echo "---"
sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' "$CONFIG_FILE" | grep -E "(proxy_cache|proxy_buffering|proxy_cache_valid|proxy_cache_methods|proxy_ignore_headers|proxy_max_temp_file_size)"
echo ""

echo "3. Checking for differences in proxy_pass:"
echo "--- Image:"
sed -n '/location ^~ \/api\/media\/images\//,/^[[:space:]]*}/p' "$CONFIG_FILE" | grep "proxy_pass"
echo "--- Stream:"
sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' "$CONFIG_FILE" | grep "proxy_pass"
echo ""

echo "4. Checking if stream location has proxy_cache enabled:"
if grep -A 50 "location ^~ /api/media/stream" "$CONFIG_FILE" | grep -q "proxy_cache videos_cache;"; then
    echo "   ✅ proxy_cache is enabled"
else
    echo "   ❌ proxy_cache is NOT enabled!"
fi
echo ""

echo "5. Testing image cache (should work):"
curl -sI "http://127.0.0.1/api/media/images/test/Primary" 2>&1 | grep -E "(HTTP|X-Cache-Status)" | head -2
echo ""

echo "6. Testing stream cache (not working):"
curl -sI "http://127.0.0.1/api/media/stream/724b048230b301b9d16fc3864d910dd4/master.m3u8" 2>&1 | grep -E "(HTTP|X-Cache-Status)" | head -2
echo ""

echo "=== Comparison Complete ==="
