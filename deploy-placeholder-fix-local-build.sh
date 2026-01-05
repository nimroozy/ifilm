#!/bin/bash
set -e

SERVER="root@167.172.206.254"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "Building frontend locally (to avoid server memory issues)..."

# Build locally
cd shadcn-ui
pnpm run build
cd ..

echo "Uploading built files to server..."

# Upload the dist folder
cd shadcn-ui/dist
tar czf /tmp/frontend-dist.tar.gz .
cd ../..

# Upload dist files
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR/shadcn-ui/dist"
sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -r shadcn-ui/dist/* "$SERVER:$REMOTE_DIR/shadcn-ui/dist/"

# Clean up local temp file
rm -f /tmp/frontend-dist.tar.gz

echo "Restarting frontend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pkill -f 'vite.*preview' || true && sleep 1 && nohup pnpm run preview --host 0.0.0.0 --port 3000 > /tmp/vite-preview.log 2>&1 &"

echo "Deployment complete! The frontend has been built locally and uploaded to the server."
echo "Please clear browser cache and test."

