import { Router } from 'express';
import {
  getProfile,
  updateProfileData,
  updatePassword,
  getUserPreferences,
  updateUserPreferences,
} from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

router.get('/profile', getProfile);
router.put('/profile', updateProfileData);
router.put('/password', updatePassword);
router.get('/preferences', getUserPreferences);
router.put('/preferences', updateUserPreferences);

export default router;

