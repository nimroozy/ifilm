#!/bin/bash

echo "=== Verifying Which Location Block Matches ==="
echo ""

CONFIG_FILE="/etc/nginx/sites-available/ifilm"
TEST_URL="/api/media/stream/724b048230b301b9d16fc3864d910dd4/master.m3u8"

# Add unique test headers to each location block
echo "1. Adding test headers to location blocks..."

# Add header to stream location
sudo sed -i '/location ^~ \/api\/media\/stream\//a\
        add_header X-Test-Location "stream-location" always;' "$CONFIG_FILE"

# Add header to general /api location  
sudo sed -i '/^[[:space:]]*location \/api {$/a\
        add_header X-Test-Location "general-api-location" always;' "$CONFIG_FILE"

# Test config and reload
if sudo nginx -t && sudo systemctl reload nginx; then
    echo "✅ NGINX reloaded"
else
    echo "❌ NGINX reload failed"
    exit 1
fi

echo ""
echo "2. Making test request..."
RESPONSE=$(curl -sI "http://127.0.0.1${TEST_URL}" 2>&1)

echo ""
echo "3. Response headers:"
echo "$RESPONSE" | head -20

echo ""
echo "4. Checking which location matched:"
if echo "$RESPONSE" | grep -qi "X-Test-Location.*stream-location"; then
    echo "   ✅ Stream location block IS matching!"
elif echo "$RESPONSE" | grep -qi "X-Test-Location.*general-api-location"; then
    echo "   ❌ General /api location is matching instead!"
    echo "   This means the ^~ modifier isn't working as expected"
else
    echo "   ⚠️  No test header found - location block might not be matching at all"
fi

echo ""
echo "5. Checking X-Cache-Status:"
if echo "$RESPONSE" | grep -qi "X-Cache-Status"; then
    echo "   ✅ X-Cache-Status header present:"
    echo "$RESPONSE" | grep -i "X-Cache-Status"
else
    echo "   ❌ X-Cache-Status header MISSING!"
    echo "   This confirms the stream location block isn't matching"
fi

# Remove test headers
echo ""
echo "6. Cleaning up test headers..."
sudo sed -i '/add_header X-Test-Location "stream-location" always;/d' "$CONFIG_FILE"
sudo sed -i '/add_header X-Test-Location "general-api-location" always;/d' "$CONFIG_FILE"

if sudo nginx -t && sudo systemctl reload nginx; then
    echo "✅ Test headers removed"
else
    echo "⚠️  Failed to remove test headers - manual cleanup needed"
fi

echo ""
echo "=== Verification Complete ==="

