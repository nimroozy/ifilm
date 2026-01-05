import { Request, Response } from 'express';
import { jellyfinService } from '../services/jellyfin.service';
import { addSearchHistory } from '../services/search-history.service';
import { JellyfinItem } from '../types/jellyfin.types';

export const getMovies = async (req: Request, res: Response) => {
  // Check if Jellyfin is initialized FIRST, before any try/catch
  // If not initialized, try to load config and initialize
  if (!jellyfinService.isInitialized()) {
    try {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured. Please configure in Admin Panel.',
          error: 'Jellyfin client not initialized'
        });
      }
    } catch (configError) {
      console.error('Error loading Jellyfin config:', configError);
      return res.status(503).json({ 
        message: 'Jellyfin server not configured. Please configure in Admin Panel.',
        error: 'Jellyfin client not initialized'
      });
    }
  }

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const startIndex = (page - 1) * limit;

    // Get visible libraries to filter movies
    const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
    const { getVisibleLibraries, getLibraries } = await import('../services/jellyfin-libraries.service');
    const config = await loadJellyfinConfig();
    
    let visibleLibraryIds: string[] = [];
    let allLibraryIds: string[] = [];
    if (config) {
      const allLibraries = await getLibraries(config.id);
      const visibleLibraries = await getVisibleLibraries(config.id);
      
      // Filter for movies libraries only
      const movieLibraries = visibleLibraries.filter(lib => 
        lib.collectionType === 'movies' || lib.collectionType === 'mixed'
      );
      visibleLibraryIds = movieLibraries.map(lib => lib.libraryId);
      allLibraryIds = allLibraries.map(lib => lib.libraryId);
      
      console.log('[getMovies] Visible movie libraries:', visibleLibraryIds.length, visibleLibraryIds);
      console.log('[getMovies] All libraries:', allLibraryIds.length);
      
      // If no visible libraries, return empty result
      if (visibleLibraryIds.length === 0) {
        return res.json({
          items: [],
          total: 0,
          page,
          pages: 0,
        });
      }
    }

    // Fetch movies from Jellyfin
    // If we have exactly one visible library, use parentId for efficient filtering
    // Otherwise, fetch all and filter by library
    const result = await jellyfinService.getItems({
      includeItemTypes: 'Movie',
      startIndex: visibleLibraryIds.length === 1 ? startIndex : 0, // Reset startIndex if filtering multiple
      limit: visibleLibraryIds.length === 1 ? limit : limit * 10, // Get more items if we need to filter
      sortBy: 'SortName',
      ...(visibleLibraryIds.length === 1 ? { parentId: visibleLibraryIds[0] } : {}),
    });

    if (!result.Items || result.Items.length === 0) {
      return res.json({
        items: [],
        total: 0,
        page,
        pages: 0,
      });
    }

    // Filter items by visible libraries
    let filteredItems = result.Items.filter((item) => item.Id && item.Name);
    
    // If we have multiple visible libraries or need to filter, check each item's library
    if (visibleLibraryIds.length > 1 || (visibleLibraryIds.length > 0 && allLibraryIds.length > visibleLibraryIds.length)) {
      // Get library ItemIds (these are the actual folder IDs in Jellyfin)
      const visibleLibraries = await getVisibleLibraries(config!.id);
      const movieLibraries = visibleLibraries.filter(lib => 
        lib.collectionType === 'movies' || lib.collectionType === 'mixed'
      );
      
      // Query items from each visible library separately and combine
      // This ensures we only get items from visible libraries
      const allItems: JellyfinItem[] = [];
      const allLibraryItemIds: string[] = []; // Track library ItemIds from Jellyfin
      
      // First, get the actual library folder IDs from Jellyfin
      const jellyfinLibraries = await jellyfinService.getLibraries();
      for (const library of movieLibraries) {
        // Find the matching Jellyfin library to get its ItemId (actual folder ID)
        const jellyfinLib = jellyfinLibraries.find((jl: any) => 
          (jl.Id === library.libraryId || jl.ItemId === library.libraryId)
        );
        
        const libraryItemId = jellyfinLib?.ItemId || jellyfinLib?.Id || library.libraryId;
        allLibraryItemIds.push(libraryItemId);
        
        try {
          console.log('[getMovies] Fetching items from library:', library.libraryName, 'ItemId:', libraryItemId);
          const libraryItems = await jellyfinService.getItems({
            includeItemTypes: 'Movie',
            parentId: libraryItemId,
            limit: 10000, // Get all items from this library
            sortBy: 'SortName',
          });
          
          if (libraryItems.Items && libraryItems.Items.length > 0) {
            console.log('[getMovies] Found', libraryItems.Items.length, 'items in library', library.libraryName);
            allItems.push(...libraryItems.Items);
          }
        } catch (libError: any) {
          console.warn('[getMovies] Could not fetch items from library', library.libraryId, ':', libError.message);
          // If parentId doesn't work, the library might not have a direct folder structure
          // In that case, we'll filter by CollectionFolders later
        }
      }
      
      // If we got items from libraries, use those
      if (allItems.length > 0) {
        // Remove duplicates
        const uniqueItems = allItems.filter((item, index, self) => 
          index === self.findIndex((t) => t.Id === item.Id)
        );
        
        // Sort and paginate
        const sortedItems = uniqueItems.sort((a, b) => {
          const nameA = a.Name || '';
          const nameB = b.Name || '';
          return nameA.localeCompare(nameB);
        });
        
        filteredItems = sortedItems.slice(startIndex, startIndex + limit);
      } else {
        // Fallback: filter by CollectionFolders if available
        filteredItems = filteredItems.filter((item: any) => {
          if (item.CollectionFolders && Array.isArray(item.CollectionFolders)) {
            return item.CollectionFolders.some((folderId: string) => allLibraryItemIds.includes(folderId));
          }
          // If no CollectionFolders, exclude it (can't verify it's from a visible library)
          return false;
        });
      }
    }
    
    const movies = filteredItems.map((item) => ({
      id: item.Id,
      title: item.Name,
      type: 'movie',
      overview: item.Overview || '',
      posterUrl: jellyfinService.getImageUrl(item.Id, 'Primary'),
      backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length > 0
        ? jellyfinService.getImageUrl(item.Id, 'Backdrop')
        : jellyfinService.getImageUrl(item.Id, 'Primary'),
      year: item.ProductionYear || 0,
      rating: item.CommunityRating || 0,
      duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000 / 60) : 0,
      genres: item.Genres || [],
    }));

    const responseData = {
      items: movies,
      total: result.TotalRecordCount,
      page,
      pages: Math.ceil(result.TotalRecordCount / limit),
    };

    res.json(responseData);
  } catch (error) {
    console.error('Get movies error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // If error is about Jellyfin not being initialized, return 503
    if (errorMessage.includes('Jellyfin client not initialized') || !jellyfinService.isInitialized()) {
      return res.status(503).json({ 
        message: 'Jellyfin server not configured. Please configure in Admin Panel.',
        error: 'Jellyfin client not initialized'
      });
    }
    
    res.status(500).json({ 
      message: 'Failed to fetch movies',
      error: errorMessage 
    });
  }
};

