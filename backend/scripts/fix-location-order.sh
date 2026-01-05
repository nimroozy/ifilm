#!/bin/bash

echo "=== Fixing NGINX Location Block Order ==="
echo ""

CONFIG_FILE="/etc/nginx/sites-available/ifilm"

# Check current order
echo "1. Current location block order:"
grep -n "location" "$CONFIG_FILE" | grep -E "(/api|/api/media)"
echo ""

# The issue: NGINX might be matching /api before ^~ /api/media/stream/
# Solution: Ensure ^~ locations come first AND are more specific

# Check if stream location is actually being used
echo "2. Testing location matching..."
echo "   Making request to: /api/media/stream/test/master.m3u8"
RESPONSE=$(curl -sI "http://127.0.0.1/api/media/stream/test/master.m3u8" 2>&1 | head -5)
echo "$RESPONSE"
echo ""

# Check NGINX error log for location matching info
echo "3. Checking NGINX error log (last 5 lines):"
sudo tail -5 /var/log/nginx/error.log 2>/dev/null || echo "   No recent errors"
echo ""

echo "4. Verifying location block syntax..."
# Check if there are any syntax issues
sudo nginx -t 2>&1 | grep -E "(location|error)" || echo "   Syntax OK"
echo ""

echo "5. Full location block order in config:"
grep -n "^[[:space:]]*location" "$CONFIG_FILE"
echo ""

echo "✅ Diagnostic complete"
