# iFilm Quick Start Guide

## 🚀 Installation on Fresh Ubuntu Server

### One Command Installation

```bash
git clone https://github.com/nimroozy/ifilm.git && cd ifilm && chmod +x install-ubuntu.sh && sudo ./install-ubuntu.sh
```

### What Gets Installed

- ✅ Node.js 20.x
- ✅ PostgreSQL
- ✅ PM2 (Process Manager)
- ✅ pnpm (Package Manager)
- ✅ NGINX (Reverse Proxy)
- ✅ Backend API (Port 5000)
- ✅ Frontend (Port 3000, proxied via NGINX on Port 80)

### After Installation

1. **Configure Jellyfin Connection:**
   ```bash
   nano /opt/ifilm/backend/.env
   ```
   
   Update these values:
   ```
   JELLYFIN_SERVER_URL=http://your-jellyfin-server:8096
   JELLYFIN_API_KEY=your-api-key-here
   ```

2. **Restart Backend:**
   ```bash
   pm2 restart ifilm-backend
   ```

3. **Access Your Application:**
   - **Via NGINX (Port 80):** `http://YOUR_SERVER_IP`
   - **Direct Frontend:** `http://YOUR_SERVER_IP:3000`
   - **Backend API:** `http://YOUR_SERVER_IP:5000/api`

## 📝 Common Commands

### Service Management

```bash
# View all services
pm2 list

# View logs
pm2 logs ifilm-backend
pm2 logs ifilm-frontend

# Restart services
pm2 restart all
pm2 restart ifilm-backend
pm2 restart ifilm-frontend

# Stop services
pm2 stop all

# Monitor services
pm2 monit
```

### NGINX Management

```bash
# Check NGINX status
systemctl status nginx

# Restart NGINX
sudo systemctl restart nginx

# Test NGINX configuration
sudo nginx -t

# View NGINX logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Database Management

```bash
# Run migrations
cd /opt/ifilm/backend
npm run migrate

# Create admin user
npm run create-admin -- email@example.com username password
```

### Updating the Application

```bash
cd /opt/ifilm
git pull
cd backend && npm install && npm run build
cd ../shadcn-ui && pnpm install && pnpm run build
pm2 restart all
sudo systemctl restart nginx
```

Or use the automated update script:
```bash
cd /opt/ifilm
./update-server.sh
```

## 🔧 Troubleshooting

### Images/Videos Not Loading

1. **Check Backend Logs:**
   ```bash
   pm2 logs ifilm-backend --lines 50
   ```

2. **Test Backend Directly:**
   ```bash
   curl http://localhost:5000/health
   curl http://localhost:5000/api/media/movies?limit=1
   ```

3. **Verify Jellyfin Connection:**
   - Check `.env` file has correct Jellyfin URL and API key
   - Test Jellyfin API: `curl http://your-jellyfin-server:8096/System/Info`

4. **Check NGINX Proxy:**
   ```bash
   curl http://localhost/api/health
   ```

### Port 80 Not Working

1. **Check NGINX is Running:**
   ```bash
   systemctl status nginx
   ```

2. **Verify NGINX Configuration:**
   ```bash
   sudo nginx -t
   ```

3. **Check Firewall:**
   ```bash
   sudo ufw status
   sudo ufw allow 80/tcp
   ```

### Services Not Starting

1. **Check PM2 Status:**
   ```bash
   pm2 list
   pm2 logs
   ```

2. **Restart Services:**
   ```bash
   pm2 restart all
   ```

3. **Check Port Availability:**
   ```bash
   sudo netstat -tulpn | grep -E ':(3000|5000|80)'
   ```

## 📚 Additional Resources

- **Full Documentation:** See `README.md`
- **Troubleshooting Guide:** See `TROUBLESHOOTING.md`
- **NGINX Configuration:** See `nginx/ifilm.conf`
- **Update Script:** See `update-server.sh`

## 🆘 Getting Help

If you encounter issues:

1. Check the logs: `pm2 logs`
2. Review `TROUBLESHOOTING.md`
3. Verify all services are running: `pm2 list`
4. Test endpoints directly: `curl http://localhost:5000/health`
