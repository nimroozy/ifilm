# iFilm - Jellyfin Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Jellyfin Setup](#jellyfin-setup)
3. [API Key Generation](#api-key-generation)
4. [Connecting iFilm to Jellyfin](#connecting-ifilm-to-jellyfin)
5. [Library Management](#library-management)
6. [Streaming Configuration](#streaming-configuration)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [API Reference](#api-reference)

---

## Overview

iFilm integrates with Jellyfin as the backend media server. Jellyfin handles:
- Media storage and organization
- Video transcoding
- Metadata management
- Streaming infrastructure

iFilm provides:
- Custom Netflix-style frontend
- User authentication and authorization
- Watch history and favorites
- Admin panel for configuration

**Integration Architecture**:
```
[iFilm Frontend] → [iFilm Backend] → [Jellyfin Server]
                      ↓
                  [PostgreSQL]
                  [Redis Cache]
```

---

## Jellyfin Setup

### 1. Install Jellyfin Server

**Windows**:
```bash
# Download installer from https://jellyfin.org/downloads
# Run the installer and follow the wizard
```

**macOS**:
```bash
# Using Homebrew
brew install --cask jellyfin

# Or download from https://jellyfin.org/downloads
```

**Linux (Ubuntu/Debian)**:
```bash
# Add Jellyfin repository
curl https://repo.jellyfin.org/install-debuntu.sh | sudo bash

# Install Jellyfin
sudo apt install jellyfin

# Start service
sudo systemctl start jellyfin
sudo systemctl enable jellyfin
```

**Docker**:
```bash
docker run -d \
  --name jellyfin \
  --user 1000:1000 \
  --net=host \
  --volume /path/to/config:/config \
  --volume /path/to/cache:/cache \
  --volume /path/to/media:/media \
  --restart=unless-stopped \
  jellyfin/jellyfin
```

### 2. Initial Jellyfin Configuration

1. **Access Jellyfin Web Interface**:
   - Open browser to `http://localhost:8096`
   - Or `http://YOUR_SERVER_IP:8096`

2. **Complete Setup Wizard**:
   - Select language
   - Create admin account
   - Add media libraries
   - Configure metadata providers

3. **Add Media Libraries**:
   - Click "Add Media Library"
   - Select content type (Movies, Shows, Music)
   - Browse to media folder
   - Configure metadata settings
   - Click "OK"

4. **Scan Libraries**:
   - Navigate to Dashboard → Libraries
   - Click "Scan All Libraries"
   - Wait for scan to complete

### 3. Verify Jellyfin is Working

```bash
# Test Jellyfin API
curl http://localhost:8096/System/Info/Public

# Should return JSON with server info
```

---

## API Key Generation

### Method 1: Via Jellyfin Web Interface (Recommended)

1. **Log in to Jellyfin**:
   - Go to `http://localhost:8096`
   - Sign in with admin account

2. **Navigate to API Keys**:
   - Click user icon (top right)
   - Select "Dashboard"
   - Go to "Advanced" section
   - Click "API Keys"

3. **Create New API Key**:
   - Click "+" button
   - Enter app name: `iFilm Integration`
   - Click "OK"
   - **Copy the API key immediately** (shown only once)

4. **Save API Key Securely**:
   ```bash
   # Example API key format
   1234567890abcdef1234567890abcdef
   ```

### Method 2: Via Jellyfin API

```bash
# Authenticate and get access token
curl -X POST http://localhost:8096/Users/AuthenticateByName \
  -H "Content-Type: application/json" \
  -d '{
    "Username": "admin",
    "Pw": "your_password"
  }'

# Response includes AccessToken
# Use this token as API key
```

---

## Connecting iFilm to Jellyfin

### Option 1: Via Admin Panel (Recommended)

1. **Start iFilm Application**:
   ```bash
   # Terminal 1: Backend
   cd /workspace/backend
   npm run dev

   # Terminal 2: Frontend
   cd /workspace/shadcn-ui
   pnpm run dev
   ```

2. **Register Admin Account**:
   - Go to `http://localhost:3000/register`
   - Create account with your email
   - Promote to admin:
     ```sql
     psql -U postgres -d ifilm
     UPDATE users SET role = 'admin' WHERE email = 'your_email@example.com';
     ```

3. **Configure Jellyfin Connection**:
   - Log in to iFilm
   - Navigate to Admin Panel
   - Click "Jellyfin Configuration"
   - Enter details:
     - **Server URL**: `http://localhost:8096`
     - **API Key**: (paste your Jellyfin API key)
   - Click "Test Connection"
   - If successful, click "Save"

4. **Sync Libraries**:
   - In Admin Panel, go to "Library Management"
   - Click "Sync Libraries"
   - Wait for sync to complete
   - Toggle visibility for each library

### Option 2: Direct Database Configuration

```sql
-- Connect to database
psql -U postgres -d ifilm

-- Encrypt API key first (use backend encryption utility)
-- Then insert config

INSERT INTO jellyfin_config (
  server_url,
  api_key_encrypted,
  is_active,
  server_name,
  server_version
) VALUES (
  'http://localhost:8096',
  'ENCRYPTED_API_KEY_HERE',
  true,
  'My Jellyfin Server',
  '10.8.0'
);
```

### Option 3: Environment Variables (Development Only)

```bash
# Add to backend/.env
JELLYFIN_SERVER_URL=http://localhost:8096
JELLYFIN_API_KEY=your_api_key_here
```

**Note**: This method is not recommended for production as it doesn't use encryption.

---

## Library Management

### Understanding Jellyfin Libraries

Jellyfin organizes media into libraries:
- **Movies**: Feature films
- **TV Shows**: Series with seasons and episodes
- **Music**: Audio files and albums
- **Mixed**: Combined content types

### Syncing Libraries to iFilm

1. **Automatic Sync** (via Admin Panel):
   - Navigate to Admin Panel → Library Management
   - Click "Sync Libraries"
   - iFilm fetches all libraries from Jellyfin
   - Libraries appear in the list

2. **Manual Sync** (via API):
   ```bash
   curl -X POST http://localhost:5000/api/admin/jellyfin/sync \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```

### Controlling Library Visibility

**Via Admin Panel**:
1. Go to Library Management
2. Toggle "Visible" switch for each library
3. Click "Save Changes"

**Via Database**:
```sql
-- Hide a specific library
UPDATE jellyfin_libraries
SET is_visible = false
WHERE library_name = 'Kids Movies';

-- Show all libraries
UPDATE jellyfin_libraries
SET is_visible = true;
```

### Library Filtering

Filter content by:
- **Content Rating**: Hide adult content
- **Genre**: Show only specific genres
- **Year**: Hide content older than X years

**Example: Hide Adult Content**:
```sql
-- This requires custom implementation
-- Add to backend service layer
```

---

## Streaming Configuration

### Understanding Jellyfin Streaming

Jellyfin provides multiple streaming methods:
1. **Direct Play**: Stream original file (no transcoding)
2. **Direct Stream**: Remux container without transcoding video
3. **Transcode**: Convert video on-the-fly

### HLS Streaming (Recommended for iFilm)

**Why HLS?**:
- Adaptive bitrate streaming
- Better browser compatibility
- Efficient bandwidth usage
- Supports multiple quality levels

**iFilm HLS Implementation**:
```typescript
// Backend generates HLS stream URL
const hlsUrl = `${jellyfinUrl}/Videos/${itemId}/master.m3u8?api_key=${apiKey}`;

// Frontend uses HLS.js to play
const player = new Hls();
player.loadSource(hlsUrl);
player.attachMedia(videoElement);
```

### Stream Security

**iFilm Security Model**:
1. User requests stream from iFilm backend
2. Backend generates short-lived stream token (15 min)
3. Backend proxies stream request to Jellyfin
4. Jellyfin API key never exposed to frontend

**Stream Token Flow**:
```
[Frontend] → POST /api/media/stream { mediaId }
              ↓
[Backend]  → Generate JWT stream token
              ↓
[Backend]  → Return proxied stream URL
              ↓
[Frontend] → Request video segments with token
              ↓
[Backend]  → Validate token, proxy to Jellyfin
              ↓
[Jellyfin] → Return video segments
```

### Transcoding Settings

**Jellyfin Transcoding Configuration**:
1. Go to Jellyfin Dashboard → Playback
2. Configure transcoding settings:
   - **Hardware Acceleration**: Enable if available (NVIDIA, Intel QSV, AMD)
   - **Max Streaming Bitrate**: 20 Mbps (default)
   - **Throttle Transcodes**: Enable to save resources

**Recommended Settings for iFilm**:
- Enable hardware acceleration for better performance
- Set max bitrate to 20 Mbps for 1080p
- Enable HLS segmenter
- Set segment length to 6 seconds

---

## Security Best Practices

### 1. API Key Security

**DO**:
- ✅ Store API keys encrypted in database
- ✅ Use AES-256 encryption
- ✅ Keep encryption key in environment variables
- ✅ Rotate API keys every 90 days
- ✅ Use separate API keys for dev/staging/prod

**DON'T**:
- ❌ Never commit API keys to git
- ❌ Never expose API keys to frontend
- ❌ Never log API keys
- ❌ Never share API keys via email/chat

### 2. Network Security

**Jellyfin Server**:
```bash
# Use HTTPS for Jellyfin
# Configure reverse proxy (Nginx)

server {
    listen 443 ssl http2;
    server_name jellyfin.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8096;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**iFilm Backend Proxy**:
- All Jellyfin requests go through iFilm backend
- Backend adds authentication headers
- Frontend never communicates directly with Jellyfin

### 3. Access Control

**Jellyfin User Permissions**:
- Create a dedicated Jellyfin user for iFilm
- Grant only necessary permissions
- Disable admin access for integration user

**iFilm User Roles**:
- **User**: Can browse and watch content
- **Admin**: Can configure Jellyfin, manage users

### 4. Rate Limiting

**Implement Rate Limits**:
```typescript
// Backend rate limiting
import rateLimit from 'express-rate-limit';

const streamLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many stream requests',
});

app.use('/api/media/stream', streamLimiter);
```

---

## Troubleshooting

### Issue 1: "Cannot connect to Jellyfin server"

**Symptoms**:
- Test connection fails in admin panel
- Error: "ECONNREFUSED" or "Network error"

**Solutions**:
1. **Verify Jellyfin is running**:
   ```bash
   curl http://localhost:8096/System/Info/Public
   ```

2. **Check firewall**:
   ```bash
   # Linux
   sudo ufw allow 8096/tcp

   # Windows
   # Add firewall rule for port 8096
   ```

3. **Verify URL format**:
   - Correct: `http://localhost:8096`
   - Incorrect: `localhost:8096` (missing http://)
   - Incorrect: `http://localhost:8096/` (trailing slash)

4. **Check Docker network** (if using Docker):
   ```bash
   docker network inspect bridge
   # Ensure containers are on same network
   ```

### Issue 2: "Invalid API key"

**Symptoms**:
- Connection test fails with 401 Unauthorized
- Jellyfin returns "Invalid API key"

**Solutions**:
1. **Verify API key is correct**:
   ```bash
   curl http://localhost:8096/System/Info \
     -H "X-Emby-Token: YOUR_API_KEY"
   ```

2. **Regenerate API key**:
   - Go to Jellyfin Dashboard → API Keys
   - Delete old key
   - Create new key
   - Update in iFilm admin panel

3. **Check API key encryption**:
   ```bash
   # Verify encryption key is set
   echo $ENCRYPTION_KEY

   # Should be 32 characters
   ```

### Issue 3: "No media items found"

**Symptoms**:
- Libraries sync successfully
- But no movies/series appear in iFilm

**Solutions**:
1. **Verify libraries are scanned in Jellyfin**:
   - Go to Jellyfin Dashboard → Libraries
   - Click "Scan All Libraries"
   - Wait for scan to complete

2. **Check library visibility**:
   ```sql
   psql -U postgres -d ifilm
   SELECT library_name, is_visible FROM jellyfin_libraries;
   ```

3. **Verify API permissions**:
   - Ensure API key has access to libraries
   - Check Jellyfin user permissions

4. **Clear cache**:
   ```bash
   # Clear Redis cache
   redis-cli FLUSHALL

   # Restart backend
   cd /workspace/backend
   npm run dev
   ```

### Issue 4: "Video won't play"

**Symptoms**:
- Video player loads but playback fails
- Black screen or infinite buffering

**Solutions**:
1. **Check video format compatibility**:
   - Jellyfin transcodes incompatible formats
   - Check Jellyfin Dashboard → Playback → Active Devices

2. **Verify stream URL**:
   ```bash
   # Test HLS stream
   curl http://localhost:8096/Videos/ITEM_ID/master.m3u8?api_key=YOUR_KEY
   ```

3. **Check browser console**:
   - Open DevTools (F12)
   - Look for HLS.js errors
   - Common: "MANIFEST_LOAD_ERROR", "FRAG_LOAD_ERROR"

4. **Enable transcoding**:
   - Go to Jellyfin Dashboard → Playback
   - Enable transcoding
   - Configure hardware acceleration

5. **Check CORS settings**:
   ```typescript
   // Backend CORS config
   app.use(cors({
     origin: 'http://localhost:3000',
     credentials: true,
   }));
   ```

### Issue 5: "Slow streaming / buffering"

**Symptoms**:
- Video buffers frequently
- Low quality despite good internet

**Solutions**:
1. **Enable hardware transcoding**:
   - Jellyfin Dashboard → Playback
   - Enable NVIDIA/Intel/AMD acceleration

2. **Adjust bitrate**:
   - Lower max streaming bitrate
   - Jellyfin Dashboard → Playback → Max Streaming Bitrate

3. **Check network**:
   ```bash
   # Test bandwidth to Jellyfin
   curl -o /dev/null http://localhost:8096/Videos/ITEM_ID/stream?api_key=KEY

   # Monitor network usage
   iftop -i eth0
   ```

4. **Optimize Jellyfin**:
   - Reduce segment length (3-6 seconds)
   - Enable throttle transcodes
   - Increase cache size

---

## API Reference

### Jellyfin API Endpoints Used by iFilm

#### System Info
```http
GET /System/Info
Headers:
  X-Emby-Token: {api_key}

Response:
{
  "ServerName": "My Jellyfin",
  "Version": "10.8.0",
  "Id": "server-id"
}
```

#### Get Libraries
```http
GET /Library/VirtualFolders
Headers:
  X-Emby-Token: {api_key}

Response:
[
  {
    "ItemId": "library-id",
    "Name": "Movies",
    "CollectionType": "movies"
  }
]
```

#### Get Items
```http
GET /Items
Headers:
  X-Emby-Token: {api_key}
Query Parameters:
  ParentId: library-id (optional)
  IncludeItemTypes: Movie,Series
  StartIndex: 0
  Limit: 20
  Recursive: true

Response:
{
  "Items": [...],
  "TotalRecordCount": 100
}
```

#### Get Item Details
```http
GET /Items/{itemId}
Headers:
  X-Emby-Token: {api_key}

Response:
{
  "Id": "item-id",
  "Name": "Movie Title",
  "Overview": "Description",
  "ProductionYear": 2023,
  ...
}
```

#### Get Stream URL
```http
GET /Videos/{itemId}/stream
Headers:
  X-Emby-Token: {api_key}
Query Parameters:
  Static: true
  MediaSourceId: source-id

Returns: Video file stream
```

#### Get HLS Playlist
```http
GET /Videos/{itemId}/master.m3u8
Headers:
  X-Emby-Token: {api_key}

Returns: HLS master playlist
```

### iFilm Backend API Endpoints

#### Connect Jellyfin
```http
POST /api/admin/jellyfin/connect
Headers:
  Authorization: Bearer {access_token}
Body:
{
  "serverUrl": "http://localhost:8096",
  "apiKey": "jellyfin-api-key"
}

Response:
{
  "success": true,
  "serverName": "My Jellyfin",
  "version": "10.8.0"
}
```

#### Sync Libraries
```http
POST /api/admin/jellyfin/sync
Headers:
  Authorization: Bearer {access_token}

Response:
{
  "librariesSynced": 3,
  "itemsProcessed": 150,
  "syncedAt": "2025-01-15T10:30:00Z"
}
```

#### Get Movies
```http
GET /api/media/movies
Headers:
  Authorization: Bearer {access_token}
Query Parameters:
  page: 1
  limit: 20

Response:
{
  "items": [...],
  "total": 100,
  "page": 1,
  "pages": 5
}
```

---

## Advanced Configuration

### Custom Metadata Providers

**Configure in Jellyfin**:
1. Dashboard → Libraries → Select Library
2. Click "Manage Library"
3. Configure metadata providers:
   - TheMovieDB (recommended)
   - TheTVDB
   - OMDb

### Subtitle Configuration

**Jellyfin Subtitle Settings**:
1. Dashboard → Playback → Subtitles
2. Configure:
   - Subtitle mode: Default, Always, Only Forced
   - Preferred language
   - Subtitle burning (for incompatible clients)

**iFilm Subtitle Support**:
- Supports VTT and SRT formats
- Multiple subtitle tracks
- Subtitle styling options
- Language selection in player

### Multi-User Setup

**Jellyfin Users**:
- Create separate Jellyfin users for different access levels
- Configure parental controls per user
- Set content restrictions

**iFilm Integration**:
- Use single Jellyfin user for all iFilm users
- Manage permissions in iFilm (not Jellyfin)
- Track watch history per iFilm user

---

## Performance Tuning

### Jellyfin Performance

1. **Enable Hardware Acceleration**:
   - NVIDIA GPU: Install NVIDIA drivers and NVENC
   - Intel: Enable Intel Quick Sync
   - AMD: Enable AMF

2. **Optimize Database**:
   ```bash
   # Vacuum Jellyfin database
   sqlite3 /path/to/jellyfin/data/library.db "VACUUM;"
   ```

3. **Increase Cache**:
   - Dashboard → Playback
   - Increase cache size to 500 MB+

### iFilm Performance

1. **Redis Caching**:
   - Media metadata: 5 minutes
   - Library lists: 10 minutes
   - User sessions: No expiry

2. **Database Indexing**:
   - All indexes created via migrations
   - Monitor slow queries

3. **CDN Integration** (Optional):
   - Use CDN for video streaming
   - Reduce Jellyfin server load

---

## Monitoring and Logs

### Jellyfin Logs

**Location**:
- Linux: `/var/log/jellyfin/`
- Windows: `C:\ProgramData\Jellyfin\Server\log\`
- Docker: `docker logs jellyfin`

**View Logs**:
```bash
# Linux
tail -f /var/log/jellyfin/log_*.txt

# Docker
docker logs -f jellyfin

# Via Dashboard
# Dashboard → Logs
```

### iFilm Logs

**Backend Logs**:
```bash
cd /workspace/backend
npm run dev
# Logs appear in console
```

**Monitor API Calls**:
```bash
# Enable debug logging
export DEBUG=ifilm:*
npm run dev
```

---

## Backup and Recovery

### Backup Jellyfin Configuration

```bash
# Backup Jellyfin data directory
tar -czf jellyfin-backup-$(date +%Y%m%d).tar.gz /var/lib/jellyfin/

# Backup Jellyfin database
cp /var/lib/jellyfin/data/library.db library.db.backup
```

### Backup iFilm Database

```bash
# Backup PostgreSQL database
pg_dump -U postgres ifilm > ifilm-backup-$(date +%Y%m%d).sql

# Restore database
psql -U postgres ifilm < ifilm-backup-20250115.sql
```

---

## Conclusion

This guide covers the complete integration between iFilm and Jellyfin. For additional support:

- **Jellyfin Documentation**: https://jellyfin.org/docs/
- **Jellyfin API Docs**: https://api.jellyfin.org/
- **iFilm Setup Guide**: See `setup_guide.md`

**Key Takeaways**:
- Always use HTTPS in production
- Keep API keys encrypted and secure
- Enable hardware transcoding for performance
- Monitor logs for issues
- Backup regularly

---

**Last Updated**: 2025-01-15
**Version**: 1.0