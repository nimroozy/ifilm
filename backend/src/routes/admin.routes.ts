import { Router } from 'express';
import multer from 'multer';
import {
  testJellyfinConnection,
  saveJellyfinConfig,
  getSystemStats,
  getActivityLogs,
  syncJellyfinLibraries,
  getJellyfinLibraries,
  updateLibraryVisibility,
  getR2ConfigController,
  saveR2ConfigController,
  testR2Connection,
  listR2Files,
  uploadR2File,
  downloadR2File,
  renameR2File,
  moveR2File,
  deleteR2File,
  getR2FileInfo,
  getUsers,
  createUser,
  updateUserRole,
  deleteUser,
  clearCache,
  getCacheConfigController,
  saveCacheConfigController,
  updateCacheConfigEnabledController,
  reloadNginxConfigController,
} from '../controllers/admin.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All admin routes require authentication
router.use(authMiddleware);

// Dashboard routes
router.get('/stats', getSystemStats);
router.get('/activity', getActivityLogs);
router.post('/cache/clear', clearCache);

// Cache configuration routes
router.get('/cache/config', getCacheConfigController);
router.post('/cache/config', saveCacheConfigController);
router.put('/cache/config/:cacheType/enabled', updateCacheConfigEnabledController);
router.post('/cache/nginx/reload', reloadNginxConfigController);

// Jellyfin configuration routes
router.post('/jellyfin/test', testJellyfinConnection);
router.post('/jellyfin/save', saveJellyfinConfig);

// Jellyfin libraries routes
router.get('/jellyfin/libraries', getJellyfinLibraries);
router.post('/jellyfin/libraries/sync', syncJellyfinLibraries);
router.put('/jellyfin/libraries/:libraryId/visibility', updateLibraryVisibility);

// User management routes
router.get('/users', getUsers);
router.post('/users', createUser);
router.put('/users/:userId/role', updateUserRole);
router.delete('/users/:userId', deleteUser);

// R2 configuration routes
router.get('/r2/config', getR2ConfigController);
router.post('/r2/config/save', saveR2ConfigController);
router.post('/r2/test', testR2Connection);

// R2 file management routes
router.get('/r2/files', listR2Files);
router.post('/r2/files/upload', multer({ storage: multer.memoryStorage() }).single('file'), uploadR2File);
router.post('/r2/files/rename', renameR2File);
router.post('/r2/files/move', moveR2File);
// Use regex for wildcard file paths (must be before the generic wildcard route)
router.get(/^\/r2\/files\/info\/(.+)$/, getR2FileInfo);
router.get(/^\/r2\/files\/(.+)$/, downloadR2File);
router.delete(/^\/r2\/files\/(.+)$/, deleteR2File);

export default router;
