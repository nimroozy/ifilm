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

# Create default admin user
echo ""
echo "8️⃣.5️⃣ Creating default admin user..."
cd /opt/ifilm/backend

# Set database environment variables for create-admin script
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ifilm
export DB_USER=ifilm
export DB_PASSWORD=ifilm123

if [ -f "scripts/create-admin.js" ]; then
    # Check if admin user already exists
    ADMIN_EXISTS=$(sudo -u postgres psql -d ifilm -t -c "SELECT COUNT(*) FROM users WHERE email = 'admin@ifilm.af';" 2>/dev/null | tr -d ' ')
    if [ "$ADMIN_EXISTS" = "0" ] || [ -z "$ADMIN_EXISTS" ]; then
        node scripts/create-admin.js admin@ifilm.af admin Haroon@00 2>/dev/null && echo "✅ Default admin user created" || echo "⚠️  Failed to create admin user (may already exist)"
    else
        echo "✅ Default admin user already exists"
    fi
else
    echo "⚠️  Admin creation script not found, skipping..."
fi
cd /opt/ifilm

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
# Remove old config if it exists and is not a symlink
if [ -f /etc/nginx/sites-enabled/ifilm ] && [ ! -L /etc/nginx/sites-enabled/ifilm ]; then
    rm -f /etc/nginx/sites-enabled/ifilm
fi
ln -sf /etc/nginx/sites-available/ifilm /etc/nginx/sites-enabled/ifilm
rm -f /etc/nginx/sites-enabled/default

# Create cache directories
mkdir -p /var/cache/nginx/images
mkdir -p /var/cache/nginx/videos
chown -R www-data:www-data /var/cache/nginx
chmod -R 755 /var/cache/nginx

# Enable cache directives in NGINX config
echo ""
echo "🔟.5️⃣ Enabling NGINX cache directives..."
cd /opt/ifilm/backend
bash scripts/fix-stream-cache-manual.sh 2>/dev/null || echo "Cache directives will be enabled after first config save"
cd /opt/ifilm

# Update NGINX cache config from database (if cache_config table exists)
/opt/ifilm/backend/scripts/update-nginx-cache.sh 2>/dev/null || echo "Cache config update skipped (will be applied after first config save)"

# Test NGINX config
nginx -t

# Configure sudoers for NGINX commands (for root user)
echo ""
echo "1️⃣1️⃣ Configuring sudoers..."
# Find the user running the script (usually root)
CURRENT_USER=${SUDO_USER:-$USER}
if [ "$CURRENT_USER" = "root" ] || [ -z "$CURRENT_USER" ]; then
    CURRENT_USER="root"
fi

SUDOERS_LINE="$CURRENT_USER ALL=(ALL) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx, /bin/systemctl reload nginx.service, /opt/ifilm/backend/scripts/update-nginx-cache.sh"
if ! grep -q "NOPASSWD.*nginx" /etc/sudoers 2>/dev/null; then
    echo "$SUDOERS_LINE" >> /etc/sudoers
    echo "✅ Sudoers configured for $CURRENT_USER"
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
echo "📝 Default Admin Credentials:"
echo "   Email: admin@ifilm.af"
echo "   Password: Haroon@00"
echo ""
echo "🌐 Access your site:"
echo "   Main site: http://$(hostname -I | awk '{print $1}')"
echo "   Admin panel: http://$(hostname -I | awk '{print $1}')/admin/dashboard"
echo ""
echo "📝 Next steps:"
echo "   1. Login with default admin credentials"
echo "   2. Configure Jellyfin: http://$(hostname -I | awk '{print $1}')/admin/jellyfin-settings"
echo "   3. Configure cache: http://$(hostname -I | awk '{print $1}')/admin/cache-settings"
echo ""
echo "🔄 To update: sudo /opt/ifilm/update.sh"
