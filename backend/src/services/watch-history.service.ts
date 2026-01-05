import { query } from '../config/database';

export interface WatchHistoryItem {
  id: string;
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'episode';
  mediaTitle?: string;
  progress: number;
  duration: number;
  percentage: number;
  lastWatched: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const getWatchHistory = async (
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<WatchHistoryItem[]> => {
  try {
    const result = await query(
      `SELECT * FROM watch_history 
       WHERE user_id = $1 
       ORDER BY last_watched DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      mediaTitle: row.media_title,
      progress: row.progress,
      duration: row.duration,
      percentage: parseFloat(row.percentage) || 0,
      lastWatched: row.last_watched,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error getting watch history:', error);
    return [];
  }
};

export const addWatchHistory = async (
  userId: string,
  mediaId: string,
  mediaType: 'movie' | 'episode',
  progress: number,
  duration: number,
  mediaTitle?: string
): Promise<WatchHistoryItem | null> => {
  try {
    const percentage = duration > 0 ? (progress / duration) * 100 : 0;

    const result = await query(
      `INSERT INTO watch_history (user_id, media_id, media_type, media_title, progress, duration, percentage, last_watched)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, media_id, media_type)
       DO UPDATE SET 
         progress = EXCLUDED.progress,
         duration = EXCLUDED.duration,
         percentage = EXCLUDED.percentage,
         media_title = EXCLUDED.media_title,
         last_watched = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, mediaId, mediaType, mediaTitle || null, progress, duration, percentage]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      mediaTitle: row.media_title,
      progress: row.progress,
      duration: row.duration,
      percentage: parseFloat(row.percentage) || 0,
      lastWatched: row.last_watched,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  } catch (error) {
    console.error('Error adding watch history:', error);
    return null;
  }
};

export const removeWatchHistory = async (
  userId: string,
  mediaId: string,
  mediaType: 'movie' | 'episode'
): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM watch_history WHERE user_id = $1 AND media_id = $2 AND media_type = $3',
      [userId, mediaId, mediaType]
    );
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('Error removing watch history:', error);
    return false;
  }
};

export const getContinueWatching = async (userId: string): Promise<WatchHistoryItem[]> => {
  try {
    // Get items with 5% to 90% completion
    const result = await query(
      `SELECT * FROM watch_history 
       WHERE user_id = $1 
         AND percentage >= 5 
         AND percentage < 90
       ORDER BY last_watched DESC 
       LIMIT 20`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      mediaTitle: row.media_title,
      progress: row.progress,
      duration: row.duration,
      percentage: parseFloat(row.percentage) || 0,
      lastWatched: row.last_watched,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  } catch (error) {
    console.error('Error getting continue watching:', error);
    return [];
  }
};

export const getWatchProgress = async (
  userId: string,
  mediaId: string,
  mediaType: 'movie' | 'episode'
): Promise<number> => {
  try {
    const result = await query(
      'SELECT progress FROM watch_history WHERE user_id = $1 AND media_id = $2 AND media_type = $3',
      [userId, mediaId, mediaType]
    );

    if (result.rows.length === 0) {
      return 0;
    }

    return result.rows[0].progress || 0;
  } catch (error) {
    console.error('Error getting watch progress:', error);
    return 0;
  }
};

