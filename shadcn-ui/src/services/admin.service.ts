import { isDemoMode } from './mockAuth.service';
import { api } from './api';

export interface SystemStats {
  totalUsers: number;
  totalMovies: number;
  totalSeries: number;
  activeStreams: number;
  storageUsed: string;
  storageTotal: string;
  jellyfinStatus: 'connected' | 'disconnected' | 'error';
  apiResponseTime: number;
}

export interface Library {
  id: string;
  name: string;
  type: 'movies' | 'series' | 'music';
  itemCount: number;
  visible: boolean;
  lastSync: Date;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: Date;
  lastLogin: Date;
}

export interface JellyfinSettings {
  serverUrl: string;
  apiKey: string;
}

export interface ActivityLog {
  id: string;
  type: 'user_registered' | 'user_login' | 'movie_watched' | 'library_synced' | 'settings_updated';
  message: string;
  timestamp: Date;
}

// Mock data for demo mode
const mockStats: SystemStats = {
  totalUsers: 1247,
  totalMovies: 3842,
  totalSeries: 856,
  activeStreams: 23,
  storageUsed: '2.4 TB',
  storageTotal: '5.0 TB',
  jellyfinStatus: 'connected',
  apiResponseTime: 45,
};

const mockLibraries: Library[] = [
  {
    id: 'lib-1',
    name: 'Movies',
    type: 'movies',
    itemCount: 3842,
    visible: true,
    lastSync: new Date('2024-12-29T10:30:00'),
  },
  {
    id: 'lib-2',
    name: 'TV Shows',
    type: 'series',
    itemCount: 856,
    visible: true,
    lastSync: new Date('2024-12-29T10:30:00'),
  },
  {
    id: 'lib-3',
    name: '4K Movies',
    type: 'movies',
    itemCount: 542,
    visible: false,
    lastSync: new Date('2024-12-29T10:30:00'),
  },
  {
    id: 'lib-4',
    name: 'Kids Content',
    type: 'movies',
    itemCount: 234,
    visible: true,
    lastSync: new Date('2024-12-29T10:30:00'),
  },
];

const mockUsers: AdminUser[] = [
  {
    id: 'user-1',
    username: 'demo',
    email: 'demo@ifilm.com',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date('2024-12-29'),
  },
  {
    id: 'user-2',
    username: 'admin',
    email: 'admin@ifilm.com',
    role: 'admin',
    createdAt: new Date('2024-01-01'),
    lastLogin: new Date('2024-12-29'),
  },
  {
    id: 'user-3',
    username: 'john_doe',
    email: 'john@example.com',
    role: 'user',
    createdAt: new Date('2024-06-15'),
    lastLogin: new Date('2024-12-28'),
  },
  {
    id: 'user-4',
    username: 'jane_smith',
    email: 'jane@example.com',
    role: 'user',
    createdAt: new Date('2024-08-20'),
    lastLogin: new Date('2024-12-27'),
  },
];

const mockActivityLogs: ActivityLog[] = [
  {
    id: 'log-1',
    type: 'user_login',
    message: 'User admin logged in',
    timestamp: new Date('2024-12-29T14:30:00'),
  },
  {
    id: 'log-2',
    type: 'movie_watched',
    message: 'User demo watched The Matrix',
    timestamp: new Date('2024-12-29T13:45:00'),
  },
  {
    id: 'log-3',
    type: 'library_synced',
    message: 'Movies library synced successfully',
    timestamp: new Date('2024-12-29T10:30:00'),
  },
  {
    id: 'log-4',
    type: 'user_registered',
    message: 'New user jane_smith registered',
    timestamp: new Date('2024-12-28T16:20:00'),
  },
  {
    id: 'log-5',
    type: 'settings_updated',
    message: 'Jellyfin settings updated',
    timestamp: new Date('2024-12-28T09:15:00'),
  },
];

export const getSystemStats = async (): Promise<SystemStats> => {
  if (isDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockStats;
  }
  
  try {
    const response = await api.get('/admin/stats');
    return response.data;
  } catch (error: any) {
    console.error('[Frontend Admin Service] Failed to get system stats:', error);
    // Fallback to mock data if API fails
    return mockStats;
  }
};

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
  if (isDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockActivityLogs;
  }
  
  try {
    const response = await api.get('/admin/activity');
    return response.data || [];
  } catch (error: any) {
    console.error('[Frontend Admin Service] Failed to get activity logs:', error);
    // Fallback to empty array if API fails
    return [];
  }
};

