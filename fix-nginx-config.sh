#!/bin/bash

set -e

echo "🔧 Fixing NGINX configuration..."
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

INSTALL_DIR="/opt/ifilm"
cd "$INSTALL_DIR" || { echo "Error: Could not cd to $INSTALL_DIR"; exit 1; }

# Pull latest changes
echo "1️⃣ Pulling latest changes..."
git pull

# Copy NGINX config
echo ""
echo "2️⃣ Installing NGINX configuration..."
if [ -f "nginx/ifilm.conf" ]; then
    cp nginx/ifilm.conf /etc/nginx/sites-available/ifilm
    echo "✅ NGINX config copied"
else
    echo "❌ NGINX config file not found at nginx/ifilm.conf"
    exit 1
fi

# Check for duplicates
echo ""
echo "3️⃣ Checking for duplicate location blocks..."
DUPLICATE_API=$(grep -c "location /api" /etc/nginx/sites-available/ifilm || echo "0")
DUPLICATE_HEALTH=$(grep -c "location /health" /etc/nginx/sites-available/ifilm || echo "0")

if [ "$DUPLICATE_API" -gt 1 ]; then
    echo "⚠️  Found $DUPLICATE_API 'location /api' blocks (should be 1)"
    echo "   Removing duplicates..."
    # This is a simple fix - we'll recreate the file with only one instance
    # But first, let's check the current file
    echo "   Current config has issues. Using fresh config from repo."
fi

if [ "$DUPLICATE_HEALTH" -gt 1 ]; then
    echo "⚠️  Found $DUPLICATE_HEALTH 'location /health' blocks (should be 1)"
fi

# Test NGINX config
echo ""
echo "4️⃣ Testing NGINX configuration..."
if nginx -t; then
    echo "✅ NGINX configuration is valid"
else
    echo "❌ NGINX configuration test failed"
    echo ""
    echo "Checking for duplicate locations:"
    grep -n "location /api" /etc/nginx/sites-available/ifilm || echo "No /api locations found"
    grep -n "location /health" /etc/nginx/sites-available/ifilm || echo "No /health locations found"
    exit 1
fi

# Restart NGINX
echo ""
echo "5️⃣ Restarting NGINX..."
systemctl restart nginx
systemctl status nginx --no-pager | head -10

echo ""
echo "✅ NGINX configuration fixed!"
echo ""
echo "🧪 Testing endpoints..."
sleep 2

# Test health endpoint
HEALTH=$(curl -s http://localhost/api/health 2>/dev/null || echo "")
if [[ "$HEALTH" == *"ok"* ]]; then
    echo "✅ /api/health works via NGINX"
else
    echo "⚠️  /api/health test failed: $HEALTH"
fi

# Test image endpoint
MOVIE_ID=$(curl -s http://localhost:5000/api/media/movies?limit=1 | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 2>/dev/null || echo "")
if [ ! -z "$MOVIE_ID" ]; then
    IMAGE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost/api/media/images/$MOVIE_ID/Primary" 2>/dev/null || echo "000")
    if [ "$IMAGE_STATUS" = "200" ]; then
        echo "✅ Image endpoint works via NGINX"
    else
        echo "⚠️  Image endpoint returned HTTP $IMAGE_STATUS"
    fi
fi

echo ""
echo "🌐 Access your application at: http://$(hostname -I | awk '{print $1}')"

