# iFilm - System Design Document

## 1. Implementation Approach

### 1.1 Overview
iFilm is a custom Netflix-style streaming platform that integrates with Jellyfin as the backend media server. The system follows a modern three-tier architecture with clear separation between frontend, backend, and external services.

### 1.2 Core Technologies

**Frontend Stack:**
- **React.js 18+** with TypeScript for type safety and better developer experience
- **Tailwind CSS** for utility-first styling and responsive design
- **Redux Toolkit** for centralized state management
- **React Router v6** for client-side routing
- **HLS.js** for adaptive video streaming with HLS protocol support
- **Axios** for HTTP client with interceptors for authentication
- **Shadcn-ui** for pre-built, accessible UI components

**Backend Stack:**
- **Node.js 18+** with Express.js framework
- **TypeScript** for type-safe backend development
- **PostgreSQL 15+** for relational data storage (users, watch history, favorites)
- **Redis 7+** for session management and caching
- **JWT (jsonwebtoken)** for authentication and authorization
- **bcrypt** for password hashing
- **node-cache** for in-memory caching

**External Integration:**
- **Jellyfin REST API** for media management and streaming

**DevOps & Deployment:**
- **Docker & Docker Compose** for containerization
- **Nginx** as reverse proxy and static file server
- **PM2** for Node.js process management
- **GitHub Actions** for CI/CD

### 1.3 Key Implementation Challenges & Solutions

**Challenge 1: Secure Jellyfin API Key Management**
- **Solution**: Implement API Key Vault with AES-256 encryption, store encrypted keys in database, decrypt only in backend memory, never expose to frontend

**Challenge 2: Efficient Media Metadata Caching**
- **Solution**: Multi-layer caching strategy:
  - Redis for frequently accessed metadata (5-minute TTL)
  - In-memory cache for hot data (1-minute TTL)
  - Database cache table for long-term storage

**Challenge 3: Secure Video Streaming**
- **Solution**: Backend proxy pattern:
  - Generate short-lived JWT stream tokens (15-minute expiry)
  - All stream requests go through backend proxy
  - Backend adds Jellyfin authentication headers
  - Token validation on every stream request

**Challenge 4: Real-time Watch Progress Tracking**
- **Solution**: 
  - Frontend sends progress updates every 10 seconds
  - Backend debounces and batches database writes
  - Use UPSERT operations to avoid race conditions

**Challenge 5: Responsive Video Player**
- **Solution**:
  - HLS.js for adaptive bitrate streaming
  - Quality auto-switching based on bandwidth
  - Mobile-optimized controls with touch gestures
  - Picture-in-picture support

### 1.4 MVP Feature Prioritization

**Phase 1 (Core Features - Week 1-2):**
1. User authentication (register, login, JWT)
2. Jellyfin connection and API integration
3. Movie browsing and search
4. Basic video player with HLS support
5. Watch progress tracking

**Phase 2 (Enhanced Features - Week 3):**
1. Series support with seasons and episodes
2. Favorites/My List functionality
3. Watch history page
4. User profile management
5. Subtitle support

**Phase 3 (Admin & Polish - Week 4):**
1. Admin panel for Jellyfin configuration
2. User management for admins
3. Library visibility controls
4. Performance optimization
5. Mobile responsiveness refinement

**Phase 4 (Advanced Features - Future):**
1. Multi-profile support per account
2. Parental controls
3. Recommendations engine
4. Social features (watch together)
5. Download for offline viewing

---

## 2. Main User-UI Interaction Patterns

### 2.1 First-Time User Journey
1. **Landing Page** → User sees hero section with featured content
2. **Sign Up** → User clicks "Get Started", fills registration form (email, username, password)
3. **Email Verification** (optional) → User receives verification email
4. **Login** → User enters credentials, receives JWT tokens
5. **Home Page** → User sees personalized homepage with trending content
6. **Browse** → User explores movies/series by genre, search, or recommendations
7. **Watch** → User clicks play, video player opens in full-screen mode
8. **Track Progress** → System automatically saves watch progress every 10 seconds

