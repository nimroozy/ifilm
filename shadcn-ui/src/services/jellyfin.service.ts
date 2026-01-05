import { MediaItem } from '@/types/media.types';
import { isDemoMode } from './mockAuth.service';
import { mockMovies } from '@/data/mockMovies';

export interface JellyfinItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  RunTimeTicks?: number;
  Genres?: string[];
}

export interface JellyfinResponse {
  Items: JellyfinItem[];
  TotalRecordCount: number;
}

// Generate a unique device ID for this browser session
const getDeviceId = (): string => {
  let deviceId = localStorage.getItem('jellyfin_device_id');
  if (!deviceId) {
    deviceId = 'ifilm-web-' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('jellyfin_device_id', deviceId);
  }
  return deviceId;
};

export const getJellyfinSettings = (): { serverUrl: string; apiKey: string } | null => {
  const serverUrl = localStorage.getItem('jellyfin_server_url');
  const apiKey = localStorage.getItem('jellyfin_api_key');
  
  if (serverUrl && apiKey) {
    return { serverUrl, apiKey };
  }
  
  return null;
};

const getJellyfinHeaders = (apiKey: string): HeadersInit => {
  const deviceId = getDeviceId();
  return {
    'X-Emby-Authorization': `MediaBrowser Client="iFilm", Device="Web Browser", DeviceId="${deviceId}", Version="1.0.0"`,
    'X-Emby-Token': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

const detectCorsError = (error: Error): boolean => {
  const errorMessage = error.message.toLowerCase();
  return errorMessage.includes('cors') || 
         errorMessage.includes('network') || 
         errorMessage.includes('failed to fetch') ||
         error.name === 'TypeError';
};

const transformJellyfinItem = (item: JellyfinItem, serverUrl: string, apiKey: string): MediaItem => {
  // Remove trailing slash from serverUrl if present
  const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
  
  return {
    id: item.Id,
    title: item.Name,
    type: item.Type === 'Movie' ? 'movie' : 'series',
    overview: item.Overview || 'No description available.',
    posterUrl: `${baseUrl}/Items/${item.Id}/Images/Primary?api_key=${apiKey}`,
    backdropUrl: `${baseUrl}/Items/${item.Id}/Images/Backdrop?api_key=${apiKey}`,
    year: item.ProductionYear || 0,
    rating: item.CommunityRating || 0,
    duration: item.RunTimeTicks ? Math.round(item.RunTimeTicks / 600000000) : 0,
    genres: item.Genres || [],
  };
};

export const fetchMoviesFromJellyfin = async (): Promise<{ success: boolean; data?: MediaItem[]; error?: string; isCorsError?: boolean }> => {
  // In demo mode, always return mock movies
  if (isDemoMode()) {
    return {
      success: true,
      data: mockMovies.filter(m => m.type === 'movie'),
    };
  }

  const settings = getJellyfinSettings();
  
  if (!settings) {
    return {
      success: false,
      error: 'Jellyfin server not configured. Please configure in Admin Panel.',
    };
  }

  try {
    // Remove trailing slash from serverUrl if present
    const baseUrl = settings.serverUrl.endsWith('/') ? settings.serverUrl.slice(0, -1) : settings.serverUrl;
    const url = `${baseUrl}/Items?IncludeItemTypes=Movie&Recursive=true`;
    
    console.log('[Jellyfin] Fetching movies from:', url);
    console.log('[Jellyfin] Headers:', getJellyfinHeaders(settings.apiKey));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getJellyfinHeaders(settings.apiKey),
      mode: 'cors',
    });
    
    console.log('[Jellyfin] Response status:', response.status);
    console.log('[Jellyfin] Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Invalid Jellyfin API key. Please update in Admin Panel.',
        };
      }
      const errorText = await response.text();
      console.error('[Jellyfin] Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: JellyfinResponse = await response.json();
    console.log('[Jellyfin] Fetched', data.TotalRecordCount, 'movies');
    const movies = data.Items.map(item => transformJellyfinItem(item, baseUrl, settings.apiKey));
    
    return {
      success: true,
      data: movies,
    };
  } catch (error) {
    console.error('[Jellyfin] Failed to fetch movies:', error);
    
    const isCors = detectCorsError(error as Error);
    
    if (isCors) {
      return {
        success: false,
        error: 'CORS Error: Your Jellyfin server is blocking requests from this website. Please enable CORS in Jellyfin Dashboard → Networking → CORS, or contact your administrator.',
        isCorsError: true,
      };
    }
    
    return {
      success: false,
      error: `Cannot connect to Jellyfin server at ${settings.serverUrl}. Please check the URL and ensure the server is running.`,
    };
  }
};

