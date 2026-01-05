#!/bin/bash

SERVER="${1:-root@139.59.212.0}"
PASS="${2:-}"

echo "🔍 Diagnosing 404 errors..."
echo ""

# Function to run SSH command
run_ssh() {
    if [ -z "$PASS" ]; then
        ssh -o StrictHostKeyChecking=no "$SERVER" "$@"
    else
        sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$@"
    fi
}

# Check 1: PM2 Status
echo "1️⃣ Checking PM2 services..."
PM2_STATUS=$(run_ssh "pm2 list")
echo "$PM2_STATUS"
echo ""

# Check 2: Backend health
echo "2️⃣ Testing backend health endpoint..."
BACKEND_HEALTH=$(run_ssh "curl -s http://localhost:5000/health")
echo "Response: $BACKEND_HEALTH"
if [[ "$BACKEND_HEALTH" == *"ok"* ]]; then
    echo "✅ Backend is responding"
else
    echo "❌ Backend is NOT responding"
fi
echo ""

# Check 3: Test image endpoint directly
echo "3️⃣ Testing image endpoint on backend..."
MOVIE_ID=$(run_ssh "curl -s http://localhost:5000/api/media/movies?limit=1 | grep -o '\"id\":\"[^\"]*' | head -1 | cut -d'\"' -f4")
if [ ! -z "$MOVIE_ID" ]; then
    echo "Found movie ID: $MOVIE_ID"
    IMAGE_TEST=$(run_ssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/media/images/$MOVIE_ID/Primary")
    echo "Image endpoint HTTP status: $IMAGE_TEST"
    if [ "$IMAGE_TEST" = "200" ]; then
        echo "✅ Image endpoint works on backend"
    else
        echo "❌ Image endpoint returns $IMAGE_TEST"
    fi
else
    echo "⚠️  Could not get movie ID to test"
fi
echo ""

# Check 4: Test frontend proxy
echo "4️⃣ Testing frontend proxy..."
PROXY_TEST=$(run_ssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health")
echo "Frontend proxy HTTP status: $PROXY_TEST"
if [ "$PROXY_TEST" = "200" ]; then
    echo "✅ Frontend proxy is working"
else
    echo "❌ Frontend proxy returns $PROXY_TEST"
    echo "   This means Vite preview proxy is not forwarding /api requests"
fi
echo ""

# Check 5: Backend logs (last 20 lines)
echo "5️⃣ Recent backend logs..."
run_ssh "pm2 logs ifilm-backend --lines 20 --nostream"
echo ""

# Check 6: Port listening
echo "6️⃣ Checking ports..."
run_ssh "netstat -tuln | grep -E ':(3000|5000)' || ss -tuln | grep -E ':(3000|5000)'"
echo ""

# Check 7: NGINX status (if installed)
echo "7️⃣ Checking NGINX status..."
NGINX_STATUS=$(run_ssh "systemctl is-active nginx 2>/dev/null || echo 'not-installed'")
if [ "$NGINX_STATUS" != "not-installed" ]; then
    echo "NGINX status: $NGINX_STATUS"
    if [ "$NGINX_STATUS" = "active" ]; then
        echo "✅ NGINX is running"
        # Test NGINX proxy
        NGINX_TEST=$(run_ssh "curl -s -o /dev/null -w '%{http_code}' http://localhost/api/health")
        echo "NGINX proxy HTTP status: $NGINX_TEST"
    else
        echo "⚠️  NGINX is not running"
    fi
else
    echo "ℹ️  NGINX is not installed"
fi
echo ""

echo "📋 Summary:"
echo "==========="
echo "If backend health works but image endpoint doesn't:"
echo "  → Check Jellyfin configuration in admin panel"
echo ""
echo "If backend works but frontend proxy doesn't:"
echo "  → Vite preview proxy issue - use NGINX instead"
echo ""
echo "If backend doesn't respond:"
echo "  → Check PM2 logs: pm2 logs ifilm-backend"
echo "  → Restart backend: pm2 restart ifilm-backend"

