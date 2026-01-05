#!/bin/bash

# Deploy URL Fix to Production Server
# This script deploys the relative URL fixes to the production server

set -e

SERVER_IP="167.172.206.254"
SERVER_USER="root"
SERVER_PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"

echo "🚀 Deploying URL fixes to server..."

# Files to deploy
FILES=(
  "backend/src/controllers/media.controller.ts"
  "backend/src/services/jellyfin.service.ts"
  "backend/src/routes/media.routes.ts"
)

# Copy files using sshpass
for file in "${FILES[@]}"; do
  echo "📤 Uploading $file..."
  sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no "$file" ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/$file || {
    echo "❌ Failed to upload $file"
    echo "Please upload manually or check SSH access"
    exit 1
  }
done

echo "✅ Files uploaded successfully!"

# Execute remote commands to rebuild and restart
echo "🔨 Building backend on server..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
    set -e
    cd /opt/ifilm/backend
    
    echo "Removing duplicate files in src/ root..."
    rm -f src/media.controller.ts src/media.routes.ts src/jellyfin.service.ts src/jellyfin-libraries.service.ts 2>/dev/null || true
    
    echo "Installing dependencies if needed..."
    npm install
    
    echo "Building TypeScript..."
    npm run build
    
    echo "Restarting PM2 service..."
    pm2 restart ifilm-backend || pm2 start ecosystem.config.js
    
    echo "✅ Deployment completed!"
    echo "Checking PM2 status..."
    pm2 status
ENDSSH

echo ""
echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Verification:"
echo "Run this command to verify relative URLs:"
echo "curl http://167.172.206.254:5000/api/media/movies?limit=1 | grep -o '\"posterUrl\":\"[^\"]*\"'"
echo ""
echo "Expected: posterUrl should start with /api/media/images/ (relative path)"

