#!/bin/bash

set -e

SERVER="${1:-root@139.59.212.0}"
REMOTE_DIR="/opt/ifilm"

echo "🔄 Updating server to latest version..."
echo "Server: $SERVER"
echo ""

# Check if server is provided
if [ -z "$1" ]; then
    echo "Usage: ./update-server.sh <server>"
    echo "Example: ./update-server.sh root@139.59.212.0"
    exit 1
fi

# Pull latest changes
echo "Step 1: Pulling latest changes from GitHub..."
ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR && git pull origin main"

# Update backend
echo ""
echo "Step 2: Updating backend..."
ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && npm install && npm run build"

# Clean up duplicate files
echo ""
echo "Step 3: Cleaning up duplicate files..."
ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && rm -f src/admin.controller.ts src/admin.routes.ts src/jellyfin.service.ts src/jellyfin-libraries.service.ts src/media.controller.ts 2>/dev/null || true"

# Restart backend
echo ""
echo "Step 4: Restarting backend..."
ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && pm2 restart ifilm-backend || pm2 start dist/server.js --name ifilm-backend"

# Update frontend
echo ""
echo "Step 5: Updating frontend..."
ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pnpm install && pnpm run build"

# Restart frontend
echo ""
echo "Step 6: Restarting frontend..."
ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pm2 restart ifilm-frontend || pm2 start 'pnpm run preview --host 0.0.0.0 --port 3000' --name ifilm-frontend"

# Check status
echo ""
echo "Step 7: Checking service status..."
ssh -o StrictHostKeyChecking=no "$SERVER" "pm2 list"

echo ""
echo "✅ Update complete!"
echo ""
echo "📊 Service Status:"
ssh -o StrictHostKeyChecking=no "$SERVER" "pm2 list"
echo ""
echo "📝 Check logs if needed:"
echo "  pm2 logs ifilm-backend"
echo "  pm2 logs ifilm-frontend"

