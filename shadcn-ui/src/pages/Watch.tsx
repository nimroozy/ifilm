import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Settings, Minimize2, Square, Loader2, X, Languages, Gauge } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Hls from 'hls.js';
import { resolveMediaUrl, getPlaceholderImage } from '@/utils/urlSanitizer';
import {
  getPlayerPreferences,
  savePlayerPreferences,
  getLastPosition,
  saveLastPosition,
  getSavedAudioTrack,
  saveAudioTrack,
  getSavedPlaybackSpeed,
  savePlaybackSpeed,
  getSavedVolume,
  saveVolume,
  getSavedMuted,
  saveMuted,
  saveVideoQuality,
  getSavedVideoQuality,
} from '@/utils/playerPreferences';

interface MediaDetails {
  id: string;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: number;
  rating: number;
  duration: number;
  genres: string[];
}

interface RelatedMovie {
  id: string;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: number;
  rating: number;
  duration: number;
  genres: string[];
}

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const redirectingRef = useRef<boolean>(false);
  
  const [media, setMedia] = useState<MediaDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<number | null>(null);
  const [playerSize, setPlayerSize] = useState<'small' | 'medium' | 'fullscreen'>('small');
  const [isAirPlayAvailable, setIsAirPlayAvailable] = useState(false);
  const [relatedMovies, setRelatedMovies] = useState<RelatedMovie[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [audioTracks, setAudioTracks] = useState<Array<{ index: number; language: string; name: string; codec: string; mediaSourceId: string }>>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | null>(null);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [currentMediaSourceId, setCurrentMediaSourceId] = useState<string | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [videoQuality, setVideoQuality] = useState<string>('auto');
  const [availableQualities, setAvailableQualities] = useState<Array<{ label: string; value: string; height: number }>>([]);
  const [timelineHoverTime, setTimelineHoverTime] = useState<number | null>(null);
  const [timelineHoverPosition, setTimelineHoverPosition] = useState<number>(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const saveProgressTimeoutRef = useRef<number | null>(null);
  const hasResumedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!id) {
      setError('Invalid media ID');
      setLoading(false);
      return;
    }

    // Reset resume flag when media changes
    hasResumedRef.current = false;
    
    // Load saved preferences
    const savedPrefs = getPlayerPreferences(id);
    if (savedPrefs.audioTrack !== undefined && savedPrefs.audioTrack !== null) {
      setSelectedAudioTrack(savedPrefs.audioTrack);
    }
    if (savedPrefs.playbackSpeed) {
      setPlaybackSpeed(savedPrefs.playbackSpeed);
    }
    // Load saved video quality preference
    if (media?.id) {
      const savedQuality = getSavedVideoQuality(media.id);
      setVideoQuality(savedQuality);
    }
    const savedVolume = getSavedVolume();
    if (savedVolume !== undefined) {
      setVolume(savedVolume);
    }
    const savedMuted = getSavedMuted();
    if (savedMuted !== undefined) {
      setIsMuted(savedMuted);
    }
    
    // Clear any existing stream URL on mount
    setStreamUrl(null);
    
    loadMediaDetails();
    
    // Cleanup on unmount
    return () => {
      if (saveProgressTimeoutRef.current) {
        clearTimeout(saveProgressTimeoutRef.current);
      }
    };
  }, [id]);

  useEffect(() => {
    // Don't initialize if we're redirecting
    if (redirectingRef.current) {
      return;
    }
    
    // Only initialize player if we have valid conditions
    if (!streamUrl || !videoRef.current) {
      return;
    }
    
    console.log('[Watch] Initializing player with stream URL:', streamUrl);
    initializePlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, selectedAudioTrack, playbackSpeed]);

  const loadMediaDetails = async () => {
    try {
      setLoading(true);
      
      // Load as movie first
      try {
        const response = await api.get(`/media/movies/${id}`);
        const mediaData = response.data;
        
        
        // Double-check: if backend returned a series type, redirect immediately
        if (mediaData.type === 'series') {
          redirectingRef.current = true;
          setStreamUrl(null);
          navigate(`/watch-series/${id}`, { replace: true });
          return;
        }
        
        setMedia({
          id: mediaData.id,
          title: mediaData.title,
          overview: mediaData.overview || '',
          posterUrl: mediaData.posterUrl,
          backdropUrl: mediaData.backdropUrl || mediaData.posterUrl,
          year: mediaData.year || 0,
          rating: mediaData.rating || 0,
          duration: mediaData.duration || 0,
          genres: mediaData.genres || [],
        });

      // For movies, get stream URL directly
      await loadStreamUrl(mediaData.id);
      
      // Load related movies
      loadRelatedMovies(mediaData.id);
      } catch (movieError: any) {
        // If not a movie, check if it's a series and redirect
        try {
          const seriesResponse = await api.get(`/media/series/${id}`);
          // It's a series - redirect to WatchSeries page
          redirectingRef.current = true;
          setStreamUrl(null); // Clear any stream URL before redirect
          navigate(`/watch-series/${id}`, { replace: true });
          return;
        } catch (seriesError: any) {
          // Not a movie or series
          throw new Error('Media not found');
        }
      }
    } catch (err: any) {
      console.error('Failed to load media details:', err);
      setError(err.response?.data?.message || 'Failed to load media');
      toast.error('Failed to load media details');
    } finally {
      setLoading(false);
    }
  };


  const loadStreamUrl = async (mediaId: string, audioTrackIndex?: number, mediaSourceId?: string) => {
    
    // Don't load stream URL if we're redirecting
    if (redirectingRef.current) {
      return;
    }
    
    try {
      // Get stream URL from backend for movie
      const endpoint = `/media/movies/${mediaId}/stream`;
      
      
      console.log('[Watch] Calling backend endpoint:', endpoint);
      const response = await api.get(endpoint);
      const streamUrlValue = response.data.streamUrl;
      const tracks = response.data.audioTracks || [];
      const defaultMediaSourceId = response.data.defaultMediaSourceId || null;
      
      // Set audio tracks and default media source
      setAudioTracks(tracks);
      setCurrentMediaSourceId(mediaSourceId || defaultMediaSourceId);
      
      // Jellyfin requires AudioStreamIndex in the master.m3u8 URL to use the correct audio track
      // Audio track switching CANNOT be done live - the player must reload the stream
      // This is how Jellyfin Web, Emby, and official clients work
      let finalStreamUrl = streamUrlValue;
      
      // If audio track is specified, add it to the URL so backend includes AudioStreamIndex in master.m3u8
      if (audioTrackIndex !== undefined && audioTrackIndex !== null && tracks.length > 0) {
        const selectedTrack = tracks[audioTrackIndex];
        if (selectedTrack) {
          const url = new URL(streamUrlValue, window.location.origin);
          
          // CRITICAL: Use the track's 'index' property (Jellyfin MediaStream Index)
          // This is NOT the array index - it's the actual Jellyfin MediaStream Index from the API
          // Example: If Jellyfin has audio streams with Index 1 and 2, we send 1 or 2, not 0 or 1
          const jellyfinIndex = selectedTrack.index;
          
          console.log('[Watch] ========== AUDIO TRACK INDEX VERIFICATION ==========');
          console.log('[Watch] UI Array Index (audioTrackIndex):', audioTrackIndex);
          console.log('[Watch] Jellyfin MediaStream Index (selectedTrack.index):', jellyfinIndex);
          console.log('[Watch] Track name:', selectedTrack.name);
          console.log('[Watch] Track language:', selectedTrack.language);
          console.log('[Watch] MediaSourceId:', selectedTrack.mediaSourceId);
          console.log('[Watch] ✅ Sending Jellyfin Index to backend:', jellyfinIndex);
          console.log('[Watch] ====================================================');
          
          url.searchParams.set('audioTrack', jellyfinIndex.toString());
          if (selectedTrack.mediaSourceId) {
            url.searchParams.set('mediaSourceId', selectedTrack.mediaSourceId);
          }
          finalStreamUrl = url.pathname + url.search;
          setSelectedAudioTrack(audioTrackIndex);
          console.log('[Watch] Final stream URL with audioTrack param:', finalStreamUrl);
        } else {
          console.error('[Watch] ❌ Selected track not found at array index:', audioTrackIndex);
        }
      } else if (tracks.length > 0) {
        // Select first track by default
        setSelectedAudioTrack(0);
      }
      
      
      console.log('[Watch] Backend returned stream URL:', finalStreamUrl);
      console.log('[STREAM URL] Final URL:', finalStreamUrl);
      console.log('[STREAM URL] Ends with master.m3u8?', finalStreamUrl?.endsWith('master.m3u8'));
      console.log('[STREAM URL] Contains audioTrack param?', finalStreamUrl?.includes('audioTrack'));
      console.log('[Watch] Audio tracks available:', tracks.length);
      console.log('[Watch] Audio tracks data:', JSON.stringify(tracks, null, 2));
      
      // Debug: Always log if tracks are empty
      if (tracks.length === 0) {
        console.warn('[Watch] ⚠️ No audio tracks returned from backend. Full response:', JSON.stringify(response.data, null, 2));
      } else {
        console.log('[Watch] ✅ Audio tracks found:', tracks.map(t => `${t.name} (${t.language})`).join(', '));
      }
      
      // Double-check we're not redirecting before setting stream URL
      if (!redirectingRef.current) {
        setStreamUrl(finalStreamUrl);
      }
    } catch (err: any) {
      console.error('[Watch] Failed to load stream URL:', err);
      console.error('[Watch] Error details:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        endpoint: `/media/movies/${mediaId}/stream`,
      });
      
      // Set empty tracks array on error so UI doesn't break
      setAudioTracks([]);
      
      if (!redirectingRef.current) {
        // Don't set error for 401 - might just be missing auth, stream might still work
        if (err.response?.status !== 401) {
          setError(err.response?.data?.message || 'Failed to load stream URL');
        }
        setStreamUrl(null);
      }
    }
  };

  const loadRelatedMovies = async (mediaId: string) => {
    try {
      setLoadingRelated(true);
      console.log('[Watch] Loading related movies for:', mediaId);
      const response = await api.get(`/media/movies/${mediaId}/related?limit=6`);
      console.log('[Watch] Related movies response:', response.data);
      const movies = response.data.items || response.data || [];
      // Limit to 6 items
      const limitedMovies = movies.slice(0, 6);
      console.log('[Watch] Setting related movies:', limitedMovies.length, 'movies');
      setRelatedMovies(limitedMovies);
    } catch (err: any) {
      console.error('[Watch] Failed to load related movies:', err);
      console.error('[Watch] Error details:', err.response?.data || err.message);
      // Don't show error to user, just log it
      setRelatedMovies([]);
    } finally {
      setLoadingRelated(false);
    }
  };

  const handlePlayClick = (movieId: string) => {
    navigate(`/watch/${movieId}`);
  };

  const initializePlayer = () => {
    if (!videoRef.current || !streamUrl) {
      console.warn('[Watch] Cannot initialize player: missing video ref or stream URL');
      return;
    }

    // CRITICAL: Destroy any existing HLS instance before creating a new one
    // This ensures clean state when switching audio tracks
    if (hlsRef.current) {
      console.log('[Watch] Destroying existing HLS instance before reinitializing');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    
    // Clear any existing source
    video.src = '';
    video.load();

    // Set up event listeners
    const handleTimeUpdate = () => {
      if (video.duration) {
        const currentTime = video.currentTime;
        setProgress(currentTime);
        setDuration(video.duration);
        
        // Save progress to localStorage (throttled)
        if (media?.id && currentTime > 0) {
          saveLastPosition(media.id, currentTime);
          
          // Save to backend watch history (throttled - every 10 seconds)
          if (saveProgressTimeoutRef.current === null) {
            saveProgressTimeoutRef.current = window.setTimeout(() => {
              if (media?.id && video.duration) {
                saveWatchProgress(media.id, currentTime, video.duration);
                saveProgressTimeoutRef.current = null;
              }
            }, 10000); // Save every 10 seconds
          }
        }
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        debug: false,
        // Increase timeouts for transcoded streams (they take longer to start)
        manifestLoadingTimeOut: 20000, // 20 seconds for manifest
        manifestLoadingMaxRetry: 3,
        levelLoadingTimeOut: 20000, // 20 seconds for level/playlist
        levelLoadingMaxRetry: 3,
        fragLoadingTimeOut: 20000, // 20 seconds for fragments
        fragLoadingMaxRetry: 3,
        // Allow more time for codec initialization (transcoded streams need this)
        startFragPrefetch: true,
      });

      const resolvedUrl = resolveMediaUrl(streamUrl);
      console.log('[STREAM URL] Loading HLS source:', resolvedUrl);
      console.log('[STREAM URL] Original streamUrl:', streamUrl);
      console.log('[STREAM URL] Is master.m3u8?', streamUrl?.endsWith('master.m3u8') || resolvedUrl?.endsWith('master.m3u8'));
      
      hls.loadSource(resolvedUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed, ready to play');
        
        // ============================================
        // QUALITY DEBUGGING - CRITICAL
        // ============================================
        console.log('[QUALITY] ========== QUALITY DEBUG START ==========');
        console.log('[QUALITY] hls.levels:', hls.levels);
        console.log('[QUALITY] levels count:', hls.levels?.length || 0);
        console.log('[QUALITY] currentLevel:', hls.currentLevel);
        console.log('[QUALITY] autoLevelEnabled:', hls.autoLevelEnabled);
        console.log('[STREAM URL]', streamUrl);
        console.log('[STREAM URL] Ends with master.m3u8?', streamUrl?.endsWith('master.m3u8'));
        console.log('[QUALITY] =========================================');
        
        // Build available qualities list from HLS levels
        if (hls.levels && hls.levels.length > 0) {
          const qualities: Array<{ label: string; value: string; height: number }> = [
            { label: 'Auto (Adaptive)', value: 'auto', height: 0 }
          ];
          
          // Get unique heights and sort descending
          const uniqueHeights = [...new Set(hls.levels.map((level: any) => level.height))].sort((a, b) => b - a);
          
          uniqueHeights.forEach((height) => {
            const label = height >= 1080 ? '1080p' : height >= 720 ? '720p' : height >= 480 ? '480p' : `${height}p`;
            qualities.push({ label, value: `${height}p`, height });
          });
          
          console.log('[QUALITY] Built qualities array:', qualities);
          console.log('[QUALITY] Qualities count:', qualities.length);
          console.log('[QUALITY] Will show quality selector?', qualities.length > 1);
          
          setAvailableQualities(qualities);
          
          console.log('[Watch] Available qualities:', qualities);
          console.log('[Watch] Quality levels:', hls.levels.map((level: any, idx: number) => ({
            index: idx,
            height: level.height,
            width: level.width,
            bitrate: level.bitrate,
            name: level.name || `${level.height}p`,
          })));
        } else {
          console.warn('[QUALITY] ⚠️ NO HLS LEVELS FOUND - Quality selection will NOT work!');
          console.warn('[QUALITY] This means the stream is NOT using master.m3u8 or has only one quality');
          setAvailableQualities([]);
        }
        
        // Set initial quality based on user preference
        if (videoQuality === 'auto') {
          hls.currentLevel = -1; // Auto - let HLS.js adapt
          console.log('[Watch] Quality set to AUTO (adaptive bitrate)');
        } else {
          // Find matching level by height
          const targetHeight = parseInt(videoQuality.replace('p', ''));
          const targetLevel = hls.levels.findIndex((level: any) => level.height === targetHeight);
          
          if (targetLevel >= 0) {
            hls.currentLevel = targetLevel;
            console.log(`[Watch] Quality set to ${videoQuality} (level ${targetLevel}, height ${hls.levels[targetLevel].height})`);
          } else {
            hls.currentLevel = -1; // Fallback to auto
            console.warn(`[Watch] Quality ${videoQuality} not found, using AUTO`);
            setVideoQuality('auto'); // Update UI to match
          }
        }
        
        console.log('[Watch] Available audio tracks:', hls.audioTracks?.length || 0);
        
        // Log audio tracks for debugging
        if (hls.audioTracks && hls.audioTracks.length > 0) {
          console.log('[Watch] HLS audio tracks:', hls.audioTracks.map((track: any, idx: number) => ({
            index: idx,
            name: track.name,
            lang: track.lang,
            groupId: track.groupId,
          })));
        } else {
          console.warn('[Watch] ⚠️ No HLS audio tracks available - Jellyfin streams use AudioStreamIndex parameter, not HLS.js audio tracks');
        }
        
        // NOTE: We do NOT set audio track here via hls.audioTrack
        // Jellyfin requires AudioStreamIndex in the master.m3u8 URL
        // Audio track is selected when loading the stream URL, not via HLS.js API
        
        // Set playback speed
        if (videoRef.current) {
          videoRef.current.playbackRate = playbackSpeed;
        }
        
        // Resume playback position after metadata is loaded
        if (media?.id && !hasResumedRef.current) {
          resumePlayback(media.id);
        }
      });
      
      // Listen for level switches (quality changes)
      hls.on(Hls.Events.LEVEL_SWITCHED, (event: any, data: any) => {
        const level = hls.levels[data.level];
        if (level) {
          console.log(`[Watch] Quality switched to level ${data.level}: ${level.height}p @ ${Math.round(level.bitrate / 1000)}kbps`);
        }
      });
      
      // Listen for audio track changes
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        console.log('[Watch] Audio tracks updated:', hls.audioTracks?.length || 0);
        if (selectedAudioTrack !== null && hls.audioTracks && hls.audioTracks.length > 0) {
          try {
            const trackIndex = Math.min(selectedAudioTrack, hls.audioTracks.length - 1);
            hls.audioTrack = trackIndex;
            console.log('[Watch] Set audio track to index:', trackIndex);
          } catch (error) {
            console.warn('[Watch] Failed to set audio track:', error);
          }
        }
      });
      
      // Listen for audio track switching
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
        console.log('[Watch] Audio track switched:', data.id, hls.audioTracks?.[data.id]);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('[HLS ERROR]', {
          type: data.type,
          fatal: data.fatal,
          details: data.details,
          error: data.error,
          url: data.url,
          response: data.response,
        });
        
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('[HLS ERROR] Fatal network error, trying to recover...');
              // Try to recover from network errors
              try {
                hls.startLoad();
              } catch (err) {
                console.error('[HLS ERROR] Recovery failed, reloading stream...', err);
                // If recovery fails, reload the entire stream
                if (streamUrl) {
                  setTimeout(() => {
                    hls.loadSource(resolveMediaUrl(streamUrl));
                  }, 1000);
                }
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('[HLS ERROR] Fatal media error, trying to recover...');
              // For media errors (codec issues), try to recover
              try {
                hls.recoverMediaError();
              } catch (err) {
                console.error('[HLS ERROR] Media recovery failed, reloading stream...', err);
                // If recovery fails, reload the entire stream
                if (streamUrl) {
                  setTimeout(() => {
                    hls.loadSource(resolveMediaUrl(streamUrl));
                  }, 1000);
                }
              }
              break;
            default:
              console.error('[HLS ERROR] Fatal error, destroying HLS instance');
              hls.destroy();
              setError('Failed to load video. Please try again.');
              break;
          }
        } else {
          // Non-fatal errors - just log them
          console.warn('[HLS WARNING] Non-fatal error:', data);
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = resolveMediaUrl(streamUrl);
      
      // For native HLS, audio tracks are handled via video.audioTracks
      video.addEventListener('loadedmetadata', () => {
        if (selectedAudioTrack !== null && video.audioTracks.length > 0) {
          const trackIndex = Math.min(selectedAudioTrack, video.audioTracks.length - 1);
          if (video.audioTracks[trackIndex]) {
            video.audioTracks[trackIndex].enabled = true;
            // Disable other tracks
            for (let i = 0; i < video.audioTracks.length; i++) {
              if (i !== trackIndex) {
                video.audioTracks[i].enabled = false;
              }
            }
          }
        }
        
        // Resume playback position after metadata is loaded
        if (media?.id && !hasResumedRef.current) {
          resumePlayback(media.id);
        }
      });
    } else {
      setError('HLS playback not supported in this browser');
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  };

  // Save watch progress to backend
  const saveWatchProgress = async (mediaId: string, progress: number, duration: number) => {
    try {
      await api.post('/watch-history/progress', {
        mediaId,
        mediaType: 'movie',
        progress: Math.floor(progress),
        duration: Math.floor(duration),
        mediaTitle: media?.title,
      });
    } catch (error: any) {
      // Silently fail - localStorage is the fallback
      console.warn('[Watch] Failed to save progress to backend:', error.message);
    }
  };

  // Resume playback from saved position
  const resumePlayback = async (mediaId: string) => {
    if (hasResumedRef.current || !videoRef.current) return;
    
    try {
      // Try to get progress from backend first (only if user is authenticated)
      let savedProgress = 0;
      try {
        const response = await api.get(`/watch-history/progress/${mediaId}`);
        savedProgress = response.data.progress || 0;
      } catch (error: any) {
        // Silently fallback to localStorage if backend fails (401/400/404 are expected if not logged in)
        // Only log if it's an unexpected error
        if (error.response?.status && error.response.status !== 401 && error.response.status !== 400 && error.response.status !== 404) {
          console.warn('[Watch] Failed to get progress from backend:', error.response?.status);
        }
        savedProgress = getLastPosition(mediaId);
      }
      
      // Only resume if progress is significant (> 10 seconds and < 90% watched)
      if (savedProgress > 10 && videoRef.current.duration) {
        const percentage = (savedProgress / videoRef.current.duration) * 100;
        if (percentage < 90) {
          videoRef.current.currentTime = savedProgress;
          console.log('[Watch] Resumed playback from:', savedProgress, 'seconds');
          
          // Show resume notification
          toast.info(`Resumed from ${formatTime(savedProgress)}`, {
            duration: 3000,
          });
        }
      }
      
      hasResumedRef.current = true;
    } catch (error) {
      console.error('[Watch] Error resuming playback:', error);
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          toast.error('Failed to play video. Please try again.');
        });
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const handlePlaybackSpeedChange = (speed: number) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      setPlaybackSpeed(speed);
      if (media?.id) {
        savePlaybackSpeed(media.id, speed);
      }
      setShowSettingsMenu(false);
    }
  };

  const handleQualityChange = (quality: string) => {
    console.log('[Watch] Quality change requested:', quality);
    setVideoQuality(quality);
    setShowSettingsMenu(false);
    if (media?.id) {
      saveVideoQuality(media.id, quality); // Save preference
    }
    
    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
      const levels = hlsRef.current.levels;
      let targetLevel = -1;
      
      if (quality === 'auto') {
        // Auto mode - let HLS.js adapt based on network speed
        targetLevel = -1;
        console.log('[Watch] ✅ Quality set to AUTO (adaptive bitrate)');
      } else if (quality === '1080p') {
        targetLevel = levels.findIndex((level: any) => level.height === 1080);
        if (targetLevel === -1) {
          // Fallback to highest available
          targetLevel = levels.length - 1;
          console.warn('[Watch] 1080p not found, using highest available:', levels[targetLevel]?.height);
        } else {
          console.log('[Watch] ✅ Quality set to 1080p (level', targetLevel, ')');
        }
      } else if (quality === '720p') {
        targetLevel = levels.findIndex((level: any) => level.height === 720);
        if (targetLevel === -1) {
          // Fallback to middle
          targetLevel = Math.floor(levels.length / 2);
          console.warn('[Watch] 720p not found, using middle quality:', levels[targetLevel]?.height);
        } else {
          console.log('[Watch] ✅ Quality set to 720p (level', targetLevel, ')');
        }
      } else if (quality === '480p') {
        targetLevel = levels.findIndex((level: any) => level.height === 480);
        if (targetLevel === -1) {
          // Fallback to lowest
          targetLevel = 0;
          console.warn('[Watch] 480p not found, using lowest quality:', levels[targetLevel]?.height);
        } else {
          console.log('[Watch] ✅ Quality set to 480p (level', targetLevel, ')');
        }
      }
      
      // Apply the level change
      if (targetLevel >= 0 && targetLevel < levels.length) {
        hlsRef.current.currentLevel = targetLevel;
        const level = levels[targetLevel];
        toast.success(`Quality: ${level.height}p`);
      } else if (targetLevel === -1) {
        hlsRef.current.currentLevel = -1; // Auto
        toast.success('Quality: Auto (Adaptive)');
      }
    } else {
      console.warn('[Watch] ⚠️ No HLS levels available for quality switching');
      toast.error('Quality switching not available');
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
      saveVolume(newVolume);
      saveMuted(newVolume === 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setProgress(newTime);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!document.fullscreenElement) {
        videoRef.current.requestFullscreen().catch(err => {
          console.error('Error entering fullscreen:', err);
        });
        setPlayerSize('fullscreen');
      } else {
        document.exitFullscreen();
        setPlayerSize('small');
      }
    }
  };

  const togglePlayerSize = () => {
    if (playerSize === 'small') {
      setPlayerSize('medium');
    } else if (playerSize === 'medium') {
      // Enter fullscreen
      if (videoRef.current) {
        videoRef.current.requestFullscreen().catch(err => {
          console.error('Error entering fullscreen:', err);
        });
        setPlayerSize('fullscreen');
      }
    } else {
      // Exit fullscreen
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      setPlayerSize('small');
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && playerSize === 'fullscreen') {
        setPlayerSize('small');
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [playerSize]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (videoRef.current && videoRef.current.duration) {
            videoRef.current.currentTime = Math.min(
              videoRef.current.duration,
              videoRef.current.currentTime + 10
            );
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (videoRef.current) {
            const newVolume = Math.min(1, videoRef.current.volume + 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(false);
            saveVolume(newVolume);
            saveMuted(false);
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoRef.current) {
            const newVolume = Math.max(0, videoRef.current.volume - 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
            saveVolume(newVolume);
            saveMuted(newVolume === 0);
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlaying, volume, isMuted]);

  // Check AirPlay availability and set attributes
  useEffect(() => {
    const checkAirPlayAvailability = () => {
      if (videoRef.current) {
        // Set AirPlay attributes directly on the DOM element
        const video = videoRef.current;
        video.setAttribute('x-webkit-airplay', 'allow');
        video.setAttribute('webkit-playsinline', 'true');
        
        // Check if WebKit AirPlay API is available
        // Also check for Safari/iOS user agent
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) || 
                         /iPad|iPhone|iPod/.test(navigator.userAgent);
        const hasAirPlay = 'webkitShowPlaybackTargetPicker' in video || isSafari;
        setIsAirPlayAvailable(hasAirPlay);
        
        console.log('[AirPlay] Available:', hasAirPlay, 'Safari/iOS:', isSafari);
      }
    };

    // Check immediately and also after a delay to ensure video is loaded
    checkAirPlayAvailability();
    const timer = setTimeout(() => {
      checkAirPlayAvailability();
    }, 1000);
    
    // Also check when video element is ready
    if (videoRef.current) {
      videoRef.current.addEventListener('loadedmetadata', checkAirPlayAvailability);
    }

    return () => {
      clearTimeout(timer);
      if (videoRef.current) {
        videoRef.current.removeEventListener('loadedmetadata', checkAirPlayAvailability);
      }
    };
  }, [streamUrl]);

  const showAirPlayPicker = () => {
    if (videoRef.current) {
      // Check if AirPlay API is available
      if ('webkitShowPlaybackTargetPicker' in videoRef.current) {
        try {
          (videoRef.current as any).webkitShowPlaybackTargetPicker();
        } catch (error) {
          console.error('Error showing AirPlay picker:', error);
          toast.error('AirPlay is not available on this device');
        }
      } else {
        toast.error('AirPlay is not supported on this browser. Please use Safari on macOS or iOS.');
      }
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
  };

  const handleMouseLeave = () => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      setShowControls(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-[#E50914] animate-spin mx-auto mb-4" />
          <div className="text-white text-xl font-medium">Loading your movie...</div>
        </div>
      </div>
    );
  }

  if (error || !media) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <X className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-white text-2xl font-bold mb-2">Oops! Something went wrong</h2>
            <p className="text-gray-400 text-lg">{error || 'Media not found'}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium"
            >
              Go Back
            </button>
            <button
              onClick={() => navigate('/movies')}
              className="px-6 py-3 bg-[#E50914] text-white rounded-lg hover:bg-[#F40612] transition-colors font-medium"
            >
              Browse Movies
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] relative overflow-hidden">
      {/* Enhanced Backdrop with darker cinema effect */}
      {media.backdropUrl && (
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{ backgroundImage: `url(${media.backdropUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/98 via-[#0A0A0A]/95 to-[#0A0A0A] backdrop-blur-md" />
        </div>
      )}

      {/* Professional Header */}
      <div className="relative z-20 px-6 py-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition-all group"
        >
          <div className="p-2 rounded-full bg-black/40 group-hover:bg-black/60 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </div>
          <span className="font-medium hidden sm:inline">Back</span>
        </button>
        <div className="text-white text-lg font-semibold truncate max-w-md text-center">
          {media.title}
        </div>
        <div className="w-20" /> {/* Spacer */}
      </div>

      {/* Media Info Above Player */}
      <div className="relative z-10 px-6 md:px-12 pt-6 pb-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            {media.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-white/90 mb-4">
            <span className="font-medium">{media.year}</span>
            <span className="text-white/40">•</span>
            <span className="font-medium">{Math.floor(media.duration / 60)} min</span>
            <span className="text-white/40">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400">⭐</span>
              <span className="font-semibold">{media.rating.toFixed(1)}</span>
            </div>
          </div>
          {media.overview && (
            <p className="text-gray-300 leading-relaxed text-base max-w-3xl line-clamp-2">
              {media.overview}
            </p>
          )}
        </div>
      </div>

      {/* Video Player - Larger and more prominent */}
      {streamUrl && (
        <div
          className={`relative z-10 mt-4 mb-8 transition-all duration-300 ${
            playerSize === 'small' 
              ? 'w-full max-w-6xl mx-auto px-4' 
              : playerSize === 'medium'
              ? 'w-full max-w-7xl mx-auto px-4'
              : 'w-full px-0'
          }`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={(e) => {
            // Close menus when clicking outside
            if (showSettingsMenu || showAudioMenu) {
              setShowSettingsMenu(false);
              setShowAudioMenu(false);
            }
          }}
        >
          <div className="relative w-full bg-black" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              preload="metadata"
            />

            {/* Professional Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 text-[#E50914] animate-spin mx-auto mb-4" />
                  <div className="text-white text-lg font-medium">Loading video...</div>
                  <div className="text-gray-400 text-sm mt-2">Please wait</div>
                </div>
              </div>
            )}

            {/* Enhanced Play/Pause Button Overlay - Larger and more prominent */}
            {showControls && !isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-md z-10">
                <button
                  onClick={togglePlay}
                  className="bg-[#E50914]/90 hover:bg-[#E50914] backdrop-blur-md rounded-full p-10 transition-all transform hover:scale-110 shadow-2xl border-4 border-white/30 hover:border-white/50"
                  aria-label="Play"
                >
                  <Play className="h-24 w-24 text-white" fill="currentColor" />
                </button>
              </div>
            )}

            {/* Professional Bottom Controls Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-sm transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Progress Bar with Hover Time */}
              <div className="px-6 pt-3 pb-2">
                <div 
                  className="relative"
                  ref={timelineRef}
                  onMouseMove={(e) => {
                    if (!timelineRef.current || !duration) return;
                    const rect = timelineRef.current.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percentage = Math.max(0, Math.min(1, x / rect.width));
                    const hoverTime = percentage * duration;
                    setTimelineHoverTime(hoverTime);
                    setTimelineHoverPosition(x);
                  }}
                  onMouseLeave={() => {
                    setTimelineHoverTime(null);
                  }}
                >
                  <div className="absolute inset-0 h-1.5 bg-white/20 rounded-full" />
                  <div 
                    className="absolute inset-y-0 left-0 h-1.5 bg-[#E50914] rounded-full transition-all duration-150"
                    style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                  />
                  {/* Hover Time Tooltip */}
                  {timelineHoverTime !== null && (
                    <div
                      className="absolute bottom-full mb-2 transform -translate-x-1/2 pointer-events-none z-20"
                      style={{ left: `${timelineHoverPosition}px` }}
                    >
                      <div className="bg-black/95 text-white text-xs font-mono px-2 py-1 rounded whitespace-nowrap shadow-lg border border-white/20">
                        {formatTime(timelineHoverTime)}
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/95" />
                    </div>
                  )}
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={progress}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-1.5 opacity-0 cursor-pointer z-10"
                  />
                </div>
              </div>

              {/* Enhanced Control Buttons - Larger and clearer */}
              <div className="px-6 pb-6 flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-white transition-all p-3 rounded-full hover:bg-white/25 bg-white/15 backdrop-blur-md border border-white/20 hover:border-white/30"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="h-7 w-7" fill="currentColor" />
                  ) : (
                    <Play className="h-7 w-7" fill="currentColor" />
                  )}
                </button>

                {/* Enhanced Volume Control */}
                <div className="flex items-center gap-2 group">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-white transition-all p-3 rounded-full hover:bg-white/25 bg-white/15 backdrop-blur-md border border-white/20 hover:border-white/30"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-6 w-6" />
                    ) : (
                      <Volume2 className="h-6 w-6" />
                    )}
                  </button>
                  <div className="w-0 group-hover:w-28 overflow-hidden transition-all duration-300">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-28 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#E50914]"
                      style={{
                        background: `linear-gradient(to right, #E50914 0%, #E50914 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`
                      }}
                    />
                  </div>
                </div>

                {/* Enhanced Time Display */}
                <div className="text-white text-base font-semibold ml-2 font-mono tracking-wide">
                  <span className="text-white">{formatTime(progress)}</span>
                  <span className="text-white/50 mx-1.5">/</span>
                  <span className="text-white/70">{formatTime(duration)}</span>
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2 ml-auto">
                  {/* Audio Track Selection - Show if tracks exist */}
                  {audioTracks && audioTracks.length > 0 ? (
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowAudioMenu(!showAudioMenu);
                          setShowSettingsMenu(false); // Close settings if open
                        }}
                        className="text-white hover:text-white transition-all p-2.5 rounded-full hover:bg-white/20 bg-white/10 backdrop-blur-sm relative"
                        aria-label="Audio Tracks"
                        title={`Audio Tracks (${audioTracks.length} available)`}
                      >
                        <Languages className="h-5 w-5" />
                        {audioTracks.length > 1 && (
                          <span className="absolute -top-1 -right-1 bg-[#E50914] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                            {audioTracks.length}
                          </span>
                        )}
                      </button>
                      {showAudioMenu && (
                        <div 
                          className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg shadow-xl border border-white/20 min-w-[250px] z-[100] max-h-[300px] overflow-y-auto" 
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          <div className="p-2">
                            <div className="text-white text-xs font-semibold mb-2 px-2 border-b border-white/10 pb-2">
                              Audio Tracks ({audioTracks.length})
                            </div>
                            {audioTracks.map((track, index) => (
                              <button
                                key={`${track.mediaSourceId}-${index}`}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setShowAudioMenu(false);
                                  
                                  // ============================================
                                  // CRITICAL: Audio Track Switching Protocol
                                  // ============================================
                                  // Jellyfin does NOT support live audio switching
                                  // We MUST: Stop → Destroy → Clear → Reload → Resume
                                  // ============================================
                                  
                                  const wasPlaying = isPlaying;
                                  const currentTime = videoRef.current?.currentTime || 0;
                                  const jellyfinIndex = track.index; // Jellyfin MediaStream Index
                                  
                                  // ============================================
                                  // AUDIO TRACK SWITCHING - COMPREHENSIVE DEBUG
                                  // ============================================
                                  console.log('[AUDIO] ========== AUDIO SWITCH START ==========');
                                  console.log('[AUDIO] selected index:', index);
                                  console.log('[AUDIO] jellyfin index:', jellyfinIndex);
                                  console.log('[AUDIO] track name:', track.name);
                                  console.log('[AUDIO] mediaSourceId:', track.mediaSourceId);
                                  console.log('[AUDIO] currentTime:', currentTime);
                                  console.log('[AUDIO] wasPlaying:', wasPlaying);
                                  
                                  // Step 1: Stop current playback
                                  console.log('[AUDIO] stopping playback');
                                  if (videoRef.current) {
                                    videoRef.current.pause();
                                    console.log('[AUDIO] ✅ video.pause() called');
                                    videoRef.current.currentTime = 0; // Reset to prevent buffering issues
                                    console.log('[AUDIO] ✅ video.currentTime set to 0');
                                  } else {
                                    console.error('[AUDIO] ❌ videoRef.current is null!');
                                  }
                                  
                                  // Step 2: Destroy existing HLS instance
                                  console.log('[AUDIO] destroying HLS instance');
                                  if (hlsRef.current) {
                                    try {
                                      hlsRef.current.destroy();
                                      console.log('[AUDIO] ✅ hls.destroy() called');
                                      hlsRef.current = null;
                                      console.log('[AUDIO] ✅ hlsRef.current set to null');
                                    } catch (err) {
                                      console.error('[AUDIO] ❌ Error destroying HLS:', err);
                                    }
                                  } else {
                                    console.log('[AUDIO] ⚠️ No HLS instance (may be native HLS)');
                                  }
                                  
                                  // Step 3: Clear video source
                                  console.log('[AUDIO] clearing video src');
                                  if (videoRef.current) {
                                    const oldSrc = videoRef.current.src;
                                    videoRef.current.src = '';
                                    console.log('[AUDIO] ✅ video.src set to "" (was:', oldSrc, ')');
                                    videoRef.current.load(); // Force reload
                                    console.log('[AUDIO] ✅ video.load() called');
                                  } else {
                                    console.error('[AUDIO] ❌ videoRef.current is null!');
                                  }
                                  
                                  // Step 4: Update UI state and save preference
                                  setSelectedAudioTrack(index);
                                  if (media?.id) {
                                    saveAudioTrack(media.id, index);
                                  }
                                  
                                  // Step 5: Load new stream URL with AudioStreamIndex
                                  if (media?.id) {
                                    console.log('[AUDIO] requesting new stream');
                                    console.log('[AUDIO] Parameters:', {
                                      mediaId: media.id,
                                      audioTrackArrayIndex: index,
                                      audioTrackJellyfinIndex: jellyfinIndex,
                                      mediaSourceId: track.mediaSourceId,
                                    });
                                    
                                    // Clear stream URL first to trigger re-initialization
                                    setStreamUrl(null);
                                    
                                    // Load new stream with audio track parameter
                                    // This will generate: /Videos/{id}/master.m3u8?AudioStreamIndex={jellyfinIndex}&VideoStreamIndex=0&SubtitleStreamIndex=-1
                                    await loadStreamUrl(media.id, index, track.mediaSourceId);
                                    
                                    // Wait for stream URL to be set and log it
                                    const checkStreamUrl = setInterval(() => {
                                      if (streamUrl) {
                                        clearInterval(checkStreamUrl);
                                        console.log('[AUDIO] new stream URL:', streamUrl);
                                        console.log('[AUDIO] URL contains audioTrack?', streamUrl.includes('audioTrack'));
                                        console.log('[AUDIO] URL contains AudioStreamIndex?', streamUrl.includes('AudioStreamIndex'));
                                      }
                                    }, 100);
                                    
                                    // Step 6: Wait for player to initialize, then restore position and resume
                                    const waitForReady = () => {
                                      if (videoRef.current && videoRef.current.readyState >= 2) {
                                        console.log('[AUDIO] ✅ Video ready (readyState:', videoRef.current.readyState, ')');
                                        videoRef.current.currentTime = currentTime;
                                        console.log('[AUDIO] ✅ Position restored to:', currentTime);
                                        
                                        if (wasPlaying) {
                                          videoRef.current.play()
                                            .then(() => {
                                              console.log('[AUDIO] ✅ Playback resumed');
                                              toast.success(`Switched to ${track.name}`);
                                              console.log('[AUDIO] ========== COMPLETE ==========');
                                            })
                                            .catch((err: any) => {
                                              console.error('[AUDIO] ❌ Failed to resume:', err);
                                              toast.error('Failed to resume playback');
                                            });
                                        } else {
                                          console.log('[AUDIO] ✅ Position restored (was paused)');
                                          toast.success(`Switched to ${track.name}`);
                                          console.log('[AUDIO] ========== COMPLETE ==========');
                                        }
                                      } else {
                                        setTimeout(waitForReady, 200);
                                      }
                                    };
                                    
                                    setTimeout(waitForReady, 500);
                                    
                                    // Fallback timeout
                                    setTimeout(() => {
                                      if (videoRef.current && videoRef.current.readyState < 2) {
                                        console.warn('[AUDIO] ⚠️ Video not ready after 3s, forcing restore');
                                        if (videoRef.current) {
                                          videoRef.current.currentTime = currentTime;
                                          if (wasPlaying) {
                                            videoRef.current.play().catch((err: any) => {
                                              console.error('[AUDIO] ❌ Failed to resume (fallback):', err);
                                            });
                                          }
                                          toast.success(`Switched to ${track.name}`);
                                        }
                                      }
                                    }, 3000);
                                  } else {
                                    console.error('[AUDIO] ❌ media?.id is null!');
                                  }
                                  
                                  // Skip the old HLS.js audio track switching code since Jellyfin doesn't support it
                                  return;
                                  
                                  // Legacy code (not used for Jellyfin)
                                  if (false && hlsRef.current && hlsRef.current.audioTracks && hlsRef.current.audioTracks.length > 0) {
                                    try {
                                      // Find matching HLS audio track by language and codec
                                      let hlsTrackIndex = -1;
                                      const trackLang = track.language.toLowerCase();
                                      const trackCodec = track.codec.toLowerCase();
                                      
                                      // First, try to find exact match by language
                                      for (let i = 0; i < hlsRef.current.audioTracks.length; i++) {
                                        const hlsTrack = hlsRef.current.audioTracks[i];
                                        const hlsLang = (hlsTrack.lang || '').toLowerCase();
                                        const hlsName = (hlsTrack.name || '').toLowerCase();
                                        
                                        // Match by language code (e.g., 'eng', 'fas')
                                        if (hlsLang === trackLang || hlsLang.startsWith(trackLang) || trackLang.startsWith(hlsLang)) {
                                          hlsTrackIndex = i;
                                          break;
                                        }
                                        // Also try matching by name if it contains the language
                                        if (hlsName.includes(trackLang) || hlsName.includes(track.name.toLowerCase())) {
                                          hlsTrackIndex = i;
                                          break;
                                        }
                                      }
                                      
                                      // Fallback to array index if no match found
                                      if (hlsTrackIndex === -1) {
                                        hlsTrackIndex = Math.min(index, hlsRef.current.audioTracks.length - 1);
                                        console.warn('[Watch] No language match found, using array index:', hlsTrackIndex);
                                      }
                                      
                                      // Switch audio track WITHOUT pausing or reloading
                                      hlsRef.current.audioTrack = hlsTrackIndex;
                                      setSelectedAudioTrack(index);
                                      
                                      console.log('[Watch] ✅ Switched to audio track seamlessly:', {
                                        backendIndex: index,
                                        hlsIndex: hlsTrackIndex,
                                        track: track.name,
                                        hlsTrack: hlsRef.current.audioTracks[hlsTrackIndex],
                                      });
                                      
                                      toast.success(`Switched to ${track.name}`);
                                    } catch (error) {
                                      console.error('[Watch] Failed to switch audio track:', error);
                                      toast.error('Failed to switch audio track');
                                    }
                                  } else if (videoRef.current && videoRef.current.audioTracks && videoRef.current.audioTracks.length > 0) {
                                    // Native HLS (Safari)
                                    try {
                                      const trackIndex = Math.min(index, videoRef.current.audioTracks.length - 1);
                                      if (videoRef.current.audioTracks[trackIndex]) {
                                        // Disable all tracks first
                                        for (let i = 0; i < videoRef.current.audioTracks.length; i++) {
                                          videoRef.current.audioTracks[i].enabled = false;
                                        }
                                        // Enable selected track
                                        videoRef.current.audioTracks[trackIndex].enabled = true;
                                        setSelectedAudioTrack(index);
                                        console.log('[Watch] Switched to native audio track:', trackIndex);
                                        toast.success(`Switched to ${track.name}`);
                                      }
                                    } catch (error) {
                                      console.error('[Watch] Failed to switch native audio track:', error);
                                      toast.error('Failed to switch audio track');
                                    }
                                  } else {
                                    // Fallback: reload stream with new audio track
                                    console.log('[Watch] HLS tracks not available, reloading stream with audio track:', index, track);
                                    setSelectedAudioTrack(index);
                                    if (media?.id) {
                                      await loadStreamUrl(media.id, index, track.mediaSourceId);
                                      // Restore playback state after reload
                                      if (videoRef.current && wasPlaying) {
                                        setTimeout(() => {
                                          if (videoRef.current) {
                                            videoRef.current.currentTime = currentTime;
                                            videoRef.current.play().catch(() => {});
                                          }
                                        }, 500);
                                      }
                                    }
                                  }
                                }}
                                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors mb-1 ${
                                  selectedAudioTrack === index
                                    ? 'bg-[#E50914] text-white'
                                    : 'text-white/80 hover:bg-white/10'
                                }`}
                              >
                                <div className="font-medium text-sm">{track.name}</div>
                                <div className="text-xs opacity-75 mt-0.5">{track.language.toUpperCase()} • {track.codec.toUpperCase()}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {/* Settings Menu */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSettingsMenu(!showSettingsMenu);
                        setShowAudioMenu(false); // Close audio menu if open
                      }}
                      className="text-white hover:text-white transition-all p-2.5 rounded-full hover:bg-white/20 bg-white/10 backdrop-blur-sm"
                      aria-label="Settings"
                      title="Settings"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    {showSettingsMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg shadow-xl border border-white/20 min-w-[250px] z-[100]" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                        <div className="p-3">
                          {/* Playback Speed */}
                          <div className="mb-4">
                            <div className="text-white text-xs font-semibold mb-2 flex items-center gap-2">
                              <Gauge className="h-4 w-4" />
                              Playback Speed
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                                <button
                                  key={speed}
                                  onClick={() => handlePlaybackSpeedChange(speed)}
                                  className={`px-3 py-2 rounded text-sm transition-colors ${
                                    playbackSpeed === speed
                                      ? 'bg-[#E50914] text-white'
                                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                                  }`}
                                >
                                  {speed}x
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Video Quality - Dynamic based on available levels */}
                          {(() => {
                            console.log('[QUALITY UI] Rendering quality selector. availableQualities.length:', availableQualities.length);
                            console.log('[QUALITY UI] availableQualities:', availableQualities);
                            console.log('[QUALITY UI] Will show?', availableQualities.length > 1);
                            
                            if (availableQualities.length > 1) {
                              return (
                                <div className="mb-4">
                                  <div className="text-white text-xs font-semibold mb-2 flex items-center gap-2">
                                    <Gauge className="h-4 w-4" />
                                    Quality
                                  </div>
                                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                    {availableQualities.map((quality) => (
                                      <button
                                        key={quality.value}
                                        onClick={() => handleQualityChange(quality.value)}
                                        className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                          videoQuality === quality.value
                                            ? 'bg-[#E50914] text-white'
                                            : 'text-white/80 hover:bg-white/10'
                                        }`}
                                      >
                                        {quality.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            } else {
                              console.warn('[QUALITY UI] ⚠️ Quality selector NOT shown - availableQualities.length <= 1');
                              return null;
                            }
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={showAirPlayPicker}
                    className="text-white hover:text-white transition-all p-2.5 rounded-full hover:bg-white/20 bg-white/10 backdrop-blur-sm"
                    aria-label="AirPlay"
                    title="AirPlay"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M5 17C3.89543 17 3 16.2325 3 15.2857V6.71429C3 5.76751 3.89543 5 5 5H19C20.1046 5 21 5.76751 21 6.71429V15.2857C21 16.2325 20.1046 17 19 17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                      <path d="M12 15L17.1962 21H6.80385L12 15Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="text-white hover:text-white transition-all p-3 rounded-full hover:bg-white/25 bg-white/15 backdrop-blur-md border border-white/20 hover:border-white/30"
                    aria-label="Toggle fullscreen"
                    title="Fullscreen (F)"
                  >
                    {document.fullscreenElement ? (
                      <Minimize2 className="h-6 w-6" />
                    ) : (
                      <Maximize className="h-6 w-6" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media Info Below Player - Enhanced layout */}
      <div className="relative z-10 mt-12 px-6 md:px-12 pb-12">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <div className="flex flex-wrap gap-3 mb-6">
              {media.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                >
                  {genre}
                </span>
              ))}
            </div>
            {media.overview && (
              <div className="mt-6">
                <h2 className="text-2xl font-bold text-white mb-4">About</h2>
                <p className="text-gray-200 leading-relaxed text-lg max-w-4xl">
                  {media.overview}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Related Movies Section */}
      <div className="relative z-10 px-6 md:px-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">More Like This</h2>
          {loadingRelated ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-[#E50914] animate-spin" />
              <span className="ml-3 text-white">Loading related movies...</span>
            </div>
          ) : relatedMovies.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {relatedMovies.map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => handlePlayClick(movie.id)}
                  className="group text-left transition-transform hover:scale-105"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-2 bg-[#2A2A2A]">
                    <img
                      src={resolveMediaUrl(movie.posterUrl)}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = getPlaceholderImage();
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute bottom-0 left-0 right-0 p-3 transform translate-y-full group-hover:translate-y-0 transition-transform">
                      <p className="text-white text-sm font-medium line-clamp-2">{movie.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-white/80">
                        <span>{movie.year}</span>
                        {movie.rating > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <span className="text-yellow-400">⭐</span>
                              {movie.rating.toFixed(1)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">No related movies found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
