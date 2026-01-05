import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env';
import { connectRedis } from './config/redis';
import { pool } from './config/database';
import authRoutes from './routes/auth.routes';
import mediaRoutes from './routes/media.routes';
import adminRoutes from './routes/admin.routes';
import watchHistoryRoutes from './routes/watch-history.routes';
import favoritesRoutes from './routes/favorites.routes';
import userRoutes from './routes/user.routes';
import { loadJellyfinConfig } from './services/jellyfin-config.service';
import { jellyfinService } from './services/jellyfin.service';

const app = express();

// Middleware
// Disable CSP in Helmet - CSP is handled by frontend meta tag
// Backend doesn't serve HTML, so CSP should be set by frontend only
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP - handled by frontend
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({ origin: config.cors.origin, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/watch-history', watchHistoryRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/user', userRoutes);

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Also provide /api/health for frontend compatibility
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler - only handle errors if response hasn't been sent
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

// Start server
const startServer = async () => {
  try {
    await connectRedis();
    
    // Load and initialize Jellyfin config on startup (non-blocking)
    let jellyfinConfig = null;
    try {
      // Test database connection first
      await pool.query('SELECT 1');
      jellyfinConfig = await loadJellyfinConfig();
      if (jellyfinConfig) {
        jellyfinService.initialize(jellyfinConfig.serverUrl, jellyfinConfig.apiKey);
        console.log(`✅ Jellyfin configured: ${jellyfinConfig.serverName || jellyfinConfig.serverUrl}`);
      } else {
        console.log('⚠️  Jellyfin not configured. Please configure in Admin Panel.');
      }
    } catch (configError: any) {
      // Don't fail server startup if config loading fails
      console.error('⚠️  Error loading Jellyfin config:', configError.message || configError);
      console.log('⚠️  Jellyfin not configured. Please configure in Admin Panel.');
    }
    
    app.listen(config.port, () => {
      console.log(`✅ Server running on port ${config.port}`);
      console.log(`✅ Environment: ${config.nodeEnv}`);
      console.log(`✅ CORS origin: ${config.cors.origin}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();