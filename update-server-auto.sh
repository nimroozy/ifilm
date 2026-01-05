#!/bin/bash

set -e

SERVER="${1:-root@139.59.212.0}"
PASS="${2:-}"
REMOTE_DIR="/opt/ifilm"

echo "🔄 Updating server to latest version..."
echo "Server: $SERVER"
echo ""

# Function to run SSH command
run_ssh() {
    if [ -z "$PASS" ]; then
        ssh -o StrictHostKeyChecking=no "$SERVER" "$@"
    else
        sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$@"
    fi
}

# Pull latest changes
echo "Step 1: Pulling latest changes from GitHub..."
run_ssh "cd $REMOTE_DIR && git pull origin main"

# Update backend
echo ""
echo "Step 2: Updating backend..."
run_ssh "cd $REMOTE_DIR/backend && npm install && npm run build"

# Clean up duplicate files
echo ""
echo "Step 3: Cleaning up duplicate files..."
run_ssh "cd $REMOTE_DIR/backend && rm -f src/admin.controller.ts src/admin.routes.ts src/jellyfin.service.ts src/jellyfin-libraries.service.ts src/media.controller.ts 2>/dev/null || true"

# Restart backend
echo ""
echo "Step 4: Restarting backend..."
run_ssh "cd $REMOTE_DIR/backend && pm2 restart ifilm-backend || pm2 start dist/server.js --name ifilm-backend"

# Update frontend
echo ""
echo "Step 5: Updating frontend..."
run_ssh "cd $REMOTE_DIR/shadcn-ui && pnpm install && pnpm run build"

# Restart frontend
echo ""
echo "Step 6: Restarting frontend..."
run_ssh "cd $REMOTE_DIR/shadcn-ui && pm2 restart ifilm-frontend || pm2 start 'pnpm run preview --host 0.0.0.0 --port 3000' --name ifilm-frontend"

# Check status
echo ""
echo "Step 7: Checking service status..."
run_ssh "pm2 list"

# Test backend
echo ""
echo "Step 8: Testing backend health..."
HEALTH=$(run_ssh "curl -s http://localhost:5000/health" 2>/dev/null || echo "")
if [[ "$HEALTH" == *"ok"* ]]; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend health check failed. Check logs: pm2 logs ifilm-backend"
fi

echo ""
echo "✅ Update complete!"
echo ""
echo "📊 Service Status:"
run_ssh "pm2 list"
echo ""
echo "📝 Useful commands:"
echo "  pm2 logs ifilm-backend    # View backend logs"
echo "  pm2 logs ifilm-frontend   # View frontend logs"
echo "  pm2 restart all           # Restart all services"