export const getMovieDetails = async (req: Request, res: Response) => {
  // Check if Jellyfin is initialized
  if (!jellyfinService.isInitialized()) {
    try {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured. Please configure in Admin Panel.',
          error: 'Jellyfin client not initialized'
        });
      }
    } catch (configError) {
      console.error('Error loading Jellyfin config:', configError);
      return res.status(503).json({ 
        message: 'Jellyfin server not configured. Please configure in Admin Panel.',
        error: 'Jellyfin client not initialized'
      });
    }
  }

  try {
    const { id } = req.params;
    console.log('[getMovieDetails] Fetching details for movie ID:', id);

    // Always validate cache to ensure item still exists in Jellyfin
    const item = await jellyfinService.getItemDetails(id, true);

    if (!item || !item.Id) {
      console.error('[getMovieDetails] Invalid item response:', item);
      return res.status(404).json({ message: 'Movie not found' });
    }

    // Check if the item is actually a movie, not a series
    if (item.Type === 'Series' || item.Type === 'Episode' || item.Type === 'Season') {
      console.log('[getMovieDetails] Item is not a movie, it is:', item.Type);
      return res.status(404).json({ message: 'Movie not found' });
    }

    const movie = {
      id: item.Id,
      title: item.Name,
      type: 'movie',
      overview: item.Overview || '',
      posterUrl: jellyfinService.getImageUrl(item.Id, 'Primary'),
      backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length > 0
        ? jellyfinService.getImageUrl(item.Id, 'Backdrop')
        : jellyfinService.getImageUrl(item.Id, 'Primary'),
      year: item.ProductionYear || 0,
      rating: item.CommunityRating || 0,
      duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000 / 60) : 0,
      genres: item.Genres || [],
    };

    console.log('[getMovieDetails] Successfully returning movie:', movie.title);
    res.json(movie);
  } catch (error: any) {
    console.error('[getMovieDetails] Error:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    if (error.message?.includes('Jellyfin client not initialized')) {
      return res.status(503).json({ 
        message: 'Jellyfin server not configured. Please configure in Admin Panel.',
        error: 'Jellyfin client not initialized'
      });
    }
    
    if (error.response?.status === 404) {
      return res.status(404).json({ message: 'Movie not found in Jellyfin' });
    }
    
    res.status(500).json({ 
      message: 'Failed to fetch movie details',
      error: error.message || 'Unknown error'
    });
  }
};

export const getStreamUrl = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!jellyfinService.isInitialized()) {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured',
          error: 'Jellyfin client not initialized'
        });
      }
    }

    // Get Jellyfin config - we always use API key for Jellyfin API calls
    // Bearer token is for iFilm auth, but Jellyfin needs its own API key
    const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
    const axios = require('axios');
    const config = await loadJellyfinConfig();
    if (!config) {
      return res.status(503).json({ message: 'Jellyfin server not configured' });
    }
    
    // Always use Jellyfin API key for Jellyfin API calls (not Bearer token)
    const userToken = config.apiKey;
    console.log('[getStreamUrl] Using Jellyfin API key from config for audio track detection');

    const serverUrl = config.serverUrl.replace(/\/+$/, '');
    let audioTracks: Array<{ index: number; language: string; name: string; codec: string; mediaSourceId: string }> = [];
    let defaultMediaSourceId: string | null = null;

    try {
      // Try to get user ID first (for user-specific endpoint)
      let userId: string | null = null;
      try {
        const usersResponse = await axios.get(`${serverUrl}/Users`, {
          headers: { 'X-Emby-Token': userToken },
        });
        userId = usersResponse.data?.[0]?.Id || usersResponse.data?.Items?.[0]?.Id;
        console.log('[getStreamUrl] Got user ID:', userId);
      } catch (userError: any) {
        console.warn('[getStreamUrl] Could not get user ID (may require user auth):', userError.message);
        // Continue without user ID - will try direct endpoint
      }
      
      // Try user-specific endpoint first, fallback to direct endpoint
      let itemResponse: any = null;
      if (userId) {
        try {
          itemResponse = await axios.get(`${serverUrl}/Users/${userId}/Items/${id}`, {
            headers: { 'X-Emby-Token': userToken },
          });
          console.log('[getStreamUrl] Got item via user endpoint');
        } catch (userItemError: any) {
          console.warn('[getStreamUrl] User endpoint failed, trying direct endpoint:', userItemError.message);
          // Fallback to direct endpoint
          itemResponse = await axios.get(`${serverUrl}/Items/${id}`, {
            headers: { 'X-Emby-Token': userToken },
          });
          console.log('[getStreamUrl] Got item via direct endpoint');
        }
      } else {
        // No user ID, try direct endpoint
        itemResponse = await axios.get(`${serverUrl}/Items/${id}`, {
          headers: { 'X-Emby-Token': userToken },
        });
        console.log('[getStreamUrl] Got item via direct endpoint (no user ID)');
      }
      
      if (itemResponse?.data?.MediaSources && itemResponse.data.MediaSources.length > 0) {
        // Check all MediaSources for audio tracks
        for (const mediaSource of itemResponse.data.MediaSources) {
          if (!defaultMediaSourceId) {
            defaultMediaSourceId = mediaSource.Id;
          }
          
          // Extract audio tracks from this MediaSource
          if (mediaSource.MediaStreams && Array.isArray(mediaSource.MediaStreams)) {
            const audioStreams = mediaSource.MediaStreams.filter((stream: any) => stream.Type === 'Audio');
            console.log(`[getStreamUrl] Found ${audioStreams.length} audio streams in MediaSource ${mediaSource.Id}`);
            
            audioStreams.forEach((stream: any, index: number) => {
              // Check if this track already exists (avoid duplicates)
              const existingTrack = audioTracks.find(
                (track) => track.language === (stream.Language || stream.LanguageTag || 'Unknown') && 
                           track.codec === (stream.Codec || 'Unknown')
              );
              
              if (!existingTrack) {
                audioTracks.push({
                  index: stream.Index !== undefined ? stream.Index : audioTracks.length,
                  language: stream.Language || stream.LanguageTag || 'Unknown',
                  name: stream.DisplayTitle || stream.Title || `${stream.Language || stream.LanguageTag || 'Unknown'} (${stream.Codec || 'Unknown'})`,
                  codec: stream.Codec || 'Unknown',
                  mediaSourceId: mediaSource.Id,
                });
              }
            });
          }
        }

        console.log(`[getStreamUrl] Total audio tracks found: ${audioTracks.length}`);
        
        // If no audio tracks found but we have MediaSources, don't add a default track
        // This way the UI won't show the selector if there's only one track
        if (audioTracks.length === 0) {
          console.log('[getStreamUrl] No audio tracks found in MediaSources');
        }
      } else {
        console.log('[getStreamUrl] No MediaSources found in item response');
        if (itemResponse?.data) {
          console.log('[getStreamUrl] Item data keys:', Object.keys(itemResponse.data));
        }
      }
    } catch (error: any) {
      console.error('[getStreamUrl] Failed to get audio tracks:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
      });
      // Continue without audio tracks - stream will still work
      // Return empty array so frontend knows we tried but found none
      audioTracks = [];
    }

    // Return relative proxied stream URL (no protocol/host for proxy/CDN compatibility)
    // This avoids CORS issues and keeps API keys secure
    const proxiedUrl = `/api/media/stream/${id}/master.m3u8`;
    
    res.json({
      streamUrl: proxiedUrl,
      type: 'hls',
      audioTracks: audioTracks,
      defaultMediaSourceId: defaultMediaSourceId,
    });
  } catch (error) {
    console.error('Get stream URL error:', error);
    res.status(500).json({ message: 'Failed to get stream URL' });
  }
};

