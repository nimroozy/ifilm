#!/bin/bash
set -e

SERVER="root@167.172.206.254"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "Deploying pagination fix..."

# Upload Movies.tsx
cat shadcn-ui/src/pages/Movies.tsx | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/pages/Movies.tsx"

echo "File uploaded. Now rebuilding..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pnpm run build"

echo "Restarting frontend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pkill -f 'vite.*preview' || true && sleep 1 && nohup pnpm run preview --host 0.0.0.0 --port 3000 > /tmp/vite-preview.log 2>&1 &"

echo "Deployment complete!"
