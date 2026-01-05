#!/bin/bash
# Update script for test-ui branch

set -e

echo "🔄 Updating iFilm to test-ui branch..."
echo "=================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root: sudo bash update-test-ui.sh"
    exit 1
fi

cd /opt/ifilm

# Pull latest changes from test-ui branch
echo "1️⃣ Pulling latest changes from test-ui branch..."
git fetch origin
git checkout test-ui
git pull origin test-ui

# Update backend
echo ""
echo "2️⃣ Updating backend..."
cd backend
npm install
npm run build

# Run migrations (if any new ones exist)
echo ""
echo "3️⃣ Running database migrations..."
npm run migrate || echo "No new migrations or migration already applied"

# Update frontend
echo ""
echo "4️⃣ Updating frontend..."
cd ../shadcn-ui
pnpm install
pnpm run build

# Restart PM2 processes
echo ""
echo "5️⃣ Restarting services..."
cd /opt/ifilm
pm2 restart all

# Update NGINX cache config (if needed)
echo ""
echo "6️⃣ Updating NGINX cache configuration..."
/opt/ifilm/backend/scripts/update-nginx-cache.sh 2>/dev/null || echo "Cache config update skipped"
systemctl reload nginx 2>/dev/null || echo "NGINX reload skipped"

echo ""
echo "✅ Update complete!"
echo ""
echo "📝 Changes:"
echo "   - Audio track selection for movies and series"
echo "   - Backend returns audio track information"
echo "   - Frontend UI for selecting audio tracks"
echo ""
echo "🌐 Access your site: http://$(hostname -I | awk '{print $1}')"
