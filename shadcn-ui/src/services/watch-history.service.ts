import { api } from './api';

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

export interface ContinueWatchingItem {
  items: WatchHistoryItem[];
  total: number;
}

export const getWatchHistory = async (limit: number = 50, offset: number = 0): Promise<WatchHistoryItem[]> => {
  try {
    const response = await api.get('/watch-history', {
      params: { limit, offset },
    });
    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching watch history:', error);
    return [];
  }
};

export const updateProgress = async (
  mediaId: string,
  mediaType: 'movie' | 'episode',
  progress: number,
  duration: number,
  mediaTitle?: string
): Promise<WatchHistoryItem | null> => {
  try {
    const response = await api.post('/watch-history/progress', {
      mediaId,
      mediaType,
      progress,
      duration,
      mediaTitle,
    });
    return response.data;
  } catch (error) {
    console.error('Error updating progress:', error);
    return null;
  }
};

export const removeWatchHistory = async (
  mediaId: string,
  mediaType: 'movie' | 'episode'
): Promise<boolean> => {
  try {
    await api.delete(`/watch-history/${mediaId}`, {
      params: { mediaType },
    });
    return true;
  } catch (error) {
    console.error('Error removing watch history:', error);
    return false;
  }
};

export const getContinueWatching = async (): Promise<WatchHistoryItem[]> => {
  try {
    const response = await api.get('/watch-history/continue');
    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching continue watching:', error);
    return [];
  }
};

export const getWatchProgress = async (
  mediaId: string,
  mediaType: 'movie' | 'episode'
): Promise<number> => {
  try {
    const response = await api.get(`/watch-history/progress/${mediaId}`, {
      params: { mediaType },
    });
    return response.data.progress || 0;
  } catch (error) {
    console.error('Error fetching watch progress:', error);
    return 0;
  }
};