// Proxy HLS stream requests to Jellyfin
export const proxyStream = async (req: Request, res: Response) => {
  try {
    // Extract id and filePath from the URL path
    // The regex route /^\/stream\/([^\/]+)(?:\/(.+))?$/ captures:
    // - Group 1: the id
    // - Group 2: the file path (optional)
    // Note: When mounted at /api/media, req.path is relative to the mount point
    // So /api/media/stream/id/master.m3u8 becomes /stream/id/master.m3u8 in req.path
    // But req.url contains the full path, so we can use either
    
    // Extract id and filePath from req.path
    // When mounted at /api/media, req.path is relative to the mount point
    // So /api/media/stream/id/master.m3u8 becomes /stream/id/master.m3u8 in req.path
    const streamPathMatch = req.path.match(/^\/stream\/(.+)$/);
    
    if (!streamPathMatch) {
      console.error('[proxyStream] ❌ Path match failed:', {
        path: req.path,
        url: req.url,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        method: req.method,
        headers: req.headers,
      });
      return res.status(400).json({ 
        message: 'Invalid stream path', 
        path: req.path,
        url: req.url,
        originalUrl: req.originalUrl,
        expectedPattern: '/^\\/stream\\/(.+)$/',
      });
    }
    
    // streamPathMatch[1] contains everything after /stream/
    const fullPath = streamPathMatch[1];
    
    // Split the path to get id and filePath
    const pathParts = fullPath.split('/');
    const id = pathParts[0];
    // For master.m3u8, filePath will be empty or 'master.m3u8'
    // If the path is just the id, filePath will be empty (master playlist)
    // If the path is id/master.m3u8, filePath will be 'master.m3u8' (also master playlist)
    // If the path is id/hls1/main/0.ts, filePath will be 'hls1/main/0.ts' (segment)
    const filePath = pathParts.slice(1).join('/') || '';
    
    if (!id) {
      console.error('[proxyStream] No id found in path:', { fullPath, pathParts });
      return res.status(400).json({ 
        message: 'Invalid stream path - no id found', 
        path: req.path,
        fullPath,
        pathParts,
      });
    }
    
    // Normalize filePath: if it's 'master.m3u8', treat it as empty (master playlist request)
    const normalizedFilePath = (filePath === 'master.m3u8' || filePath === '') ? '' : filePath;
    
    console.log('[proxyStream] Parsed:', { 
      id, 
      filePath, 
      fullPath, 
      path: req.path, 
      url: req.url,
      originalUrl: req.originalUrl,
      query: req.query,
      audioTrack: req.query.audioTrack,
      mediaSourceId: req.query.mediaSourceId,
      isMasterPlaylist: !filePath || filePath === 'master.m3u8',
    });
    
    if (!jellyfinService.isInitialized()) {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured',
          error: 'Jellyfin client not initialized'
        });
      }
    }

    // Get API key from Jellyfin config
    const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
    const config = await loadJellyfinConfig();
    if (!config) {
      return res.status(503).json({ message: 'Jellyfin not configured' });
    }

    // Authenticate with Jellyfin using username/password for streaming
    // Cache the user token to avoid authenticating on every request
    const jellyfinUsername = 'public';
    const jellyfinPassword = 'public';
    const axios = require('axios');
    const NodeCache = require('node-cache');
    
    // Use a module-level cache for user tokens (cache for 1 hour)
    if (!(global as any).jellyfinTokenCache) {
      (global as any).jellyfinTokenCache = new NodeCache({ stdTTL: 3600 });
    }
    const tokenCache = (global as any).jellyfinTokenCache;
    const cacheKey = `jellyfin_user_token_${jellyfinUsername}`;
    let userToken: string = tokenCache.get(cacheKey) || config.apiKey;
    
    // Normalize serverUrl - remove trailing slash to avoid double slashes
    const serverUrl = config.serverUrl.replace(/\/+$/, '');
    
    // If no cached token, authenticate with Jellyfin
    if (!tokenCache.get(cacheKey)) {
      try {
        console.log('[proxyStream] Authenticating with Jellyfin user:', jellyfinUsername);
        const authResponse = await axios.post(`${serverUrl}/Users/authenticatebyname`, {
          Username: jellyfinUsername,
          Pw: jellyfinPassword,
        }, {
          headers: {
            'X-Emby-Client': 'iFilm',
            'X-Emby-Device-Name': 'Web Browser',
            'X-Emby-Device-Id': 'ifilm-web',
            'X-Emby-Client-Version': '1.0.0',
          },
        });
        
        if (authResponse.data && authResponse.data.AccessToken) {
          userToken = authResponse.data.AccessToken;
          tokenCache.set(cacheKey, userToken);
          console.log('[proxyStream] Successfully authenticated with Jellyfin user:', jellyfinUsername);
        }
      } catch (authError: any) {
        console.warn('[proxyStream] Failed to authenticate with Jellyfin user, using API key:', authError.message);
        // Use API key as fallback
        userToken = config.apiKey;
      }
    } else {
      console.log('[proxyStream] Using cached Jellyfin user token');
    }

    // Get media source ID from item details (required for HLS streaming in newer Jellyfin versions)
    // Check if audio track is specified in query params
    // Note: For regex routes, req.query might not be populated, so parse from req.url
    let audioTrackIndex: number | null = null;
    let requestedMediaSourceId: string | undefined = undefined;
    
    // Try req.query first (works for normal routes)
    if (req.query.audioTrack) {
      audioTrackIndex = parseInt(req.query.audioTrack as string);
    }
    if (req.query.mediaSourceId) {
      requestedMediaSourceId = req.query.mediaSourceId as string;
    }
    
    // If not found in req.query, parse from req.url (for regex routes)
    // req.url includes the full path with query string
    if (audioTrackIndex === null || !requestedMediaSourceId) {
      // Try req.url first (includes query string)
      const urlParts = req.url.split('?');
      if (urlParts.length > 1) {
        const queryParams = new URLSearchParams(urlParts[1]);
        if (audioTrackIndex === null && queryParams.has('audioTrack')) {
          const audioTrackValue = queryParams.get('audioTrack');
          if (audioTrackValue) {
            audioTrackIndex = parseInt(audioTrackValue);
            console.log('[proxyStream] Parsed audioTrack from req.url:', audioTrackIndex);
          }
        }
        if (!requestedMediaSourceId && queryParams.has('mediaSourceId')) {
          requestedMediaSourceId = queryParams.get('mediaSourceId')!;
          console.log('[proxyStream] Parsed mediaSourceId from req.url:', requestedMediaSourceId);
        }
      }
      
      // Also try req.originalUrl as fallback
      if ((audioTrackIndex === null || !requestedMediaSourceId) && req.originalUrl !== req.url) {
        const originalUrlParts = req.originalUrl.split('?');
        if (originalUrlParts.length > 1) {
          const queryParams = new URLSearchParams(originalUrlParts[1]);
          if (audioTrackIndex === null && queryParams.has('audioTrack')) {
            const audioTrackValue = queryParams.get('audioTrack');
            if (audioTrackValue) {
              audioTrackIndex = parseInt(audioTrackValue);
              console.log('[proxyStream] Parsed audioTrack from req.originalUrl:', audioTrackIndex);
            }
          }
          if (!requestedMediaSourceId && queryParams.has('mediaSourceId')) {
            requestedMediaSourceId = queryParams.get('mediaSourceId')!;
            console.log('[proxyStream] Parsed mediaSourceId from req.originalUrl:', requestedMediaSourceId);
          }
        }
      }
    }
    
    console.log('[proxyStream] Audio track query params:', {
      fromReqQuery: { audioTrack: req.query.audioTrack, mediaSourceId: req.query.mediaSourceId },
      parsed: { audioTrackIndex, requestedMediaSourceId },
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
      fullUrl: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
      isMasterPlaylist: !filePath || filePath === 'master.m3u8',
    });
    
    // Special handling for master.m3u8 requests - parse query params from originalUrl
    if ((!filePath || filePath === 'master.m3u8') && audioTrackIndex === null) {
      console.log('[proxyStream] 🔍 Master playlist request detected, parsing query params from originalUrl');
      const originalUrlMatch = req.originalUrl.match(/\?(.+)$/);
      if (originalUrlMatch) {
        const queryString = originalUrlMatch[1];
        const queryParams = new URLSearchParams(queryString);
        if (queryParams.has('audioTrack')) {
          audioTrackIndex = parseInt(queryParams.get('audioTrack')!);
          console.log('[proxyStream] ✅ Parsed audioTrack from originalUrl:', audioTrackIndex);
        }
        if (queryParams.has('mediaSourceId')) {
          requestedMediaSourceId = queryParams.get('mediaSourceId')!;
          console.log('[proxyStream] ✅ Parsed mediaSourceId from originalUrl:', requestedMediaSourceId);
        }
      }
    }
    
    let mediaSourceId: string | null = null;
    let audioStreamIndex: number | null = null;
    let hlsPlaylistId: string | null = null; // Store playlistId when using /hls endpoint
    
    // Extract hlsPlaylistId and audioTrack from query params if present (from rewritten playlist URLs)
    // Check both req.query and manually parse from req.url/req.originalUrl
    if (req.query.hlsPlaylistId) {
      hlsPlaylistId = req.query.hlsPlaylistId as string;
      console.log('[proxyStream] Extracted hlsPlaylistId from req.query:', hlsPlaylistId);
    } else {
      // Try parsing from req.url (for regex routes)
      const urlParts = req.url.split('?');
      if (urlParts.length > 1) {
        const queryParams = new URLSearchParams(urlParts[1]);
        if (queryParams.has('hlsPlaylistId')) {
          hlsPlaylistId = queryParams.get('hlsPlaylistId')!;
          console.log('[proxyStream] Extracted hlsPlaylistId from req.url:', hlsPlaylistId);
        }
        // Also extract audioTrack from req.url for segment requests
        // IMPORTANT: Always check for audioTrack, even if it was already set, because segments might have it
        if (queryParams.has('audioTrack')) {
          const audioTrackValue = queryParams.get('audioTrack');
          if (audioTrackValue) {
            audioTrackIndex = parseInt(audioTrackValue);
            console.log('[proxyStream] Extracted audioTrack from req.url for segment:', audioTrackIndex);
          }
        }
      }
      // Also try req.originalUrl
      if ((!hlsPlaylistId || !audioTrackIndex) && req.originalUrl !== req.url) {
        const originalUrlParts = req.originalUrl.split('?');
        if (originalUrlParts.length > 1) {
          const queryParams = new URLSearchParams(originalUrlParts[1]);
          if (!hlsPlaylistId && queryParams.has('hlsPlaylistId')) {
            hlsPlaylistId = queryParams.get('hlsPlaylistId')!;
            console.log('[proxyStream] Extracted hlsPlaylistId from req.originalUrl:', hlsPlaylistId);
          }
          // Also extract audioTrack from req.originalUrl for segment requests
          // IMPORTANT: Always check for audioTrack, even if it was already set, because segments might have it
          if (queryParams.has('audioTrack')) {
            const audioTrackValue = queryParams.get('audioTrack');
            if (audioTrackValue) {
              audioTrackIndex = parseInt(audioTrackValue);
              console.log('[proxyStream] Extracted audioTrack from req.originalUrl for segment:', audioTrackIndex);
            }
          }
        }
      }
    }
    
    // Function to get mediaSourceId and find audioStreamIndex from audioTrackIndex
    const getMediaSourceAndAudioStream = async () => {
      // Always try to get mediaSourceId, even if no audio track is requested
      // Jellyfin often requires MediaSourceId for master.m3u8 requests
      try {
        // Use userId endpoint to get item with user context
        const usersResponse = await axios.get(`${serverUrl}/Users`, {
          headers: { 'X-Emby-Token': userToken },
        });
        const userId = usersResponse.data?.[0]?.Id || usersResponse.data?.Items?.[0]?.Id;
        
        if (userId) {
          const itemResponse = await axios.get(`${serverUrl}/Users/${userId}/Items/${id}`, {
            headers: { 'X-Emby-Token': userToken },
          });
          
          if (itemResponse.data && itemResponse.data.MediaSources && itemResponse.data.MediaSources.length > 0) {
            // If mediaSourceId is provided in query, use it; otherwise use first MediaSource
            let selectedMediaSource: any = null;
            if (requestedMediaSourceId) {
              const foundSource = itemResponse.data.MediaSources.find((ms: any) => ms.Id === requestedMediaSourceId);
              if (foundSource) {
                selectedMediaSource = foundSource;
                mediaSourceId = foundSource.Id;
                console.log('[proxyStream] Using requested media source ID:', mediaSourceId);
              } else {
                selectedMediaSource = itemResponse.data.MediaSources[0];
                mediaSourceId = selectedMediaSource.Id;
                console.log('[proxyStream] Requested media source not found, using first:', mediaSourceId);
              }
            } else {
              selectedMediaSource = itemResponse.data.MediaSources[0];
              mediaSourceId = selectedMediaSource.Id;
              console.log('[proxyStream] Got media source ID:', mediaSourceId);
            }
            
            // If audioTrackIndex is specified, find the matching audio stream
            if (audioTrackIndex !== null && selectedMediaSource.MediaStreams) {
              const audioStreams = selectedMediaSource.MediaStreams.filter((stream: any) => stream.Type === 'Audio');
              console.log('[proxyStream] Looking for audio track:', {
                requestedIndex: audioTrackIndex,
                availableAudioStreams: audioStreams.map((s: any) => ({
                  Index: s.Index,
                  Language: s.Language || s.LanguageTag,
                  Codec: s.Codec,
                })),
              });
              
              // Check if the requested index exists in the audio streams
              const matchingStream = audioStreams.find((stream: any) => stream.Index === audioTrackIndex);
              if (matchingStream) {
                // Use the Index directly (frontend already passed the correct Jellyfin MediaStream Index)
                audioStreamIndex = audioTrackIndex;
                console.log('[proxyStream] ✅ Audio track found and will be used:', {
                  jellyfinIndex: audioStreamIndex,
                  language: matchingStream.Language || matchingStream.LanguageTag,
                  codec: matchingStream.Codec,
                  name: matchingStream.DisplayTitle || matchingStream.Title,
                });
              } else {
                console.warn('[proxyStream] ❌ AudioStreamIndex not found:', {
                  requested: audioTrackIndex,
                  availableIndices: audioStreams.map((s: any) => s.Index).join(', '),
                  allStreams: audioStreams.map((s: any) => ({ Index: s.Index, Type: s.Type })),
                });
              }
            } else if (audioTrackIndex !== null) {
              console.warn('[proxyStream] Audio track requested but no MediaStreams available:', {
                audioTrackIndex,
                hasMediaSources: !!selectedMediaSource,
                hasMediaStreams: !!selectedMediaSource?.MediaStreams,
              });
            }
          } else {
            console.warn('[proxyStream] No MediaSources found in item response');
          }
        } else {
          console.warn('[proxyStream] No user ID found, trying direct endpoint');
          // Fallback: try direct endpoint
          try {
            const itemResponse = await axios.get(`${serverUrl}/Items/${id}`, {
              headers: { 'X-Emby-Token': userToken },
            });
            if (itemResponse.data && itemResponse.data.MediaSources && itemResponse.data.MediaSources.length > 0) {
              mediaSourceId = itemResponse.data.MediaSources[0].Id;
              console.log('[proxyStream] Got media source ID from direct endpoint:', mediaSourceId);
            }
          } catch (directError: any) {
            console.warn('[proxyStream] Direct endpoint also failed:', directError.message);
          }
        }
      } catch (itemError: any) {
        console.warn('[proxyStream] Failed to get media source ID:', itemError.message);
        // Try direct endpoint as fallback
        try {
          const itemResponse = await axios.get(`${serverUrl}/Items/${id}`, {
            headers: { 'X-Emby-Token': userToken },
          });
          if (itemResponse.data && itemResponse.data.MediaSources && itemResponse.data.MediaSources.length > 0) {
            mediaSourceId = itemResponse.data.MediaSources[0].Id;
            console.log('[proxyStream] Got media source ID from direct endpoint (fallback):', mediaSourceId);
          }
        } catch (directError: any) {
          console.warn('[proxyStream] Direct endpoint fallback also failed:', directError.message);
        }
      }
    };
    
    // Always get mediaSourceId (required for Jellyfin master.m3u8 requests)
    await getMediaSourceAndAudioStream();
    
    // If mediaSourceId was provided in query but not found, use it anyway
    if (requestedMediaSourceId && !mediaSourceId) {
      mediaSourceId = requestedMediaSourceId;
      console.log('[proxyStream] Using media source ID from query:', mediaSourceId);
    }

    // Construct the Jellyfin URL with user token
    // If filePath is provided, it's a segment or variant playlist
    // Otherwise, it's the master.m3u8
    let targetUrl: string;
    const urlParams = new URLSearchParams();
    urlParams.append('api_key', userToken);
    if (mediaSourceId) {
      urlParams.append('MediaSourceId', mediaSourceId);
    }
    // Add AudioStreamIndex if specified (Jellyfin uses this to select audio track)
    if (audioStreamIndex !== null) {
      const audioIndex = Number(audioStreamIndex);
      if (!isNaN(audioIndex)) {
        urlParams.append('AudioStreamIndex', audioIndex.toString());
        console.log('[proxyStream] Adding AudioStreamIndex to request:', audioIndex);
      }
    }
    
    if (normalizedFilePath) {
      // For HLS segments/variants: /Videos/{id}/hls/{playlistId}/stream.m3u8 or segment files
      // Extract query parameters from the request (runtimeTicks, actualSegmentLengthTicks, etc.)
      const requestQuery = new URLSearchParams(req.url.split('?')[1] || '');
      const segmentParams = new URLSearchParams();
      segmentParams.append('api_key', userToken);
      
      // Check if this segment is from an HLS playlist (path starts with hls*/)
      const isFromHlsPlaylist = normalizedFilePath.match(/^hls\d+\//);
      
      // For segment files (.ts), include runtimeTicks and actualSegmentLengthTicks if present
      if (normalizedFilePath.endsWith('.ts')) {
        if (requestQuery.has('runtimeTicks')) {
          segmentParams.append('runtimeTicks', requestQuery.get('runtimeTicks')!);
        }
        if (requestQuery.has('actualSegmentLengthTicks')) {
          segmentParams.append('actualSegmentLengthTicks', requestQuery.get('actualSegmentLengthTicks')!);
        }
        if (mediaSourceId && !isFromHlsPlaylist) {
          // Only add MediaSourceId if not from HLS playlist (it's in the playlist path)
          segmentParams.append('MediaSourceId', mediaSourceId);
        }
        // If this segment is from an HLS playlist and we have the playlistId, use the HLS playlist path
        // HLS playlist segments already have correct audio, so don't add AudioStreamIndex
        if (isFromHlsPlaylist && hlsPlaylistId) {
          targetUrl = `${serverUrl}/Videos/${id}/hls/${hlsPlaylistId}/${normalizedFilePath}?${segmentParams.toString()}`;
          console.log('[proxyStream] ✅ Requesting segment from HLS playlist:', {
            playlistId: hlsPlaylistId,
            filePath: normalizedFilePath,
            targetUrl,
            isFromHlsPlaylist,
            hasPlaylistId: !!hlsPlaylistId,
          });
        } else {
          // For non-HLS playlist segments OR if HLS playlist creation failed, ALWAYS add AudioStreamIndex
          // This ensures audio track selection works even if HLS playlist approach doesn't work
          if (audioStreamIndex !== null) {
            const audioIndex = Number(audioStreamIndex);
            if (!isNaN(audioIndex)) {
              segmentParams.append('AudioStreamIndex', audioIndex.toString());
              console.log('[proxyStream] Adding AudioStreamIndex to segment request (fallback):', {
                audioIndex,
                filePath,
                isFromHlsPlaylist,
                hasPlaylistId: !!hlsPlaylistId,
              });
            }
          }
          if (isFromHlsPlaylist && !hlsPlaylistId) {
            console.warn('[proxyStream] ⚠️ Segment is from HLS playlist but no playlistId available, using AudioStreamIndex fallback:', {
              filePath,
              isFromHlsPlaylist,
              hlsPlaylistId,
              audioStreamIndex,
            });
          }
              targetUrl = `${serverUrl}/Videos/${id}/${normalizedFilePath}?${segmentParams.toString()}`;
        }
      } else {
        // For playlist files (.m3u8), include MediaSourceId and AudioStreamIndex if available
        // If from HLS playlist, use the HLS playlist path
        if (isFromHlsPlaylist && hlsPlaylistId) {
          targetUrl = `${serverUrl}/Videos/${id}/hls/${hlsPlaylistId}/${normalizedFilePath}?${urlParams.toString()}`;
        } else {
          targetUrl = `${serverUrl}/Videos/${id}/${normalizedFilePath}?${urlParams.toString()}`;
        }
      }
    } else {
      // Master playlist
      // Jellyfin's master.m3u8 doesn't expose multiple audio tracks in HLS format
      // The AudioStreamIndex parameter on master.m3u8 doesn't work - we need to use it on the variant playlist
      // So we request master.m3u8 normally, then rewrite the variant playlist URL to include AudioStreamIndex
      // The segments will then use AudioStreamIndex from the variant playlist
      if (audioStreamIndex !== null && typeof audioStreamIndex === 'number') {
        // Add AudioStreamIndex to urlParams for master.m3u8
        // Even though it doesn't directly affect master.m3u8, it will be preserved in rewritten URLs
        urlParams.append('AudioStreamIndex', audioStreamIndex.toString());
        console.log('[proxyStream] Requesting master playlist with AudioStreamIndex (will be applied to variant):', audioStreamIndex);
      }
      targetUrl = `${serverUrl}/Videos/${id}/master.m3u8?${urlParams.toString()}`;
      console.log('[proxyStream] Requesting master playlist:', targetUrl);
    }

    console.log('[proxyStream] Proxying request to Jellyfin:', targetUrl);
    console.log('[proxyStream] Request details:', {
      id,
      filePath: normalizedFilePath,
      originalFilePath: filePath,
      audioTrackIndex: audioTrackIndex !== null ? audioTrackIndex : 'none',
      audioStreamIndex: audioStreamIndex !== null ? audioStreamIndex : 'none',
      mediaSourceId: mediaSourceId || 'none',
      queryParams: req.query,
      path: req.path,
      url: req.url,
    });

    // Proxy the request to Jellyfin with user token
    const response = await axios.get(targetUrl, {
      responseType: normalizedFilePath?.endsWith('.m3u8') ? 'text' : 'stream',
      headers: {
        'X-Emby-Token': userToken,
      },
      timeout: 30000, // 30 second timeout for streaming
    });

    // Set appropriate headers
    const contentType = response.headers['content-type'] || 
                       (normalizedFilePath?.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' :
                        normalizedFilePath?.endsWith('.ts') ? 'video/mp2t' :
                        'application/octet-stream');
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    // Remove Vary header to allow NGINX caching (CORS adds Vary: Origin by default)
    res.removeHeader('Vary');
    // Don't set Cache-Control header - let NGINX handle caching
    // NGINX will add its own Cache-Control headers based on proxy_cache_valid settings

        // For M3U8 playlists, rewrite URLs to point to our proxy (RELATIVE URLs ONLY)
        if (normalizedFilePath?.endsWith('.m3u8') || (!normalizedFilePath && response.data)) {
      // Use relative path only (no protocol/host for proxy/CDN compatibility)
      const proxyBase = `/api/media/stream/${id}`;
      
      let playlistContent: string;
      if (typeof response.data === 'string') {
        playlistContent = response.data;
      } else {
        // If it's a stream, we need to collect it first
        const chunks: Buffer[] = [];
        for await (const chunk of response.data) {
          chunks.push(chunk);
        }
        playlistContent = Buffer.concat(chunks).toString('utf-8');
      }
      
      // Debug: Log playlist content when audio track is specified
      if (audioStreamIndex !== null || hlsPlaylistId) {
        console.log('[proxyStream] Playlist content (first 1000 chars):', {
          audioStreamIndex,
          hlsPlaylistId,
          content: playlistContent.substring(0, 1000),
        });
        console.log('[proxyStream] Playlist length:', playlistContent.length);
        // Check if playlist contains audio track references
        const hasAudioGroup = playlistContent.includes('GROUP-ID="audio"') || playlistContent.includes('GROUP-ID="aud');
        const hasAudioStream = playlistContent.includes('AUDIO=');
        console.log('[proxyStream] Playlist analysis:', {
          hasAudioGroup,
          hasAudioStream,
          lines: playlistContent.split('\n').length,
          usingHlsPlaylist: !!hlsPlaylistId,
        });
      }
      
      // ALWAYS include audioTrack and mediaSourceId in rewritten URLs as fallback
      // Even if using HLS playlist, include these params so segments can use AudioStreamIndex if needed
      const rewrittenPlaylist = playlistContent
        .split('\n')
        .map((line: string) => {
          // Skip comments and empty lines
          if (line.trim().startsWith('#') || !line.trim()) {
            return line;
          }
          
          // This is a URL line - rewrite it to relative path
          // IMPORTANT: Always preserve audioTrack, mediaSourceId, and hlsPlaylistId query params
          let url = line.trim();
          const urlParts = url.split('?');
          const urlPath = urlParts[0];
          const existingQueryString = urlParts[1] || '';
          
          // Build query params: merge existing params with audioTrack/mediaSourceId/hlsPlaylistId
          // ALWAYS include these params so segments can use them as fallback
          const queryParams = new URLSearchParams(existingQueryString);
          // IMPORTANT: Use audioTrackIndex (from query params) in rewritten URLs, not audioStreamIndex
          // This ensures segments can extract audioTrack from their URLs
          // audioTrackIndex is what the frontend passes, so we preserve it
          if (audioTrackIndex !== null) {
            const audioIndex = Number(audioTrackIndex);
            if (!isNaN(audioIndex)) {
              queryParams.set('audioTrack', audioIndex.toString());
              console.log('[proxyStream] Adding audioTrack to rewritten URL:', audioIndex);
            }
          } else if (audioStreamIndex !== null) {
            // Fallback to audioStreamIndex if audioTrackIndex not available
            const audioIndex = Number(audioStreamIndex);
            if (!isNaN(audioIndex)) {
              queryParams.set('audioTrack', audioIndex.toString());
              console.log('[proxyStream] Adding audioStreamIndex as audioTrack to rewritten URL:', audioIndex);
            }
          }
          if (mediaSourceId) {
            queryParams.set('mediaSourceId', mediaSourceId);
          }
          // IMPORTANT: Include hlsPlaylistId in rewritten URLs so segment requests can use it
          if (hlsPlaylistId) {
            queryParams.set('hlsPlaylistId', hlsPlaylistId);
          }
          const finalQueryString = queryParams.toString();
          
          // If it's already a relative path to our proxy, add query params if needed
          if (url.includes('/api/media/stream/') && !url.startsWith('http')) {
            if (finalQueryString && !existingQueryString.includes('audioTrack')) {
              return `${url}${existingQueryString ? '&' : '?'}${finalQueryString}`;
            }
            return line;
          }
          
          // If it's a full URL to our proxy, convert to relative
          if (url.includes('/api/media/stream/') && url.startsWith('http')) {
            const matchResult = url.match(/\/api\/media\/stream\/[^\/]+(?:\/(.+))?/);
            if (matchResult) {
              const relativePath = matchResult[0];
              return finalQueryString ? `${relativePath}?${finalQueryString}` : relativePath;
            }
          }
          
          // If it's a full URL to Jellyfin, extract the path and make relative
          if (urlPath.startsWith('http')) {
            const matchResult = urlPath.match(/\/Videos\/[^\/]+\/(.+)$/);
            if (matchResult) {
              return finalQueryString ? `${proxyBase}/${matchResult[1]}?${finalQueryString}` : `${proxyBase}/${matchResult[1]}`;
            }
          }
          
          // If it starts with /Videos/, extract the path and make relative
          if (urlPath.startsWith('/Videos/')) {
            const matchResult = urlPath.match(/\/Videos\/[^\/]+\/(.+)$/);
            if (matchResult) {
              return finalQueryString ? `${proxyBase}/${matchResult[1]}?${finalQueryString}` : `${proxyBase}/${matchResult[1]}`;
            }
          }
          
          // If it's a relative path (like hls1/main/0.ts or main.m3u8), prepend our proxy base
          // When using HLS playlist, segments are relative to the playlist, so we need to preserve that structure
          if (!urlPath.startsWith('http') && !urlPath.startsWith('/')) {
            // If we're using an HLS playlist, the segments should be requested from the HLS playlist path
            // But since we're proxying, we can just use the relative path - our proxy will handle it
            return finalQueryString ? `${proxyBase}/${urlPath}?${finalQueryString}` : `${proxyBase}/${urlPath}`;
          }
          
          // If it's an absolute path but not /Videos/, try to use it as-is
          if (urlPath.startsWith('/') && !urlPath.startsWith('/Videos/')) {
            // Extract just the filename/path
            const pathParts = urlPath.split('/').filter(p => p);
            if (pathParts.length > 0) {
              return finalQueryString ? `${proxyBase}/${pathParts.join('/')}?${finalQueryString}` : `${proxyBase}/${pathParts.join('/')}`;
            }
          }
          
          // Default: return the line as-is
          return line;
        })
        .join('\n');

      res.send(rewrittenPlaylist);
    } else {
      // For non-playlist files (segments), pipe directly
      response.data.pipe(res);
    }
  } catch (error: any) {
    console.error('[proxyStream] ❌ Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      path: req.path,
      originalUrl: req.originalUrl,
      stack: error.stack,
      responseData: error.response?.data,
    });
    const statusCode = error.response?.status || 500;
    res.status(statusCode).json({ 
      message: 'Failed to proxy stream',
      error: error.message,
      details: error.response?.data || 'No additional details',
      path: req.path,
    });
  }
};

