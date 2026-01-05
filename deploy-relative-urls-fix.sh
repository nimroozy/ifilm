#!/bin/bash
set -e

SERVER="root@167.172.206.254"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "🚀 Deploying relative URLs fix..."

echo ""
echo "Step 1: Uploading fixed source files..."

# Upload fixed API service
cat shadcn-ui/src/services/api.ts | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/services/api.ts"

# Upload fixed URL sanitizer
cat shadcn-ui/src/utils/urlSanitizer.ts | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/src/utils/urlSanitizer.ts"

# Upload fixed .env file
echo "VITE_API_URL=/api" | sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $REMOTE_DIR/shadcn-ui/.env"

echo ""
echo "Step 2: Building frontend locally (to avoid server memory issues)..."

# Ensure pnpm is available
NPM_PREFIX=$(npm config get prefix 2>/dev/null || echo "$HOME/.npm-global")
export PATH="$PATH:$NPM_PREFIX/bin"

if ! command -v pnpm &> /dev/null; then
    echo "pnpm not found. Installing pnpm via npm..."
    npm install -g pnpm@8.10.0
    export PATH="$PATH:$NPM_PREFIX/bin"
fi

# Build locally
cd shadcn-ui

# Clean dist first
rm -rf dist

# Install dependencies
echo "Installing dependencies..."
if [ -f "pnpm-lock.yaml" ]; then
    echo "Y" | pnpm install --frozen-lockfile || exit 1
else
    echo "Y" | pnpm install || exit 1
fi

# Build
echo "Building frontend..."
if ! pnpm run build; then
    echo "Build failed! Please check for errors."
    exit 1
fi

# Verify no absolute URLs in build
echo ""
echo "Verifying build contains no absolute URLs..."
if grep -r "http://167.172.206.254" dist/ 2>/dev/null; then
    echo "❌ ERROR: Build still contains absolute URLs!"
    exit 1
fi
if grep -r "http://localhost:5000" dist/ 2>/dev/null; then
    echo "❌ ERROR: Build still contains localhost URLs!"
    exit 1
fi
echo "✅ Build verified - no absolute URLs found"

cd ..

echo ""
echo "Step 3: Uploading built files to server..."

# Ensure dist directory exists on server
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR/shadcn-ui/dist"

# Upload dist folder contents
sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -r shadcn-ui/dist/* "$SERVER:$REMOTE_DIR/shadcn-ui/dist/"

echo ""
echo "Step 4: Restarting frontend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pkill -f 'vite.*preview' || true && sleep 2 && nohup pnpm run preview --host 0.0.0.0 --port 3000 > /tmp/vite-preview.log 2>&1 &"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Verification steps:"
echo "1. Open browser DevTools Network tab"
echo "2. Visit https://ifilm.af"
echo "3. Verify ALL API calls use '/api/...' (relative URLs)"
echo "4. Verify NO requests to 'http://167.172.206.254:5000'"
echo "5. Check console for any mixed-content errors"
echo ""
echo "Test endpoint: https://ifilm.af/api/media/movies?limit=1"