export const fetchSeriesFromJellyfin = async (): Promise<{ success: boolean; data?: MediaItem[]; error?: string; isCorsError?: boolean }> => {
  // In demo mode, return mock series
  if (isDemoMode()) {
    return {
      success: true,
      data: mockMovies.filter(m => m.type === 'series'),
    };
  }

  const settings = getJellyfinSettings();
  
  if (!settings) {
    return {
      success: false,
      error: 'Jellyfin server not configured. Please configure in Admin Panel.',
    };
  }

  try {
    const baseUrl = settings.serverUrl.endsWith('/') ? settings.serverUrl.slice(0, -1) : settings.serverUrl;
    const url = `${baseUrl}/Items?IncludeItemTypes=Series&Recursive=true`;
    
    console.log('[Jellyfin] Fetching series from:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getJellyfinHeaders(settings.apiKey),
      mode: 'cors',
    });
    
    console.log('[Jellyfin] Response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          error: 'Invalid Jellyfin API key. Please update in Admin Panel.',
        };
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data: JellyfinResponse = await response.json();
    console.log('[Jellyfin] Fetched', data.TotalRecordCount, 'series');
    const series = data.Items.map(item => transformJellyfinItem(item, baseUrl, settings.apiKey));
    
    return {
      success: true,
      data: series,
    };
  } catch (error) {
    console.error('[Jellyfin] Failed to fetch series:', error);
    
    const isCors = detectCorsError(error as Error);
    
    if (isCors) {
      return {
        success: false,
        error: 'CORS Error: Your Jellyfin server is blocking requests from this website. Please enable CORS in Jellyfin Dashboard → Networking → CORS, or contact your administrator.',
        isCorsError: true,
      };
    }
    
    return {
      success: false,
      error: `Cannot connect to Jellyfin server at ${settings.serverUrl}. Please check the URL and ensure the server is running.`,
    };
  }
};

export const fetchItemDetails = async (itemId: string): Promise<{ success: boolean; data?: MediaItem; error?: string }> => {
  if (isDemoMode()) {
    const item = mockMovies.find(m => m.id === itemId);
    if (item) {
      return { success: true, data: item };
    }
    return { success: false, error: 'Item not found' };
  }

  const settings = getJellyfinSettings();
  
  if (!settings) {
    return {
      success: false,
      error: 'Jellyfin server not configured.',
    };
  }

  try {
    const baseUrl = settings.serverUrl.endsWith('/') ? settings.serverUrl.slice(0, -1) : settings.serverUrl;
    const url = `${baseUrl}/Items/${itemId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getJellyfinHeaders(settings.apiKey),
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const item: JellyfinItem = await response.json();
    const transformedItem = transformJellyfinItem(item, baseUrl, settings.apiKey);
    
    return {
      success: true,
      data: transformedItem,
    };
  } catch (error) {
    console.error('[Jellyfin] Failed to fetch item details:', error);
    return {
      success: false,
      error: 'Cannot fetch item details.',
    };
  }
};

export const testJellyfinConnection = async (serverUrl: string, apiKey: string): Promise<{ 
  success: boolean; 
  message: string; 
  serverInfo?: { name: string; version: string };
  isCorsError?: boolean;
  detailedError?: string;
}> => {
  try {
    const baseUrl = serverUrl.endsWith('/') ? serverUrl.slice(0, -1) : serverUrl;
    const url = `${baseUrl}/System/Info`;
    
    console.log('[Jellyfin] Testing connection to:', url);
    console.log('[Jellyfin] Using API key:', apiKey.substring(0, 8) + '...');
    console.log('[Jellyfin] Headers:', getJellyfinHeaders(apiKey));
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getJellyfinHeaders(apiKey),
      mode: 'cors',
    });
    
    console.log('[Jellyfin] Test response status:', response.status);
    console.log('[Jellyfin] Test response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        const errorText = await response.text();
        console.error('[Jellyfin] Auth error response:', errorText);
        return {
          success: false,
          message: 'Invalid API key. Please check your Jellyfin API key.',
          detailedError: `HTTP ${response.status}: Authentication failed. Error: ${errorText}`,
        };
      }
      const errorText = await response.text();
      console.error('[Jellyfin] Error response:', errorText);
      return {
        success: false,
        message: `Connection failed with status ${response.status}`,
        detailedError: `HTTP ${response.status}: ${response.statusText}. Response: ${errorText}`,
      };
    }
    
    const data = await response.json();
    console.log('[Jellyfin] Server info:', data);
    return {
      success: true,
      message: 'Successfully connected to Jellyfin server',
      serverInfo: {
        name: data.ServerName || 'Jellyfin Server',
        version: data.Version || 'Unknown',
      },
    };
  } catch (error) {
    console.error('[Jellyfin] Connection test failed:', error);
    
    const isCors = detectCorsError(error as Error);
    
    if (isCors) {
      return {
        success: false,
        message: 'CORS Error: Cannot connect due to Cross-Origin restrictions',
        isCorsError: true,
        detailedError: `Your Jellyfin server is blocking requests from this website (${window.location.origin}). This is a security feature that needs to be configured. Error: ${(error as Error).message}`,
      };
    }
    
    return {
      success: false,
      message: 'Cannot reach Jellyfin server',
      detailedError: `Network error: ${(error as Error).message}. Please check the server URL and ensure the server is running.`,
    };
  }
};