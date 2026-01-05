#!/bin/bash

SERVER="root@139.59.212.0"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "🔧 Fixing proxy and backend issues..."

# Check backend status
echo "Checking backend status..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && pm2 list | grep ifilm-backend || echo 'Backend not running'"

# Check if backend is accessible
echo ""
echo "Testing backend health endpoint..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "curl -s http://localhost:5000/health || echo 'Backend not responding'"

# Restart backend if needed
echo ""
echo "Restarting backend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && pm2 restart ifilm-backend || pm2 start dist/server.js --name ifilm-backend"

# Check backend logs
echo ""
echo "Backend logs (last 20 lines):"
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && pm2 logs ifilm-backend --lines 20 --nostream"

echo ""
echo "✅ Fix complete. Please test the application."

