import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import { JellyfinItem, JellyfinLibrary, JellyfinSystemInfo } from '../types/jellyfin.types';

const cache = new NodeCache({ stdTTL: 300 }); // 5 minutes cache

// Clear cache when service is re-initialized
const clearCache = () => {
  console.log('[JellyfinService] Clearing cache');
  cache.flushAll();
};

// Export clearCache for external use
export const clearJellyfinCache = clearCache;

export class JellyfinService {
  private client: AxiosInstance | null = null;
  private serverUrl: string = '';
  private apiKey: string = '';
  
  // Public method to check if initialized
  public isInitialized(): boolean {
    return this.client !== null;
  }

  constructor(serverUrl?: string, apiKey?: string) {
    if (serverUrl && apiKey) {
      this.initialize(serverUrl, apiKey);
    }
  }

  initialize(serverUrl: string, apiKey: string) {
    
    console.log('[JellyfinService] Initializing with serverUrl:', serverUrl);
    
    // Always clear cache when initializing to avoid stale data
    // This ensures we get fresh data after service restart or re-initialization
    clearCache();
    console.log('[JellyfinService] Cache cleared');
    
    this.serverUrl = serverUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    
    this.client = axios.create({
      baseURL: this.serverUrl,
      headers: {
        'X-Emby-Token': apiKey,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async testConnection(): Promise<JellyfinSystemInfo> {
    if (!this.client) throw new Error('Jellyfin client not initialized');
    
    const response = await this.client.get('/System/Info');
    return response.data;
  }

  async getLibraries(): Promise<JellyfinLibrary[]> {
    if (!this.client) throw new Error('Jellyfin client not initialized');
    
    const cacheKey = 'libraries';
    const cached = cache.get<JellyfinLibrary[]>(cacheKey);
    if (cached) {
      console.log('[JellyfinService] Returning cached libraries:', cached.length);
      return cached;
    }

    try {
      const response = await this.client.get('/Library/VirtualFolders');
      console.log('[JellyfinService] VirtualFolders response:', {
        status: response.status,
        dataType: typeof response.data,
        isArray: Array.isArray(response.data),
        dataLength: Array.isArray(response.data) ? response.data.length : 'N/A',
        firstItem: Array.isArray(response.data) && response.data.length > 0 ? response.data[0] : 'N/A',
      });

      // Handle different response formats
      let libraries: JellyfinLibrary[] = [];
      
      if (Array.isArray(response.data)) {
        libraries = response.data;
      } else if (response.data && typeof response.data === 'object') {
        // Check if libraries are nested in a property
        if (response.data.Items && Array.isArray(response.data.Items)) {
          libraries = response.data.Items;
        } else if (response.data.Libraries && Array.isArray(response.data.Libraries)) {
          libraries = response.data.Libraries;
        } else {
          // Try to extract any array from the response
          const keys = Object.keys(response.data);
          for (const key of keys) {
            if (Array.isArray(response.data[key])) {
              libraries = response.data[key];
              break;
            }
          }
        }
      }

      console.log('[JellyfinService] Processed libraries:', libraries.length);
      if (libraries.length > 0) {
        const firstLib = libraries[0] as any;
        console.log('[JellyfinService] First library:', {
          Id: firstLib.Id || firstLib.ItemId,
          Name: firstLib.Name,
          CollectionType: firstLib.CollectionType,
        });
      }

      cache.set(cacheKey, libraries);
      return libraries;
    } catch (error: any) {
      console.error('[JellyfinService] Error fetching libraries:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }
  }

  async getItems(params: {
    parentId?: string;
    includeItemTypes?: string;
    startIndex?: number;
    limit?: number;
    searchTerm?: string;
    sortBy?: string;
  }): Promise<{ Items: JellyfinItem[]; TotalRecordCount: number }> {
    if (!this.client) {
      throw new Error('Jellyfin client not initialized');
    }

    // Add Recursive=true to search through all libraries
    const queryParams: any = {
      ...params,
      Recursive: true,
    };

    // Create cache key (exclude timestamp parameters used for cache-busting)
    const cacheParams = { ...queryParams };
    // Remove cache-busting parameters from cache key
    delete (cacheParams as any)._t;
    delete (cacheParams as any).bypassCache;
    const cacheKey = `items_${JSON.stringify(cacheParams)}`;
    const cached = cache.get<any>(cacheKey);
    if (cached) {
      console.log('[JellyfinService] Returning CACHED data:', { total: cached.TotalRecordCount, itemsCount: cached.Items?.length, cacheKey: cacheKey.substring(0, 100) });
      return cached;
    }
    
    console.log('[JellyfinService] Cache MISS, calling API...');


    try {
      console.log('[JellyfinService] Calling getItems with params:', JSON.stringify(queryParams));
      const response = await this.client.get('/Items', { params: queryParams });
      const data = response.data;
      
      console.log('[JellyfinService] getItems response:', { total: data.TotalRecordCount, itemsCount: data.Items?.length, status: response.status });
      
      // Use shorter cache TTL (60 seconds) for series and movies to ensure new content appears quickly
      // This ensures new series/movies added to Jellyfin appear within 1 minute instead of 5 minutes
      const cacheTTL = (params.includeItemTypes === 'Series' || params.includeItemTypes === 'Movie') ? 60 : 300;
      cache.set(cacheKey, data, cacheTTL);
      return data;
    } catch (error: any) {
      console.error('[JellyfinService] getItems error:', error.message, error.response?.status, error.response?.data);
      throw error;
    }
  }

  async getItemDetails(itemId: string): Promise<JellyfinItem> {
    if (!this.client) {
      console.error('[JellyfinService] getItemDetails: Jellyfin client not initialized');
      throw new Error('Jellyfin client not initialized');
    }

    const cacheKey = `item_${itemId}`;
    const cached = cache.get<JellyfinItem>(cacheKey);
    if (cached) {
      console.log('[JellyfinService] getItemDetails: Cache HIT for', itemId);
      return cached;
    }

    try {
      // Get the first user ID (Jellyfin requires userId for Items endpoint)
      let userId: string | null = null;
      try {
        const usersResponse = await this.client.get('/Users');
        const users = usersResponse.data;
        if (Array.isArray(users) && users.length > 0) {
          userId = users[0].Id;
        } else if (users && typeof users === 'object' && users.Items && Array.isArray(users.Items) && users.Items.length > 0) {
          userId = users.Items[0].Id;
        }
      } catch (userError) {
        console.warn('[JellyfinService] Could not fetch user ID, trying direct Items endpoint:', userError);
      }

      console.log('[JellyfinService] getItemDetails: Fetching from Jellyfin API for', itemId, 'userId:', userId);
      
      // Try user-specific endpoint first, fallback to direct endpoint
      let response;
      if (userId) {
        try {
          response = await this.client.get(`/Users/${userId}/Items/${itemId}`);
        } catch (userEndpointError: any) {
          // If user endpoint fails, try direct endpoint
          console.warn('[JellyfinService] User endpoint failed, trying direct endpoint:', userEndpointError.message);
          response = await this.client.get(`/Items/${itemId}`);
        }
      } else {
        response = await this.client.get(`/Items/${itemId}`);
      }
      
      const item = response.data;
      console.log('[JellyfinService] getItemDetails: Successfully fetched item', itemId, 'Title:', item?.Name);
      cache.set(cacheKey, item);
      return item;
    } catch (error: any) {
      console.error('[JellyfinService] getItemDetails error:', {
        itemId,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
        url: error.config?.url,
      });
      throw error;
    }
  }

  async getSeasons(seriesId: string): Promise<JellyfinItem[]> {
    if (!this.client) throw new Error('Jellyfin client not initialized');

    const response = await this.client.get(`/Shows/${seriesId}/Seasons`);
    return response.data.Items;
  }

  async getEpisodes(seriesId: string, seasonId?: string): Promise<JellyfinItem[]> {
    if (!this.client) throw new Error('Jellyfin client not initialized');

    const params: any = { seriesId };
    if (seasonId) params.seasonId = seasonId;

    const response = await this.client.get(`/Shows/${seriesId}/Episodes`, { params });
    return response.data.Items;
  }

  async search(query: string): Promise<JellyfinItem[]> {
    if (!this.client) throw new Error('Jellyfin client not initialized');

    const response = await this.client.get('/Items', {
      params: {
        searchTerm: query,
        includeItemTypes: 'Movie,Series',
        recursive: true,
        limit: 50,
      },
    });
    return response.data.Items;
  }

  getImageUrl(itemId: string, imageType: string = 'Primary'): string {
    return `${this.serverUrl}/Items/${itemId}/Images/${imageType}?api_key=${this.apiKey}`;
  }

  getStreamUrl(itemId: string): string {
    return `${this.serverUrl}/Videos/${itemId}/stream?static=true&api_key=${this.apiKey}`;
  }

  getHlsUrl(itemId: string): string {
    return `${this.serverUrl}/Videos/${itemId}/master.m3u8?api_key=${this.apiKey}`;
  }
}

export const jellyfinService = new JellyfinService();