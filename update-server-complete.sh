#!/bin/bash

set -e

echo "🔄 Complete Server Update Script"
echo "=================================="
echo ""

INSTALL_DIR="/opt/ifilm"
cd "$INSTALL_DIR" || { echo "Error: Could not cd to $INSTALL_DIR"; exit 1; }

# Step 1: Pull latest changes
echo "1️⃣ Pulling latest changes from GitHub..."
git pull

# Step 2: Update backend
echo ""
echo "2️⃣ Updating backend..."
cd backend
npm install
npm run build
cd ..

# Step 3: Update frontend
echo ""
echo "3️⃣ Updating frontend..."
cd shadcn-ui
pnpm install
pnpm run build
cd ..

# Step 4: Fix NGINX configuration
echo ""
echo "4️⃣ Updating NGINX configuration..."
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-enabled/ifilm
sudo cp nginx/ifilm.conf /etc/nginx/sites-available/ifilm
sudo ln -s /etc/nginx/sites-available/ifilm /etc/nginx/sites-enabled/ifilm

# Verify root directive
ROOT_DIR=$(sudo grep "^[[:space:]]*root" /etc/nginx/sites-available/ifilm | grep -v "^#" | head -1 | awk '{print $2}' | tr -d ';')
if [ "$ROOT_DIR" != "/opt/ifilm/shadcn-ui/dist" ]; then
    echo "⚠️  Warning: NGINX root is set to: $ROOT_DIR"
    echo "   Expected: /opt/ifilm/shadcn-ui/dist"
    echo "   Checking full config..."
    sudo grep -n "root" /etc/nginx/sites-available/ifilm | head -3
else
    echo "✅ NGINX root is correct: $ROOT_DIR"
fi

# Test NGINX config
echo ""
echo "5️⃣ Testing NGINX configuration..."
if sudo nginx -t; then
    echo "✅ NGINX configuration is valid"
else
    echo "❌ NGINX configuration test failed"
    exit 1
fi

# Step 6: Restart services
echo ""
echo "6️⃣ Restarting services..."
pm2 restart ifilm-backend
pm2 restart ifilm-frontend
sudo systemctl restart nginx

# Step 7: Wait a moment for services to start
sleep 3

# Step 8: Verify services
echo ""
echo "7️⃣ Verifying services..."
pm2 list

# Step 9: Test endpoints
echo ""
echo "8️⃣ Testing endpoints..."
BACKEND_HEALTH=$(curl -s http://localhost:5000/health || echo "")
if [[ "$BACKEND_HEALTH" == *"ok"* ]]; then
    echo "✅ Backend health check passed"
else
    echo "⚠️  Backend health check failed"
fi

NGINX_HEALTH=$(curl -s http://localhost/api/health || echo "")
if [[ "$NGINX_HEALTH" == *"ok"* ]]; then
    echo "✅ NGINX proxy health check passed"
else
    echo "⚠️  NGINX proxy health check failed"
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
    
    STREAM_STATUS=$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:5000/api/media/stream/$MOVIE_ID/master.m3u8" 2>/dev/null || echo "000")
    if [ "$STREAM_STATUS" = "200" ] || [ "$STREAM_STATUS" = "302" ]; then
        echo "✅ Stream endpoint works"
    else
        echo "⚠️  Stream endpoint returned HTTP $STREAM_STATUS"
    fi
fi

echo ""
echo "✅ Update complete!"
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Access your application:"
echo "   http://$SERVER_IP (Port 80 via NGINX)"
echo ""
echo "📝 If you encounter issues:"
echo "   - Check logs: pm2 logs ifilm-backend"
echo "   - Check NGINX: sudo tail -f /var/log/nginx/error.log"
echo "   - Verify NGINX root: sudo nginx -T | grep root"

