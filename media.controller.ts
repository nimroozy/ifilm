import { Request, Response } from 'express';
import { jellyfinService } from '../services/jellyfin.service';
import { addSearchHistory } from '../services/search-history.service';

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

    // Fetch movies from Jellyfin
    const result = await jellyfinService.getItems({
      includeItemTypes: 'Movie',
      startIndex,
      limit,
      sortBy: 'SortName',
    });

    if (!result.Items || result.Items.length === 0) {
      return res.json({
        items: [],
        total: result.TotalRecordCount || 0,
        page,
        pages: Math.ceil((result.TotalRecordCount || 0) / limit),
      });
    }

    const movies = result.Items.map((item) => ({
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

    const item = await jellyfinService.getItemDetails(id);

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

    // Return proxied stream URL instead of direct Jellyfin URL
    // This avoids CORS issues and keeps API keys secure
    const protocol = req.protocol;
    const host = req.get('host');
    const proxiedUrl = `${protocol}://${host}/api/media/stream/${id}/master.m3u8`;
    
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
    const pathMatch = req.path.match(/^\/stream\/([^\/]+)(?:\/(.+))?$/);
    if (!pathMatch) {
      return res.status(400).json({ message: 'Invalid stream path' });
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

    // For M3U8 playlists, rewrite URLs to point to our proxy
    if (filePath?.endsWith('.m3u8') || (!filePath && response.data)) {
      const protocol = req.protocol;
      const host = req.get('host');
      const proxyBase = `${protocol}://${host}/api/media/stream/${id}`;
      
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

      // Rewrite URLs in the playlist
      // Replace relative paths and Jellyfin URLs with our proxy URLs
      // Preserve query parameters (runtimeTicks, actualSegmentLengthTicks) for segment URLs
      const rewrittenPlaylist = playlistContent
        .split('\n')
        .map((line: string) => {
          // Skip comments and empty lines
          if (line.trim().startsWith('#') || !line.trim()) {
            return line;
          }
          
          // This is a URL line - rewrite it
          let url = line.trim();
          const urlParts = url.split('?');
          const urlPath = urlParts[0];
          const queryString = urlParts[1] || '';
          
          // If it's already a full URL to our proxy, leave it
          if (url.includes('/api/media/stream/')) {
            return line;
          }
          
          // If it's a full URL to Jellyfin, extract the path
          if (urlPath.startsWith('http')) {
            const matchResult = urlPath.match(/\/Videos\/[^\/]+\/(.+)$/);
            if (matchResult) {
              return queryString ? `${proxyBase}/${matchResult[1]}?${queryString}` : `${proxyBase}/${matchResult[1]}`;
            }
          }
          
          // If it starts with /Videos/, extract the path
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

    const result = await jellyfinService.getItems({
      includeItemTypes: 'Series',
      startIndex,
      limit,
      sortBy: 'SortName',
    });

    const series = result.Items.map((item) => ({
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

    res.json({
      items: series,
      total: result.TotalRecordCount,
      page,
      pages: Math.ceil(result.TotalRecordCount / limit),
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

    const media = results.map((item) => ({
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
      addSearchHistory(userId, searchQuery, media.length).catch(err => 
        console.error('Failed to log search history:', err)
      );
    }

    res.json({ items: media });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed' });
  }
};