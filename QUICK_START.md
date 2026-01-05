# Quick Start Deployment Guide

## 🚀 Fastest Way to Deploy

### From Your Local Machine

```bash
# 1. Make scripts executable (if not already)
chmod +x deploy.sh setup-server.sh

# 2. Run deployment
./deploy.sh
```

The script will automatically:
- ✅ Package your application
- ✅ Upload to server (167.172.206.254)
- ✅ Install all dependencies (Node.js, PostgreSQL, Redis, Nginx)
- ✅ Build backend and frontend
- ✅ Setup database
- ✅ Configure services

### After Deployment

1. **SSH into server:**
   ```bash
   ssh root@167.172.206.254
   ```

2. **Configure environment variables:**
   ```bash
   # Backend
   nano /opt/ifilm/backend/.env
   # Update: DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, CORS_ORIGIN
   
   # Frontend
   nano /opt/ifilm/shadcn-ui/.env
   # Update: VITE_API_URL=http://167.172.206.254:5000/api
   ```

3. **Generate secure secrets:**
   ```bash
   # JWT Secret
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Encryption Key
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

4. **Start services with PM2:**
   ```bash
   cd /opt/ifilm
   pm2 start ecosystem.config.js
   
   # Start frontend
   cd /opt/ifilm/shadcn-ui
   pm2 start "pnpm run preview --host 0.0.0.0 --port 3000" --name ifilm-frontend
   pm2 save
   ```

5. **Configure Nginx:**
   ```bash
   # Edit nginx config
   nano /etc/nginx/sites-available/ifilm
   # Update server_name to: 167.172.206.254
   
   # Test and reload
   nginx -t
   systemctl reload nginx
   ```

6. **Access your application:**
   - Frontend: http://167.172.206.254:3000
   - Backend API: http://167.172.206.254:5000/api
   - Via Nginx: http://167.172.206.254

## 🔧 Alternative: Docker Compose

If you prefer Docker:

```bash
# SSH into server
ssh root@167.172.206.254

# Navigate to project
cd /opt/ifilm

# Create .env for docker-compose
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
```

## 📋 Checklist

- [ ] Run `./deploy.sh` from local machine
- [ ] SSH into server and configure `.env` files
- [ ] Generate and set secure secrets (JWT, encryption key)
- [ ] Start services with PM2 or Docker
- [ ] Configure Nginx
- [ ] Test application access
- [ ] Create admin account
- [ ] Configure Jellyfin connection

## 🆘 Troubleshooting

**Can't connect to server?**
- Verify IP: 167.172.206.254
- Check SSH credentials

**Services not starting?**
- Check logs: `pm2 logs` or `docker-compose logs`
- Verify environment variables are set correctly
- Check database is running: `systemctl status postgresql`

**Frontend can't connect to backend?**
- Verify `VITE_API_URL` in frontend `.env`
- Check backend is running: `pm2 status`
- Test backend: `curl http://localhost:5000/health`

For detailed information, see [DEPLOYMENT.md](./DEPLOYMENT.md)

