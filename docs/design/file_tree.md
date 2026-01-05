# iFilm - Project File Structure

```
ifilm/
├── frontend/                           # React frontend application
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   ├── manifest.json
│   │   └── robots.txt
│   ├── src/
│   │   ├── assets/                     # Static assets
│   │   │   ├── images/
│   │   │   │   ├── logo.svg
│   │   │   │   ├── placeholder-poster.jpg
│   │   │   │   └── placeholder-backdrop.jpg
│   │   │   └── styles/
│   │   │       └── global.css
│   │   ├── components/                 # Reusable React components
│   │   │   ├── common/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Spinner.tsx
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   ├── layout/
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Navigation.tsx
│   │   │   ├── media/
│   │   │   │   ├── MovieCard.tsx
│   │   │   │   ├── SeriesCard.tsx
│   │   │   │   ├── MediaGrid.tsx
│   │   │   │   ├── MediaRow.tsx
│   │   │   │   ├── MediaDetails.tsx
│   │   │   │   ├── SeasonSelector.tsx
│   │   │   │   ├── EpisodeList.tsx
│   │   │   │   └── GenreFilter.tsx
│   │   │   ├── player/
│   │   │   │   ├── VideoPlayer.tsx
│   │   │   │   ├── PlayerControls.tsx
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   ├── VolumeControl.tsx
│   │   │   │   ├── QualitySelector.tsx
│   │   │   │   ├── SubtitleSelector.tsx
│   │   │   │   └── FullscreenButton.tsx
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   ├── RegisterForm.tsx
│   │   │   │   ├── ForgotPasswordForm.tsx
│   │   │   │   └── ProtectedRoute.tsx
│   │   │   ├── user/
│   │   │   │   ├── ProfileCard.tsx
│   │   │   │   ├── WatchHistoryList.tsx
│   │   │   │   ├── FavoritesList.tsx
│   │   │   │   └── ProfileSettings.tsx
│   │   │   └── admin/
│   │   │       ├── JellyfinConfigForm.tsx
│   │   │       ├── UserManagementTable.tsx
│   │   │       ├── LibraryManagement.tsx
│   │   │       └── AnalyticsDashboard.tsx
│   │   ├── pages/                      # Page components
│   │   │   ├── LandingPage.tsx
│   │   │   ├── HomePage.tsx
│   │   │   ├── MoviesPage.tsx
│   │   │   ├── SeriesPage.tsx
│   │   │   ├── SearchPage.tsx
│   │   │   ├── MediaDetailsPage.tsx
│   │   │   ├── WatchPage.tsx
│   │   │   ├── MyListPage.tsx
│   │   │   ├── WatchHistoryPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── AdminPanelPage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   └── NotFoundPage.tsx
│   │   ├── services/                   # API service layer
│   │   │   ├── api/
│   │   │   │   ├── apiClient.ts        # Axios instance with interceptors
│   │   │   │   ├── authService.ts      # Auth API calls
│   │   │   │   ├── mediaService.ts     # Media API calls
│   │   │   │   ├── userService.ts      # User API calls
│   │   │   │   └── adminService.ts     # Admin API calls
│   │   │   └── player/
│   │   │       └── hlsPlayer.ts        # HLS.js wrapper
│   │   ├── store/                      # Redux store
│   │   │   ├── index.ts                # Store configuration
│   │   │   ├── slices/
│   │   │   │   ├── authSlice.ts
│   │   │   │   ├── mediaSlice.ts
│   │   │   │   ├── userSlice.ts
│   │   │   │   ├── playerSlice.ts
│   │   │   │   └── adminSlice.ts
│   │   │   └── hooks.ts                # Typed Redux hooks
│   │   ├── types/                      # TypeScript type definitions
│   │   │   ├── media.types.ts
│   │   │   ├── user.types.ts
│   │   │   ├── auth.types.ts
│   │   │   ├── player.types.ts
│   │   │   └── api.types.ts
│   │   ├── utils/                      # Utility functions
│   │   │   ├── formatters.ts           # Date, time, duration formatters
│   │   │   ├── validators.ts           # Form validation helpers
│   │   │   ├── storage.ts              # localStorage wrapper
│   │   │   └── constants.ts            # App constants
│   │   ├── hooks/                      # Custom React hooks
│   │   │   ├── useAuth.ts
│   │   │   ├── useMedia.ts
│   │   │   ├── usePlayer.ts
│   │   │   ├── useDebounce.ts
│   │   │   └── useInfiniteScroll.ts
│   │   ├── App.tsx                     # Main App component
│   │   ├── index.tsx                   # Entry point
│   │   └── routes.tsx                  # Route configuration
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── .env.example
│
├── backend/                            # Node.js backend application
│   ├── src/
│   │   ├── config/                     # Configuration files
│   │   │   ├── database.ts             # PostgreSQL config
│   │   │   ├── redis.ts                # Redis config
│   │   │   ├── jwt.ts                  # JWT config
│   │   │   └── env.ts                  # Environment variables
│   │   ├── controllers/                # Request handlers
│   │   │   ├── authController.ts
│   │   │   ├── mediaController.ts
│   │   │   ├── userController.ts
│   │   │   ├── streamController.ts
│   │   │   └── adminController.ts
│   │   ├── services/                   # Business logic layer
│   │   │   ├── authService.ts
│   │   │   ├── userService.ts
│   │   │   ├── jellyfinService.ts
│   │   │   ├── watchHistoryService.ts
│   │   │   ├── favoritesService.ts
│   │   │   └── streamService.ts
│   │   ├── models/                     # Database models
│   │   │   ├── User.ts
│   │   │   ├── UserSession.ts
│   │   │   ├── WatchHistory.ts
│   │   │   ├── Favorite.ts
│   │   │   ├── JellyfinConfig.ts
│   │   │   ├── JellyfinLibrary.ts
│   │   │   ├── MediaCache.ts
│   │   │   ├── UserProfile.ts
│   │   │   ├── SearchHistory.ts
│   │   │   ├── StreamLog.ts
│   │   │   └── AdminAction.ts
│   │   ├── middleware/                 # Express middleware
│   │   │   ├── authMiddleware.ts       # JWT validation
│   │   │   ├── adminMiddleware.ts      # Admin role check
│   │   │   ├── rateLimiter.ts          # Rate limiting
│   │   │   ├── errorHandler.ts         # Global error handler
│   │   │   ├── validator.ts            # Request validation
│   │   │   └── logger.ts               # Request logging
│   │   ├── routes/                     # API routes
│   │   │   ├── authRoutes.ts
│   │   │   ├── mediaRoutes.ts
│   │   │   ├── userRoutes.ts
│   │   │   ├── streamRoutes.ts
│   │   │   └── adminRoutes.ts
│   │   ├── utils/                      # Utility functions
│   │   │   ├── jwtManager.ts           # JWT generation/validation
│   │   │   ├── apiKeyVault.ts          # API key encryption
│   │   │   ├── requestProxy.ts         # Jellyfin request proxy
│   │   │   ├── cache.ts                # Redis cache wrapper
│   │   │   ├── logger.ts               # Winston logger
│   │   │   └── validators.ts           # Input validators
│   │   ├── types/                      # TypeScript type definitions
│   │   │   ├── jellyfin.types.ts
│   │   │   ├── express.types.ts
│   │   │   └── api.types.ts
│   │   ├── database/                   # Database setup
│   │   │   ├── migrations/             # SQL migration files
│   │   │   │   ├── 001_create_users_table.sql
│   │   │   │   ├── 002_create_sessions_table.sql
│   │   │   │   ├── 003_create_watch_history_table.sql
│   │   │   │   ├── 004_create_favorites_table.sql
│   │   │   │   ├── 005_create_jellyfin_config_table.sql
│   │   │   │   ├── 006_create_jellyfin_libraries_table.sql
│   │   │   │   ├── 007_create_media_cache_table.sql
│   │   │   │   ├── 008_create_user_profiles_table.sql
│   │   │   │   ├── 009_create_search_history_table.sql
│   │   │   │   ├── 010_create_stream_logs_table.sql
│   │   │   │   └── 011_create_admin_actions_table.sql
│   │   │   ├── seeds/                  # Seed data
│   │   │   │   └── adminUser.sql
│   │   │   └── connection.ts           # Database connection pool
│   │   ├── app.ts                      # Express app setup
│   │   └── server.ts                   # Server entry point
│   ├── tests/                          # Test files
│   │   ├── unit/
│   │   │   ├── services/
│   │   │   └── utils/
│   │   ├── integration/
│   │   │   ├── auth.test.ts
│   │   │   ├── media.test.ts
│   │   │   └── stream.test.ts
│   │   └── setup.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.js
│   └── .env.example
│
├── docs/                               # Documentation
│   ├── prd/
│   │   └── ifilm_prd.md               # Product Requirements Document
│   ├── design/
│   │   ├── system_design.md           # This file
│   │   ├── architecture.plantuml      # System architecture diagram
│   │   ├── class_diagram.plantuml     # Class diagram
│   │   ├── sequence_diagram.plantuml  # Sequence diagrams
│   │   ├── er_diagram.plantuml        # Database ER diagram
│   │   ├── ui_navigation.plantuml     # UI navigation flow
│   │   └── file_tree.md               # This file
│   ├── api/
│   │   └── api_documentation.md       # API endpoint documentation
│   ├── deployment/
│   │   ├── deployment_guide.md        # Deployment instructions
│   │   └── docker_setup.md            # Docker setup guide
│   └── user/
│       ├── user_guide.md              # End-user guide
│       └── admin_guide.md             # Admin panel guide
│
├── docker/                             # Docker configuration
│   ├── frontend/
│   │   └── Dockerfile
│   ├── backend/
│   │   └── Dockerfile
│   ├── nginx/
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   └── docker-compose.yml
│
├── scripts/                            # Utility scripts
│   ├── setup.sh                       # Initial setup script
│   ├── migrate.sh                     # Database migration script
│   ├── seed.sh                        # Database seed script
│   └── deploy.sh                      # Deployment script
│
├── .github/                           # GitHub configuration
│   └── workflows/
│       ├── ci.yml                     # CI pipeline
│       └── deploy.yml                 # Deployment pipeline
│
├── .gitignore
├── README.md                          # Project README
├── LICENSE
└── package.json                       # Root package.json for scripts
```