### 2.2 Returning User Journey
1. **Login** → User enters credentials or auto-login via refresh token
2. **Home Page** → User sees "Continue Watching" row at top with progress indicators
3. **Resume Watching** → User clicks on partially watched content, video resumes from saved position
4. **Discover New Content** → User browses recommendations based on watch history
5. **Manage Favorites** → User adds/removes content from "My List"

### 2.3 Video Playback Interactions
1. **Play Button** → User clicks play on movie/episode card or details page
2. **Player Controls** → User can:
   - Play/Pause (spacebar or click)
   - Seek forward/backward (arrow keys or progress bar drag)
   - Adjust volume (up/down arrows or volume slider)
   - Toggle fullscreen (F key or fullscreen button)
   - Change quality (settings menu)
   - Enable subtitles (CC button)
   - Skip intro/credits (if available)
3. **Auto-Play Next** → For series, next episode auto-plays after 5-second countdown
4. **Exit Player** → User clicks back button or ESC key to return to details page

### 2.4 Search & Discovery Interactions
1. **Search Bar** → User types query, sees instant suggestions
2. **Search Results** → User sees filtered results by movies/series
3. **Filter & Sort** → User applies genre filters, sort by rating/year/popularity
4. **Infinite Scroll** → User scrolls down, more results load automatically
5. **Quick Preview** → User hovers over card, sees trailer preview (future feature)

### 2.5 Admin Panel Interactions
1. **Admin Access** → Admin user clicks "Admin Panel" in profile dropdown
2. **Jellyfin Configuration** → Admin enters server URL and API key, clicks "Test Connection"
3. **Library Sync** → Admin clicks "Sync Libraries", system fetches all media from Jellyfin
4. **User Management** → Admin views user list, can edit roles or delete users
5. **Library Visibility** → Admin toggles which Jellyfin libraries are visible to users

### 2.6 Mobile-Specific Interactions
1. **Hamburger Menu** → Mobile users tap menu icon to access navigation
2. **Swipe Gestures** → Swipe left/right to navigate between sections
3. **Touch Controls** → Tap video to show/hide controls, double-tap to skip 10 seconds
4. **Portrait/Landscape** → Video player auto-rotates to landscape for full-screen

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Web Browser (Chrome, Firefox, Safari, Edge)             │  │
│  │  - React SPA                                              │  │
│  │  - Responsive UI (Desktop, Tablet, Mobile)               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTPS
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Layer (React)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Components: Header, MovieCard, VideoPlayer, etc.        │  │
│  │  State Management: Redux Toolkit                         │  │
│  │  Routing: React Router                                   │  │
│  │  API Client: Axios with interceptors                     │  │
│  │  Video Player: HLS.js                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              ↓ REST API (HTTPS)
┌─────────────────────────────────────────────────────────────────┐
│                   Backend Layer (Node.js + Express)              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Gateway + Middleware (Auth, Rate Limit, CORS)       │  │
│  │  Controllers: Auth, Media, User, Admin                   │  │
│  │  Services: Jellyfin, User, WatchHistory, Favorites       │  │
│  │  Security: JWT Manager, API Key Vault, Request Proxy     │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    ↓                              ↓
┌──────────────────────────────┐    ┌──────────────────────────────┐
│      Data Layer              │    │   External Services          │
│  ┌────────────────────────┐ │    │  ┌────────────────────────┐ │
│  │  PostgreSQL            │ │    │  │  Jellyfin Server       │ │
│  │  - users               │ │    │  │  - REST API            │ │
│  │  - watch_history       │ │    │  │  - Media Storage       │ │
│  │  - favorites           │ │    │  │  - Transcoding         │ │
│  │  - jellyfin_config     │ │    │  └────────────────────────┘ │
│  └────────────────────────┘ │    └──────────────────────────────┘
│  ┌────────────────────────┐ │
│  │  Redis Cache           │ │
│  │  - Sessions            │ │
│  │  - Media metadata      │ │
│  │  - Token blacklist     │ │
│  └────────────────────────┘ │
└──────────────────────────────┘
```

### 3.2 Component Interaction Flow

See `architecture.plantuml` for detailed PlantUML diagram showing:
- Frontend components and their relationships
- Backend controllers, services, and security layers
- Data layer (PostgreSQL + Redis)
- External Jellyfin API integration
- Request/response flow with authentication

### 3.3 Security Architecture

**Authentication Flow:**
1. User submits credentials → Backend validates → Generates JWT access token (1 hour) + refresh token (7 days)
2. Frontend stores tokens in localStorage (access) and httpOnly cookie (refresh)
3. Every API request includes access token in Authorization header
4. Backend middleware validates token, extracts user ID and role
5. Expired access tokens trigger automatic refresh using refresh token

**API Key Protection:**
1. Jellyfin API keys stored encrypted in PostgreSQL using AES-256
2. Encryption key stored in environment variables, never in code
3. Backend decrypts keys only when making Jellyfin API calls
4. Keys never exposed to frontend or API responses

**Stream Security:**
1. User requests stream URL → Backend generates short-lived stream token (15 min)
2. Stream token includes: userId, mediaId, expiration timestamp
3. All video requests go through backend proxy with token validation
4. Backend adds Jellyfin authentication headers before proxying to Jellyfin
5. Expired tokens return 401, frontend requests new token

**Rate Limiting:**
- 100 requests per minute per user for general API
- 10 requests per minute for login attempts
- 5 requests per minute for stream URL generation
- Redis-based counter with sliding window

---

## 4. Data Structures and Interfaces

### 4.1 Frontend Interfaces (TypeScript)

**Core Media Interfaces:**
```typescript
interface IMediaItem {
    id: string;
    title: string;
    type: "movie" | "series";
    overview: string;
    posterUrl: string;
    backdropUrl: string;
    year: number;
    rating: number;
    duration: number;
    genres: string[];
}

