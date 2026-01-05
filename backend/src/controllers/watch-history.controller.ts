import { Request, Response } from 'express';
import {
  getWatchHistory,
  addWatchHistory,
  removeWatchHistory,
  getContinueWatching,
  getWatchProgress,
} from '../services/watch-history.service';

export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const history = await getWatchHistory(userId, limit, offset);

    res.json({
      items: history,
      total: history.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get watch history error:', error);
    res.status(500).json({ message: 'Failed to fetch watch history' });
  }
};

export const updateProgress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { mediaId, mediaType, progress, duration, mediaTitle } = req.body;

    if (!mediaId || !mediaType || progress === undefined || duration === undefined) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (mediaType !== 'movie' && mediaType !== 'episode') {
      return res.status(400).json({ message: 'Invalid media type' });
    }

    const historyItem = await addWatchHistory(
      userId,
      mediaId,
      mediaType,
      progress,
      duration,
      mediaTitle
    );

    if (!historyItem) {
      return res.status(500).json({ message: 'Failed to update watch history' });
    }

    res.json(historyItem);
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ message: 'Failed to update progress' });
  }
};

export const removeHistory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { mediaId } = req.params;
    const { mediaType } = req.query;

    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'episode')) {
      return res.status(400).json({ message: 'Invalid or missing media type' });
    }

    const removed = await removeWatchHistory(userId, mediaId, mediaType as 'movie' | 'episode');

    if (!removed) {
      return res.status(404).json({ message: 'Watch history item not found' });
    }

    res.json({ message: 'Watch history item removed successfully' });
  } catch (error) {
    console.error('Remove history error:', error);
    res.status(500).json({ message: 'Failed to remove watch history' });
  }
};

export const getContinueWatchingItems = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const items = await getContinueWatching(userId);

    res.json({
      items,
      total: items.length,
    });
  } catch (error) {
    console.error('Get continue watching error:', error);
    res.status(500).json({ message: 'Failed to fetch continue watching items' });
  }
};

export const getProgress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { mediaId } = req.params;
    const { mediaType } = req.query;

    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'episode')) {
      return res.status(400).json({ message: 'Invalid or missing media type' });
    }

    const progress = await getWatchProgress(userId, mediaId, mediaType as 'movie' | 'episode');

    res.json({ progress });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ message: 'Failed to get progress' });
  }
};

