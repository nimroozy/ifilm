#!/bin/bash

# Test which location block NGINX is actually using

MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"

echo "=== Testing NGINX Location Block Matching ==="
echo ""

# Add a test header to stream location to verify it's being used
echo "1. Adding test header to stream location block..."
sudo sed -i '/location ^~ \/api\/media\/stream\//a\
        add_header X-Location-Matched "stream-location" always;' /etc/nginx/sites-available/ifilm

sudo nginx -t && sudo systemctl reload nginx
echo ""

echo "2. Making test request..."
RESPONSE=$(curl -sI "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" 2>&1)

echo "3. Checking which location block matched:"
if echo "$RESPONSE" | grep -qi "X-Location-Matched"; then
    echo "   ✅ Stream location block IS matching!"
    echo "$RESPONSE" | grep -i "X-Location-Matched"
else
    echo "   ❌ Stream location block is NOT matching!"
    echo "   NGINX is using a different location block"
    echo ""
    echo "   Full response headers:"
    echo "$RESPONSE" | head -15
fi
echo ""

echo "4. Checking X-Cache-Status:"
echo "$RESPONSE" | grep -i "X-Cache-Status" || echo "   Not found"
echo ""

# Remove test header
sudo sed -i '/add_header X-Location-Matched "stream-location" always;/d' /etc/nginx/sites-available/ifilm
sudo nginx -t && sudo systemctl reload nginx

