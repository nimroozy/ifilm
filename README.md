# iFilm - Media Streaming Platform

A modern media streaming platform built with React, Node.js, and Jellyfin integration.

## 🚀 One-Click Installation

### Fresh Ubuntu Server Installation

```bash
curl -fsSL https://raw.githubusercontent.com/nimroozy/ifilm/main/install.sh | sudo bash
```

Or clone and run:

```bash
git clone https://github.com/nimroozy/ifilm.git
cd ifilm
sudo bash install.sh
```

### What gets installed:

- ✅ Node.js, npm, pnpm
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ NGINX web server
- ✅ PM2 process manager
- ✅ All dependencies
- ✅ Database migrations
- ✅ Frontend and backend builds
- ✅ NGINX configuration
- ✅ Cache directories
- ✅ Sudoers configuration for NGINX

## 🔄 One-Click Update

To update to the latest version:

```bash
sudo /opt/ifilm/update.sh
```

Or manually:

```bash
cd /opt/ifilm
sudo bash update.sh
```

## 📋 Post-Installation Setup

After installation, access the admin panel:

**Default Admin Credentials:**
- Email: `admin@ifilm.af`
- Password: `Haroon@00`

1. **Login to Admin Panel:**
   - Go to: `http://YOUR_SERVER_IP/admin/dashboard`
   - Use the default admin credentials above

2. **Configure Jellyfin Server:**
   - Go to: `http://YOUR_SERVER_IP/admin/jellyfin-settings`
   - Enter your Jellyfin server URL and API key
   - Test connection and save

3. **Configure Cache Settings:**
   - Go to: `http://YOUR_SERVER_IP/admin/cache-settings`
   - Set cache sizes based on your server's HDD capacity
   - Click "Reload NGINX Config" to apply

4. **Access Your Site:**
   - Frontend: `http://YOUR_SERVER_IP` (port 80)
   - Admin Panel: `http://YOUR_SERVER_IP/admin/dashboard`

## 🛠️ Manual Installation Steps

If you prefer manual installation:

### Prerequisites

- Ubuntu 20.04+ or Debian 11+
- Root or sudo access
- At least 2GB RAM
- 20GB+ disk space

### Step-by-Step

1. **Clone Repository:**
   ```bash
   git clone https://github.com/nimroozy/ifilm.git
   cd ifilm
   ```

2. **Run Installation Script:**
   ```bash
   sudo bash install.sh
   ```

3. **Configure Environment:**
   - Edit `/opt/ifilm/backend/.env` with your database credentials
   - Default database: `ifilm`, user: `ifilm`, password: `ifilm123`

4. **Access Admin Panel:**
   - Navigate to `http://YOUR_SERVER_IP/admin`
   - Configure Jellyfin and cache settings

## 📁 Project Structure

```
ifilm/
├── backend/          # Node.js/Express backend
├── shadcn-ui/        # React frontend
├── nginx/            # NGINX configuration
├── install.sh        # One-click installation script
└── update.sh         # One-click update script
```

## 🔧 Configuration

### Database

Default PostgreSQL setup:
- Database: `ifilm`
- User: `ifilm`
- Password: `ifilm123`

Change in `/opt/ifilm/backend/.env` and update PostgreSQL accordingly.

### NGINX Cache

Configure cache sizes in admin panel:
- Images cache: Default 5GB
- Videos cache: Default 50GB
- Adjust based on your server's HDD capacity

### PM2 Processes

- `ifilm-backend`: Backend API server (port 5000)
- `ifilm-frontend`: Frontend preview server (port 3000)

## 🐛 Troubleshooting

### Services not starting

```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs ifilm-backend
pm2 logs ifilm-frontend

# Restart services
pm2 restart all
```

### NGINX issues

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Reload NGINX
sudo systemctl reload nginx
```

### Database connection issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test connection
sudo -u postgres psql -d ifilm
```

## 📝 Features

- 🎬 Movie and TV series streaming
- 🖼️ Image and video caching with NGINX
- 👥 User management
- 📊 Admin dashboard
- 🔍 Search functionality
- ⭐ Favorites and watch history
- 📱 Responsive design

## 🔐 Security

- JWT authentication
- Role-based access control (Admin/User)
- Secure API endpoints
- NGINX security headers
- Input validation

## 📄 License

[Your License Here]

## 🤝 Contributing

[Contributing Guidelines]

## 📞 Support

[Support Information]
