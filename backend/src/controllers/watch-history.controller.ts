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

    // Enrich history items with media details from Jellyfin
    const { jellyfinService } = await import('../services/jellyfin.service');
    const enrichedItems = await Promise.all(
      history.map(async (item) => {
        try {
          // For episodes, we need to get the parent series ID
          if (item.mediaType === 'episode') {
            const episode = await jellyfinService.getItemDetails(item.mediaId);
            if (episode && episode.SeriesId) {
              // Return episode info with parent series ID
              return {
                ...item,
                id: item.mediaId, // Episode ID
                seriesId: episode.SeriesId, // Parent series ID for navigation
                title: episode.Name || item.mediaTitle || 'Unknown Episode',
                posterUrl: jellyfinService.getImageUrl(episode.SeriesId || episode.Id, 'Primary'),
                backdropUrl: episode.BackdropImageTags && episode.BackdropImageTags.length > 0
                  ? jellyfinService.getImageUrl(episode.SeriesId || episode.Id, 'Backdrop')
                  : jellyfinService.getImageUrl(episode.SeriesId || episode.Id, 'Primary'),
                year: episode.ProductionYear || 0,
                rating: episode.CommunityRating || 0,
                duration: episode.RunTimeTicks ? Math.floor(episode.RunTimeTicks / 10000000 / 60) : item.duration,
                genres: episode.Genres || [],
                type: 'episode',
              };
            }
          } else {
            // For movies, get movie details
            const movie = await jellyfinService.getItemDetails(item.mediaId);
            if (movie) {
              return {
                ...item,
                id: item.mediaId,
                title: movie.Name || item.mediaTitle || 'Unknown Movie',
                posterUrl: jellyfinService.getImageUrl(movie.Id, 'Primary'),
                backdropUrl: movie.BackdropImageTags && movie.BackdropImageTags.length > 0
                  ? jellyfinService.getImageUrl(movie.Id, 'Backdrop')
                  : jellyfinService.getImageUrl(movie.Id, 'Primary'),
                year: movie.ProductionYear || 0,
                rating: movie.CommunityRating || 0,
                duration: movie.RunTimeTicks ? Math.floor(movie.RunTimeTicks / 10000000 / 60) : item.duration,
                genres: movie.Genres || [],
                type: 'movie',
              };
            }
          }
        } catch (err: any) {
          // If item doesn't exist in Jellyfin anymore, skip it
          console.warn(`[getHistory] Item ${item.mediaId} not found in Jellyfin, skipping:`, err.message);
          return null;
        }
        return null;
      })
    );

    // Filter out null items (items that don't exist in Jellyfin)
    const validItems = enrichedItems.filter(item => item !== null);

    res.json({
      items: validItems,
      total: validItems.length,
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

    // Enrich items with media details from Jellyfin
    const { jellyfinService } = await import('../services/jellyfin.service');
    
    // Check if Jellyfin is initialized
    if (!jellyfinService.isInitialized()) {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        // If Jellyfin not configured, return empty array
        return res.json({
          items: [],
          total: 0,
        });
      }
    }

    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        try {
          // For episodes, we need to get the parent series ID
          if (item.mediaType === 'episode') {
            const episode = await jellyfinService.getItemDetails(item.mediaId);
            if (episode && episode.SeriesId) {
              // Return episode info with parent series ID
              return {
                ...item,
                id: item.mediaId, // Episode ID
                seriesId: episode.SeriesId, // Parent series ID for navigation
                title: episode.Name || item.mediaTitle || 'Unknown Episode',
                posterUrl: jellyfinService.getImageUrl(episode.SeriesId || episode.Id, 'Primary'),
                backdropUrl: episode.BackdropImageTags && episode.BackdropImageTags.length > 0
                  ? jellyfinService.getImageUrl(episode.SeriesId || episode.Id, 'Backdrop')
                  : jellyfinService.getImageUrl(episode.SeriesId || episode.Id, 'Primary'),
                year: episode.ProductionYear || 0,
                rating: episode.CommunityRating || 0,
                duration: episode.RunTimeTicks ? Math.floor(episode.RunTimeTicks / 10000000 / 60) : item.duration,
                genres: episode.Genres || [],
                type: 'episode',
              };
            }
          } else {
            // For movies, get movie details
            const movie = await jellyfinService.getItemDetails(item.mediaId);
            if (movie) {
              return {
                ...item,
                id: item.mediaId,
                title: movie.Name || item.mediaTitle || 'Unknown Movie',
                posterUrl: jellyfinService.getImageUrl(movie.Id, 'Primary'),
                backdropUrl: movie.BackdropImageTags && movie.BackdropImageTags.length > 0
                  ? jellyfinService.getImageUrl(movie.Id, 'Backdrop')
                  : jellyfinService.getImageUrl(movie.Id, 'Primary'),
                year: movie.ProductionYear || 0,
                rating: movie.CommunityRating || 0,
                duration: movie.RunTimeTicks ? Math.floor(movie.RunTimeTicks / 10000000 / 60) : item.duration,
                genres: movie.Genres || [],
                type: 'movie',
              };
            }
          }
        } catch (err: any) {
          // If item doesn't exist in Jellyfin anymore, skip it
          console.warn(`[getContinueWatchingItems] Item ${item.mediaId} not found in Jellyfin, skipping:`, err.message);
          return null;
        }
        return null;
      })
    );

    // Filter out null items (items that don't exist in Jellyfin)
    const validItems = enrichedItems.filter(item => item !== null);

    res.json({
      items: validItems,
      total: validItems.length,
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

