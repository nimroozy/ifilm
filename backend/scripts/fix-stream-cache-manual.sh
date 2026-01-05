#!/bin/bash

CONFIG_FILE="/etc/nginx/sites-available/ifilm"

echo "=== Manually Enabling Stream Cache Directives ==="
echo ""

# Backup
sudo cp "$CONFIG_FILE" "${CONFIG_FILE}.bak.$(date +%s)"

# Use a more reliable method - use sed with line numbers
echo "1. Finding stream location block..."
START_LINE=$(grep -n "location ^~ /api/media/stream/" "$CONFIG_FILE" | cut -d: -f1)
END_LINE=$(awk "NR>$START_LINE && /^[[:space:]]*}/ {print NR; exit}" "$CONFIG_FILE")

if [ -z "$START_LINE" ] || [ -z "$END_LINE" ]; then
    echo "❌ Could not find stream location block"
    exit 1
fi

echo "   Stream location block: lines $START_LINE to $END_LINE"
echo ""

# Uncomment cache directives using sed with line range
echo "2. Uncommenting cache directives..."
sudo sed -i "${START_LINE},${END_LINE}s|^[[:space:]]*# proxy_cache videos_cache;|        proxy_cache videos_cache;|" "$CONFIG_FILE"
sudo sed -i "${START_LINE},${END_LINE}s|^[[:space:]]*# proxy_cache_valid 200|        proxy_cache_valid 200|" "$CONFIG_FILE"
sudo sed -i "${START_LINE},${END_LINE}s|^[[:space:]]*# proxy_cache_valid 404|        proxy_cache_valid 404|" "$CONFIG_FILE"
sudo sed -i "${START_LINE},${END_LINE}s|^[[:space:]]*# proxy_cache_use_stale|        proxy_cache_use_stale|" "$CONFIG_FILE"
sudo sed -i "${START_LINE},${END_LINE}s|^[[:space:]]*# proxy_cache_background_update|        proxy_cache_background_update|" "$CONFIG_FILE"
sudo sed -i "${START_LINE},${END_LINE}s|^[[:space:]]*# proxy_cache_lock|        proxy_cache_lock|" "$CONFIG_FILE"
sudo sed -i "${START_LINE},${END_LINE}s|^[[:space:]]*# add_header X-Cache-Status|        add_header X-Cache-Status|" "$CONFIG_FILE"

echo "3. Verifying changes..."
if grep -A 2 "location ^~ /api/media/stream" "$CONFIG_FILE" | grep -q "^[[:space:]]*proxy_cache videos_cache;"; then
    echo "   ✅ proxy_cache is now enabled"
else
    echo "   ❌ proxy_cache is still not enabled"
    echo "   Showing first few lines of location block:"
    sed -n "${START_LINE},$((START_LINE+10))p" "$CONFIG_FILE"
    exit 1
fi

echo ""
echo "4. Testing NGINX configuration..."
if sudo nginx -t; then
    echo "   ✅ Config test passed"
    sudo systemctl reload nginx
    echo "   ✅ NGINX reloaded"
else
    echo "   ❌ Config test failed"
    exit 1
fi

echo ""
echo "✅ Stream cache directives enabled!"
