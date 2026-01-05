import { Router } from 'express';
import {
  getHistory,
  updateProgress,
  removeHistory,
  getContinueWatchingItems,
  getProgress,
} from '../controllers/watch-history.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', getHistory);
router.get('/continue', getContinueWatchingItems);
router.get('/progress/:mediaId', getProgress);
router.post('/progress', updateProgress);
router.delete('/:mediaId', removeHistory);

export default router;

