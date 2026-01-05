#!/bin/bash

echo "=== Final Cache Fix ==="
echo ""

CONFIG_FILE="/etc/nginx/sites-available/ifilm"

# Ensure proxy_buffering is on and add proxy_max_temp_file_size
echo "1. Ensuring proxy_buffering is on and adding proxy_max_temp_file_size..."
sudo sed -i '/location ^~ \/api\/media\/stream\//,/^[[:space:]]*}/ {
    /proxy_buffering on;/! {
        /proxy_buffering off;/s/proxy_buffering off;/proxy_buffering on;/
        /proxy_buffering/! {
            /proxy_request_buffering off;/a\
        proxy_buffering on;
        }
    }
    /proxy_max_temp_file_size/! {
        /proxy_hide_header "ETag";/a\
        proxy_max_temp_file_size 0;
    }
}' "$CONFIG_FILE"

# Verify changes
echo ""
echo "2. Verifying stream location block:"
grep -A 5 "proxy_buffering\|proxy_max_temp_file_size" "$CONFIG_FILE" | grep -A 5 "location ^~ /api/media/stream" | head -10
echo ""

# Test config
echo "3. Testing NGINX configuration..."
if sudo nginx -t; then
    echo "✅ Config test passed"
    sudo systemctl reload nginx
    echo "✅ NGINX reloaded"
else
    echo "❌ Config test failed"
    exit 1
fi

echo ""
echo "=== Fix Complete ==="