## File Structure Explanation

### Frontend Structure

**Components Organization:**
- `common/` - Reusable UI components (buttons, inputs, modals)
- `layout/` - Layout components (header, footer, navigation)
- `media/` - Media-specific components (cards, grids, details)
- `player/` - Video player and controls
- `auth/` - Authentication forms and protected routes
- `user/` - User profile and history components
- `admin/` - Admin panel components

**State Management:**
- Redux Toolkit with feature-based slices
- Typed hooks for type-safe state access
- Centralized store configuration

**Services:**
- API client with Axios interceptors for auth
- Separate service files for each API domain
- HLS player wrapper for video streaming

### Backend Structure

**Controllers:**
- Handle HTTP requests and responses
- Validate input using middleware
- Call appropriate services

**Services:**
- Contain business logic
- Interact with database models
- Call external APIs (Jellyfin)

**Models:**
- Database table representations
- Include validation and helper methods
- TypeScript interfaces for type safety

**Middleware:**
- Authentication and authorization
- Rate limiting
- Error handling
- Request validation and logging

**Utils:**
- JWT management
- API key encryption/decryption
- Request proxying to Jellyfin
- Caching utilities

### Database Migrations

- Sequential numbered SQL files
- Each migration is atomic and reversible
- Seed files for initial data (admin user)

### Documentation

- PRD for product requirements
- System design with diagrams
- API documentation
- Deployment guides
- User and admin manuals

### Docker Setup

- Separate Dockerfiles for frontend and backend
- Docker Compose for orchestration
- Nginx configuration for reverse proxy
- Volume mounts for persistent data

### Scripts

- Automated setup and deployment
- Database migration and seeding
- Environment configuration

---

**Next Steps After File Structure Setup:**

1. Initialize Git repository
2. Create directory structure
3. Setup package.json files with dependencies
4. Configure TypeScript, ESLint, Prettier
5. Setup Docker Compose environment
6. Create database migrations
7. Implement backend API endpoints
8. Build frontend components
9. Integrate HLS video player
10. Write tests and documentation