export const testJellyfinConnection = async (serverUrl: string, apiKey: string): Promise<{ success: boolean; message: string; serverInfo?: { name: string; version: string } }> => {
  if (isDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (!serverUrl || !apiKey) {
      return { success: false, message: 'Server URL and API Key are required' };
    }
    
    return {
      success: true,
      message: 'Successfully connected to Jellyfin server',
      serverInfo: {
        name: 'iFilm Jellyfin Server',
        version: '10.8.13',
      },
    };
  }
  
  // Use backend API to test connection (avoids CORS issues)
  try {
    const response = await api.post('/admin/jellyfin/test', {
      serverUrl,
      apiKey,
    });
    
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message,
        serverInfo: response.data.serverInfo,
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Failed to connect to Jellyfin server',
      };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || error.message || 'Cannot reach Jellyfin server. Please check the URL.';
    return {
      success: false,
      message: errorMessage,
    };
  }
};

export const saveJellyfinSettings = async (settings: JellyfinSettings): Promise<{ success: boolean; message: string }> => {
  // Check if user has an access token (real or demo)
  const token = localStorage.getItem('accessToken');
  
  // If no token at all, use demo mode
  if (!token && isDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 800));
    localStorage.setItem('jellyfin_server_url', settings.serverUrl);
    localStorage.setItem('jellyfin_api_key', settings.apiKey);
    localStorage.setItem('jellyfinSettings', JSON.stringify(settings));
    return { success: true, message: 'Jellyfin settings saved successfully (demo mode)' };
  }

  // If user has a token (even if demo), try to call backend API
  // The backend will handle authentication
  try {
    const response = await api.post('/admin/jellyfin/save', {
      serverUrl: settings.serverUrl,
      apiKey: settings.apiKey,
    });

    if (response.data.success) {
      // Also save to localStorage for backward compatibility
      localStorage.setItem('jellyfin_server_url', settings.serverUrl);
      localStorage.setItem('jellyfin_api_key', settings.apiKey);
      localStorage.setItem('jellyfinSettings', JSON.stringify(settings));
      
      return {
        success: true,
        message: response.data.message || 'Jellyfin settings saved successfully',
      };
    } else {
      return {
        success: false,
        message: response.data.message || 'Failed to save Jellyfin settings',
      };
    }
  } catch (error: any) {
    console.error('[Frontend Admin Service] Failed to save Jellyfin settings:', error);
    
    // If backend call fails and user is in demo mode, fall back to localStorage
    if (isDemoMode() && (!error.response || error.response?.status === 401)) {
      localStorage.setItem('jellyfin_server_url', settings.serverUrl);
      localStorage.setItem('jellyfin_api_key', settings.apiKey);
      localStorage.setItem('jellyfinSettings', JSON.stringify(settings));
      return { success: true, message: 'Jellyfin settings saved to local storage (backend unavailable)' };
    }
    
    const errorMessage = error.response?.data?.message || error.message || 'Failed to save Jellyfin settings';
    return {
      success: false,
      message: errorMessage,
    };
  }
};

export const getJellyfinSettings = (): JellyfinSettings | null => {
  // Try to get from individual keys first
  const serverUrl = localStorage.getItem('jellyfin_server_url');
  const apiKey = localStorage.getItem('jellyfin_api_key');
  
  if (serverUrl && apiKey) {
    return { serverUrl, apiKey };
  }
  
  // Fallback to JSON format
  const settingsStr = localStorage.getItem('jellyfinSettings');
  if (settingsStr) {
    return JSON.parse(settingsStr);
  }
  
  // Return demo defaults if in demo mode
  if (isDemoMode()) {
    return {
      serverUrl: 'http://localhost:8096',
      apiKey: 'demo_api_key_12345',
    };
  }
  
  return null;
};

