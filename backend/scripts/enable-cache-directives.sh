#!/bin/bash

# Enable cache directives in the updated config (with ^~ prefix locations)

set -e

NGINX_CONFIG="/etc/nginx/sites-available/ifilm"
TMP_CONFIG=$(mktemp)

echo "🔧 Enabling cache directives in stream and image location blocks..."

# Backup
sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.bak.$(date +%s)"

# Copy current config
sudo cp "$NGINX_CONFIG" "$TMP_CONFIG"

# Enable cache directives for stream location (now using ^~ prefix)
sed -i '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/ {
    s|^[[:space:]]*# proxy_cache videos_cache;|        proxy_cache videos_cache;|
    s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|
    s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|
    s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|
    s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|
    s|^[[:space:]]*# proxy_cache_lock|        proxy_cache_lock|
    s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|
    # Ensure proxy_buffering is on
    s|proxy_buffering off;|proxy_buffering on;|
    /proxy_buffering on;/! {
        /proxy_request_buffering off;/a\
        proxy_buffering on;
    }
}' "$TMP_CONFIG"

# Enable cache directives for images location
sed -i '/location ^~ \/api\/media\/images\//,/^[[:space:]]*}/ {
    s|^[[:space:]]*# proxy_cache images_cache;|        proxy_cache images_cache;|
    s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|
    s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|
    s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|
    s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|
    s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|
}' "$TMP_CONFIG"

# Verify
echo ""
echo "📋 Verifying cache directives are enabled:"
echo "--- Stream location:"
grep -A 20 "location ^~ /api/media/stream" "$TMP_CONFIG" | grep -E "proxy_cache|proxy_buffering" | head -8
echo ""
echo "--- Images location:"
grep -A 15 "location ^~ /api/media/images" "$TMP_CONFIG" | grep -E "proxy_cache|proxy_buffering" | head -5

# Copy to actual config
sudo cp "$TMP_CONFIG" "$NGINX_CONFIG"

# Test and reload
echo ""
echo "🧪 Testing NGINX configuration..."
if sudo nginx -t; then
    echo "✅ Config test passed"
    sudo systemctl reload nginx
    echo "✅ NGINX reloaded"
    echo ""
    echo "✅ Cache directives enabled!"
else
    echo "❌ Config test failed"
    exit 1
fi

rm -f "$TMP_CONFIG"

