#!/bin/bash

echo "🔄 Updating Cache Configuration System"
echo "========================================"
echo ""

# Step 1: Pull latest changes
echo "1️⃣ Pulling latest changes from GitHub..."
cd /opt/ifilm
git pull

# Step 2: Run migrations
echo ""
echo "2️⃣ Running database migrations..."
cd backend
npm run migrate

# Step 3: Rebuild backend
echo ""
echo "3️⃣ Rebuilding backend..."
npm run build

# Step 4: Rebuild frontend
echo ""
echo "4️⃣ Rebuilding frontend..."
cd ../shadcn-ui
pnpm install
pnpm run build

# Step 5: Restart services
echo ""
echo "5️⃣ Restarting services..."
pm2 restart ifilm-backend
pm2 restart ifilm-frontend

# Step 6: Verify
echo ""
echo "6️⃣ Verifying services..."
pm2 status

echo ""
echo "✅ Update complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Visit http://139.59.212.0/admin/cache-settings"
echo "   2. Configure cache sizes based on your server's HDD capacity"
echo "   3. Click 'Reload NGINX Config' to apply changes"

