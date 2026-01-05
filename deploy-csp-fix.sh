#!/bin/bash
set -e

SERVER="root@167.172.206.254"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "Deploying CSP fix..."

# Upload index.html
cat shadcn-ui/index.html | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/index.html"

# Upload media.controller.ts
cat backend/src/controllers/media.controller.ts | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/backend/src/controllers/media.controller.ts"

echo "Files uploaded. Now rebuilding frontend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pnpm run build"

echo "Rebuilding backend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/backend && npm run build"

echo "Restarting services..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "pm2 restart ifilm-backend && cd $REMOTE_DIR/shadcn-ui && pkill -f 'vite.*preview' || true && sleep 1 && nohup pnpm run preview --host 0.0.0.0 --port 3000 > /tmp/vite-preview.log 2>&1 &"

echo "Deployment complete!"