export const getSeries = async (req: Request, res: Response) => {
  // Check if Jellyfin is initialized
  if (!jellyfinService.isInitialized()) {
    try {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured. Please configure in Admin Panel.',
          error: 'Jellyfin client not initialized'
        });
      }
    } catch (configError) {
      console.error('Error loading Jellyfin config:', configError);
      return res.status(503).json({ 
        message: 'Jellyfin server not configured. Please configure in Admin Panel.',
        error: 'Jellyfin client not initialized'
      });
    }
  }

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const startIndex = (page - 1) * limit;
    const bypassCache = req.query.bypassCache === 'true';

    // Clear cache if bypass is requested
    if (bypassCache) {
      const { clearJellyfinCache } = await import('../services/jellyfin.service');
      clearJellyfinCache();
      console.log('[getSeries] Cache cleared due to bypassCache parameter');
    }

    // Get visible libraries to filter series
    const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
    const { getVisibleLibraries, getLibraries } = await import('../services/jellyfin-libraries.service');
    const config = await loadJellyfinConfig();
    
    let visibleLibraryIds: string[] = [];
    let allLibraryIds: string[] = [];
    if (config) {
      const allLibraries = await getLibraries(config.id);
      const visibleLibraries = await getVisibleLibraries(config.id);
      
      // Filter for series libraries only
      const seriesLibraries = visibleLibraries.filter(lib => 
        lib.collectionType === 'tvshows' || lib.collectionType === 'mixed'
      );
      visibleLibraryIds = seriesLibraries.map(lib => lib.libraryId);
      allLibraryIds = allLibraries.map(lib => lib.libraryId);
      
      console.log('[getSeries] Visible series libraries:', visibleLibraryIds.length, visibleLibraryIds);
      
      // If no visible libraries, return empty result
      if (visibleLibraryIds.length === 0) {
        return res.json({
          items: [],
          total: 0,
          page,
          pages: 0,
        });
      }
    }

    // Fetch series from Jellyfin
    const result = await jellyfinService.getItems({
      includeItemTypes: 'Series',
      startIndex: visibleLibraryIds.length === 1 ? startIndex : 0,
      limit: visibleLibraryIds.length === 1 ? limit : limit * 10,
      sortBy: 'SortName',
      ...(visibleLibraryIds.length === 1 ? { parentId: visibleLibraryIds[0] } : {}),
    });

    // Filter items by visible libraries
    let filteredItems = result.Items.filter((item) => item.Id && item.Name);
    
    // If we have multiple visible libraries, query each separately
    if (visibleLibraryIds.length > 1 || (visibleLibraryIds.length > 0 && allLibraryIds.length > visibleLibraryIds.length)) {
      const visibleLibraries = await getVisibleLibraries(config!.id);
      const seriesLibraries = visibleLibraries.filter(lib => 
        lib.collectionType === 'tvshows' || lib.collectionType === 'mixed'
      );
      
      const allItems: JellyfinItem[] = [];
      const allLibraryItemIds: string[] = [];
      
      // Get actual library folder IDs from Jellyfin
      const jellyfinLibraries = await jellyfinService.getLibraries();
      for (const library of seriesLibraries) {
        const jellyfinLib = jellyfinLibraries.find((jl: any) => 
          (jl.Id === library.libraryId || jl.ItemId === library.libraryId)
        );
        
        const libraryItemId = jellyfinLib?.ItemId || jellyfinLib?.Id || library.libraryId;
        allLibraryItemIds.push(libraryItemId);
        
        try {
          console.log('[getSeries] Fetching items from library:', library.libraryName, 'ItemId:', libraryItemId);
          const libraryItems = await jellyfinService.getItems({
            includeItemTypes: 'Series',
            parentId: libraryItemId,
            limit: 10000,
            sortBy: 'SortName',
          });
          
          if (libraryItems.Items && libraryItems.Items.length > 0) {
            console.log('[getSeries] Found', libraryItems.Items.length, 'items in library', library.libraryName);
            allItems.push(...libraryItems.Items);
          }
        } catch (libError: any) {
          console.warn('[getSeries] Could not fetch items from library', library.libraryId, ':', libError.message);
        }
      }
      
      if (allItems.length > 0) {
        const uniqueItems = allItems.filter((item, index, self) => 
          index === self.findIndex((t) => t.Id === item.Id)
        );
        
        const sortedItems = uniqueItems.sort((a, b) => {
          const nameA = a.Name || '';
          const nameB = b.Name || '';
          return nameA.localeCompare(nameB);
        });
        
        filteredItems = sortedItems.slice(startIndex, startIndex + limit);
      } else {
        // Fallback: filter by CollectionFolders
        filteredItems = filteredItems.filter((item: any) => {
          if (item.CollectionFolders && Array.isArray(item.CollectionFolders)) {
            return item.CollectionFolders.some((folderId: string) => allLibraryItemIds.includes(folderId));
          }
          return false;
        });
      }
    }
    
    const series = filteredItems.map((item) => ({
      id: item.Id,
      title: item.Name,
      type: 'series',
      overview: item.Overview || '',
      posterUrl: jellyfinService.getImageUrl(item.Id, 'Primary'),
      backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length > 0
        ? jellyfinService.getImageUrl(item.Id, 'Backdrop')
        : jellyfinService.getImageUrl(item.Id, 'Primary'),
      year: item.ProductionYear || 0,
      rating: item.CommunityRating || 0,
      duration: 0,
      genres: item.Genres || [],
    }));

    // Calculate total based on filtered items
    const totalItems = visibleLibraryIds.length === 1 
      ? result.TotalRecordCount 
      : filteredItems.length;
    
    res.json({
      items: series,
      total: totalItems,
      page,
      pages: Math.ceil(totalItems / limit),
    });
  } catch (error) {
    console.error('Get series error:', error);
    res.status(500).json({ message: 'Failed to fetch series' });
  }
};

