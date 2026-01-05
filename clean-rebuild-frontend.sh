#!/bin/bash
set -e

echo "🧹 Cleaning frontend build artifacts..."

cd shadcn-ui

# Remove build artifacts
echo "Removing dist/ directory..."
rm -rf dist

# Remove node_modules (optional - uncomment if you want a completely clean install)
# echo "Removing node_modules/ directory..."
# rm -rf node_modules

# Ensure pnpm is available
NPM_PREFIX=$(npm config get prefix 2>/dev/null || echo "$HOME/.npm-global")
export PATH="$PATH:$NPM_PREFIX/bin"

if ! command -v pnpm &> /dev/null; then
    echo "pnpm not found. Installing pnpm via npm..."
    npm install -g pnpm@8.10.0
    export PATH="$PATH:$NPM_PREFIX/bin"
fi

# Install dependencies
echo "📦 Installing dependencies..."
if [ -f "pnpm-lock.yaml" ]; then
    echo "Y" | pnpm install --frozen-lockfile || exit 1
else
    echo "Y" | pnpm install || exit 1
fi

# Build
echo "🔨 Building frontend..."
pnpm run build || exit 1

echo ""
echo "✅ Clean rebuild complete!"
echo "The frontend has been rebuilt with relative API URLs only."
echo ""
echo "Verification:"
echo "- Check that dist/assets/*.js files do NOT contain 'http://167.172.206.254'"
echo "- Check that dist/assets/*.js files use '/api' for API calls"

