#!/bin/bash

# Debug script to check which NGINX location block is matching

echo "=== NGINX Location Block Debugging ==="
echo ""

# Check location block order
echo "1. Location blocks in order (first match wins):"
sudo grep -n "location" /etc/nginx/sites-available/ifilm | grep -E "location.*api|location.*stream|location.*images"
echo ""

# Test with a sample request
echo "2. Testing which location block matches /api/media/stream/test:"
echo "   (This will show in NGINX access log)"
echo ""

# Add a test request to see which location matches
# We can't directly test this, but we can check the config

echo "3. Checking location block specificity:"
echo ""
echo "   Regex locations (evaluated in order, first match wins):"
sudo grep -B 2 -A 2 "location ~\*" /etc/nginx/sites-available/ifilm | grep -E "location|proxy_pass" | head -10
echo ""
echo "   Prefix locations (evaluated after regex):"
sudo grep -B 2 -A 2 "^[[:space:]]*location /api" /etc/nginx/sites-available/ifilm | head -10
echo ""

echo "4. Important: Regex locations are evaluated BEFORE prefix locations"
echo "   So 'location ~* ^/api/media/stream/' should match before 'location /api'"
echo ""

echo "5. To verify which location is used, check NGINX access log:"
echo "   sudo tail -f /var/log/nginx/access.log"
echo "   Then make a request and see the log entry"
echo ""

echo "6. Checking if cache key might be the issue:"
echo "   Cache keys are based on: proxy_cache_key (default: \$scheme\$proxy_host\$request_uri)"
echo "   If requests have different query params, they won't cache together"
echo ""

# Check for cache bypass conditions
echo "7. Checking for cache bypass conditions:"
sudo grep -E "proxy_cache_bypass|proxy_no_cache" /etc/nginx/sites-available/ifilm || echo "   No explicit bypass conditions found"
echo ""

echo "8. Testing actual request (replace {id} with real movie ID):"
echo "   curl -v http://127.0.0.1/api/media/stream/{id}/master.m3u8 2>&1 | grep -E 'X-Cache|HTTP/'"
echo ""

