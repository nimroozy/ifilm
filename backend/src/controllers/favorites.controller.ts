import { Request, Response } from 'express';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  isFavorite,
  toggleFavorite,
} from '../services/favorites.service';

export const getFavoritesList = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const favorites = await getFavorites(userId);

    res.json({
      items: favorites,
      total: favorites.length,
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ message: 'Failed to fetch favorites' });
  }
};

export const toggleFavoriteItem = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { mediaId, mediaType, mediaTitle, mediaPosterUrl } = req.body;

    if (!mediaId || !mediaType) {
      return res.status(400).json({ message: 'Missing required fields: mediaId, mediaType' });
    }

    if (mediaType !== 'movie' && mediaType !== 'series') {
      return res.status(400).json({ message: 'Invalid media type' });
    }

    const result = await toggleFavorite(
      userId,
      mediaId,
      mediaType,
      mediaTitle,
      mediaPosterUrl
    );

    res.json(result);
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ message: 'Failed to toggle favorite' });
  }
};

export const removeFavoriteItem = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { mediaId } = req.params;
    const { mediaType } = req.query;

    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'series')) {
      return res.status(400).json({ message: 'Invalid or missing media type' });
    }

    const removed = await removeFavorite(userId, mediaId, mediaType as 'movie' | 'series');

    if (!removed) {
      return res.status(404).json({ message: 'Favorite not found' });
    }

    res.json({ message: 'Favorite removed successfully' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ message: 'Failed to remove favorite' });
  }
};

export const checkFavorite = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { mediaId } = req.params;
    const { mediaType } = req.query;

    if (!mediaType || (mediaType !== 'movie' && mediaType !== 'series')) {
      return res.status(400).json({ message: 'Invalid or missing media type' });
    }

    const favorited = await isFavorite(userId, mediaId, mediaType as 'movie' | 'series');

    res.json({ isFavorite: favorited });
  } catch (error) {
    console.error('Check favorite error:', error);
    res.status(500).json({ message: 'Failed to check favorite status' });
  }
};

