# How to Update Server to Latest Version

## Quick Update (One Command)

SSH into your server and run:

```bash
cd /opt/ifilm && sudo bash update-test-ui.sh
```

## Step-by-Step Manual Update

If you prefer manual steps:

```bash
# 1. SSH into your server
ssh root@YOUR_SERVER_IP

# 2. Navigate to installation directory
cd /opt/ifilm

# 3. Switch to test-ui branch and pull latest changes
git fetch origin
git checkout test-ui
git pull origin test-ui

# 4. Update backend dependencies and rebuild
cd backend
npm install
npm run build

# 5. Run database migrations (if any)
npm run migrate

# 6. Update frontend dependencies and rebuild
cd ../shadcn-ui
pnpm install
pnpm run build

# 7. Restart PM2 services
cd /opt/ifilm
pm2 restart all

# 8. Reload NGINX (if needed)
sudo systemctl reload nginx
```

## Verify Update

After updating, check:

1. **Check PM2 status:**
   ```bash
   pm2 status
   ```

2. **Check backend logs:**
   ```bash
   pm2 logs ifilm-backend --lines 20
   ```

3. **Check frontend logs:**
   ```bash
   pm2 logs ifilm-frontend --lines 20
   ```

4. **Test audio tracks:**
   - Open a movie or series episode
   - Look for the Languages icon (🌐) in player controls
   - Click it to see available audio tracks

## Troubleshooting

If you encounter issues:

```bash
# Check if you're on the right branch
cd /opt/ifilm
git branch

# Check for uncommitted changes
git status

# Force pull if needed (WARNING: This will discard local changes)
git fetch origin
git reset --hard origin/test-ui

# Rebuild everything
cd backend && npm install && npm run build
cd ../shadcn-ui && pnpm install && pnpm run build
cd /opt/ifilm && pm2 restart all
```

## What's New in This Update

- ✅ Audio track selection for movies and series
- ✅ Improved audio track detection (checks all MediaSources)
- ✅ Better UI with track count badge
- ✅ Enhanced logging for debugging
- ✅ Support for multiple audio languages