export const getSeriesDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const item = await jellyfinService.getItemDetails(id);
    const seasons = await jellyfinService.getSeasons(id);

    const seriesData = {
      id: item.Id,
      title: item.Name,
      type: 'series',
      overview: item.Overview || '',
      posterUrl: jellyfinService.getImageUrl(item.Id, 'Primary'),
      backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length > 0
        ? jellyfinService.getImageUrl(item.Id, 'Backdrop')
        : jellyfinService.getImageUrl(item.Id, 'Primary'),
      year: item.ProductionYear || 0,
      rating: item.CommunityRating || 0,
      genres: item.Genres || [],
      seasons: seasons.map((season) => ({
        id: season.Id,
        name: season.Name,
        seasonNumber: season.IndexNumber || 0,
      })),
    };

    res.json(seriesData);
  } catch (error) {
    console.error('Get series details error:', error);
    res.status(500).json({ message: 'Failed to fetch series details' });
  }
};

export const getEpisodes = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const seasonId = req.query.seasonId as string;

    if (!jellyfinService.isInitialized()) {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured',
          error: 'Jellyfin client not initialized'
        });
      }
    }

    console.log('[getEpisodes] Fetching episodes for series:', id, 'season:', seasonId);
    
    // Get episodes for the series/season
    const episodes = await jellyfinService.getEpisodes(id, seasonId);
    
    console.log('[getEpisodes] Found', episodes.length, 'episodes');

    const episodesData = episodes.map((episode) => ({
      id: episode.Id,
      name: episode.Name,
      overview: episode.Overview || '',
      episodeNumber: episode.IndexNumber || 0,
      seasonNumber: episode.ParentIndexNumber || 0,
      duration: episode.RunTimeTicks ? Math.floor(episode.RunTimeTicks / 10000000 / 60) : 0,
      thumbnailUrl: jellyfinService.getImageUrl(episode.Id, 'Primary'),
      posterUrl: jellyfinService.getImageUrl(episode.Id, 'Primary'),
    }));

    res.json({ episodes: episodesData });
  } catch (error: any) {
    console.error('Get episodes error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
    res.status(500).json({ 
      message: 'Failed to fetch episodes',
      error: error.message 
    });
  }
};

