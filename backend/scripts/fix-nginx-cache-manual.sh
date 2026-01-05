#!/bin/bash

# Manual fix script to ensure cache directives are properly enabled

set -e

NGINX_CONFIG="/etc/nginx/sites-available/ifilm"
TMP_CONFIG=$(mktemp)

echo "🔧 Fixing NGINX cache configuration..."

# Backup current config
sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.bak.$(date +%s)"

# Copy current config
sudo cp "$NGINX_CONFIG" "$TMP_CONFIG"

# Enable cache directives for stream location block
# Use a more reliable method - replace the entire commented block
sed -i '/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
    # Uncomment cache directives
    s|^[[:space:]]*# proxy_cache videos_cache;|        proxy_cache videos_cache;|
    s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|
    s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|
    s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|
    s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|
    s|^[[:space:]]*# proxy_cache_lock|        proxy_cache_lock|
    s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|
    # Ensure buffering is on
    s|proxy_buffering off;|proxy_buffering on;|
}' "$TMP_CONFIG"

# Enable cache directives for images location block
sed -i '/location ~\* \^\/api\/media\/images\//,/^[[:space:]]*}/ {
    s|^[[:space:]]*# proxy_cache images_cache;|        proxy_cache images_cache;|
    s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|
    s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|
    s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|
    s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|
    s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|
}' "$TMP_CONFIG"

# Also ensure proxy_buffering is ON in stream location (critical for caching)
sed -i '/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
    s|proxy_buffering off;|proxy_buffering on;|
    /proxy_buffering on;/! {
        /proxy_request_buffering off;/a\
        proxy_buffering on;
    }
}' "$TMP_CONFIG"

# Verify changes
echo ""
echo "📋 Verifying cache directives are enabled:"
echo "--- Stream location:"
grep -A 15 "location ~\* \^\/api\/media\/stream" "$TMP_CONFIG" | grep -E "proxy_cache|proxy_buffering" | head -8

echo ""
echo "--- Images location:"
grep -A 10 "location ~\* \^\/api\/media\/images" "$TMP_CONFIG" | grep -E "proxy_cache|proxy_buffering" | head -5

# Copy to actual config first
sudo cp "$TMP_CONFIG" "$NGINX_CONFIG"

# Test config
echo ""
echo "🧪 Testing NGINX configuration..."
if sudo nginx -t; then
    echo "✅ Config test passed"
    
    # Reload NGINX
    if sudo systemctl reload nginx; then
        echo "✅ NGINX reloaded successfully"
    else
        echo "❌ Failed to reload NGINX"
        exit 1
    fi
else
    echo "❌ Config test failed"
    echo "Restoring original config..."
    sudo cp "${NGINX_CONFIG}.bak" "$NGINX_CONFIG" 2>/dev/null || echo "No backup found"
    exit 1
fi

rm -f "$TMP_CONFIG"
echo ""
echo "✅ Cache configuration fixed!"

