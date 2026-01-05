#!/bin/bash

set -e

echo "🚀 iFilm Installation Script"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}Warning: Not running as root. Some commands may require sudo.${NC}"
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo -e "${RED}Cannot detect OS. Please install manually.${NC}"
    exit 1
fi

echo "Detected OS: $OS $VER"
echo ""

# Function to check command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Node.js if not present
if ! command_exists node; then
    echo "📦 Installing Node.js..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    else
        echo -e "${RED}Unsupported OS. Please install Node.js manually.${NC}"
        exit 1
    fi
fi

# Install pnpm
if ! command_exists pnpm; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm@8.10.0
fi

# Install PM2
if ! command_exists pm2; then
    echo "📦 Installing PM2..."
    npm install -g pm2
fi

# Install Docker if not present
if ! command_exists docker; then
    echo "📦 Installing Docker..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get update
        apt-get install -y docker.io docker-compose
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y docker docker-compose
        systemctl start docker
        systemctl enable docker
    fi
fi

# Install PostgreSQL if not present
if ! command_exists psql; then
    echo "📦 Installing PostgreSQL..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get install -y postgresql postgresql-contrib
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y postgresql-server postgresql-contrib
        postgresql-setup --initdb
        systemctl start postgresql
        systemctl enable postgresql
    fi
fi

# Install Redis if not present
if ! command_exists redis-cli; then
    echo "📦 Installing Redis..."
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        apt-get install -y redis-server
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
        yum install -y redis
        systemctl start redis
        systemctl enable redis
    fi
fi

echo ""
echo -e "${GREEN}✅ Prerequisites installed!${NC}"
echo ""

# Get installation directory
INSTALL_DIR="/opt/ifilm"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}Directory $INSTALL_DIR already exists.${NC}"
    read -p "Remove and reinstall? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
    else
        echo "Installation cancelled."
        exit 1
    fi
fi

# Clone or copy repository
if [ -d ".git" ]; then
    echo "📥 Copying current directory to $INSTALL_DIR..."
    mkdir -p "$INSTALL_DIR"
    cp -r . "$INSTALL_DIR"/
    cd "$INSTALL_DIR"
else
    echo "📥 Cloning repository..."
    git clone https://github.com/nimroozy/ifilm.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# Setup backend
echo ""
echo "🔧 Setting up backend..."
cd backend

# Clean up any duplicate files that might cause build errors
echo "🧹 Cleaning up duplicate files..."
rm -f src/admin.controller.ts src/admin.routes.ts src/jellyfin.service.ts src/jellyfin-libraries.service.ts src/media.controller.ts 2>/dev/null || true

# Install dependencies
npm install

# Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating backend .env file..."
    cat > .env << EOF
NODE_ENV=production
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ifilm
DB_USER=postgres
DB_PASSWORD=change_this_password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
CORS_ORIGIN=http://localhost:3000
JELLYFIN_SERVER_URL=http://localhost:8096
JELLYFIN_API_KEY=your_jellyfin_api_key_here
EOF
    echo -e "${YELLOW}⚠️  Please edit backend/.env with your actual configuration!${NC}"
fi

# Build backend
npm run build

# Setup database
echo "🗄️  Setting up database..."
sudo -u postgres createdb ifilm 2>/dev/null || echo "Database may already exist"

# Run migrations if script exists
if [ -f "scripts/migrate.js" ]; then
    echo "🔄 Running database migrations..."
    npm run migrate || echo "Migrations may have already run"
else
    echo "⚠️  Migration script not found. Skipping migrations."
    echo "   You may need to run migrations manually later."
fi

cd ..

# Setup frontend
echo ""
echo "🔧 Setting up frontend..."
cd shadcn-ui

# Install dependencies
pnpm install

# Create .env
echo "VITE_API_URL=/api" > .env

# Build frontend
pnpm run build

cd ..

# Start services with PM2
echo ""
echo "🚀 Starting services with PM2..."

# Start backend
cd backend
# Create logs directory
mkdir -p logs

# Start with PM2 using the ecosystem config from parent directory
cd ..
if [ -f "ecosystem.config.js" ]; then
    PM2_CWD="$(pwd)/backend" pm2 start ecosystem.config.js --name ifilm-backend || pm2 restart ifilm-backend
else
    # Fallback: start directly
    cd backend
    pm2 start dist/server.js --name ifilm-backend || pm2 restart ifilm-backend
    cd ..
fi

# Start frontend preview server
cd shadcn-ui
pm2 start "pnpm run preview --host 0.0.0.0 --port 3000" --name ifilm-frontend || pm2 restart ifilm-frontend
cd ..

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup | tail -1 | bash || echo "PM2 startup already configured"

echo ""
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "📋 Next steps:"
echo "1. Edit backend/.env with your Jellyfin configuration"
echo "2. Configure NGINX reverse proxy (see README.md)"
echo "3. Access frontend at http://localhost:3000"
echo "4. Access backend API at http://localhost:5000/api"
echo ""
echo "📊 PM2 Status:"
pm2 list
echo ""
echo "📝 Useful commands:"
echo "  pm2 logs ifilm-backend    # View backend logs"
echo "  pm2 logs ifilm-frontend   # View frontend logs"
echo "  pm2 restart all           # Restart all services"
echo "  pm2 stop all              # Stop all services"
echo ""