export const getRelatedMovies = async (req: Request, res: Response) => {
  // Check if Jellyfin is initialized
  if (!jellyfinService.isInitialized()) {
    try {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured. Please configure in Admin Panel.',
          error: 'Jellyfin client not initialized'
        });
      }
    } catch (configError) {
      console.error('Error loading Jellyfin config:', configError);
      return res.status(503).json({ 
        message: 'Jellyfin server not configured. Please configure in Admin Panel.',
        error: 'Jellyfin client not initialized'
      });
    }
  }

  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 12;

    // Get the current movie details to find related movies by genres
    const currentMovie = await jellyfinService.getItemDetails(id);
    
    if (!currentMovie || !currentMovie.Genres || currentMovie.Genres.length === 0) {
      // If no genres, just return some random movies
      const result = await jellyfinService.getItems({
        includeItemTypes: 'Movie',
        startIndex: 0,
        limit,
        sortBy: 'Random',
      });

      const movies = result.Items.filter(item => item.Id !== id).slice(0, limit).map((item) => ({
        id: item.Id,
        title: item.Name,
        type: 'movie',
        overview: item.Overview || '',
        posterUrl: jellyfinService.getImageUrl(item.Id, 'Primary'),
        backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length > 0
          ? jellyfinService.getImageUrl(item.Id, 'Backdrop')
          : jellyfinService.getImageUrl(item.Id, 'Primary'),
        year: item.ProductionYear || 0,
        rating: item.CommunityRating || 0,
        duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000 / 60) : 0,
        genres: item.Genres || [],
      }));

      return res.json({ items: movies });
    }

    // Get movies with similar genres - use first genre for filtering
    const genres = currentMovie.Genres;
    // For now, just get random movies and filter by genre match
    const result = await jellyfinService.getItems({
      includeItemTypes: 'Movie',
      startIndex: 0,
      limit: limit * 5, // Get more to filter out the current movie and find genre matches
      sortBy: 'Random',
    });

    // Filter out the current movie and prioritize movies with matching genres
    const moviesWithGenres = result.Items
      .filter((item: JellyfinItem) => item.Id !== id && item.Genres && item.Genres.some((g: string) => genres.includes(g)))
      .slice(0, limit);
    
    // If we don't have enough genre matches, add random movies
    const remaining = limit - moviesWithGenres.length;
    const randomMovies = result.Items
      .filter((item: JellyfinItem) => item.Id !== id && !moviesWithGenres.find((m: JellyfinItem) => m.Id === item.Id))
      .slice(0, remaining);
    
    const allMovies = [...moviesWithGenres, ...randomMovies];
    
    // Map to response format
    const movies = allMovies.map((item: JellyfinItem) => ({
        id: item.Id,
        title: item.Name,
        type: 'movie',
        overview: item.Overview || '',
        posterUrl: jellyfinService.getImageUrl(item.Id, 'Primary'),
        backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length > 0
          ? jellyfinService.getImageUrl(item.Id, 'Backdrop')
          : jellyfinService.getImageUrl(item.Id, 'Primary'),
        year: item.ProductionYear || 0,
        rating: item.CommunityRating || 0,
        duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000 / 60) : 0,
        genres: item.Genres || [],
      }));

    // If we don't have enough related movies, fill with random movies
    if (movies.length < limit) {
      const randomResult = await jellyfinService.getItems({
        includeItemTypes: 'Movie',
        startIndex: 0,
        limit: limit - movies.length,
        sortBy: 'Random',
      });

      const randomMovies = randomResult.Items
        .filter((item: JellyfinItem) => item.Id !== id && !movies.find((m: any) => m.id === item.Id))
        .slice(0, limit - movies.length)
        .map((item: JellyfinItem) => ({
          id: item.Id,
          title: item.Name,
          type: 'movie',
          overview: item.Overview || '',
          posterUrl: jellyfinService.getImageUrl(item.Id, 'Primary'),
          backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length > 0
            ? jellyfinService.getImageUrl(item.Id, 'Backdrop')
            : jellyfinService.getImageUrl(item.Id, 'Primary'),
          year: item.ProductionYear || 0,
          rating: item.CommunityRating || 0,
          duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000 / 60) : 0,
          genres: item.Genres || [],
        }));

      movies.push(...randomMovies);
    }

    res.json({ items: movies });
  } catch (error: any) {
    console.error('Get related movies error:', error);
    res.status(500).json({ 
      message: 'Failed to fetch related movies',
      error: error.message 
    });
  }
};

