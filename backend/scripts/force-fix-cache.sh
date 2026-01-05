#!/bin/bash

# Force fix script to ensure cache works - fixes proxy_buffering issue

set -e

NGINX_CONFIG="/etc/nginx/sites-available/ifilm"
TMP_CONFIG=$(mktemp)

echo "🔧 Force fixing NGINX cache configuration..."

# Backup
sudo cp "$NGINX_CONFIG" "${NGINX_CONFIG}.bak.$(date +%s)"

# Copy current config
sudo cp "$NGINX_CONFIG" "$TMP_CONFIG"

echo ""
echo "📋 Current proxy_buffering settings:"
grep -n "proxy_buffering" "$TMP_CONFIG"
echo ""

# Fix stream location block - ensure proxy_buffering is ON
echo "🔧 Fixing stream location block..."
sed -i '/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
    # Change any proxy_buffering off to on
    s|proxy_buffering off;|proxy_buffering on;|
    # If proxy_buffering line doesn't exist, add it after proxy_request_buffering
    /proxy_request_buffering off;/a\
        proxy_buffering on;
    # Remove any duplicate proxy_buffering lines (keep only the last one)
}' "$TMP_CONFIG"

# Remove duplicate proxy_buffering lines in stream block (keep only the last occurrence)
# This is a bit tricky - we'll use awk or a more complex sed
awk '
/location ~\* \^\/api\/media\/stream\// { in_stream=1; }
/^[[:space:]]*}/ && in_stream { in_stream=0; }
in_stream && /proxy_buffering/ { 
    if (found_buffering) { next; }  # Skip duplicates
    found_buffering=1;
}
in_stream && !/proxy_buffering/ { found_buffering=0; }  # Reset when we see other directives
{ print; }
' "$TMP_CONFIG" > "${TMP_CONFIG}.tmp" && mv "${TMP_CONFIG}.tmp" "$TMP_CONFIG"

# Ensure proxy_buffering on exists in stream block
if ! grep -A 20 "location ~\* \^\/api\/media\/stream" "$TMP_CONFIG" | grep -q "proxy_buffering on"; then
    echo "   Adding proxy_buffering on to stream block..."
    sed -i '/location ~\* \^\/api\/media\/stream\//,/^[[:space:]]*}/ {
        /proxy_request_buffering off;/a\
        proxy_buffering on;
    }' "$TMP_CONFIG"
fi

# Verify
echo ""
echo "📋 Updated proxy_buffering settings:"
grep -A 20 "location ~\* \^\/api\/media\/stream" "$TMP_CONFIG" | grep -E "proxy_buffering|proxy_cache" | head -5
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
    echo "✅ Cache configuration force-fixed!"
    echo ""
    echo "Now test again:"
    echo "  sudo bash backend/scripts/test-cache-simple.sh YOUR_MOVIE_ID"
else
    echo "❌ Config test failed"
    echo "Restoring backup..."
    sudo cp "${NGINX_CONFIG}.bak"* "$NGINX_CONFIG" 2>/dev/null || true
    exit 1
fi

rm -f "$TMP_CONFIG"

