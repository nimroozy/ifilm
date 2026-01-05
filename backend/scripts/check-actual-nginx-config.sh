#!/bin/bash

echo "=== Checking What NGINX Actually Sees ==="
echo ""

echo "1. Image location from NGINX -T:"
sudo nginx -T 2>/dev/null | sed -n '/location ^~ \/api\/media\/images\//,/^[[:space:]]*}/p' | grep -E "(proxy_cache|proxy_buffering)" | head -5
echo ""

echo "2. Stream location from NGINX -T:"
sudo nginx -T 2>/dev/null | sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' | grep -E "(proxy_cache|proxy_buffering)" | head -10
echo ""

echo "3. Full stream location block (first 40 lines):"
sudo nginx -T 2>/dev/null | sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' | head -40
echo ""

echo "4. Checking if proxy_cache is actually enabled in stream:"
STREAM_CACHE=$(sudo nginx -T 2>/dev/null | sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' | grep "^[[:space:]]*proxy_cache videos_cache;")
if [ -n "$STREAM_CACHE" ]; then
    echo "   ✅ proxy_cache is ENABLED (not commented)"
    echo "   $STREAM_CACHE"
else
    echo "   ❌ proxy_cache is NOT enabled (commented out or missing)"
    echo "   Checking for commented version:"
    sudo nginx -T 2>/dev/null | sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' | grep "proxy_cache"
fi
echo ""

echo "=== Check Complete ==="
