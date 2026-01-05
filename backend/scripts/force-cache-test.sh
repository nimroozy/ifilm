#!/bin/bash

echo "=== Force Cache Test ==="
echo ""

CONFIG_FILE="/etc/nginx/sites-available/ifilm"

echo "1. Checking actual NGINX config (not file, but what NGINX sees):"
sudo nginx -T 2>/dev/null | grep -A 30 "location ^~ /api/media/stream" | grep -E "(proxy_cache|proxy_buffering|proxy_cache_valid|proxy_cache_methods)" | head -10
echo ""

echo "2. Verifying cache zone is loaded:"
sudo nginx -T 2>/dev/null | grep "videos_cache" | head -3
echo ""

echo "3. Testing with a simple static file cache (to verify cache works at all):"
# Create a test location that caches a simple response
TEST_CONFIG=$(mktemp)
sudo cp "$CONFIG_FILE" "$TEST_CONFIG"

# Add a test location that should definitely cache
sudo sed -i '/server {/a\
    # Test cache location\
    location /test-cache {\
        proxy_cache videos_cache;\
        proxy_cache_valid 200 1h;\
        proxy_buffering on;\
        proxy_pass http://127.0.0.1:5000/health;\
        add_header X-Cache-Status $upstream_cache_status;\
    }' "$TEST_CONFIG"

if sudo nginx -t -c "$TEST_CONFIG" 2>/dev/null; then
    echo "   Test config is valid"
    # Test it
    curl -sI "http://127.0.0.1/test-cache" | grep X-Cache-Status
    curl -sI "http://127.0.0.1/test-cache" | grep X-Cache-Status
else
    echo "   Test config failed"
fi

rm -f "$TEST_CONFIG"
echo ""

echo "4. Checking if there are any proxy_cache_bypass directives:"
grep -r "proxy_cache_bypass" /etc/nginx/sites-available/ifilm || echo "   None found"
echo ""

echo "5. Full stream location block from NGINX -T:"
sudo nginx -T 2>/dev/null | sed -n '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/p' | head -50
echo ""

echo "=== Test Complete ==="
