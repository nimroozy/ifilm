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

    // Return relative proxied stream URL (no protocol/host for proxy/CDN compatibility)
    // This avoids CORS issues and keeps API keys secure
    const proxiedUrl = `/api/media/stream/${id}/master.m3u8`;
    
    res.json({
      streamUrl: proxiedUrl,
      type: 'hls',
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
    // Note: req.path includes the full path including route prefix (/api/media/stream/...)
    // So we need to match from /stream/ onwards
    const pathMatch = req.path.match(/\/stream\/([^\/]+)(?:\/(.+))?$/);
    if (!pathMatch) {
      return res.status(400).json({ message: 'Invalid stream path', path: req.path });
    }
    const id = pathMatch[1];
    const filePath = pathMatch[2] || '';
    
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
    
    // If no cached token, authenticate with Jellyfin
    if (!tokenCache.get(cacheKey)) {
      try {
        console.log('[proxyStream] Authenticating with Jellyfin user:', jellyfinUsername);
        const authResponse = await axios.post(`${config.serverUrl}/Users/authenticatebyname`, {
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
    let mediaSourceId: string | null = null;
    try {
      // Use userId endpoint to get item with user context
      const usersResponse = await axios.get(`${config.serverUrl}/Users`, {
        headers: { 'X-Emby-Token': userToken },
      });
      const userId = usersResponse.data?.[0]?.Id || usersResponse.data?.Items?.[0]?.Id;
      
      if (userId) {
        const itemResponse = await axios.get(`${config.serverUrl}/Users/${userId}/Items/${id}`, {
          headers: { 'X-Emby-Token': userToken },
        });
        
        if (itemResponse.data && itemResponse.data.MediaSources && itemResponse.data.MediaSources.length > 0) {
          mediaSourceId = itemResponse.data.MediaSources[0].Id;
          console.log('[proxyStream] Got media source ID:', mediaSourceId);
        }
      }
    } catch (itemError: any) {
      console.warn('[proxyStream] Failed to get media source ID, will try without it:', itemError.message);
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
    
    if (filePath) {
      // For HLS segments/variants: /Videos/{id}/hls/{playlistId}/stream.m3u8 or segment files
      // Extract query parameters from the request (runtimeTicks, actualSegmentLengthTicks, etc.)
      const requestQuery = new URLSearchParams(req.url.split('?')[1] || '');
      const segmentParams = new URLSearchParams();
      segmentParams.append('api_key', userToken);
      
      // For segment files (.ts), include runtimeTicks and actualSegmentLengthTicks if present
      if (filePath.endsWith('.ts')) {
        if (requestQuery.has('runtimeTicks')) {
          segmentParams.append('runtimeTicks', requestQuery.get('runtimeTicks')!);
        }
        if (requestQuery.has('actualSegmentLengthTicks')) {
          segmentParams.append('actualSegmentLengthTicks', requestQuery.get('actualSegmentLengthTicks')!);
        }
        if (mediaSourceId) {
          segmentParams.append('MediaSourceId', mediaSourceId);
        }
        targetUrl = `${config.serverUrl}/Videos/${id}/${filePath}?${segmentParams.toString()}`;
      } else {
        // For playlist files (.m3u8), include MediaSourceId if available
        targetUrl = `${config.serverUrl}/Videos/${id}/${filePath}?${urlParams.toString()}`;
      }
    } else {
      // Master playlist
      targetUrl = `${config.serverUrl}/Videos/${id}/master.m3u8?${urlParams.toString()}`;
    }

    console.log('[proxyStream] Proxying request to Jellyfin:', targetUrl);

    // Proxy the request to Jellyfin with user token
    const response = await axios.get(targetUrl, {
      responseType: filePath?.endsWith('.m3u8') ? 'text' : 'stream',
      headers: {
        'X-Emby-Token': userToken,
      },
      timeout: 30000, // 30 second timeout for streaming
    });

    // Set appropriate headers
    const contentType = response.headers['content-type'] || 
                       (filePath?.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' :
                        filePath?.endsWith('.ts') ? 'video/mp2t' :
                        'application/octet-stream');
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    // For M3U8 playlists, rewrite URLs to point to our proxy (RELATIVE URLs ONLY)
    if (filePath?.endsWith('.m3u8') || (!filePath && response.data)) {
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

      // Rewrite URLs in the playlist to RELATIVE paths only
      // Replace relative paths and Jellyfin URLs with our proxy URLs
      // Preserve query parameters (runtimeTicks, actualSegmentLengthTicks) for segment URLs
      const rewrittenPlaylist = playlistContent
        .split('\n')
        .map((line: string) => {
          // Skip comments and empty lines
          if (line.trim().startsWith('#') || !line.trim()) {
            return line;
          }
          
          // This is a URL line - rewrite it to relative path
          let url = line.trim();
          const urlParts = url.split('?');
          const urlPath = urlParts[0];
          const queryString = urlParts[1] || '';
          
          // If it's already a relative path to our proxy, leave it
          if (url.includes('/api/media/stream/') && !url.startsWith('http')) {
            return line;
          }
          
          // If it's a full URL to our proxy, convert to relative
          if (url.includes('/api/media/stream/') && url.startsWith('http')) {
            const matchResult = url.match(/\/api\/media\/stream\/[^\/]+(?:\/(.+))?/);
            if (matchResult) {
              const relativePath = matchResult[0];
              return queryString ? `${relativePath}?${queryString}` : relativePath;
            }
          }
          
          // If it's a full URL to Jellyfin, extract the path and make relative
          if (urlPath.startsWith('http')) {
            const matchResult = urlPath.match(/\/Videos\/[^\/]+\/(.+)$/);
            if (matchResult) {
              return queryString ? `${proxyBase}/${matchResult[1]}?${queryString}` : `${proxyBase}/${matchResult[1]}`;
            }
          }
          
          // If it starts with /Videos/, extract the path and make relative
          if (urlPath.startsWith('/Videos/')) {
            const matchResult = urlPath.match(/\/Videos\/[^\/]+\/(.+)$/);
            if (matchResult) {
              return queryString ? `${proxyBase}/${matchResult[1]}?${queryString}` : `${proxyBase}/${matchResult[1]}`;
            }
          }
          
          // If it's a relative path (like hls1/main/0.ts or main.m3u8), prepend our proxy base
          if (!urlPath.startsWith('http') && !urlPath.startsWith('/')) {
            return queryString ? `${proxyBase}/${urlPath}?${queryString}` : `${proxyBase}/${urlPath}`;
          }
          
          // If it's an absolute path but not /Videos/, try to use it as-is
          if (urlPath.startsWith('/') && !urlPath.startsWith('/Videos/')) {
            // Extract just the filename/path
            const pathParts = urlPath.split('/').filter(p => p);
            if (pathParts.length > 0) {
              return queryString ? `${proxyBase}/${pathParts.join('/')}?${queryString}` : `${proxyBase}/${pathParts.join('/')}`;
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
    console.error('[proxyStream] Error:', {
      message: error.message,
      status: error.response?.status,
      url: error.config?.url,
    });
    res.status(error.response?.status || 500).json({ 
      message: 'Failed to proxy stream',
      error: error.message 
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