export const getLibraries = async (): Promise<Library[]> => {
  if (isDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 600));
    const librariesStr = localStorage.getItem('libraries');
    if (librariesStr) {
      return JSON.parse(librariesStr);
    }
    return mockLibraries;
  }
  
  try {
    const response = await api.get('/admin/jellyfin/libraries');
    if (response.data.success && response.data.libraries) {
      // Map backend LibraryRecord to frontend Library format
      return response.data.libraries.map((lib: any) => ({
        id: lib.id,
        name: lib.libraryName,
        type: lib.collectionType === 'movies' ? 'movies' : lib.collectionType === 'tvshows' ? 'series' : 'mixed',
        itemCount: lib.itemCount,
        visible: lib.isVisible,
        lastSync: lib.lastSync ? new Date(lib.lastSync) : undefined,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching libraries:', error);
    throw error;
  }
};

export const toggleLibraryVisibility = async (libraryId: string): Promise<{ success: boolean; message: string }> => {
  if (isDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 400));
    const libraries = await getLibraries();
    const library = libraries.find(lib => lib.id === libraryId);
    if (!library) {
      return { success: false, message: 'Library not found' };
    }
    const updatedLibraries = libraries.map(lib =>
      lib.id === libraryId ? { ...lib, visible: !lib.visible } : lib
    );
    localStorage.setItem('libraries', JSON.stringify(updatedLibraries));
    return { success: true, message: 'Library visibility updated' };
  }
  
  try {
    const libraries = await getLibraries();
    const library = libraries.find(lib => lib.id === libraryId);
    if (!library) {
      return { success: false, message: 'Library not found' };
    }
    
    const response = await api.put(`/admin/jellyfin/libraries/${libraryId}/visibility`, {
      isVisible: !library.visible,
    });
    
    if (response.data.success) {
      return { success: true, message: response.data.message || 'Library visibility updated' };
    }
    return { success: false, message: response.data.message || 'Failed to update library visibility' };
  } catch (error: any) {
    console.error('Error toggling library visibility:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to update library visibility',
    };
  }
};

export const syncLibraries = async (): Promise<{ success: boolean; message: string }> => {
  if (isDemoMode()) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const libraries = await getLibraries();
    const updatedLibraries = libraries.map(lib => ({
      ...lib,
      lastSync: new Date(),
    }));
    localStorage.setItem('libraries', JSON.stringify(updatedLibraries));
    return { success: true, message: 'All libraries synced successfully' };
  }
  
  try {
    const response = await api.post('/admin/jellyfin/libraries/sync');
    
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'Libraries synced successfully',
      };
    }
    return {
      success: false,
      message: response.data.message || 'Failed to sync libraries',
    };
  } catch (error: any) {
    console.error('Error syncing libraries:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.response?.data?.detailedError || 'Failed to sync libraries',
    };
  }
};

export const getUsers = async (): Promise<AdminUser[]> => {
  try {
    const response = await api.get('/admin/users');
    if (response.data.success) {
      return response.data.users.map((user: any) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: new Date(user.createdAt),
        lastLogin: new Date(user.lastLogin),
      }));
    }
    throw new Error(response.data.message || 'Failed to fetch users');
  } catch (error: any) {
    console.error('Error fetching users:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to fetch users');
  }
};

export const updateUserRole = async (userId: string, newRole: 'user' | 'admin'): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.put(`/admin/users/${userId}/role`, { role: newRole });
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || `User role updated to ${newRole}`,
      };
    }
    throw new Error(response.data.message || 'Failed to update user role');
  } catch (error: any) {
    console.error('Error updating user role:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to update user role');
  }
};

export const deleteUser = async (userId: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.delete(`/admin/users/${userId}`);
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'User deleted successfully',
      };
    }
    throw new Error(response.data.message || 'Failed to delete user');
  } catch (error: any) {
    console.error('Error deleting user:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to delete user');
  }
};

export const createUser = async (userData: {
  email: string;
  username: string;
  password: string;
  role?: 'user' | 'admin';
}): Promise<{ success: boolean; message: string; user?: AdminUser }> => {
  try {
    const response = await api.post('/admin/users', userData);
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'User created successfully',
        user: response.data.user ? {
          id: response.data.user.id,
          email: response.data.user.email,
          username: response.data.user.username,
          role: response.data.user.role,
          createdAt: new Date(response.data.user.createdAt),
          lastLogin: new Date(response.data.user.lastLogin),
        } : undefined,
      };
    }
    throw new Error(response.data.message || 'Failed to create user');
  } catch (error: any) {
    console.error('Error creating user:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to create user');
  }
};
// R2 Configuration Interfaces
export interface R2Config {
  id?: number;
  accountId: string;
  accessKeyId: string;
  bucketName: string;
  publicUrl?: string;
  endpointUrl: string;
  region: string;
  isActive?: boolean;
}

export interface R2File {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  isDirectory: boolean;
  contentType?: string;
}

export interface R2ListResponse {
  files: R2File[];
  prefix: string;
  hasMore: boolean;
  nextContinuationToken?: string;
}

// R2 Configuration Functions
export const getR2Config = async (): Promise<R2Config | null> => {
  try {
    const response = await api.get('/admin/r2/config');
    if (response.data.success) {
      return response.data.config;
    }
    return null;
  } catch (error: any) {
    console.error('Error fetching R2 config:', error);
    return null;
  }
};