interface IEpisode {
    id: string;
    seriesId: string;
    seasonNumber: number;
    episodeNumber: number;
    title: string;
    overview: string;
    duration: number;
    thumbnailUrl: string;
}

interface IStreamInfo {
    streamUrl: string;
    token: string;
    expiresAt: Date;
    subtitles: ISubtitle[];
    qualities: IQuality[];
}
```

**User & State Interfaces:**
```typescript
interface IUser {
    id: string;
    email: string;
    username: string;
    role: "user" | "admin";
    avatar?: string;
    createdAt: Date;
}

interface IAuthState {
    user: IUser | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    loading: boolean;
}

interface IWatchHistory {
    id: string;
    userId: string;
    mediaId: string;
    mediaType: "movie" | "episode";
    progress: number;
    duration: number;
    lastWatched: Date;
}
```

### 4.2 Backend Models (TypeScript + PostgreSQL)

**User Model:**
```typescript
class User {
    id: string;
    email: string;
    username: string;
    passwordHash: string;
    role: "user" | "admin";
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
    
    async validatePassword(password: string): Promise<boolean>;
    generateAuthToken(): string;
}
```

**Jellyfin Service Interface:**
```typescript
interface IJellyfinClient {
    authenticate(serverUrl: string, apiKey: string): Promise<boolean>;
    getLibraries(): Promise<IJellyfinLibrary[]>;
    getMovies(libraryId: string, startIndex: number, limit: number): Promise<IJellyfinItem[]>;
    getSeries(libraryId: string, startIndex: number, limit: number): Promise<IJellyfinItem[]>;
    getItemDetails(itemId: string): Promise<IJellyfinItem>;
    getSeasons(seriesId: string): Promise<IJellyfinSeason[]>;
    getEpisodes(seriesId: string, seasonId: string): Promise<IJellyfinEpisode[]>;
    getStreamUrl(itemId: string, userId: string): Promise<string>;
    getImageUrl(itemId: string, imageType: string): string;
    search(query: string): Promise<IJellyfinItem[]>;
}
```

See `class_diagram.plantuml` for complete class diagram with:
- All frontend service classes (ApiClient, AuthService, MediaService, UserService, VideoPlayer)
- All backend models (User, WatchHistory, Favorite, JellyfinConfig)
- All backend services (JellyfinService, AuthController, MediaController, etc.)
- Security components (JWTManager, APIKeyVault, RequestProxy)
- Relationships and dependencies

---

## 5. Program Call Flow

### 5.1 User Authentication Flow

**Registration Sequence:**
1. User submits registration form → Frontend validates input
2. Frontend sends POST /api/auth/register with {email, username, password}
3. Backend AuthController receives request
4. UserService checks if email/username exists
5. UserService hashes password with bcrypt (10 rounds)
6. UserService inserts user into PostgreSQL
7. JWTManager generates access token (1h) and refresh token (7d)
8. Backend stores session in Redis
9. Backend returns {user, accessToken, refreshToken}
10. Frontend stores tokens and redirects to home page

**Login Sequence:**
1. User submits login form → Frontend validates input
2. Frontend sends POST /api/auth/login with {email, password}
3. Backend AuthController receives request
4. UserService queries user by email from PostgreSQL
5. UserService validates password using bcrypt.compare()
6. JWTManager generates new tokens
7. Backend updates session in Redis
8. Backend returns {user, accessToken, refreshToken}
9. Frontend stores tokens and redirects to home page

### 5.2 Media Browsing Flow

**Get Movies List:**
1. User navigates to Movies page → Frontend sends GET /api/media/movies?page=1&limit=20
2. Backend Auth Middleware validates JWT token
3. MediaController calls JellyfinService.getMovies(page, limit)
4. JellyfinService checks Redis cache for "movies:page:1"
5. If cache miss, JellyfinService calls Jellyfin API GET /Items?IncludeItemTypes=Movie
6. JellyfinService transforms Jellyfin items to IMediaItem format
7. JellyfinService caches result in Redis (5-minute TTL)
8. Backend returns {movies: IMediaItem[], total: number, page: number}
9. Frontend renders movie grid with infinite scroll

**Get Movie Details:**
1. User clicks movie card → Frontend sends GET /api/media/movies/{id}
2. Backend validates token and calls JellyfinService.getMediaDetails(id)
3. JellyfinService checks cache, if miss calls Jellyfin API GET /Items/{id}
4. MediaController queries watch_history and favorites tables
5. Backend returns detailed media info + watch progress + favorite status
6. Frontend renders movie details page with play button

### 5.3 Video Streaming Flow

**Request Stream URL:**
1. User clicks Play button → Frontend sends POST /api/media/stream with {mediaId, mediaType}
2. Backend validates token and calls StreamService.generateStreamUrl(mediaId, userId)
3. JWTManager generates stream token with 15-minute expiry
4. RequestProxy calls Jellyfin API GET /Items/{id}/PlaybackInfo with decrypted API key
5. RequestProxy builds proxied stream URL: https://ifilm.com/api/stream/{mediaId}?token={streamToken}
6. Backend returns {streamUrl, token, expiresAt, subtitles, qualities}
7. Frontend initializes HLS.js player with streamUrl

**Video Playback:**
1. HLS.js requests master.m3u8 manifest from backend proxy
2. Backend proxy validates stream token
3. Backend proxy adds Jellyfin auth headers and forwards request to Jellyfin
4. Jellyfin returns HLS manifest
5. Backend proxy returns manifest to frontend
6. HLS.js parses manifest and requests video segments
7. All segment requests go through backend proxy with token validation
8. Video plays in browser with adaptive bitrate

**Watch Progress Tracking:**
1. Every 10 seconds, VideoPlayer sends onProgress event to React component
2. Frontend sends PUT /api/user/watch-progress with {mediaId, progress, duration}
3. Backend validates token and calls WatchHistoryService.updateProgress()
4. Backend performs UPSERT into watch_history table
5. Backend returns 200 OK
6. Frontend continues playback

### 5.4 Admin Panel Flow

**Connect Jellyfin Server:**
1. Admin enters server URL and API key → Frontend sends POST /api/admin/jellyfin/connect
2. Backend validates admin role
3. JellyfinService tests connection by calling Jellyfin API GET /System/Info
4. If successful, APIKeyVault encrypts API key
5. Backend inserts into jellyfin_config table
6. Backend returns {success: true, serverName, version}
7. Frontend shows success message

**Sync Libraries:**
1. Admin clicks "Sync Libraries" → Frontend sends POST /api/admin/jellyfin/sync
2. Backend validates admin role
3. JellyfinService calls Jellyfin API GET /Library/VirtualFolders
4. For each library, JellyfinService calls GET /Items?ParentId={libraryId}
5. JellyfinService caches all items in Redis and media_cache table
6. Backend returns {librariesSynced, itemsProcessed, syncedAt}
7. Frontend shows sync completion message

See `sequence_diagram.plantuml` for detailed sequence diagrams covering:
- Complete authentication flow (register, login, token refresh)
- Media browsing and details retrieval
- Video streaming with HLS
- Watch progress tracking
- Admin panel operations

---

## 6. Database ER Diagram

### 6.1 Core Tables

**users**
- Primary Key: id (UUID)
- Unique: email, username
- Fields: password_hash, role (enum: user/admin), avatar, is_active, timestamps
- Indexes: email, username, role, created_at

**user_sessions**
- Primary Key: id (UUID)
- Foreign Key: user_id → users.id
- Fields: access_token, refresh_token, expires_at, ip_address, user_agent, created_at
- Indexes: user_id, expires_at, access_token

**watch_history**
- Primary Key: id (UUID)
- Foreign Key: user_id → users.id
- Fields: media_id, media_type (enum: movie/episode), media_title, progress, duration, percentage, last_watched, timestamps
- Unique: (user_id, media_id, media_type)
- Indexes: (user_id, media_id), last_watched DESC, media_type

**favorites**
- Primary Key: id (UUID)
- Foreign Key: user_id → users.id
- Fields: media_id, media_type (enum: movie/series), media_title, media_poster_url, added_at
- Unique: (user_id, media_id, media_type)
- Indexes: (user_id, media_id), added_at DESC

**jellyfin_config**
- Primary Key: id (UUID)
- Fields: server_url, api_key_encrypted, jellyfin_user_id, server_name, server_version, is_active, last_sync, timestamps
- Only one active config at a time

**jellyfin_libraries**
- Primary Key: id (UUID)
- Foreign Key: config_id → jellyfin_config.id
- Fields: library_id, library_name, collection_type (enum: movies/tvshows/music), is_visible, item_count, last_sync, created_at

**media_cache**
- Primary Key: id (UUID)
- Unique: (media_id, media_type)
- Fields: media_id, media_type, title, overview, poster_url, backdrop_url, year, rating, duration, genres (JSON), metadata (JSON), cached_at, expires_at
- Indexes: media_id, media_type, expires_at

**user_profiles**
- Primary Key: id (UUID)
- Foreign Key: user_id → users.id (one-to-one)
- Fields: display_name, bio, avatar_url, language, subtitle_language, autoplay_next, quality_preference, timestamps

**search_history**
- Primary Key: id (UUID)
- Foreign Key: user_id → users.id
- Fields: query, results_count, searched_at
- Index: user_id, searched_at DESC

**stream_logs**
- Primary Key: id (UUID)
- Foreign Key: user_id → users.id
- Fields: media_id, media_type, stream_token, ip_address, user_agent, quality, bandwidth, started_at, ended_at, duration_watched
- Indexes: user_id, media_id, started_at DESC

**admin_actions**
- Primary Key: id (UUID)
- Foreign Key: admin_id → users.id
- Fields: action_type (enum: user_update/user_delete/config_update/library_sync), target_id, details (JSON), created_at
- Index: admin_id, created_at DESC

### 6.2 Relationships

- users 1:N user_sessions
- users 1:N watch_history
- users 1:N favorites
- users 1:1 user_profiles
- users 1:N search_history
- users 1:N stream_logs
- users 1:N admin_actions (as admin)
- jellyfin_config 1:N jellyfin_libraries

See `er_diagram.plantuml` for complete ER diagram with all constraints and indexes.

---

## 7. UI Navigation Flow

### 7.1 Navigation Hierarchy

**Level 0 (Entry Points):**
- Landing Page (public)
- Login Page (public)
- Register Page (public)

**Level 1 (Main Navigation - Always Accessible):**
- Home Page (authenticated)
- Movies Browse (authenticated)
- Series Browse (authenticated)
- Search (authenticated)
- My List (authenticated)
- Watch History (authenticated)
- Profile (authenticated)

**Level 2 (Content Details):**
- Movie Details Page
- Series Details Page (with seasons/episodes)

**Level 3 (Playback):**
- Video Player (full-screen)

**Admin Section (Admin Users Only):**
- Admin Panel Dashboard
  - Jellyfin Configuration
  - User Management
  - Library Management
  - Analytics

### 7.2 Navigation Principles

1. **Maximum 3 Clicks to Content**: Users should reach any movie/episode within 3 clicks from home page
2. **Persistent Navigation Bar**: Main navigation always visible (except in full-screen player)
3. **Clear Back Navigation**: Every page has obvious way to go back
4. **Breadcrumb Trail**: Show user's current location in deep navigation
5. **Mobile-First**: Hamburger menu for mobile, full nav bar for desktop

### 7.3 State Transitions

See `ui_navigation.plantuml` for complete state machine diagram showing:
- All navigation states (Landing, Auth, Home, Movies, Series, Search, Details, Player, Profile, Admin)
- Transitions between states with trigger actions
- Authentication gates
- Admin-only paths
- Back navigation flows

---

## 8. Deployment Architecture

### 8.1 Production Environment

**Server Infrastructure:**
- **Web Server**: Nginx (reverse proxy, static file serving, SSL termination)
- **Application Server**: Node.js (PM2 process manager, cluster mode with 4 workers)
- **Database Server**: PostgreSQL 15 (primary + read replica for scaling)
- **Cache Server**: Redis 7 (single instance with persistence)
- **Media Server**: Jellyfin (separate server, not managed by iFilm)

**Docker Compose Setup:**
```yaml
services:
  frontend:
    image: ifilm-frontend:latest
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - REACT_APP_API_URL=https://api.ifilm.com
  
  backend:
    image: ifilm-backend:latest
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/ifilm
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
    depends_on:
      - postgres
      - redis
  
  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=ifilm
      - POSTGRES_USER=ifilm_user
      - POSTGRES_PASSWORD=${DB_PASSWORD}
  
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - frontend
      - backend
