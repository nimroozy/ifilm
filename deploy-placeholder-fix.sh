#!/bin/bash
set -e

SERVER="root@167.172.206.254"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "Deploying placeholder image fix..."

# Upload updated urlSanitizer.ts
cat shadcn-ui/src/utils/urlSanitizer.ts | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/utils/urlSanitizer.ts"

# Upload updated page components
cat shadcn-ui/src/pages/Home.tsx | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/pages/Home.tsx"
cat shadcn-ui/src/pages/Movies.tsx | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/pages/Movies.tsx"
cat shadcn-ui/src/pages/Series.tsx | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/pages/Series.tsx"
cat shadcn-ui/src/pages/Search.tsx | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/pages/Search.tsx"

# Upload old files too (for consistency)
cat shadcn-ui/src/Movies.tsx | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/Movies.tsx"
cat shadcn-ui/src/Series.tsx | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/Series.tsx"
cat shadcn-ui/src/Search.tsx | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/Search.tsx"

echo "Files uploaded. Rebuilding frontend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pnpm run build"

echo "Restarting frontend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pkill -f 'vite.*preview' || true && sleep 1 && nohup pnpm run preview --host 0.0.0.0 --port 3000 > /tmp/vite-preview.log 2>&1 &"

echo "Deployment complete! Please clear browser cache and test."
echo "The placeholder images should now use a local SVG data URI instead of via.placeholder.com"

