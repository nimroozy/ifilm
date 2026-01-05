#!/bin/bash

# Fix Server File Structure
# Removes duplicate files and ensures correct structure

SERVER_IP="167.172.206.254"
SERVER_USER="root"
SERVER_PASS="Jamshed@00Haroon"

echo "🔧 Fixing server file structure..."

sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
    set -e
    cd /opt/ifilm/backend
    
    echo "📁 Checking current structure..."
    echo "Files in src/ root:"
    ls -1 src/*.ts src/*.routes.ts 2>/dev/null | head -10 || echo "No duplicate files found"
    
    echo ""
    echo "🗑️  Removing duplicate files from src/ root..."
    rm -f src/admin.controller.ts
    rm -f src/admin.routes.ts
    rm -f src/media.controller.ts
    rm -f src/media.routes.ts
    rm -f src/jellyfin.service.ts
    rm -f src/jellyfin-libraries.service.ts
    rm -f src/auth.controller.ts
    rm -f src/auth.routes.ts
    rm -f src/favorites.controller.ts
    rm -f src/favorites.routes.ts
    rm -f src/user.controller.ts
    rm -f src/user.routes.ts
    rm -f src/watch-history.controller.ts
    rm -f src/watch-history.routes.ts
    
    echo "✅ Duplicate files removed"
    
    echo ""
    echo "📋 Verifying correct file locations..."
    echo "Controllers:"
    ls -1 src/controllers/*.ts 2>/dev/null | wc -l
    echo "Services:"
    ls -1 src/services/*.ts 2>/dev/null | wc -l
    echo "Routes:"
    ls -1 src/routes/*.ts 2>/dev/null | wc -l
    
    echo ""
    echo "🔨 Building TypeScript..."
    npm run build
    
    if [ $? -eq 0 ]; then
        echo "✅ Build successful!"
        echo ""
        echo "🔄 Restarting PM2 service..."
        pm2 restart ifilm-backend || pm2 start ecosystem.config.js
        pm2 save
        echo ""
        echo "📊 PM2 Status:"
        pm2 status
    else
        echo "❌ Build failed. Check errors above."
        exit 1
    fi
ENDSSH

echo ""
echo "✅ Server structure fixed and backend restarted!"