```

### 8.2 CI/CD Pipeline

**GitHub Actions Workflow:**
1. **Build Stage**: Run tests, lint code, build Docker images
2. **Test Stage**: Run integration tests, security scans
3. **Deploy Stage**: Push images to registry, deploy to production server
4. **Rollback**: Automatic rollback if health checks fail

### 8.3 Monitoring & Logging

- **Application Monitoring**: PM2 monitoring dashboard
- **Error Tracking**: Sentry for frontend and backend errors
- **Logging**: Winston for structured logging, log rotation
- **Metrics**: Prometheus + Grafana for system metrics
- **Uptime Monitoring**: UptimeRobot for endpoint health checks

---

## 9. Performance Optimization

### 9.1 Frontend Optimization

- **Code Splitting**: React.lazy() for route-based code splitting
- **Image Optimization**: WebP format, lazy loading, responsive images
- **Caching**: Service Worker for offline support and asset caching
- **Bundle Size**: Tree shaking, minification, gzip compression
- **CDN**: Serve static assets from CDN

### 9.2 Backend Optimization

- **Database Indexing**: Proper indexes on frequently queried columns
- **Connection Pooling**: PostgreSQL connection pool (max 20 connections)
- **Query Optimization**: Use EXPLAIN ANALYZE, avoid N+1 queries
- **Caching Strategy**: 
  - Redis for session data (no expiry)
  - Redis for media metadata (5-minute TTL)
  - In-memory cache for hot data (1-minute TTL)
- **Rate Limiting**: Prevent abuse and DDoS attacks

### 9.3 Video Streaming Optimization

- **Adaptive Bitrate**: HLS with multiple quality levels (1080p, 720p, 480p, 360p)
- **CDN Integration**: Stream video through CDN for better performance
- **Preloading**: Preload next episode in series
- **Bandwidth Detection**: Auto-select quality based on user's bandwidth

---

## 10. Security Best Practices

### 10.1 Authentication & Authorization

- **Password Policy**: Minimum 8 characters, require uppercase, lowercase, number, special char
- **Password Hashing**: bcrypt with 10 rounds
- **JWT Expiry**: Access token 1 hour, refresh token 7 days
- **Token Rotation**: Rotate refresh tokens on every use
- **Session Management**: Store sessions in Redis with expiry

### 10.2 API Security

- **HTTPS Only**: Enforce HTTPS in production
- **CORS**: Whitelist allowed origins
- **Rate Limiting**: 100 req/min per user, 10 req/min for login
- **Input Validation**: Validate all user inputs with Joi/Zod
- **SQL Injection Prevention**: Use parameterized queries
- **XSS Prevention**: Sanitize user-generated content

### 10.3 Jellyfin Integration Security

- **API Key Encryption**: AES-256 encryption for stored keys
- **Environment Variables**: Store secrets in .env, never commit to git
- **Backend Proxy**: All Jellyfin requests go through backend
- **Token Validation**: Validate stream tokens on every request
- **Audit Logging**: Log all admin actions and Jellyfin API calls

---

## 11. Testing Strategy

### 11.1 Frontend Testing

- **Unit Tests**: Jest + React Testing Library for components
- **Integration Tests**: Test user flows (login, browse, play)
- **E2E Tests**: Playwright for critical user journeys
- **Visual Regression**: Percy for UI consistency

### 11.2 Backend Testing

- **Unit Tests**: Jest for services and utilities
- **Integration Tests**: Supertest for API endpoints
- **Database Tests**: Test migrations and queries
- **Security Tests**: OWASP ZAP for vulnerability scanning

### 11.3 Performance Testing

- **Load Testing**: k6 for API load testing
- **Stress Testing**: Test with 1000+ concurrent users
- **Video Streaming**: Test HLS playback under load

---

## 12. Anything UNCLEAR

### 12.1 Clarifications Needed

1. **Jellyfin User Management**: Should iFilm create separate Jellyfin users for each iFilm user, or use a single shared Jellyfin user for all streaming?
   - **Recommendation**: Use single shared Jellyfin user for simplicity, manage permissions in iFilm

2. **Content Restrictions**: Should iFilm support parental controls or content rating filters?
   - **Recommendation**: Add in Phase 4, use Jellyfin's content rating metadata

3. **Multi-Profile Support**: Should users be able to create multiple profiles under one account (like Netflix)?
   - **Recommendation**: Add in Phase 4, implement user_profiles table with foreign key to users

4. **Download for Offline**: Should users be able to download content for offline viewing?
   - **Recommendation**: Add in Phase 4, requires significant storage and DRM considerations

5. **Social Features**: Should users be able to share watch lists or watch together?
   - **Recommendation**: Add in Phase 4, requires WebRTC or similar technology

6. **Payment Integration**: Will iFilm have subscription payments or is it free for all users?
   - **Assumption**: Free platform for now, payment integration can be added later

7. **Email Service**: Which email service should be used for verification and password reset?
   - **Recommendation**: Use SendGrid or AWS SES, implement in Phase 2

8. **CDN Provider**: Which CDN should be used for video streaming?
   - **Recommendation**: Cloudflare or AWS CloudFront, implement in Phase 3

9. **Analytics**: What level of user analytics should be tracked?
   - **Recommendation**: Basic analytics (watch time, popular content, user activity) in Phase 3

10. **Mobile Apps**: Are native iOS/Android apps planned?
    - **Assumption**: Web-only for MVP, mobile apps can be considered in future phases

### 12.2 Technical Assumptions

1. **Jellyfin Version**: Assuming Jellyfin 10.8+ with stable REST API
2. **Browser Support**: Modern browsers only (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
3. **Video Formats**: Assuming Jellyfin handles transcoding, iFilm only streams HLS
4. **Storage**: Assuming sufficient storage for PostgreSQL and Redis, no media storage in iFilm
5. **Bandwidth**: Assuming users have at least 5 Mbps for 720p streaming
6. **Concurrent Users**: Designing for 1000 concurrent users initially, scalable to 10,000+

---

## 13. Next Steps

1. **Review and Approve System Design** - Stakeholder review of this document
2. **Setup Development Environment** - Initialize Git repo, Docker setup, CI/CD pipeline
3. **Database Schema Implementation** - Create PostgreSQL migrations
4. **Backend API Development** - Implement core API endpoints (auth, media, user)
5. **Jellyfin Integration** - Develop Jellyfin service and proxy
6. **Frontend Development** - Build React components and pages
7. **Video Player Integration** - Implement HLS.js player with controls
8. **Testing** - Write unit, integration, and E2E tests
9. **Deployment** - Deploy to production environment
10. **Monitoring & Optimization** - Setup monitoring, performance tuning

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-15  
**Author**: Bob (System Architect)  
**Status**: Ready for Review