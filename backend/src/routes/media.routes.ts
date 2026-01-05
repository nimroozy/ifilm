import { Router } from 'express';
import { getMovies, getMovieDetails, getSeries, getSeriesDetails, getEpisodes, searchMedia, getStreamUrl, proxyStream, getRelatedMovies, proxyImage } from '../controllers/media.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public routes - No authentication required for browsing
router.get('/movies', getMovies);
router.get('/movies/:id', getMovieDetails);
router.get('/movies/:id/related', getRelatedMovies);
router.get('/series', getSeries);
router.get('/series/:id', getSeriesDetails);
router.get('/series/:id/episodes', getEpisodes);
router.get('/search', searchMedia);

// Image proxy - Proxies image requests to Jellyfin (public, cached)
router.get('/images/:itemId/:imageType', proxyImage);

// Protected routes - Authentication required for streaming
router.get('/movies/:id/stream', authMiddleware, getStreamUrl);

// Stream proxy - Proxies HLS requests to Jellyfin
// Note: No auth middleware because HLS.js requests don't include auth headers
// Security is maintained by authenticating with Jellyfin on the backend
// Use multiple routes to match /stream/:id and /stream/:id/* patterns
// Route order matters - more specific routes first
router.get('/stream/:id/:filePath(*)', proxyStream); // Matches /stream/id/path/to/file
router.get('/stream/:id', proxyStream); // Matches /stream/id (fallback, though unlikely)

export default router;