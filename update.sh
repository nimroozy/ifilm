#!/bin/bash

# One-Click Update Script for iFilm
# This script updates everything to the latest version from GitHub

set -e

echo "🔄 iFilm One-Click Update"
echo "=========================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root: sudo bash update.sh"
    exit 1
fi

cd /opt/ifilm

# Pull latest changes
echo "1️⃣ Pulling latest changes from GitHub..."
git pull

# Update backend
echo ""
echo "2️⃣ Updating backend..."
cd backend
npm install
npm run build
npm run migrate

# Update frontend
echo ""
echo "3️⃣ Updating frontend..."
cd ../shadcn-ui
pnpm install
pnpm run build

# Update NGINX cache config
echo ""
echo "4️⃣ Updating NGINX cache configuration..."
cd /opt/ifilm
/opt/ifilm/backend/scripts/update-nginx-cache.sh 2>/dev/null || echo "⚠️  Cache config update skipped"

# Restart services
echo ""
echo "5️⃣ Restarting services..."
pm2 restart all
systemctl reload nginx

echo ""
echo "✅ Update complete!"
echo ""
echo "🌐 Your site is now updated: http://$(hostname -I | awk '{print $1}')"

