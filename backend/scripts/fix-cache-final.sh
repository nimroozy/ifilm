#!/bin/bash

# Final fix - explicitly add proxy_buffering on to stream location block

set -e

NGINX_CONFIG="/etc/nginx/sites-available/ifilm"
TMP_CONFIG=$(mktemp)

echo "🔧 Final cache fix - ensuring proxy_buffering is ON in stream location..."

# Backup
sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.bak.$(date +%s)"

# Copy current config
sudo cp "$NGINX_CONFIG" "$TMP_CONFIG"

# Show current state
echo ""
echo "Current stream location block:"
grep -A 25 "location ~\* \^\/api\/media\/stream" "$TMP_CONFIG" | head -30
echo ""

# Method 1: Replace proxy_buffering off with on in stream block
sed -i '/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
    s/proxy_buffering off;/proxy_buffering on;/g
}' "$TMP_CONFIG"

# Method 2: If proxy_buffering doesn't exist, add it after proxy_request_buffering
if ! grep -A 25 "location ~\* \^\/api\/media\/stream" "$TMP_CONFIG" | grep -q "proxy_buffering"; then
    echo "Adding proxy_buffering on to stream block..."
    sed -i '/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
        /proxy_request_buffering off;/a\
        proxy_buffering on;
    }' "$TMP_CONFIG"
fi

# Verify
echo ""
echo "Updated stream location block (showing proxy_buffering and proxy_cache):"
grep -A 25 "location ~\* \^\/api\/media\/stream" "$TMP_CONFIG" | grep -E "proxy_buffering|proxy_cache|proxy_request"
echo ""

# Copy to actual config
sudo cp "$TMP_CONFIG" "$NGINX_CONFIG"

# Test and reload
echo "🧪 Testing NGINX configuration..."
if sudo nginx -t; then
    echo "✅ Config test passed"
    sudo systemctl reload nginx
    echo "✅ NGINX reloaded"
    echo ""
    echo "✅ Cache configuration fixed!"
else
    echo "❌ Config test failed"
    exit 1
fi

rm -f "$TMP_CONFIG"

