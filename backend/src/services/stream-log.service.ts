import { query } from '../config/database';

export interface StreamLog {
  id: string;
  userId?: string;
  mediaId: string;
  mediaType: 'movie' | 'episode';
  streamToken: string;
  ipAddress?: string;
  userAgent?: string;
  quality?: string;
  bandwidth?: number;
  startedAt: Date;
  endedAt?: Date;
  durationWatched: number;
}

export const logStreamStart = async (
  userId: string | null,
  mediaId: string,
  mediaType: 'movie' | 'episode',
  streamToken: string,
  ipAddress?: string,
  userAgent?: string,
  quality?: string
): Promise<StreamLog | null> => {
  try {
    const result = await query(
      `INSERT INTO stream_logs (user_id, media_id, media_type, stream_token, ip_address, user_agent, quality, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING *`,
      [userId, mediaId, mediaType, streamToken, ipAddress || null, userAgent || null, quality || null]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      streamToken: row.stream_token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      quality: row.quality,
      bandwidth: row.bandwidth,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationWatched: row.duration_watched,
    };
  } catch (error) {
    console.error('Error logging stream start:', error);
    return null;
  }
};

export const logStreamEnd = async (
  streamToken: string,
  durationWatched: number,
  bandwidth?: number
): Promise<boolean> => {
  try {
    const result = await query(
      `UPDATE stream_logs 
       SET ended_at = CURRENT_TIMESTAMP, 
           duration_watched = $1,
           bandwidth = COALESCE($2, bandwidth)
       WHERE stream_token = $3 AND ended_at IS NULL
       RETURNING id`,
      [durationWatched, bandwidth || null, streamToken]
    );
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error logging stream end:', error);
    return false;
  }
};

export const getStreamLogs = async (
  userId?: string,
  limit: number = 50,
  offset: number = 0
): Promise<StreamLog[]> => {
  try {
    let queryStr = `SELECT * FROM stream_logs`;
    const params: any[] = [];
    let paramIndex = 1;

    if (userId) {
      queryStr += ` WHERE user_id = $${paramIndex++}`;
      params.push(userId);
    }

    queryStr += ` ORDER BY started_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const result = await query(queryStr, params);

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      mediaId: row.media_id,
      mediaType: row.media_type,
      streamToken: row.stream_token,
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      quality: row.quality,
      bandwidth: row.bandwidth,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationWatched: row.duration_watched,
    }));
  } catch (error) {
    console.error('Error getting stream logs:', error);
    return [];
  }
};

