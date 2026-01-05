#!/bin/bash

# One-Click Install Script for iFilm
# This script installs everything needed for a fresh Ubuntu server

set -e

echo "🚀 iFilm One-Click Installation"
echo "=================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root: sudo bash install.sh"
    exit 1
fi

# Update system
echo "1️⃣ Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

# Install required packages
echo ""
echo "2️⃣ Installing required packages..."
apt-get install -y -qq \
    curl \
    git \
    build-essential \
    postgresql \
    postgresql-contrib \
    redis-server \
    nginx \
    nodejs \
    npm \
    pm2 \
    sudo \
    wget \
    ca-certificates

# Install pnpm
echo ""
echo "3️⃣ Installing pnpm..."
npm install -g pnpm

# Create application directory
echo ""
echo "4️⃣ Setting up application directory..."
mkdir -p /opt/ifilm
cd /opt/ifilm

# Clone repository
echo ""
echo "5️⃣ Cloning repository from GitHub..."
if [ -d ".git" ]; then
    echo "Repository already exists, pulling latest..."
    git pull
else
    git clone https://github.com/nimroozy/ifilm.git .
fi

# Setup PostgreSQL
echo ""
echo "6️⃣ Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE ifilm;" 2>/dev/null || echo "Database already exists"
sudo -u postgres psql -c "CREATE USER ifilm WITH PASSWORD 'ifilm123';" 2>/dev/null || echo "User already exists"
sudo -u postgres psql -c "ALTER USER ifilm CREATEDB;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ifilm TO ifilm;" 2>/dev/null || true

# Setup backend
echo ""
echo "7️⃣ Setting up backend..."
cd /opt/ifilm/backend
npm install
npm run build

# Run migrations
echo ""
echo "8️⃣ Running database migrations..."
npm run migrate

# Setup frontend
echo ""
echo "9️⃣ Setting up frontend..."
cd /opt/ifilm/shadcn-ui
pnpm install
pnpm run build

# Configure NGINX
echo ""
echo "🔟 Configuring NGINX..."
cp /opt/ifilm/nginx/ifilm.conf /etc/nginx/sites-available/ifilm
ln -sf /etc/nginx/sites-available/ifilm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Create cache directories
mkdir -p /var/cache/nginx/images
mkdir -p /var/cache/nginx/videos
chown -R www-data:www-data /var/cache/nginx
chmod -R 755 /var/cache/nginx

# Update NGINX cache config from database
/opt/ifilm/backend/scripts/update-nginx-cache.sh || echo "Cache config update skipped (will be applied after first config)"

# Test NGINX config
nginx -t

# Configure sudoers for NGINX commands (for root user)
echo ""
echo "1️⃣1️⃣ Configuring sudoers..."
SUDOERS_LINE="root ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx, /bin/systemctl reload nginx.service"
if ! grep -q "NOPASSWD.*nginx" /etc/sudoers 2>/dev/null; then
    echo "$SUDOERS_LINE" >> /etc/sudoers
    echo "✅ Sudoers configured"
else
    echo "✅ Sudoers already configured"
fi

# Setup PM2
echo ""
echo "1️⃣2️⃣ Setting up PM2 processes..."
cd /opt/ifilm

# Create ecosystem config if it doesn't exist
if [ ! -f "ecosystem.config.js" ]; then
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'ifilm-backend',
      script: './backend/dist/server.js',
      cwd: '/opt/ifilm',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './backend/logs/backend-error.log',
      out_file: './backend/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_memory_restart: '500M',
    },
    {
      name: 'ifilm-frontend',
      script: 'pnpm',
      args: 'run preview',
      cwd: '/opt/ifilm/shadcn-ui',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      autorestart: true,
      max_memory_restart: '300M',
    },
  ],
};
EOF
fi

# Start services with PM2
pm2 delete ifilm-backend 2>/dev/null || true
pm2 delete ifilm-frontend 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root || true

# Start services
echo ""
echo "1️⃣3️⃣ Starting services..."
systemctl restart nginx
systemctl enable nginx
systemctl enable redis-server
systemctl enable postgresql

# Create update script
echo ""
echo "1️⃣4️⃣ Creating update script..."
cat > /opt/ifilm/update.sh << 'EOF'
#!/bin/bash
set -e
cd /opt/ifilm
git pull
cd backend && npm install && npm run build && npm run migrate
cd ../shadcn-ui && pnpm install && pnpm run build
pm2 restart all
sudo /opt/ifilm/backend/scripts/update-nginx-cache.sh 2>/dev/null || true
sudo systemctl reload nginx
echo "✅ Update complete!"
EOF
chmod +x /opt/ifilm/update.sh

echo ""
echo "✅ Installation complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Configure Jellyfin: http://$(hostname -I | awk '{print $1}')/admin/jellyfin-settings"
echo "   2. Configure cache: http://$(hostname -I | awk '{print $1}')/admin/cache-settings"
echo "   3. Access your site: http://$(hostname -I | awk '{print $1}')"
echo ""
echo "🔄 To update: sudo /opt/ifilm/update.sh"