// Image proxy - Proxies image requests to Jellyfin
export const proxyImage = async (req: Request, res: Response) => {
  try {
    const { itemId, imageType } = req.params;

    if (!jellyfinService.isInitialized()) {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured',
          error: 'Jellyfin client not initialized'
        });
      }
    }

    const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
    const config = await loadJellyfinConfig();
    if (!config) {
      return res.status(503).json({ message: 'Jellyfin not configured' });
    }

    // Normalize serverUrl - remove trailing slash to avoid double slashes
    const serverUrl = config.serverUrl.replace(/\/+$/, '');
    
    // Construct Jellyfin image URL
    const jellyfinImageUrl = `${serverUrl}/Items/${itemId}/Images/${imageType}?api_key=${config.apiKey}`;

    // Proxy the image request to Jellyfin
    const axios = require('axios');
    const response = await axios.get(jellyfinImageUrl, {
      responseType: 'stream',
      headers: {
        'X-Emby-Token': config.apiKey,
      },
      timeout: 10000,
    });

    // Set appropriate headers
    const contentType = response.headers['content-type'] || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Remove CSP header for images to avoid conflicts with frontend CSP
    res.removeHeader('Content-Security-Policy');

    // Pipe the image stream to response
    response.data.pipe(res);
  } catch (error: any) {
    console.error('[proxyImage] Error:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
    });
    res.status(error.response?.status || 500).json({ 
      message: 'Failed to proxy image',
      error: error.message 
    });
  }
};

