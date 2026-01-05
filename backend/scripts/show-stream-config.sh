#!/bin/bash

# Show the actual stream location block configuration

echo "=== Stream Location Block Configuration ==="
echo ""

echo "Full stream location block:"
sudo grep -A 30 "location ~\* \^\/api\/media\/stream" /etc/nginx/sites-available/ifilm
echo ""

echo "=== Checking for proxy_buffering ==="
sudo grep -A 30 "location ~\* \^\/api\/media\/stream" /etc/nginx/sites-available/ifilm | grep -E "proxy_buffering|proxy_cache"
echo ""

echo "=== Checking general /api location block ==="
sudo grep -A 15 "^[[:space:]]*location /api" /etc/nginx/sites-available/ifilm | grep -E "proxy_buffering|proxy_cache"
echo ""

echo "=== Location block order ==="
sudo grep -n "location" /etc/nginx/sites-available/ifilm | grep -E "api|stream|images"
echo ""

echo "=== Testing which location matches ==="
echo "Making a test request and checking access log..."
curl -sI "http://127.0.0.1/api/media/stream/test/master.m3u8" > /dev/null 2>&1
echo "Check access log: sudo tail -1 /var/log/nginx/access.log"

