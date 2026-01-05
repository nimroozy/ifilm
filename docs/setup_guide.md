# iFilm - Setup and Installation Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Backend Setup](#backend-setup)
3. [Frontend Setup](#frontend-setup)
4. [Database Setup](#database-setup)
5. [Jellyfin Configuration](#jellyfin-configuration)
6. [Running the Application](#running-the-application)
7. [Docker Deployment](#docker-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before setting up iFilm, ensure you have the following installed:

- **Node.js** 18+ LTS ([Download](https://nodejs.org/))
- **PostgreSQL** 15+ ([Download](https://www.postgresql.org/download/))
- **Redis** 7+ ([Download](https://redis.io/download))
- **Jellyfin Server** 10.8+ ([Download](https://jellyfin.org/downloads))
- **pnpm** (Install via: `npm install -g pnpm`)
- **Git** ([Download](https://git-scm.com/downloads))

---

## Backend Setup

### 1. Navigate to Backend Directory
```bash
cd /workspace/backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the backend directory:

```bash
cp .env.example .env
```

Edit `.env` and configure the following:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ifilm
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_refresh_key_min_32_chars
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Encryption Configuration
ENCRYPTION_KEY=your_32_character_encryption_key

# CORS Configuration
CORS_ORIGIN=http://localhost:3000
```

**Important**: Generate secure random strings for JWT secrets and encryption key:
```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Build TypeScript
```bash
npm run build
```

---

## Frontend Setup

### 1. Navigate to Frontend Directory
```bash
cd /workspace/shadcn-ui
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables
Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:5000/api
```

### 4. Build Frontend (Optional for Production)
```bash
pnpm run build
```

---

## Database Setup

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ifilm;

# Create user (optional)
CREATE USER ifilm_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ifilm TO ifilm_user;

# Exit psql
\q
```

### 2. Run Database Migrations

```bash
cd /workspace/backend

# Run migrations manually
psql -U postgres -d ifilm -f migrations/001_create_users.sql
psql -U postgres -d ifilm -f migrations/002_create_watch_history.sql
psql -U postgres -d ifilm -f migrations/003_create_favorites.sql
psql -U postgres -d ifilm -f migrations/004_create_jellyfin_config.sql
```

### 3. Verify Database Tables

```bash
psql -U postgres -d ifilm

# List tables
\dt

# Expected tables:
# - users
# - user_sessions
# - watch_history
# - favorites
# - jellyfin_config
# - jellyfin_libraries
```

---

## Jellyfin Configuration

### 1. Install and Setup Jellyfin Server

1. Download and install Jellyfin from [https://jellyfin.org/downloads](https://jellyfin.org/downloads)
2. Complete the initial setup wizard
3. Add your media libraries (Movies, TV Shows)
4. Note your server URL (e.g., `http://localhost:8096`)

### 2. Generate Jellyfin API Key

1. Log in to Jellyfin web interface
2. Go to **Dashboard** → **API Keys**
3. Click **"+"** to create a new API key
4. Name it "iFilm Integration"
5. Copy the generated API key

### 3. Configure iFilm to Connect to Jellyfin

**Option A: Via Admin Panel (Recommended)**
1. Start iFilm application
2. Register an admin account
3. Navigate to Admin Panel
4. Go to "Jellyfin Configuration"
5. Enter server URL and API key
6. Click "Test Connection"
7. Click "Save" if connection successful

**Option B: Direct Database Insert**
```sql
-- Connect to database
psql -U postgres -d ifilm

-- Insert Jellyfin config (replace with your values)
INSERT INTO jellyfin_config (server_url, api_key_encrypted, is_active)
VALUES (
  'http://localhost:8096',
  'your_encrypted_api_key_here',
  true
);
```

---

## Running the Application

### Development Mode

**Terminal 1: Start Backend**
```bash
cd /workspace/backend
npm run dev
```

**Terminal 2: Start Frontend**
```bash
cd /workspace/shadcn-ui
pnpm run dev
```

**Terminal 3: Start Redis**
```bash
redis-server
```

**Terminal 4: Start PostgreSQL** (if not running as service)
```bash
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql

# Windows
# PostgreSQL runs as a Windows service automatically
```

### Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Backend Health Check**: http://localhost:5000/health

### Default Admin Account

After running migrations, create an admin account:

```bash
# Register via frontend at http://localhost:3000/register
# Then manually update role in database:

psql -U postgres -d ifilm

UPDATE users SET role = 'admin' WHERE email = 'your_email@example.com';
```

---

## Docker Deployment

### 1. Create Docker Compose File

Create `docker-compose.yml` in the project root:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: ifilm-postgres
    environment:
      POSTGRES_DB: ifilm
      POSTGRES_USER: ifilm_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    networks:
      - ifilm-network

  redis:
    image: redis:7-alpine
    container_name: ifilm-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - ifilm-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: ifilm-backend
    environment:
      NODE_ENV: production
      PORT: 5000
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: ifilm
      DB_USER: ifilm_user
      DB_PASSWORD: ${DB_PASSWORD}
      REDIS_HOST: redis
      REDIS_PORT: 6379
      JWT_SECRET: ${JWT_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
      CORS_ORIGIN: http://localhost:3000
    depends_on:
      - postgres
      - redis
    ports:
      - "5000:5000"
    networks:
      - ifilm-network

  frontend:
    build:
      context: ./shadcn-ui
      dockerfile: Dockerfile
    container_name: ifilm-frontend
    environment:
      VITE_API_URL: http://localhost:5000/api
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - ifilm-network

volumes:
  postgres_data:
  redis_data:

networks:
  ifilm-network:
    driver: bridge
```

### 2. Create Backend Dockerfile

Create `Dockerfile` in `/workspace/backend`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

### 3. Create Frontend Dockerfile

Create `Dockerfile` in `/workspace/shadcn-ui`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install -g pnpm
RUN pnpm install

COPY . .
RUN pnpm run build

EXPOSE 3000

CMD ["pnpm", "run", "preview", "--host", "0.0.0.0", "--port", "3000"]
```

### 4. Run with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

---

## Troubleshooting

### Backend Issues

**Issue: "Database connection failed"**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check database exists
psql -U postgres -l | grep ifilm

# Test connection
psql -U postgres -d ifilm -c "SELECT 1;"
```

**Issue: "Redis connection failed"**
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check Redis connection
redis-cli -h localhost -p 6379 ping
```

**Issue: "JWT token invalid"**
- Ensure JWT_SECRET in `.env` is at least 32 characters
- Clear browser localStorage and re-login
- Check token expiration settings

### Frontend Issues

**Issue: "API request failed"**
- Verify backend is running on correct port
- Check CORS settings in backend `.env`
- Verify VITE_API_URL in frontend `.env`

**Issue: "Cannot connect to backend"**
```bash
# Test backend health endpoint
curl http://localhost:5000/health

# Should return: {"status":"ok","timestamp":"..."}
```

### Jellyfin Integration Issues

**Issue: "Jellyfin connection failed"**
- Verify Jellyfin server is running
- Check server URL is correct (include http:// or https://)
- Verify API key is valid
- Check firewall settings

**Issue: "No media items found"**
- Ensure Jellyfin libraries are scanned
- Check library visibility settings in admin panel
- Verify API key has access to libraries

### Database Migration Issues

**Issue: "Migration failed"**
```bash
# Drop and recreate database
psql -U postgres -c "DROP DATABASE IF EXISTS ifilm;"
psql -U postgres -c "CREATE DATABASE ifilm;"

# Re-run migrations
cd /workspace/backend
psql -U postgres -d ifilm -f migrations/001_create_users.sql
psql -U postgres -d ifilm -f migrations/002_create_watch_history.sql
psql -U postgres -d ifilm -f migrations/003_create_favorites.sql
psql -U postgres -d ifilm -f migrations/004_create_jellyfin_config.sql
```

---

## Performance Optimization

### Backend Optimization

1. **Enable Redis Caching**
   - Ensure Redis is running
   - Media metadata cached for 5 minutes
   - Session data stored in Redis

2. **Database Indexing**
   - All indexes created via migrations
   - Monitor slow queries with `EXPLAIN ANALYZE`

3. **Connection Pooling**
   - PostgreSQL pool size: 20 connections
   - Adjust in `config/database.ts` if needed

### Frontend Optimization

1. **Code Splitting**
   - React.lazy() for route-based splitting
   - Implemented in App.tsx

2. **Image Optimization**
   - Use WebP format when possible
   - Lazy load images with `loading="lazy"`

3. **Bundle Size**
   - Run `pnpm run build` to check bundle size
   - Use `pnpm run preview` to test production build

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Generate secure JWT secrets (32+ characters)
- [ ] Enable HTTPS in production
- [ ] Set strong PostgreSQL password
- [ ] Enable Redis password authentication
- [ ] Configure firewall rules
- [ ] Enable rate limiting
- [ ] Regular security updates
- [ ] Backup database regularly
- [ ] Monitor logs for suspicious activity

---

## Next Steps

1. **Configure Jellyfin**: Follow [Jellyfin Integration Guide](./jellyfin_integration.md)
2. **Create Admin Account**: Register and promote to admin role
3. **Sync Libraries**: Use admin panel to sync Jellyfin libraries
4. **Test Streaming**: Play a movie to verify streaming works
5. **Customize**: Adjust settings and branding as needed

---

## Support

For issues and questions:
- Check [Jellyfin Integration Guide](./jellyfin_integration.md)
- Review system logs: `docker-compose logs -f`
- Check backend logs: `cd backend && npm run dev`
- Verify database: `psql -U postgres -d ifilm`

---

**Last Updated**: 2025-01-15
**Version**: 1.0