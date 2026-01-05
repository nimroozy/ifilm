#!/bin/bash
set -e

SERVER="root@167.172.206.254"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "Deploying frontend fixes..."

# Upload files using sshpass and base64 encoding
for file in shadcn-ui/src/utils/urlSanitizer.ts shadcn-ui/src/pages/Home.tsx shadcn-ui/src/pages/Movies.tsx shadcn-ui/src/pages/Series.tsx shadcn-ui/src/pages/Search.tsx shadcn-ui/src/pages/Watch.tsx shadcn-ui/src/pages/WatchSeries.tsx shadcn-ui/vite.config.ts; do
  echo "Uploading $file..."
  sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR/\$(dirname $file)" < /dev/null
  cat "$file" | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/$file"
done

echo "Files uploaded. Now rebuilding..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pnpm run build"

echo "Deployment complete!"