export const searchMedia = async (req: Request, res: Response) => {
  // Check if Jellyfin is initialized
  if (!jellyfinService.isInitialized()) {
    try {
      const { loadJellyfinConfig } = await import('../services/jellyfin-config.service');
      const config = await loadJellyfinConfig();
      if (config) {
        jellyfinService.initialize(config.serverUrl, config.apiKey);
      } else {
        return res.status(503).json({ 
          message: 'Jellyfin server not configured. Please configure in Admin Panel.',
          error: 'Jellyfin client not initialized'
        });
      }
    } catch (configError) {
      console.error('Error loading Jellyfin config:', configError);
      return res.status(503).json({ 
        message: 'Jellyfin server not configured. Please configure in Admin Panel.',
        error: 'Jellyfin client not initialized'
      });
    }
  }

  try {
    const searchQuery = req.query.q as string;
    const userId = (req as any).user?.userId || null;

    if (!searchQuery) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const results = await jellyfinService.search(searchQuery);

    const media = results.map((item: JellyfinItem) => ({
      id: item.Id,
      title: item.Name,
      type: item.Type === 'Movie' ? 'movie' : 'series',
      overview: item.Overview || '',
      posterUrl: jellyfinService.getImageUrl(item.Id, 'Primary'),
      backdropUrl: item.BackdropImageTags && item.BackdropImageTags.length > 0
        ? jellyfinService.getImageUrl(item.Id, 'Backdrop')
        : jellyfinService.getImageUrl(item.Id, 'Primary'),
      year: item.ProductionYear || 0,
      rating: item.CommunityRating || 0,
      duration: item.RunTimeTicks ? Math.floor(item.RunTimeTicks / 10000000 / 60) : 0,
      genres: item.Genres || [],
    }));

    // Log search history (non-blocking)
    if (userId) {
      addSearchHistory(userId, searchQuery, media.length).catch((err: any) => 
        console.error('Failed to log search history:', err)
      );
    }

    res.json({ items: media });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
};