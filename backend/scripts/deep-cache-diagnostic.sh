#!/bin/bash

echo "=== Deep Cache Diagnostic ==="
echo ""

CONFIG_FILE="/etc/nginx/sites-available/ifilm"
MOVIE_ID="${1:-724b048230b301b9d16fc3864d910dd4}"

echo "1. Checking stream location block configuration:"
echo "--- Full location block ---"
sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' "$CONFIG_FILE"
echo ""

echo "2. Checking if proxy_cache is enabled:"
if grep -q "proxy_cache videos_cache;" "$CONFIG_FILE"; then
    echo "   ✅ proxy_cache is enabled"
else
    echo "   ❌ proxy_cache is NOT enabled!"
fi
echo ""

echo "3. Checking proxy_buffering:"
BUFFERING=$(grep -A 30 "location ^~ /api/media/stream" "$CONFIG_FILE" | grep "proxy_buffering" | head -1)
echo "   $BUFFERING"
if echo "$BUFFERING" | grep -q "proxy_buffering on"; then
    echo "   ✅ proxy_buffering is on"
else
    echo "   ❌ proxy_buffering is NOT on!"
fi
echo ""

echo "4. Checking cache zone in nginx.conf:"
sudo nginx -T 2>/dev/null | grep -A 2 "videos_cache" | head -3
echo ""

echo "5. Making a request and checking NGINX internal state:"
# Clear access log
sudo truncate -s 0 /var/log/nginx/access.log 2>/dev/null || true

# Make request
curl -sI "http://127.0.0.1/api/media/stream/${MOVIE_ID}/master.m3u8" > /dev/null

# Check access log
echo "   Access log entry:"
sudo tail -1 /var/log/nginx/access.log 2>/dev/null || echo "   No log entry"
echo ""

echo "6. Checking cache directory structure:"
echo "   Cache directory: /var/cache/nginx/videos"
ls -la /var/cache/nginx/videos/ 2>/dev/null | head -10 || echo "   Directory empty or doesn't exist"
echo ""

echo "7. Checking cache directory permissions:"
ls -ld /var/cache/nginx/videos 2>/dev/null
echo ""

echo "8. Testing if www-data can write to cache:"
sudo -u www-data touch /var/cache/nginx/videos/test-write.txt 2>&1
if [ -f /var/cache/nginx/videos/test-write.txt ]; then
    echo "   ✅ www-data can write to cache"
    sudo rm -f /var/cache/nginx/videos/test-write.txt
else
    echo "   ❌ www-data CANNOT write to cache!"
    echo "   This is likely the problem!"
fi
echo ""

echo "9. Checking NGINX process user:"
ps aux | grep "nginx: worker" | head -1 | awk '{print "   User: " $1}'
echo ""

echo "10. Full NGINX config test output:"
sudo nginx -T 2>&1 | grep -A 5 "location ^~ /api/media/stream" | head -20
echo ""

echo "=== Diagnostic Complete ==="

