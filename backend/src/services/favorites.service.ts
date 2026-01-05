import { query } from '../config/database';

export interface Favorite {
  id: string;
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'series';
  mediaTitle?: string;
  mediaPosterUrl?: string;
  addedAt: Date;
}

export const getFavorites = async (userId: string): Promise<Favorite[]> => {
  try {
    const result = await query(
      `SELECT * FROM favorites 
       WHERE user_id = $1 
       ORDER BY added_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      mediaTitle: row.media_title,
      mediaPosterUrl: row.media_poster_url,
      addedAt: row.added_at,
    }));
  } catch (error) {
    console.error('Error getting favorites:', error);
    return [];
  }
};

export const addFavorite = async (
  userId: string,
  mediaId: string,
  mediaType: 'movie' | 'series',
  mediaTitle?: string,
  mediaPosterUrl?: string
): Promise<Favorite | null> => {
  try {
    const result = await query(
      `INSERT INTO favorites (user_id, media_id, media_type, media_title, media_poster_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, media_id, media_type)
       DO UPDATE SET 
         media_title = EXCLUDED.media_title,
         media_poster_url = EXCLUDED.media_poster_url
       RETURNING *`,
      [userId, mediaId, mediaType, mediaTitle || null, mediaPosterUrl || null]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      mediaTitle: row.media_title,
      mediaPosterUrl: row.media_poster_url,
      addedAt: row.added_at,
    };
  } catch (error) {
    console.error('Error adding favorite:', error);
    return null;
  }
};

export const removeFavorite = async (
  userId: string,
  mediaId: string,
  mediaType: 'movie' | 'series'
): Promise<boolean> => {
  try {
    const result = await query(
      'DELETE FROM favorites WHERE user_id = $1 AND media_id = $2 AND media_type = $3',
      [userId, mediaId, mediaType]
    );
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error('Error removing favorite:', error);
    return false;
  }
};

export const isFavorite = async (
  userId: string,
  mediaId: string,
  mediaType: 'movie' | 'series'
): Promise<boolean> => {
  try {
    const result = await query(
      'SELECT id FROM favorites WHERE user_id = $1 AND media_id = $2 AND media_type = $3',
      [userId, mediaId, mediaType]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
  }
};

export const toggleFavorite = async (
  userId: string,
  mediaId: string,
  mediaType: 'movie' | 'series',
  mediaTitle?: string,
  mediaPosterUrl?: string
): Promise<{ isFavorite: boolean; favorite: Favorite | null }> => {
  const currentlyFavorite = await isFavorite(userId, mediaId, mediaType);

  if (currentlyFavorite) {
    const removed = await removeFavorite(userId, mediaId, mediaType);
    return { isFavorite: false, favorite: null };
  } else {
    const favorite = await addFavorite(userId, mediaId, mediaType, mediaTitle, mediaPosterUrl);
    return { isFavorite: true, favorite };
  }
};

