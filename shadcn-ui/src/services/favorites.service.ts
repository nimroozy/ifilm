import { api } from './api';

export interface Favorite {
  id: string;
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'series';
  mediaTitle?: string;
  mediaPosterUrl?: string;
  addedAt: Date;
}

export interface ToggleFavoriteResponse {
  isFavorite: boolean;
  favorite: Favorite | null;
}

export const getFavorites = async (): Promise<Favorite[]> => {
  try {
    const response = await api.get('/favorites');
    return response.data.items || [];
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return [];
  }
};

export const toggleFavorite = async (
  mediaId: string,
  mediaType: 'movie' | 'series',
  mediaTitle?: string,
  mediaPosterUrl?: string
): Promise<ToggleFavoriteResponse> => {
  try {
    const response = await api.post('/favorites/toggle', {
      mediaId,
      mediaType,
      mediaTitle,
      mediaPosterUrl,
    });
    return response.data;
  } catch (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }
};

export const removeFavorite = async (
  mediaId: string,
  mediaType: 'movie' | 'series'
): Promise<boolean> => {
  try {
    await api.delete(`/favorites/${mediaId}`, {
      params: { mediaType },
    });
    return true;
  } catch (error) {
    console.error('Error removing favorite:', error);
    return false;
  }
};

export const isFavorite = async (
  mediaId: string,
  mediaType: 'movie' | 'series'
): Promise<boolean> => {
  try {
    const response = await api.get(`/favorites/check/${mediaId}`, {
      params: { mediaType },
    });
    return response.data.isFavorite || false;
  } catch (error) {
    console.error('Error checking favorite:', error);
    return false;
  }
};

