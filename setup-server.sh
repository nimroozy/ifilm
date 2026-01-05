#!/bin/bash

# Server Setup Script for iFilm
# This script sets up the server environment for iFilm

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Setting up iFilm server environment...${NC}"
echo "=============================================="

# Update system
echo -e "${YELLOW}📦 Updating system packages...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

# Install Node.js 18.x
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Node.js 18...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    echo -e "${GREEN}✅ Node.js already installed: $(node --version)${NC}"
fi

# Install pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}📦 Installing pnpm...${NC}"
    npm install -g pnpm@8.10.0
else
    echo -e "${GREEN}✅ pnpm already installed: $(pnpm --version)${NC}"
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PM2...${NC}"
    npm install -g pm2
    pm2 startup systemd -u root --hp /root
else
    echo -e "${GREEN}✅ PM2 already installed${NC}"
fi

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}📦 Installing PostgreSQL...${NC}"
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
else
    echo -e "${GREEN}✅ PostgreSQL already installed${NC}"
fi

# Install Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Redis...${NC}"
    apt-get install -y redis-server
    systemctl start redis-server
    systemctl enable redis-server
else
    echo -e "${GREEN}✅ Redis already installed${NC}"
fi

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Nginx...${NC}"
    apt-get install -y nginx
    systemctl start nginx
    systemctl enable nginx
else
    echo -e "${GREEN}✅ Nginx already installed${NC}"
fi

# Install build tools
echo -e "${YELLOW}📦 Installing build tools...${NC}"
apt-get install -y build-essential python3

# Create log directory
echo -e "${YELLOW}📁 Creating log directory...${NC}"
mkdir -p /var/log/ifilm
chmod 755 /var/log/ifilm

# Setup PostgreSQL database
echo -e "${YELLOW}🗄️  Setting up PostgreSQL database...${NC}"
sudo -u postgres psql << EOF
-- Create database if not exists
SELECT 'CREATE DATABASE ifilm'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ifilm')\gexec

-- Create user if not exists (optional)
-- CREATE USER ifilm_user WITH PASSWORD 'your_secure_password';
-- GRANT ALL PRIVILEGES ON DATABASE ifilm TO ifilm_user;
EOF

# Install backend dependencies
echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd /opt/ifilm/backend
npm install

# Build backend
echo -e "${YELLOW}🔨 Building backend...${NC}"
npm run build

# Install frontend dependencies
echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd /opt/ifilm/shadcn-ui
pnpm install

# Build frontend
echo -e "${YELLOW}🔨 Building frontend...${NC}"
pnpm run build

# Setup environment files if they don't exist
if [ ! -f /opt/ifilm/backend/.env ]; then
    echo -e "${YELLOW}📝 Creating backend .env file...${NC}"
    cp /opt/ifilm/backend/.env.example /opt/ifilm/backend/.env
    echo -e "${RED}⚠️  IMPORTANT: Edit /opt/ifilm/backend/.env with your configuration!${NC}"
fi

if [ ! -f /opt/ifilm/shadcn-ui/.env ]; then
    echo -e "${YELLOW}📝 Creating frontend .env file...${NC}"
    cp /opt/ifilm/shadcn-ui/.env.example /opt/ifilm/shadcn-ui/.env
    echo -e "${RED}⚠️  IMPORTANT: Edit /opt/ifilm/shadcn-ui/.env with your API URL!${NC}"
fi

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
cd /opt/ifilm/backend
for migration in migrations/*.sql; do
    echo "Running migration: $(basename $migration)"
    sudo -u postgres psql -d ifilm -f "$migration" || echo "Migration may have already been applied"
done

# Setup Nginx configuration
echo -e "${YELLOW}🌐 Setting up Nginx...${NC}"
if [ -f /opt/ifilm/nginx-ifilm.conf ]; then
    cp /opt/ifilm/nginx-ifilm.conf /etc/nginx/sites-available/ifilm
    if [ ! -L /etc/nginx/sites-enabled/ifilm ]; then
        ln -s /etc/nginx/sites-available/ifilm /etc/nginx/sites-enabled/
    fi
    # Remove default nginx site
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && systemctl reload nginx || echo -e "${YELLOW}⚠️  Nginx configuration needs manual review${NC}"
fi

echo -e "${GREEN}✅ Server setup completed!${NC}"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Edit /opt/ifilm/backend/.env with your configuration"
echo "2. Edit /opt/ifilm/shadcn-ui/.env with your API URL"
echo "3. Edit /etc/nginx/sites-available/ifilm and update server_name"
echo "4. Generate secure secrets:"
echo "   - JWT_SECRET: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo "   - ENCRYPTION_KEY: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
echo "5. Start backend with PM2: pm2 start /opt/ifilm/ecosystem.config.js"
echo "6. Start frontend: cd /opt/ifilm/shadcn-ui && pnpm run preview --host 0.0.0.0 --port 3000 &"
echo "7. Or use Docker Compose: cd /opt/ifilm && docker-compose up -d"

