# iFilm - Media Streaming Platform

A modern, self-hosted media streaming platform built with React, Node.js, Express, and Jellyfin integration.

## 🚀 Quick Start (One-Click Installation)

### Prerequisites
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Root or sudo access
- At least 2GB RAM
- Docker and Docker Compose installed

### One-Click Installation

**Recommended Method (Clone First):**

```bash
git clone https://github.com/nimroozy/ifilm.git
cd ifilm
chmod +x install.sh
sudo ./install.sh
```

**Alternative (Direct Download):**

```bash
# If the repository is public, you can use:
curl -fsSL https://raw.githubusercontent.com/nimroozy/ifilm/main/install.sh | bash

# Or download manually:
wget https://raw.githubusercontent.com/nimroozy/ifilm/main/install.sh
chmod +x install.sh
sudo ./install.sh
```

> **Note:** If you get a 404 error, the repository might be private. Use the clone method instead.

## 📋 Manual Installation

### 1. Clone Repository

```bash
git clone https://github.com/nimroozy/ifilm.git
cd ifilm
```

### 2. Install Dependencies

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd ../shadcn-ui
npm install -g pnpm@8.10.0
pnpm install
```

### 3. Configure Environment Variables

#### Backend (.env)
```bash
cd backend
cp .env.example .env
# Edit .env with your settings
```

Required variables:
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `JELLYFIN_SERVER_URL`, `JELLYFIN_API_KEY`
- `REDIS_HOST`, `REDIS_PORT`

#### Frontend (.env)
```bash
cd shadcn-ui
echo "VITE_API_URL=/api" > .env
```

### 4. Database Setup

```bash
cd backend
npm run migrate
```

### 5. Build

#### Backend
```bash
cd backend
npm run build
```

#### Frontend
```bash
cd shadcn-ui
pnpm run build
```

### 6. Start Services

#### Using PM2 (Recommended)
```bash
# Backend
cd backend
pm2 start ecosystem.config.js --name ifilm-backend

# Frontend (if using preview server)
cd shadcn-ui
pm2 start "pnpm run preview --host 0.0.0.0 --port 3000" --name ifilm-frontend
```

#### Using Docker Compose
```bash
docker-compose up -d
```

## 🐳 Docker Installation

### Using Docker Compose

1. **Create `.env` file**:
```bash
cat > .env << EOF
DB_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
ENCRYPTION_KEY=your_encryption_key
CORS_ORIGIN=https://yourdomain.com
VITE_API_URL=/api
EOF
```

2. **Start services**:
```bash
docker-compose up -d
```

3. **Check logs**:
```bash
docker-compose logs -f
```

## 🔧 Configuration

### Jellyfin Integration

1. Access your Jellyfin server admin panel
2. Go to **Settings → API Keys**
3. Create a new API key
4. Update `backend/.env`:
   ```
   JELLYFIN_SERVER_URL=http://your-jellyfin-server:8096
   JELLYFIN_API_KEY=your_api_key_here
   ```

### NGINX Reverse Proxy (Production)

Example NGINX configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

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

## 📁 Project Structure

```
ifilm/
├── backend/           # Node.js/Express backend API
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   └── server.ts
│   └── migrations/    # Database migrations
├── shadcn-ui/         # React frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── services/
│   └── public/
└── docker-compose.yml # Docker configuration
```

## 🛠️ Development

### Backend Development
```bash
cd backend
npm run dev
```

### Frontend Development
```bash
cd shadcn-ui
pnpm run dev
```

## 🔐 Security Features

- JWT authentication with refresh tokens
- Password encryption with bcrypt
- CORS protection
- Rate limiting
- Helmet security headers
- SQL injection prevention
- XSS protection

## 📝 API Documentation

API endpoints are available at `/api`:

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/media/movies` - Get movies list
- `GET /api/media/series` - Get series list
- `GET /api/media/stream/:id` - Stream media

## 🐛 Troubleshooting

### Backend won't start
- Check database connection in `.env`
- Verify Jellyfin server is accessible
- Check Redis connection

### Frontend images not loading
- Ensure backend returns relative URLs (`/api/...`)
- Check CORS configuration
- Verify NGINX proxy settings

### Build fails
- Clear `node_modules` and reinstall
- Check Node.js version (v18+)
- Verify all environment variables are set

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.

## 🙏 Acknowledgments

- Jellyfin for media server capabilities
- React & Vite for frontend framework
- Express.js for backend framework
