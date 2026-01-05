#!/bin/bash

# iFilm Deployment Script
# This script deploys the iFilm application to a remote server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_IP="167.172.206.254"
SERVER_USER="root"
SERVER_PASS="Jamshed@00Haroon"
REMOTE_DIR="/opt/ifilm"
PROJECT_NAME="ifilm-project.tar_v11"

echo -e "${GREEN}🚀 Starting iFilm Deployment${NC}"
echo "=================================="

# Check if SSH is available
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}⚠️  sshpass not found. Installing...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install hudochenkov/sshpass/sshpass
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y sshpass
    fi
fi

# Create deployment package
echo -e "${GREEN}📦 Creating deployment package...${NC}"
cd "$(dirname "$0")"
tar -czf /tmp/ifilm-deploy.tar.gz \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='*.log' \
    --exclude='.env' \
    --exclude='shadcn-ui/dist' \
    --exclude='shadcn-ui/node_modules' \
    --exclude='backend/node_modules' \
    --exclude='backend/dist' \
    .

# Upload to server
echo -e "${GREEN}📤 Uploading to server...${NC}"
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no /tmp/ifilm-deploy.tar.gz ${SERVER_USER}@${SERVER_IP}:/tmp/

# Execute remote setup
echo -e "${GREEN}🔧 Setting up on server...${NC}"
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
    set -e
    
    # Create directory
    mkdir -p /opt/ifilm
    cd /opt/ifilm
    
    # Extract files
    tar -xzf /tmp/ifilm-deploy.tar.gz -C /opt/ifilm --strip-components=1
    
    # Run setup script
    chmod +x setup-server.sh
    ./setup-server.sh
    
    # Cleanup
    rm /tmp/ifilm-deploy.tar.gz
    
    echo "✅ Deployment completed successfully!"
ENDSSH

# Cleanup local temp file
rm /tmp/ifilm-deploy.tar.gz

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. SSH into server: ssh root@${SERVER_IP}"
echo "2. Configure environment variables in /opt/ifilm/backend/.env"
echo "3. Configure frontend API URL in /opt/ifilm/shadcn-ui/.env"
echo "4. Run database migrations"
echo "5. Start services with PM2: pm2 start ecosystem.config.js"
echo "6. Configure Nginx and restart: sudo systemctl restart nginx"

