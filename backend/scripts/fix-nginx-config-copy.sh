#!/bin/bash

echo "=== Fixing NGINX Config Copy Issue ==="
echo ""

# Backup old config
if [ -f /etc/nginx/sites-enabled/ifilm ]; then
    sudo cp /etc/nginx/sites-enabled/ifilm /etc/nginx/sites-enabled/ifilm.backup.$(date +%s)
fi

# Copy the correct config from sites-available
echo "1. Copying updated config to sites-enabled..."
sudo cp /etc/nginx/sites-available/ifilm /etc/nginx/sites-enabled/ifilm

echo "2. Verifying stream location has proxy_buffering on..."
if grep -A 30 "location ^~ /api/media/stream" /etc/nginx/sites-enabled/ifilm | grep -q "proxy_buffering on"; then
    echo "   ✅ proxy_buffering is on"
else
    echo "   ❌ proxy_buffering is NOT on!"
    exit 1
fi

echo ""
echo "3. Verifying proxy_cache is enabled..."
if grep -A 5 "location ^~ /api/media/stream" /etc/nginx/sites-enabled/ifilm | grep -q "^[[:space:]]*proxy_cache videos_cache;"; then
    echo "   ✅ proxy_cache is enabled"
else
    echo "   ❌ proxy_cache is NOT enabled!"
    exit 1
fi

echo ""
echo "4. Testing NGINX configuration..."
if sudo nginx -t; then
    echo "   ✅ Config test passed"
    sudo systemctl restart nginx
    echo "   ✅ NGINX restarted"
else
    echo "   ❌ Config test failed"
    exit 1
fi

echo ""
echo "✅ NGINX config fixed!"
echo ""
echo "5. Verifying NGINX sees the stream location..."
if sudo nginx -T 2>/dev/null | grep -q "location ^~ /api/media/stream"; then
    echo "   ✅ NGINX sees the stream location block"
else
    echo "   ❌ NGINX does NOT see the stream location block"
fi

echo ""
echo "=== Fix Complete ==="
