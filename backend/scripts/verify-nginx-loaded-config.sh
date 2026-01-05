#!/bin/bash

echo "=== Verifying What NGINX Actually Loaded ==="
echo ""

echo "1. Checking if stream location exists in NGINX config:"
if sudo nginx -T 2>/dev/null | grep -q "location ^~ /api/media/stream"; then
    echo "   ✅ Stream location block exists"
else
    echo "   ❌ Stream location block NOT found!"
    exit 1
fi
echo ""

echo "2. Full stream location block from NGINX -T (what NGINX actually sees):"
sudo nginx -T 2>/dev/null | sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p'
echo ""

echo "3. Checking if proxy_cache is enabled in loaded config:"
if sudo nginx -T 2>/dev/null | sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' | grep -q "^[[:space:]]*proxy_cache videos_cache;"; then
    echo "   ✅ proxy_cache is enabled in loaded config"
else
    echo "   ❌ proxy_cache is NOT enabled in loaded config!"
    echo "   This means NGINX reload didn't pick up the changes"
fi
echo ""

echo "=== Verification Complete ==="
