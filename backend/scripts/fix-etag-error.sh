#!/bin/bash

CONFIG_FILE="/etc/nginx/sites-available/ifilm"

echo "=== Fixing ETag Error in NGINX Config ==="
echo ""

# Remove ETag from proxy_ignore_headers in both image and stream locations
echo "1. Removing ETag from proxy_ignore_headers..."
sudo sed -i 's/proxy_ignore_headers "Cache-Control" "Set-Cookie" "Vary" "Expires" "ETag";/proxy_ignore_headers "Cache-Control" "Set-Cookie" "Vary" "Expires";/g' "$CONFIG_FILE"

# Copy to sites-enabled
echo "2. Copying to sites-enabled..."
sudo cp "$CONFIG_FILE" /etc/nginx/sites-enabled/ifilm

echo "3. Testing NGINX configuration..."
if sudo nginx -t; then
    echo "   ✅ Config test passed"
    sudo systemctl restart nginx
    echo "   ✅ NGINX restarted"
else
    echo "   ❌ Config test failed"
    sudo nginx -t 2>&1 | grep -i error
    exit 1
fi

echo ""
echo "✅ ETag error fixed!"
