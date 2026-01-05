# Troubleshooting Guide

## Images and Videos Not Loading (404 Errors)

### Symptoms
- Images return 404: `GET /api/media/images/.../Primary 404`
- Videos return 404: `GET /api/media/stream/.../master.m3u8 404`

### Root Cause
The backend is not running or not accessible, OR the Vite preview proxy is not working correctly.

### Solution

#### Step 1: Verify Backend is Running

```bash
# SSH into your server
ssh root@139.59.212.0

# Check PM2 status
pm2 list

# Check if backend is running
pm2 logs ifilm-backend --lines 20

# If not running, start it
cd /opt/ifilm/backend
pm2 start dist/server.js --name ifilm-backend
```

#### Step 2: Test Backend Directly

```bash
# Test backend health
curl http://localhost:5000/health

# Test movies endpoint
curl http://localhost:5000/api/media/movies?limit=1

# Test image endpoint (replace MOVIE_ID with actual ID)
curl http://localhost:5000/api/media/images/MOVIE_ID/Primary
```

#### Step 3: Verify Vite Proxy

The Vite preview server proxy should forward `/api` requests to `http://localhost:5000`. However, Vite preview proxy has limitations.

**Option A: Use NGINX (Recommended for Production)**

Set up NGINX to proxy both frontend and backend:

```nginx
server {
    listen 80;
    server_name 139.59.212.0;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Option B: Fix Vite Preview Proxy**

If using Vite preview, ensure the proxy is working:

1. Check vite.config.ts has proxy configuration
2. Restart frontend: `pm2 restart ifilm-frontend`
3. Test: `curl http://139.59.212.0:3000/api/health`

#### Step 4: Check Backend Logs

```bash
pm2 logs ifilm-backend --lines 50
```

Look for:
- Jellyfin connection errors
- Database connection errors
- Route registration messages

#### Step 5: Verify Jellyfin Configuration

```bash
# Check if Jellyfin is configured
curl http://localhost:5000/api/admin/jellyfin/libraries
# (requires admin authentication)
```

### Quick Fix Script

Run this on your server:

```bash
cd /opt/ifilm

# Restart backend
cd backend
pm2 restart ifilm-backend || pm2 start dist/server.js --name ifilm-backend

# Restart frontend
cd ../shadcn-ui
pm2 restart ifilm-frontend || pm2 start "pnpm run preview --host 0.0.0.0 --port 3000" --name ifilm-frontend

# Check status
pm2 list
pm2 logs ifilm-backend --lines 20
```

## Common Issues

### Backend Not Starting
- Check database connection in `.env`
- Check Redis connection
- Check Jellyfin configuration
- Check logs: `pm2 logs ifilm-backend`

### Images Not Loading
- Verify backend is running: `curl http://localhost:5000/health`
- Verify image route exists: `curl http://localhost:5000/api/media/images/TEST_ID/Primary`
- Check Jellyfin API key is correct
- Check backend can reach Jellyfin server

### Videos Not Playing
- Verify stream route exists
- Check authentication token is valid
- Verify HLS proxy is working
- Check backend logs for stream errors

