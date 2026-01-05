#!/bin/bash
set -e

SERVER="root@167.172.206.254"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "Deploying backend CSP fix..."

# Upload server.ts
cat backend/src/server.ts | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/backend/src/server.ts"

echo "File uploaded. Now rebuilding..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && npm run build"

echo "Restarting backend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "pm2 restart ifilm-backend"

echo "Deployment complete!"