export const saveR2Config = async (config: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl?: string;
  endpointUrl?: string;
  region?: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post('/admin/r2/config/save', config);
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'R2 configuration saved successfully',
      };
    }
    return {
      success: false,
      message: response.data.message || 'Failed to save R2 configuration',
    };
  } catch (error: any) {
    console.error('Error saving R2 config:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.response?.data?.detailedError || 'Failed to save R2 configuration',
    };
  }
};

export const testR2Connection = async (config: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpointUrl?: string;
  region?: string;
}): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post('/admin/r2/test', config);
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'Successfully connected to R2 bucket',
      };
    }
    return {
      success: false,
      message: response.data.message || 'Failed to connect to R2 bucket',
    };
  } catch (error: any) {
    console.error('Error testing R2 connection:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.response?.data?.detailedError || 'Failed to test R2 connection',
    };
  }
};

// R2 File Management Functions
export const listR2Files = async (prefix: string = '', maxKeys: number = 1000, continuationToken?: string): Promise<R2ListResponse> => {
  try {
    const params: any = { prefix, maxKeys };
    if (continuationToken) {
      params.continuationToken = continuationToken;
    }
    const response = await api.get('/admin/r2/files', { params });
    if (response.data.success) {
      return {
        files: response.data.files || [],
        prefix: response.data.prefix || '',
        hasMore: response.data.hasMore || false,
        nextContinuationToken: response.data.nextContinuationToken,
      };
    }
    throw new Error(response.data.message || 'Failed to list files');
  } catch (error: any) {
    console.error('Error listing R2 files:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to list files');
  }
};

export const uploadR2File = async (file: File, key?: string): Promise<{ success: boolean; message: string; key: string }> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (key) {
      formData.append('key', key);
    }
    const response = await api.post('/admin/r2/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'File uploaded successfully',
        key: response.data.key,
      };
    }
    throw new Error(response.data.message || 'Failed to upload file');
  } catch (error: any) {
    console.error('Error uploading R2 file:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to upload file');
  }
};

export const downloadR2File = async (key: string, asUrl: boolean = false): Promise<{ url?: string; blob?: Blob }> => {
  try {
    if (asUrl) {
      const response = await api.get(`/admin/r2/files/${encodeURIComponent(key)}`, { params: { url: 'true' } });
      if (response.data.success) {
        return { url: response.data.url };
      }
      throw new Error(response.data.message || 'Failed to get download URL');
    } else {
      const response = await api.get(`/admin/r2/files/${encodeURIComponent(key)}`, {
        responseType: 'blob',
      });
      return { blob: response.data };
    }
  } catch (error: any) {
    console.error('Error downloading R2 file:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to download file');
  }
};

export const renameR2File = async (oldKey: string, newKey: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post('/admin/r2/files/rename', { oldKey, newKey });
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'File renamed successfully',
      };
    }
    throw new Error(response.data.message || 'Failed to rename file');
  } catch (error: any) {
    console.error('Error renaming R2 file:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to rename file');
  }
};

export const moveR2File = async (oldKey: string, newKey: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.post('/admin/r2/files/move', { oldKey, newKey });
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'File moved successfully',
      };
    }
    throw new Error(response.data.message || 'Failed to move file');
  } catch (error: any) {
    console.error('Error moving R2 file:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to move file');
  }
};

export const deleteR2File = async (key: string): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.delete(`/admin/r2/files/${encodeURIComponent(key)}`);
    if (response.data.success) {
      return {
        success: true,
        message: response.data.message || 'File deleted successfully',
      };
    }
    throw new Error(response.data.message || 'Failed to delete file');
  } catch (error: any) {
    console.error('Error deleting R2 file:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to delete file');
  }
};

export const getR2FileInfo = async (key: string): Promise<R2File> => {
  try {
    const response = await api.get(`/admin/r2/files/${encodeURIComponent(key)}/info`);
    if (response.data.success) {
      return response.data.file;
    }
    throw new Error(response.data.message || 'Failed to get file info');
  } catch (error: any) {
    console.error('Error getting R2 file info:', error);
    throw new Error(error.response?.data?.message || error.response?.data?.detailedError || 'Failed to get file info');
  }
};

// Cache Management
export interface ClearCacheResult {
  success: boolean;
  message: string;
  results?: {
    jellyfin?: { success: boolean; message: string };
    nginx?: { success: boolean; message: string };
  };
}

export const clearCache = async (cacheType: 'jellyfin' | 'nginx' | 'all' = 'all'): Promise<ClearCacheResult> => {
  try {
    const response = await api.post('/admin/cache/clear', { cacheType });
    return response.data;
  } catch (error: any) {
    console.error('Error clearing cache:', error);
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to clear cache',
    };
  }
};
