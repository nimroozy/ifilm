import { pool } from '../config/database';

export interface SearchHistoryItem {
  id: string;
  userId?: string;
  query: string;
  resultsCount: number;
  searchedAt: Date;
}

export const addSearchHistory = async (
  userId: string | null,
  query: string,
  resultsCount: number = 0
): Promise<void> => {
  try {
    await pool.query(
      'INSERT INTO search_history (user_id, query, results_count) VALUES ($1, $2, $3)',
      [userId, query, resultsCount]
    );
  } catch (error) {
    console.error('Error adding search history:', error);
    // Don't throw - search history is non-critical
  }
};

export const getSearchHistory = async (
  userId: string,
  limit: number = 10
): Promise<SearchHistoryItem[]> => {
  try {
    const result = await pool.query(
      `SELECT * FROM search_history 
       WHERE user_id = $1 
       ORDER BY searched_at DESC 
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      query: row.query,
      resultsCount: row.results_count,
      searchedAt: row.searched_at,
    }));
  } catch (error) {
    console.error('Error getting search history:', error);
    return [];
  }
};

