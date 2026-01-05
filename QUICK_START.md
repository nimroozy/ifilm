# 🚀 Quick Start Guide

## One-Click Installation

Run this command on a fresh Ubuntu server:

```bash
curl -fsSL https://raw.githubusercontent.com/nimroozy/ifilm/main/install.sh | sudo bash
```

## Default Credentials

After installation, login with:

- **Email:** `admin@ifilm.af`
- **Password:** `Haroon@00`

## Access Your Site

- **Main Site:** `http://YOUR_SERVER_IP`
- **Admin Panel:** `http://YOUR_SERVER_IP/admin/dashboard`

## Next Steps

1. Login to admin panel with default credentials
2. Configure Jellyfin server at `/admin/jellyfin-settings`
3. Configure cache settings at `/admin/cache-settings`
4. Start streaming!

## Update

To update to the latest version:

```bash
sudo /opt/ifilm/update.sh
```

## What Gets Installed

- ✅ Node.js, npm, pnpm
- ✅ PostgreSQL database
- ✅ Redis cache
- ✅ NGINX web server (port 80)
- ✅ PM2 process manager
- ✅ All dependencies
- ✅ Database migrations
- ✅ Default admin user
- ✅ NGINX cache configuration
