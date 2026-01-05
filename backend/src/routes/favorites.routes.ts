import { Router } from 'express';
import {
  getFavoritesList,
  toggleFavoriteItem,
  removeFavoriteItem,
  checkFavorite,
} from '../controllers/favorites.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/', getFavoritesList);
router.get('/check/:mediaId', checkFavorite);
router.post('/toggle', toggleFavoriteItem);
router.delete('/:mediaId', removeFavoriteItem);

export default router;

