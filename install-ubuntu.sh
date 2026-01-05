#!/bin/bash

set -e

echo "🚀 iFilm Installation Script for Ubuntu"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

echo "📦 Step 1: Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

echo ""
echo "📦 Step 2: Installing prerequisites..."

# Install Node.js 18.x
if ! command -v node &> /dev/null; then
    echo "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
else
    echo "Node.js already installed: $(node --version)"
fi

# Install pnpm
if ! command -v pnpm &> /dev/null; then
    echo "Installing pnpm..."
    npm install -g pnpm@8.10.0
else
    echo "pnpm already installed: $(pnpm --version)"
fi

# Install PM2
if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
else
    echo "PM2 already installed: $(pm2 --version)"
fi

# Install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    apt-get install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
else
    echo "PostgreSQL already installed"
fi

# Install Redis
if ! command -v redis-cli &> /dev/null; then
    echo "Installing Redis..."
    apt-get install -y redis-server
    systemctl start redis-server
    systemctl enable redis-server
else
    echo "Redis already installed"
fi

# Install Git
if ! command -v git &> /dev/null; then
    echo "Installing Git..."
    apt-get install -y git
else
    echo "Git already installed"
fi

# Install build essentials
echo "Installing build tools..."
apt-get install -y build-essential

echo ""
echo -e "${GREEN}✅ Prerequisites installed!${NC}"
echo ""

# Installation directory
INSTALL_DIR="/opt/ifilm"

# Remove existing installation if it exists
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory $INSTALL_DIR already exists.${NC}"
    read -p "Remove and reinstall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Removing existing installation..."
        rm -rf "$INSTALL_DIR"
    else
        echo "Installation cancelled."
        exit 1
    fi
fi

# Clone repository
echo ""
echo "📥 Step 3: Cloning repository..."
cd /opt
git clone https://github.com/nimroozy/ifilm.git
cd "$INSTALL_DIR"

# Setup backend
echo ""
echo "🔧 Step 4: Setting up backend..."
cd backend

# Clean up duplicate files
echo "🧹 Cleaning up duplicate files..."
rm -f src/admin.controller.ts src/admin.routes.ts src/jellyfin.service.ts src/jellyfin-libraries.service.ts src/media.controller.ts 2>/dev/null || true

# Install dependencies
echo "Installing backend dependencies..."
npm install

# Create .env file
if [ ! -f .env ]; then
    echo "📝 Creating backend .env file..."
    cat > .env << EOF
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ifilm
DB_USER=postgres
DB_PASSWORD=$(openssl rand -hex 16)
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
CORS_ORIGIN=http://localhost:3000
JELLYFIN_SERVER_URL=http://localhost:8096
JELLYFIN_API_KEY=your_jellyfin_api_key_here
EOF
    echo -e "${YELLOW}⚠️  Backend .env file created with random passwords.${NC}"
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your actual configuration!${NC}"
    echo -e "${YELLOW}⚠️  Database password: $(grep DB_PASSWORD .env | cut -d '=' -f2)${NC}"
fi

# Set PostgreSQL password
DB_PASSWORD=$(grep DB_PASSWORD .env | cut -d '=' -f2)
echo "Setting PostgreSQL password..."
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$DB_PASSWORD';" 2>/dev/null || true

# Create database
echo "Creating database..."
sudo -u postgres createdb ifilm 2>/dev/null || echo "Database may already exist"

# Build backend
echo "Building backend..."
npm run build

# Create logs directory
mkdir -p logs

# Run migrations
if [ -f "scripts/migrate.js" ]; then
    echo "🔄 Running database migrations..."
    npm run migrate || echo "Migrations may have already run"
else
    echo "⚠️  Migration script not found. Skipping migrations."
fi

# Prompt to create admin user
echo ""
echo -e "${YELLOW}📝 Admin User Setup${NC}"
read -p "Do you want to create an admin user now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Admin email: " ADMIN_EMAIL
    read -p "Admin username: " ADMIN_USERNAME
    read -sp "Admin password: " ADMIN_PASSWORD
    echo
    if [ ! -z "$ADMIN_EMAIL" ] && [ ! -z "$ADMIN_USERNAME" ] && [ ! -z "$ADMIN_PASSWORD" ]; then
        npm run create-admin -- "$ADMIN_EMAIL" "$ADMIN_USERNAME" "$ADMIN_PASSWORD" || echo "Failed to create admin user. You can create it later with: npm run create-admin"
    else
        echo "Skipping admin user creation. You can create it later with: npm run create-admin"
    fi
else
    echo "You can create an admin user later with:"
    echo "  cd /opt/ifilm/backend"
    echo "  npm run create-admin <email> <username> <password>"
fi

cd ..

# Setup frontend
echo ""
echo "🔧 Step 5: Setting up frontend..."
cd shadcn-ui

# Install dependencies
echo "Installing frontend dependencies..."
pnpm install

# Create .env
echo "VITE_API_URL=/api" > .env

# Build frontend
echo "Building frontend..."
pnpm run build

cd ..

# Start services with PM2
echo ""
echo "🚀 Step 6: Starting services with PM2..."

# Start backend
cd backend
mkdir -p logs
cd ..

# Start backend using ecosystem config
if [ -f "ecosystem.config.js" ]; then
    PM2_CWD="$(pwd)/backend" pm2 start ecosystem.config.js --name ifilm-backend || pm2 restart ifilm-backend
else
    cd backend
    pm2 start dist/server.js --name ifilm-backend || pm2 restart ifilm-backend
    cd ..
fi

# Start frontend
cd shadcn-ui
pm2 start "pnpm run preview --host 0.0.0.0 --port 3000" --name ifilm-frontend || pm2 restart ifilm-frontend
cd ..

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup systemd -u root --hp /root | grep -v "PM2" | bash || echo "PM2 startup already configured"

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "📋 Installation Summary:"
echo "========================"
echo "Installation directory: $INSTALL_DIR"
echo "Backend running on: http://localhost:5000"
echo "Frontend running on: http://localhost:3000"
echo ""
echo "📝 Next Steps:"
echo "1. Edit $INSTALL_DIR/backend/.env with your Jellyfin configuration"
echo "2. Configure NGINX reverse proxy (see README.md)"
echo "3. Access frontend at http://$(hostname -I | awk '{print $1}'):3000"
echo ""
echo "📊 PM2 Status:"
pm2 list
echo ""
echo "📝 Useful Commands:"
echo "  pm2 logs ifilm-backend    # View backend logs"
echo "  pm2 logs ifilm-frontend   # View frontend logs"
echo "  pm2 restart all           # Restart all services"
echo "  pm2 stop all              # Stop all services"
echo "  pm2 monit                 # Monitor services"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Edit backend/.env with your actual Jellyfin API key!${NC}"
echo ""

