#!/bin/bash

SERVER="root@139.59.212.0"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "🔧 Diagnosing and fixing backend/proxy issues..."
echo ""

# 1. Check if backend is running
echo "Step 1: Checking backend status..."
BACKEND_STATUS=$(sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "pm2 list | grep ifilm-backend | awk '{print \$10}'" 2>/dev/null || echo "notfound")

if [ "$BACKEND_STATUS" != "online" ]; then
    echo "⚠️  Backend is not running. Starting it..."
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && pm2 start dist/server.js --name ifilm-backend || pm2 restart ifilm-backend"
    sleep 3
else
    echo "✅ Backend is running"
fi

# 2. Test backend health endpoint
echo ""
echo "Step 2: Testing backend health endpoint..."
HEALTH=$(sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "curl -s http://localhost:5000/health" 2>/dev/null)
if [ -z "$HEALTH" ] || [[ ! "$HEALTH" == *"ok"* ]]; then
    echo "❌ Backend health check failed"
    echo "Restarting backend..."
    sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && pm2 restart ifilm-backend"
    sleep 5
    HEALTH=$(sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "curl -s http://localhost:5000/health" 2>/dev/null)
    if [ -z "$HEALTH" ] || [[ ! "$HEALTH" == *"ok"* ]]; then
        echo "❌ Backend still not responding. Check logs:"
        sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && pm2 logs ifilm-backend --lines 30 --nostream"
        exit 1
    fi
else
    echo "✅ Backend is healthy"
fi

# 3. Test image endpoint
echo ""
echo "Step 3: Testing image proxy endpoint..."
# Get a movie ID from the API first
MOVIE_ID=$(sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "curl -s http://localhost:5000/api/media/movies?limit=1 | grep -o '\"id\":\"[^\"]*' | head -1 | cut -d'\"' -f4" 2>/dev/null)
if [ ! -z "$MOVIE_ID" ]; then
    echo "Testing with movie ID: $MOVIE_ID"
    IMAGE_TEST=$(sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/media/images/$MOVIE_ID/Primary" 2>/dev/null)
    if [ "$IMAGE_TEST" = "200" ]; then
        echo "✅ Image proxy is working"
    else
        echo "⚠️  Image proxy returned: $IMAGE_TEST"
    fi
else
    echo "⚠️  Could not get movie ID for testing"
fi

# 4. Check backend logs for errors
echo ""
echo "Step 4: Checking backend logs for errors..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && pm2 logs ifilm-backend --lines 20 --nostream | tail -20"

# 5. Verify frontend proxy configuration
echo ""
echo "Step 5: Verifying frontend proxy configuration..."
PROXY_CONFIG=$(sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "grep -A 5 'preview:' $REMOTE_DIR/shadcn-ui/vite.config.ts | grep -A 3 'proxy:'" 2>/dev/null)
if [ -z "$PROXY_CONFIG" ]; then
    echo "⚠️  Proxy configuration not found in vite.config.ts"
else
    echo "✅ Proxy configuration found"
fi

# 6. Restart frontend to ensure proxy is active
echo ""
echo "Step 6: Restarting frontend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "pm2 restart ifilm-frontend || (cd $REMOTE_DIR/shadcn-ui && pm2 start 'pnpm run preview --host 0.0.0.0 --port 3000' --name ifilm-frontend)"

echo ""
echo "✅ Diagnostic complete!"
echo ""
echo "📝 Next steps:"
echo "1. Test: http://139.59.212.0:3000/api/media/movies?limit=1"
echo "2. Check backend logs: pm2 logs ifilm-backend"
echo "3. Check frontend logs: pm2 logs ifilm-frontend"
echo "4. Verify Jellyfin is configured in admin panel"

