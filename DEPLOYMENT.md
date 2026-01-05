# iFilm Deployment Guide

This guide will help you deploy the iFilm application to your server.

## Server Information

- **IP Address**: 167.172.206.254
- **User**: root
- **Password**: Jamshed@00Haroon

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

Run the deployment script from your local machine:

```bash
chmod +x deploy.sh
./deploy.sh
```

This script will:
1. Package the application
2. Upload it to the server
3. Run the setup script
4. Install all dependencies
5. Build the application

### Option 2: Manual Deployment

#### Step 1: Prepare the Package

```bash
# Create a tarball (excluding node_modules and dist)
tar -czf ifilm-deploy.tar.gz \
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
```

#### Step 2: Upload to Server

```bash
# Using scp
scp ifilm-deploy.tar.gz root@167.172.206.254:/tmp/

# Or using rsync
rsync -avz --exclude 'node_modules' --exclude 'dist' \
    ./ root@167.172.206.254:/opt/ifilm/
```

#### Step 3: SSH into Server

```bash
ssh root@167.172.206.254
```

#### Step 4: Extract and Setup

```bash
# Create directory
mkdir -p /opt/ifilm
cd /opt/ifilm

# Extract files
tar -xzf /tmp/ifilm-deploy.tar.gz

# Make setup script executable
chmod +x setup-server.sh

# Run setup
./setup-server.sh
```

## Post-Deployment Configuration

### 1. Configure Backend Environment

Edit `/opt/ifilm/backend/.env`:

```bash
nano /opt/ifilm/backend/.env
```

Update the following values:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ifilm
DB_USER=postgres
DB_PASSWORD=your_secure_password_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration (Generate secure secrets)
JWT_SECRET=your_generated_jwt_secret_32_chars_min
JWT_REFRESH_SECRET=your_generated_refresh_secret_32_chars_min
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Encryption Configuration
ENCRYPTION_KEY=your_generated_32_char_encryption_key

# CORS Configuration (Update with your domain)
CORS_ORIGIN=http://167.172.206.254:3000
```

**Generate secure secrets:**

```bash
# JWT Secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Encryption Key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Configure Frontend Environment

Edit `/opt/ifilm/shadcn-ui/.env`:

```bash
nano /opt/ifilm/shadcn-ui/.env
```

```env
VITE_API_URL=http://167.172.206.254:5000/api
```

### 3. Run Database Migrations

```bash
cd /opt/ifilm/backend
for migration in migrations/*.sql; do
    sudo -u postgres psql -d ifilm -f "$migration"
done
```

### 4. Configure Nginx

Edit `/etc/nginx/sites-available/ifilm`:

```bash
nano /etc/nginx/sites-available/ifilm
```

Update `server_name` with your domain or IP:

```nginx
server_name 167.172.206.254;
```

Test and reload Nginx:

```bash
nginx -t
systemctl reload nginx
```

## Running the Application

### Option 1: Using PM2 (Recommended for Production)

```bash
# Start backend
cd /opt/ifilm
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# View status
pm2 status

# View logs
pm2 logs ifilm-backend

# Start frontend (in a separate process)
cd /opt/ifilm/shadcn-ui
pm2 start "pnpm run preview --host 0.0.0.0 --port 3000" --name ifilm-frontend
pm2 save
```

### Option 2: Using Docker Compose

```bash
cd /opt/ifilm

# Create .env file for docker-compose
cat > .env << EOF
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
ENCRYPTION_KEY=your_encryption_key
CORS_ORIGIN=http://167.172.206.254:3000
VITE_API_URL=http://167.172.206.254:5000/api
EOF

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Option 3: Manual Start

```bash
# Terminal 1: Start backend
cd /opt/ifilm/backend
npm start

# Terminal 2: Start frontend
cd /opt/ifilm/shadcn-ui
pnpm run preview --host 0.0.0.0 --port 3000
```

## Firewall Configuration

Allow necessary ports:

```bash
# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS (if using SSL)
ufw allow 443/tcp

# Allow backend API (if accessing directly)
ufw allow 5000/tcp

# Allow frontend (if accessing directly)
ufw allow 3000/tcp

# Enable firewall
ufw enable
```

## SSL Certificate Setup (Optional but Recommended)

### Using Let's Encrypt (Certbot)

```bash
# Install certbot
apt-get install -y certbot python3-certbot-nginx

# Get certificate (replace with your domain)
certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
certbot renew --dry-run
```

After obtaining SSL certificate, update Nginx configuration to use HTTPS.

## Monitoring and Maintenance

### View Application Logs

```bash
# PM2 logs
pm2 logs

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Application logs
tail -f /var/log/ifilm/backend-out.log
tail -f /var/log/ifilm/backend-error.log
```

### Database Backup

```bash
# Create backup
sudo -u postgres pg_dump ifilm > /opt/ifilm/backup-$(date +%Y%m%d).sql

# Restore backup
sudo -u postgres psql ifilm < /opt/ifilm/backup-YYYYMMDD.sql
```

### Update Application

```bash
# Pull latest changes (if using git)
cd /opt/ifilm
git pull

# Rebuild backend
cd backend
npm install
npm run build

# Rebuild frontend
cd ../shadcn-ui
pnpm install
pnpm run build

# Restart services
pm2 restart all
```

## Troubleshooting

### Backend not starting

```bash
# Check logs
pm2 logs ifilm-backend

# Check if port is in use
netstat -tulpn | grep 5000

# Check environment variables
cd /opt/ifilm/backend
cat .env
```

### Frontend not loading

```bash
# Check if frontend is running
pm2 status

# Check frontend logs
pm2 logs ifilm-frontend

# Verify API URL in .env
cat /opt/ifilm/shadcn-ui/.env
```

### Database connection issues

```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection
sudo -u postgres psql -d ifilm -c "SELECT 1;"

# Check database exists
sudo -u postgres psql -l | grep ifilm
```

### Redis connection issues

```bash
# Check Redis status
systemctl status redis-server

# Test connection
redis-cli ping
```

### Nginx issues

```bash
# Test configuration
nginx -t

# Check error log
tail -f /var/log/nginx/error.log

# Reload configuration
systemctl reload nginx
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate secure JWT secrets (32+ characters)
- [ ] Set strong PostgreSQL password
- [ ] Configure firewall rules
- [ ] Enable HTTPS/SSL
- [ ] Set up regular database backups
- [ ] Configure rate limiting
- [ ] Monitor logs for suspicious activity
- [ ] Keep system packages updated
- [ ] Use non-root user for application (optional but recommended)

## Access the Application

After deployment:

- **Frontend**: http://167.172.206.254:3000 (or via Nginx on port 80)
- **Backend API**: http://167.172.206.254:5000/api
- **Health Check**: http://167.172.206.254:5000/health

## Next Steps

1. **Create Admin Account**: Register via frontend, then promote to admin:
   ```sql
   sudo -u postgres psql -d ifilm
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   ```

2. **Configure Jellyfin**: 
   - Access admin panel
   - Go to Jellyfin Settings
   - Enter Jellyfin server URL and API key
   - Test connection and save

3. **Sync Libraries**: Use admin panel to sync Jellyfin libraries

4. **Test Streaming**: Play a movie to verify everything works

## Support

For issues:
- Check application logs: `pm2 logs`
- Check system logs: `journalctl -xe`
- Review this deployment guide
- Check [Setup Guide](./docs/setup_guide.md)

---

**Last Updated**: 2025-01-15

