#!/bin/bash

SERVER="${1:-root@139.59.212.0}"
PASS="${2:-}"

echo "🧪 Testing iFilm endpoints..."
echo ""

# Function to run SSH command
run_ssh() {
    if [ -z "$PASS" ]; then
        ssh -o StrictHostKeyChecking=no "$SERVER" "$@"
    else
        sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$@"
    fi
}

# Test 1: Backend health
echo "Test 1: Backend Health Check"
HEALTH=$(run_ssh "curl -s http://localhost:5000/health")
if [[ "$HEALTH" == *"ok"* ]]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
fi
echo ""

# Test 2: Movies endpoint
echo "Test 2: Movies API"
MOVIES=$(run_ssh "curl -s http://localhost:5000/api/media/movies?limit=1")
if [[ "$MOVIES" == *"items"* ]] || [[ "$MOVIES" == *"id"* ]]; then
    echo "✅ Movies endpoint is working"
    # Extract first movie ID
    MOVIE_ID=$(echo "$MOVIES" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    if [ ! -z "$MOVIE_ID" ]; then
        echo "   Found movie ID: $MOVIE_ID"
    fi
else
    echo "❌ Movies endpoint failed"
    echo "   Response: $MOVIES"
fi
echo ""

# Test 3: Image endpoint (if we have a movie ID)
if [ ! -z "$MOVIE_ID" ]; then
    echo "Test 3: Image Proxy"
    IMAGE_STATUS=$(run_ssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:5000/api/media/images/$MOVIE_ID/Primary")
    if [ "$IMAGE_STATUS" = "200" ]; then
        echo "✅ Image proxy is working (HTTP $IMAGE_STATUS)"
    else
        echo "⚠️  Image proxy returned HTTP $IMAGE_STATUS"
    fi
    echo ""
fi

# Test 4: Frontend accessibility
echo "Test 4: Frontend Accessibility"
FRONTEND_STATUS=$(run_ssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/")
if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ Frontend is accessible (HTTP $FRONTEND_STATUS)"
else
    echo "⚠️  Frontend returned HTTP $FRONTEND_STATUS"
fi
echo ""

# Test 5: Frontend API proxy
echo "Test 5: Frontend API Proxy"
PROXY_STATUS=$(run_ssh "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health")
if [ "$PROXY_STATUS" = "200" ]; then
    echo "✅ Frontend proxy is working (HTTP $PROXY_STATUS)"
else
    echo "⚠️  Frontend proxy returned HTTP $PROXY_STATUS"
    echo "   Note: Vite preview proxy may have limitations. Consider using NGINX."
fi
echo ""

echo "📊 PM2 Status:"
run_ssh "pm2 list"
echo ""
echo "✅ Testing complete!"
echo ""
echo "🌐 Access your application:"
echo "   Frontend: http://139.59.212.0:3000"
echo "   Backend API: http://139.59.212.0:5000/api"
echo ""
echo "📝 If images/videos still don't work:"
echo "   1. Check backend logs: pm2 logs ifilm-backend"
echo "   2. Verify Jellyfin is configured in admin panel"
echo "   3. Consider setting up NGINX reverse proxy (see TROUBLESHOOTING.md)"

