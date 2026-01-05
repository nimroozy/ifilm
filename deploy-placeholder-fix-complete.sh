#!/bin/bash
set -e

SERVER="root@167.172.206.254"
PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "Step 1: Uploading source files to server..."

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

echo "Installing dependencies (this may take a few minutes)..."
# Use --frozen-lockfile to ensure consistency, but fallback to regular install if lockfile is missing
# Pipe 'Y' to handle interactive prompts non-interactively
if [ -f "pnpm-lock.yaml" ]; then
    echo "Y" | pnpm install --frozen-lockfile || exit 1
else
    echo "No lockfile found, installing dependencies..."
    echo "Y" | pnpm install || exit 1
fi

echo "Building frontend..."
if ! pnpm run build; then
    echo "Build failed! Please check for errors."
    exit 1
fi

cd ..

echo "Step 3: Uploading built files to server..."

# Ensure dist directory exists on server
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "mkdir -p $REMOTE_DIR/shadcn-ui/dist"

# Upload dist folder contents
sshpass -p "$PASS" scp -o StrictHostKeyChecking=no -r shadcn-ui/dist/* "$SERVER:$REMOTE_DIR/shadcn-ui/dist/"

echo "Step 4: Restarting frontend..."
sshpass -p "$PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_DIR/shadcn-ui && pkill -f 'vite.*preview' || true && sleep 2 && nohup pnpm run preview --host 0.0.0.0 --port 3000 > /tmp/vite-preview.log 2>&1 &"

echo ""
echo "✅ Deployment complete!"
echo "The frontend has been built locally and uploaded to the server."
echo "Please clear browser cache and test at http://167.172.206.254:3000"
echo ""
echo "The placeholder images should now use a local SVG data URI instead of via.placeholder.com"

