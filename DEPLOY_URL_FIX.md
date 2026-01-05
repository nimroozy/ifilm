# Deploy URL Fix to Production Server

## Quick Deploy (Automated)

Run the deployment script:

```bash
cd /Users/haroonrashidi/Desktop/ifilm
./deploy-url-fix.sh
```

## Manual Deployment Steps

If automated deployment fails, follow these steps:

### Step 1: Upload Files to Server

```bash
cd /Users/haroonrashidi/Desktop/ifilm

# Upload updated files
scp backend/src/controllers/media.controller.ts root@167.172.206.254:/opt/ifilm/backend/src/controllers/
scp backend/src/services/jellyfin.service.ts root@167.172.206.254:/opt/ifilm/backend/src/services/
scp backend/src/routes/media.routes.ts root@167.172.206.254:/opt/ifilm/backend/src/routes/
```

### Step 2: SSH into Server

```bash
ssh root@167.172.206.254
# Password: Jamshed@00Haroon
```

### Step 3: Build and Restart Backend

Once on the server:

```bash
cd /opt/ifilm/backend

# Install dependencies if needed
npm install

# Build TypeScript
npm run build

# Restart PM2 service
pm2 restart ifilm-backend

# Check status
pm2 status
pm2 logs ifilm-backend --lines 50
```

### Step 4: Verify Fix

Test that backend returns relative URLs:

```bash
# On server or locally
curl http://167.172.206.254:5000/api/media/movies?limit=1 | grep -o '"posterUrl":"[^"]*"'

# Should return something like:
# "posterUrl":"/api/media/images/{id}/Primary"
# NOT: "posterUrl":"http://167.172.206.254:5000/..."
```

### Step 5: Frontend Update (Optional)

If you want to deploy frontend changes too:

```bash
# On local machine
cd /Users/haroonrashidi/Desktop/ifilm/shadcn-ui

# Build frontend
pnpm run build

# Upload dist folder
scp -r dist/* root@167.172.206.254:/opt/ifilm/shadcn-ui/dist/

# Or rebuild on server
ssh root@167.172.206.254
cd /opt/ifilm/shadcn-ui
pnpm install
pnpm run build
```

## Files Changed

The following files were updated to return relative URLs:

1. **backend/src/controllers/media.controller.ts**
   - `getStreamUrl()` - Returns `/api/media/stream/{id}/master.m3u8`
   - `proxyStream()` - Rewrites HLS playlists with relative URLs

2. **backend/src/services/jellyfin.service.ts**
   - `getImageUrl()` - Returns `/api/media/images/{id}/{type}`
   - `getStreamUrl()` - Returns `/api/media/stream/{id}/master.m3u8`
   - `getHlsUrl()` - Returns `/api/media/stream/{id}/master.m3u8`

3. **backend/src/routes/media.routes.ts**
   - Added image proxy route: `/api/media/images/:itemId/:imageType`

4. **shadcn-ui/src/services/api.ts**
   - Added URL sanitization interceptor

5. **shadcn-ui/src/utils/urlSanitizer.ts** (new file)
   - URL sanitization utility functions

## Troubleshooting

### Build Fails on Server

```bash
# Check Node.js version
node --version  # Should be 18+

# Reinstall dependencies
cd /opt/ifilm/backend
rm -rf node_modules package-lock.json
npm install
npm run build
```

### PM2 Service Not Restarting

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs ifilm-backend --lines 100

# Restart manually
pm2 restart ifilm-backend

# If service doesn't exist, start it
cd /opt/ifilm
pm2 start ecosystem.config.js
pm2 save
```

### Still Seeing Absolute URLs

1. Clear browser cache
2. Check backend logs: `pm2 logs ifilm-backend`
3. Verify file was uploaded correctly:
   ```bash
   grep -n "req.protocol\|req.get('host')" /opt/ifilm/backend/src/controllers/media.controller.ts
   # Should return nothing
   ```

## Verification Checklist

- [ ] Backend builds successfully
- [ ] PM2 service restarted
- [ ] API returns relative URLs (test with curl)
- [ ] Frontend loads images correctly
- [ ] Video streaming works
- [ ] No mixed content errors in browser console

## Rollback (If Needed)

If something goes wrong:

```bash
# On server
cd /opt/ifilm/backend
git checkout HEAD -- src/controllers/media.controller.ts src/services/jellyfin.service.ts src/routes/media.routes.ts
npm run build
pm2 restart ifilm-backend
```

