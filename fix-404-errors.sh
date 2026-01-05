#!/bin/bash

set -e

echo "🔧 Fixing 404 errors for images and API endpoints..."
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Error: This script must be run as root (use sudo)"
    exit 1
fi

INSTALL_DIR="/opt/ifilm"
cd "$INSTALL_DIR" || { echo "Error: Could not cd to $INSTALL_DIR"; exit 1; }

# Step 1: Verify backend is running
echo "1️⃣ Checking backend status..."
if pm2 list | grep -q "ifilm-backend.*online"; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running. Starting..."
    cd backend
    pm2 start ecosystem.config.js --name ifilm-backend || pm2 restart ifilm-backend
    cd ..
fi

# Step 2: Test backend endpoints
echo ""
echo "2️⃣ Testing backend endpoints..."
BACKEND_HEALTH=$(curl -s http://localhost:5000/health || echo "")
if [[ "$BACKEND_HEALTH" == *"ok"* ]]; then
    echo "✅ Backend health check passed"
else
    echo "❌ Backend health check failed"
    echo "   Check logs: pm2 logs ifilm-backend"
    exit 1
fi

# Test image endpoint
MOVIE_ID=$(curl -s http://localhost:5000/api/media/movies?limit=1 | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4 || echo "")
if [ ! -z "$MOVIE_ID" ]; then
    IMAGE_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/media/images/$MOVIE_ID/Primary)
    if [ "$IMAGE_STATUS" = "200" ]; then
        echo "✅ Image endpoint works on backend"
    else
        echo "⚠️  Image endpoint returned HTTP $IMAGE_STATUS"
        echo "   This might be a Jellyfin configuration issue"
    fi
fi

# Step 3: Setup NGINX
echo ""
echo "3️⃣ Setting up NGINX reverse proxy..."

# Install NGINX if not present
if ! command -v nginx &> /dev/null; then
    echo "Installing NGINX..."
    apt-get update -qq
    apt-get install -y nginx
fi

# Copy NGINX configuration
if [ -f "nginx/ifilm.conf" ]; then
    echo "Installing NGINX configuration..."
    cp nginx/ifilm.conf /etc/nginx/sites-available/ifilm
    
    # Enable site
    if [ ! -L /etc/nginx/sites-enabled/ifilm ]; then
        ln -s /etc/nginx/sites-available/ifilm /etc/nginx/sites-enabled/
    fi
    
    # Remove default site
    if [ -L /etc/nginx/sites-enabled/default ]; then
        rm /etc/nginx/sites-enabled/default
    fi
    
    # Test and restart NGINX
    if nginx -t; then
        systemctl restart nginx
        systemctl enable nginx
        echo "✅ NGINX configured and started"
    else
        echo "❌ NGINX configuration test failed"
        exit 1
    fi
else
    echo "❌ NGINX config file not found at nginx/ifilm.conf"
    exit 1
fi

# Step 4: Test NGINX proxy
echo ""
echo "4️⃣ Testing NGINX proxy..."
sleep 2  # Give NGINX time to restart
NGINX_HEALTH=$(curl -s http://localhost/api/health || echo "")
if [[ "$NGINX_HEALTH" == *"ok"* ]]; then
    echo "✅ NGINX proxy is working"
else
    echo "⚠️  NGINX proxy test failed"
    echo "   Response: $NGINX_HEALTH"
fi

# Step 5: Check firewall
echo ""
echo "5️⃣ Checking firewall..."
if command -v ufw &> /dev/null; then
    UFW_STATUS=$(ufw status | grep -i "Status: active" || echo "")
    if [ ! -z "$UFW_STATUS" ]; then
        echo "Firewall is active. Ensuring port 80 is open..."
        ufw allow 80/tcp 2>/dev/null || true
        ufw allow 443/tcp 2>/dev/null || true
    fi
fi

# Step 6: Restart services
echo ""
echo "6️⃣ Restarting services..."
pm2 restart ifilm-backend
pm2 restart ifilm-frontend
pm2 save

echo ""
echo "✅ Fix complete!"
echo ""
SERVER_IP=$(hostname -I | awk '{print $1}')
echo "🌐 Access your application:"
echo "   Primary: http://$SERVER_IP (Port 80 via NGINX)"
echo "   Direct: http://$SERVER_IP:3000 (Vite preview)"
echo ""
echo "📝 If images still don't load:"
echo "   1. Check Jellyfin configuration in admin panel"
echo "   2. Verify Jellyfin is accessible from server"
echo "   3. Check backend logs: pm2 logs ifilm-backend"
echo "   4. Test backend directly: curl http://localhost:5000/api/media/movies?limit=1"

