# Updating Your Server

## Quick Update

To update your server to the latest version from GitHub:

### Method 1: Automated Script (Recommended)

```bash
# With password (automated)
./update-server-auto.sh root@139.59.212.0 YourPassword

# Without password (will prompt for SSH key)
./update-server.sh root@139.59.212.0
```

### Method 2: Manual Update (SSH into server)

```bash
# SSH into server
ssh root@139.59.212.0

# Navigate to installation directory
cd /opt/ifilm

# Pull latest changes
git pull origin main

# Update backend
cd backend
npm install
npm run build
pm2 restart ifilm-backend

# Update frontend
cd ../shadcn-ui
pnpm install
pnpm run build
pm2 restart ifilm-frontend

# Check status
pm2 list
```

### Method 3: One-Line Update

```bash
ssh root@139.59.212.0 "cd /opt/ifilm && git pull origin main && cd backend && npm install && npm run build && pm2 restart ifilm-backend && cd ../shadcn-ui && pnpm install && pnpm run build && pm2 restart ifilm-frontend"
```

## What Gets Updated

- ✅ Latest code from GitHub
- ✅ Backend dependencies and build
- ✅ Frontend dependencies and build
- ✅ Service restarts
- ✅ Duplicate file cleanup

## After Update

1. Check service status: `pm2 list`
2. Test backend: `curl http://localhost:5000/health`
3. Test frontend: Visit `http://YOUR_SERVER_IP:3000`
4. Check logs if issues: `pm2 logs ifilm-backend`

## Troubleshooting

If update fails:

1. Check git status: `cd /opt/ifilm && git status`
2. Check for conflicts: `git pull origin main`
3. Reset if needed: `git reset --hard origin/main`
4. Rebuild: Follow manual update steps above

