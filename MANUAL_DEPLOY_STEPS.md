# Manual Deployment Steps for URL Fix

Since automated deployment may have issues, follow these manual steps:

## Step 1: Remove Duplicate Files on Server

SSH into the server and remove duplicate files:

```bash
ssh root@167.172.206.254
# Password: Jamshed@00Haroon

cd /opt/ifilm/backend

# Remove duplicate files in src/ root (they should be in subdirectories)
rm -f src/media.controller.ts
rm -f src/media.routes.ts  
rm -f src/jellyfin.service.ts
rm -f src/jellyfin-libraries.service.ts

# Verify files are in correct locations
ls -la src/controllers/media.controller.ts
ls -la src/services/jellyfin.service.ts
ls -la src/routes/media.routes.ts
```

## Step 2: Upload Updated Files

From your local machine, upload the fixed files:

```bash
cd /Users/haroonrashidi/Desktop/ifilm

# Upload updated files
scp backend/src/controllers/media.controller.ts root@167.172.206.254:/opt/ifilm/backend/src/controllers/
scp backend/src/services/jellyfin.service.ts root@167.172.206.254:/opt/ifilm/backend/src/services/
scp backend/src/routes/media.routes.ts root@167.172.206.254:/opt/ifilm/backend/src/routes/
```

## Step 3: Build and Restart

Back on the server:

```bash
cd /opt/ifilm/backend

# Build TypeScript
npm run build

# If build succeeds, restart PM2
pm2 restart ifilm-backend

# Check status
pm2 status
pm2 logs ifilm-backend --lines 20
```

## Step 4: Verify Fix

Test the API to ensure it returns relative URLs:

```bash
# On server
curl http://localhost:5000/api/media/movies?limit=1 | python3 -m json.tool | grep -A 2 posterUrl

# Should show:
# "posterUrl": "/api/media/images/{id}/Primary"
# NOT: "posterUrl": "http://167.172.206.254:5000/..."
```

## Quick One-Liner (if you have direct SSH access)

```bash
ssh root@167.172.206.254 "cd /opt/ifilm/backend && rm -f src/media.controller.ts src/media.routes.ts src/jellyfin.service.ts src/jellyfin-libraries.service.ts && npm run build && pm2 restart ifilm-backend"
```

Then upload files from local machine using the scp commands above.

