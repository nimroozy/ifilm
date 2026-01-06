import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Settings, Minimize2, Square, Languages, Gauge, Loader2, X } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Hls from 'hls.js';
import { resolveMediaUrl, getPlaceholderImage } from '@/utils/urlSanitizer';

interface SeriesDetails {
  id: string;
  title: string;
  overview: string;
  posterUrl: string;
  backdropUrl: string;
  year: number;
  rating: number;
  genres: string[];
  seasons?: Array<{
    id: string;
    name: string;
    seasonNumber: number;
  }>;
}

interface Episode {
  id: string;
  name: string;
  episodeNumber: number;
  overview: string;
  thumbnailUrl?: string;
}

export default function WatchSeries() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  
  const [series, setSeries] = useState<SeriesDetails | null>(null);
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
  
  // Series-specific state
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [loadingStream, setLoadingStream] = useState(false);
  const [audioTracks, setAudioTracks] = useState<Array<{ index: number; language: string; name: string; codec: string; mediaSourceId: string }>>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | null>(null);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [currentMediaSourceId, setCurrentMediaSourceId] = useState<string | null>(null);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [videoQuality, setVideoQuality] = useState<string>('auto');

  useEffect(() => {
    if (!id) {
      setError('Invalid series ID');
      setLoading(false);
      return;
    }


    // Clear any existing stream URL on mount
    setStreamUrl(null);
    setSelectedEpisode(null);
    setEpisodes([]);
    
    loadSeriesDetails();
  }, [id]);

  useEffect(() => {
    // Don't initialize if we're still loading episodes
    if (loadingEpisodes) {
      return;
    }

    // Only initialize player if we have valid conditions
    if (!streamUrl || !selectedEpisode) {
      return;
    }

    // Wait for video element to be available (it's rendered when streamUrl && selectedEpisode are set)
    // Use a small delay to ensure DOM is updated
    const initTimer = setTimeout(() => {
      if (!videoRef.current) {
        console.warn('[WatchSeries] Video ref not available, will retry on next render');
        return;
      }

      // Verify stream URL contains episode ID, not series ID
      const streamUrlMatch = streamUrl.match(/\/stream\/([^\/]+)/);
      const streamUrlId = streamUrlMatch ? streamUrlMatch[1] : null;
      
      if (streamUrlId !== selectedEpisode) {
        console.error('[WatchSeries] Stream URL ID mismatch!');
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }
        setStreamUrl(null);
        setError('Stream URL ID mismatch. Please select an episode again.');
        return;
      }
      
      console.log('[WatchSeries] Initializing player with streamUrl:', streamUrl, 'selectedEpisode:', selectedEpisode);
      initializePlayer();
      console.log('[WatchSeries] Player initialization completed');
    }, 100);

    return () => {
      clearTimeout(initTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, selectedAudioTrack, playbackSpeed]);

  const loadSeriesDetails = async () => {
    try {
      setLoading(true);
      
      const response = await api.get(`/media/series/${id}`);
      const seriesData = response.data;
      
      
      setSeries({
        id: seriesData.id,
        title: seriesData.title,
        overview: seriesData.overview || '',
        posterUrl: seriesData.posterUrl,
        backdropUrl: seriesData.backdropUrl || seriesData.posterUrl,
        year: seriesData.year || 0,
        rating: seriesData.rating || 0,
        genres: seriesData.genres || [],
        seasons: seriesData.seasons || [],
      });

      // Check if there's an episode query parameter (from continue watching)
      const episodeIdFromUrl = searchParams.get('episode');
      
      // Load first season's episodes
      if (seriesData.seasons && seriesData.seasons.length > 0) {
        const firstSeason = seriesData.seasons[0];
        setSelectedSeason(firstSeason.seasonNumber);
        
        // If episode ID is in URL, try to load it from first season
        // If not found, findAndLoadEpisode will search other seasons
        await loadEpisodes(id!, firstSeason.id, episodeIdFromUrl || undefined);
        
        // If episode not found in first season, search all seasons
        if (episodeIdFromUrl) {
          // Wait a bit to see if episode was found in first season
          setTimeout(() => {
            if (!selectedEpisode) {
              console.log('[WatchSeries] Episode not in first season, searching all seasons...');
              findAndLoadEpisode(episodeIdFromUrl, seriesData.seasons);
            }
          }, 1000);
        }
      }
    } catch (err: any) {
      console.error('Failed to load series details:', err);
      setError(err.response?.data?.message || 'Failed to load series');
      toast.error('Failed to load series details');
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodes = async (seriesId: string, seasonId: string, autoSelectEpisodeId?: string) => {
    try {
      setLoadingEpisodes(true);
      // Clear stream URL before loading episodes
      setStreamUrl(null);
      setSelectedEpisode(null);
      
      // Get episodes for the season
      const response = await api.get(`/media/series/${seriesId}/episodes?seasonId=${seasonId}`);
      const episodesData = response.data.episodes || response.data.items || [];
      
      const mappedEpisodes = episodesData.map((ep: any) => ({
        id: ep.id,
        name: ep.name || ep.title,
        episodeNumber: ep.episodeNumber || ep.indexNumber || 0,
        overview: ep.overview || '',
        thumbnailUrl: ep.thumbnailUrl || ep.posterUrl,
      }));
      
      setEpisodes(mappedEpisodes);
      
      // If episode ID is provided (from URL query), auto-select it
      if (autoSelectEpisodeId) {
        const episodeExists = mappedEpisodes.some(ep => ep.id === autoSelectEpisodeId);
        if (episodeExists) {
          console.log('[WatchSeries] Auto-selecting episode from URL:', autoSelectEpisodeId);
          // Small delay to ensure state is updated
          setTimeout(() => {
            handleEpisodeSelect(autoSelectEpisodeId);
          }, 200);
        } else {
          console.log('[WatchSeries] Episode not found in current season, will search other seasons if needed');
        }
      }
    } catch (err: any) {
      console.error('Failed to load episodes:', err);
      toast.error('Failed to load episodes');
      setStreamUrl(null);
      setSelectedEpisode(null);
    } finally {
      setLoadingEpisodes(false);
    }
  };

  const loadStreamUrl = async (episodeId: string, audioTrackIndex?: number, mediaSourceId?: string) => {
    setLoadingStream(true);
    setError(null);
    try {
      // Get stream URL from backend
      const endpoint = `/media/movies/${episodeId}/stream`;
      
      console.log('[WatchSeries] Calling API endpoint:', endpoint);
      const response = await api.get(endpoint);
      console.log('[WatchSeries] API response:', response.data);
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
          // Use the track's 'index' property (Jellyfin MediaStream Index)
          // This will be converted to AudioStreamIndex by the backend
          url.searchParams.set('audioTrack', selectedTrack.index.toString());
          if (selectedTrack.mediaSourceId) {
            url.searchParams.set('mediaSourceId', selectedTrack.mediaSourceId);
          }
          finalStreamUrl = url.pathname + url.search;
          setSelectedAudioTrack(audioTrackIndex);
          console.log('[WatchSeries] Loading stream with audio track (will reload):', {
            arrayIndex: audioTrackIndex,
            jellyfinIndex: selectedTrack.index,
            track: selectedTrack.name,
            streamUrl: finalStreamUrl,
          });
        }
      } else if (tracks.length > 0) {
        // Select first track by default
        setSelectedAudioTrack(0);
      }
      
      // Extract ID from stream URL to verify
      const streamUrlIdMatch = finalStreamUrl.match(/\/stream\/([^\/]+)/);
      const streamUrlId = streamUrlIdMatch ? streamUrlIdMatch[1] : null;
      
      // Verify the stream URL contains the episode ID
      if (streamUrlId !== episodeId) {
        console.error('[WatchSeries] Stream URL ID does not match episode ID!');
        setStreamUrl(null);
        setError('Invalid stream URL. Please select an episode again.');
        return;
      }
      
      console.log('[WatchSeries] Setting streamUrl to:', finalStreamUrl);
      console.log('[WatchSeries] Audio tracks available:', tracks.length);
      console.log('[WatchSeries] Audio tracks data:', JSON.stringify(tracks, null, 2));
      
      // Debug: Always log if tracks are empty
      if (tracks.length === 0) {
        console.warn('[WatchSeries] ⚠️ No audio tracks returned from backend. Full response:', JSON.stringify(response.data, null, 2));
      } else {
        console.log('[WatchSeries] ✅ Audio tracks found:', tracks.map(t => `${t.name} (${t.language})`).join(', '));
      }
      setStreamUrl(finalStreamUrl);
      console.log('[WatchSeries] streamUrl state updated');
    } catch (err: any) {
      console.error('[WatchSeries] Failed to load stream URL:', err);
      console.error('[WatchSeries] Error details:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        endpoint: `/media/movies/${episodeId}/stream`
      });
      
      // Set empty tracks array on error so UI doesn't break
      setAudioTracks([]);
      
      // Don't set error for 401 - might just be missing auth, stream might still work
      if (err.response?.status !== 401) {
        setError(err.response?.data?.message || err.message || 'Failed to load stream URL');
        toast.error(`Failed to load episode: ${err.response?.data?.message || err.message}`);
      }
      setStreamUrl(null);
    } finally {
      setLoadingStream(false);
    }
  };

  const findAndLoadEpisode = async (episodeId: string, seasons: Array<{ id: string; name: string; seasonNumber: number }>) => {
    // Search through all seasons to find the episode
    for (const season of seasons) {
      try {
        const response = await api.get(`/media/series/${id}/episodes?seasonId=${season.id}`);
        const episodesData = response.data.episodes || response.data.items || [];
        const episode = episodesData.find((ep: any) => ep.id === episodeId);
        
        if (episode) {
          console.log('[WatchSeries] Found episode in season', season.seasonNumber);
          setSelectedSeason(season.seasonNumber);
          setEpisodes(episodesData.map((ep: any) => ({
            id: ep.id,
            name: ep.name || ep.title,
            episodeNumber: ep.episodeNumber || ep.indexNumber || 0,
            overview: ep.overview || '',
            thumbnailUrl: ep.thumbnailUrl || ep.posterUrl,
          })));
          // Auto-select the episode
          await handleEpisodeSelect(episodeId);
          return;
        }
      } catch (err) {
        console.warn(`[WatchSeries] Failed to load episodes for season ${season.seasonNumber}:`, err);
      }
    }
    console.warn('[WatchSeries] Episode not found in any season:', episodeId);
  };

  const handleEpisodeSelect = async (episodeId: string) => {
    console.log('🔴🔴🔴 [WatchSeries] ====== EPISODE CLICKED ======', episodeId);
    console.log('[WatchSeries] Current state - selectedEpisode:', selectedEpisode, 'streamUrl:', streamUrl);
    
    // Clean up previous HLS instance immediately
    if (hlsRef.current) {
      console.log('[WatchSeries] Destroying previous HLS instance before switching episode');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    // Pause and reset video element
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.src = '';
      videoRef.current.load();
    }
    
    // Set loading state immediately
    setLoadingStream(true);
    setError(null);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    
    // Set selected episode
    setSelectedEpisode(episodeId);
    console.log('[WatchSeries] ✅ Set selectedEpisode to:', episodeId);
    
    // Clear existing stream URL before loading new one
    setStreamUrl(null);
    console.log('[WatchSeries] 🧹 Cleared streamUrl');
    
    // Small delay to ensure state is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log('[WatchSeries] 🚀 About to call loadStreamUrl for episode:', episodeId);
    // Load stream URL for the selected episode
    try {
      await loadStreamUrl(episodeId);
      console.log('[WatchSeries] ✅ loadStreamUrl completed for episode:', episodeId);
    } catch (error: any) {
      console.error('[WatchSeries] ❌ Error in loadStreamUrl:', error);
      console.error('[WatchSeries] Error details:', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data
      });
      toast.error(`Failed to load episode: ${error?.response?.data?.message || error?.message || 'Unknown error'}`);
    }
  };

  const initializePlayer = () => {
    if (!videoRef.current || !streamUrl) {
      return;
    }

    // CRITICAL: Destroy any existing HLS instance before creating a new one
    // This ensures clean state when switching audio tracks or episodes
    if (hlsRef.current) {
      console.log('[WatchSeries] Destroying existing HLS instance before reinitializing');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    
    // Clear any existing source
    video.src = '';
    video.load();
    setProgress(0);
    setDuration(0);
    setIsPlaying(false);

    // Set up event listeners
    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress(video.currentTime);
        setDuration(video.duration);
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
      });

      hls.loadSource(resolveMediaUrl(streamUrl));
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, ready to play');
        console.log('[WatchSeries] Available quality levels:', hls.levels?.length || 0);
        console.log('[WatchSeries] Available audio tracks:', hls.audioTracks.length);
        
        // Set audio track if one is selected
        if (selectedAudioTrack !== null && hls.audioTracks.length > 0) {
          try {
            const trackIndex = Math.min(selectedAudioTrack, hls.audioTracks.length - 1);
            hls.audioTrack = trackIndex;
            console.log('[WatchSeries] Set audio track to index:', trackIndex, hls.audioTracks[trackIndex]);
          } catch (error) {
            console.warn('[WatchSeries] Failed to set audio track:', error);
          }
        }
        
        // Set playback speed
        if (videoRef.current) {
          videoRef.current.playbackRate = playbackSpeed;
        }
        
        // Auto-play when manifest is parsed (user already interacted by clicking episode)
        video.play().catch(err => {
          console.error('Error auto-playing video:', err);
          // If autoplay fails, user can click play button
        });
      });
      
      // Listen for audio track changes
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        console.log('[WatchSeries] Audio tracks updated:', hls.audioTracks.length);
        if (selectedAudioTrack !== null && hls.audioTracks.length > 0) {
          try {
            const trackIndex = Math.min(selectedAudioTrack, hls.audioTracks.length - 1);
            hls.audioTrack = trackIndex;
            console.log('[WatchSeries] Set audio track to index:', trackIndex);
          } catch (error) {
            console.warn('[WatchSeries] Failed to set audio track:', error);
          }
        }
      });
      
      // Listen for audio track switching
      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (event, data) => {
        console.log('[WatchSeries] Audio track switched:', data.id, hls.audioTracks[data.id]);
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error, trying to recover...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error, trying to recover...');
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal error, destroying HLS instance');
              hls.destroy();
              setError('Failed to load video. Please try again.');
              break;
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = resolveMediaUrl(streamUrl);
      video.load();
      
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
      });
      
      // Auto-play for Safari (user already interacted by clicking episode)
      video.play().catch(err => {
        console.error('Error auto-playing video:', err);
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
      setShowSettingsMenu(false);
    }
  };

  const handleQualityChange = (quality: string) => {
    setVideoQuality(quality);
    setShowSettingsMenu(false);
    // Note: Quality switching requires HLS level switching, which is handled by HLS.js automatically
    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
      const levels = hlsRef.current.levels;
      let targetLevel = -1;
      
      if (quality === '1080p') {
        targetLevel = levels.findIndex((level: any) => level.height === 1080) || levels.length - 1;
      } else if (quality === '720p') {
        targetLevel = levels.findIndex((level: any) => level.height === 720) || Math.floor(levels.length / 2);
      } else if (quality === '480p') {
        targetLevel = levels.findIndex((level: any) => level.height === 480) || 0;
      } else {
        targetLevel = -1; // Auto
      }
      
      if (targetLevel >= 0 && targetLevel < levels.length) {
        hlsRef.current.currentLevel = targetLevel;
      } else {
        hlsRef.current.currentLevel = -1; // Auto
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
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
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // Check if already in fullscreen
    const isFullscreen = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      (document as any).mozFullScreenElement ||
      (document as any).msFullscreenElement
    );
    
    if (!isFullscreen) {
      // Enter fullscreen
      // Try standard API first
      if (video.requestFullscreen) {
        video.requestFullscreen().catch(err => {
          console.error('Error entering fullscreen:', err);
        });
      }
      // iOS Safari fallback
      else if ((video as any).webkitEnterFullscreen) {
        (video as any).webkitEnterFullscreen();
      }
      // WebKit fallback
      else if ((video as any).webkitRequestFullscreen) {
        (video as any).webkitRequestFullscreen();
      }
      // Mozilla fallback
      else if ((video as any).mozRequestFullScreen) {
        (video as any).mozRequestFullScreen();
      }
      // IE/Edge fallback
      else if ((video as any).msRequestFullscreen) {
        (video as any).msRequestFullscreen();
      }
      setPlayerSize('fullscreen');
    } else {
      // Exit fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setPlayerSize('small');
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
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (videoRef.current) {
            const newVolume = Math.max(0, videoRef.current.volume - 0.1);
            videoRef.current.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
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
  }, [streamUrl, selectedEpisode]);

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
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-[#E50914] animate-spin mx-auto mb-4" />
          <div className="text-white text-xl font-medium">Loading series...</div>
        </div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <X className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-white text-2xl font-bold mb-2">Oops! Something went wrong</h2>
            <p className="text-gray-400 text-lg">{error || 'Series not found'}</p>
          </div>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium"
            >
              Go Back
            </button>
            <button
              onClick={() => navigate('/series')}
              className="px-6 py-3 bg-[#E50914] text-white rounded-lg hover:bg-[#F40612] transition-colors font-medium"
            >
              Browse Series
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Find current episode info for display
  const currentEpisode = episodes.find(ep => ep.id === selectedEpisode);

  return (
    <div className="min-h-screen bg-[#0A0A0A] relative overflow-hidden">
      {/* Enhanced Backdrop with darker cinema effect */}
      {series.backdropUrl && (
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center scale-105"
            style={{ backgroundImage: `url(${series.backdropUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A]/98 via-[#0A0A0A]/95 to-[#0A0A0A] backdrop-blur-md" />
        </div>
      )}

      {/* Professional Header - Mobile-friendly */}
      <div className="relative z-20 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white hover:text-gray-300 active:text-gray-400 transition-all group touch-manipulation min-w-[44px] min-h-[44px]"
        >
          <div className="p-2 rounded-full bg-black/40 group-hover:bg-black/60 active:bg-black/70 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </div>
          <span className="font-medium hidden sm:inline">Back</span>
        </button>
        <div className="text-white text-sm sm:text-lg font-semibold truncate max-w-[180px] sm:max-w-md text-center px-2">
          {series.title}
          {currentEpisode && (
            <span className="block text-xs sm:text-sm text-white/70 font-normal mt-0.5">
              Episode {currentEpisode.episodeNumber}: {currentEpisode.name}
            </span>
          )}
        </div>
        <div className="w-12 sm:w-20" /> {/* Spacer */}
      </div>

      {/* Series Info Above Player - Mobile-friendly */}
      <div className="relative z-10 px-3 sm:px-6 md:px-12 pt-3 sm:pt-4 pb-2">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-2 leading-tight drop-shadow-lg">
            {series.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-white/90 text-sm sm:text-base mb-2 sm:mb-3">
            <span className="font-semibold">{series.year}</span>
            <span className="text-white/40">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-yellow-400">⭐</span>
              <span className="font-bold">{series.rating.toFixed(1)}</span>
            </div>
          </div>
          {series.overview && (
            <p className="text-gray-200 leading-relaxed text-sm sm:text-lg max-w-4xl line-clamp-2 sm:line-clamp-3 drop-shadow-md">
              {series.overview}
            </p>
          )}
        </div>
      </div>

      {/* Season and Episode Selection - Professional Layout */}
      {series.seasons && series.seasons.length > 0 && (
        <div className="relative z-10 px-6 md:px-12 mt-4">
          <div className="max-w-6xl mx-auto">
            {/* Season Selector - Modern Pills */}
            <div className="mb-6">
              <h3 className="text-white text-xl font-bold mb-4">Seasons</h3>
              <div className="flex gap-3 flex-wrap">
                {series.seasons.map((season) => (
                  <button
                    key={season.id}
                    onClick={() => {
                      setSelectedSeason(season.seasonNumber);
                      loadEpisodes(series.id, season.id);
                    }}
                    className={`px-6 py-3 rounded-full text-base font-semibold transition-all ${
                      selectedSeason === season.seasonNumber
                        ? 'bg-[#E50914] text-white shadow-lg shadow-[#E50914]/50'
                        : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm border border-white/20'
                    }`}
                  >
                    {season.name || `Season ${season.seasonNumber}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Episode List - Professional Grid */}
            {selectedSeason !== null && (
              <div className="mb-8">
                <h3 className="text-white text-xl font-bold mb-4">
                  Episodes {loadingEpisodes && <span className="text-sm font-normal text-white/60">(Loading...)</span>}
                </h3>
                {loadingEpisodes ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-[#E50914] animate-spin" />
                    <span className="ml-3 text-white">Loading episodes...</span>
                  </div>
                ) : episodes.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {episodes.map((episode) => (
                      <button
                        key={episode.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEpisodeSelect(episode.id);
                        }}
                        className={`group relative text-left rounded-lg overflow-hidden transition-all ${
                          selectedEpisode === episode.id
                            ? 'ring-4 ring-[#E50914] shadow-2xl shadow-[#E50914]/50 scale-105'
                            : 'hover:scale-105 hover:shadow-xl'
                        }`}
                      >
                        <div className="relative aspect-video bg-[#1F1F1F]">
                          {episode.thumbnailUrl ? (
                            <img
                              src={resolveMediaUrl(episode.thumbnailUrl)}
                              alt={episode.name}
                              className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = getPlaceholderImage();
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1F1F1F] to-[#0A0A0A]">
                              <Play className="h-12 w-12 text-white/40" />
                            </div>
                          )}
                          {/* Play Overlay on Hover */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <div className="bg-[#E50914]/90 rounded-full p-4 transform scale-75 group-hover:scale-100 transition-transform">
                              <Play className="h-8 w-8 text-white" fill="currentColor" />
                            </div>
                          </div>
                          {/* Episode Number Badge */}
                          <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-bold">
                            E{episode.episodeNumber}
                          </div>
                          {/* Currently Playing Indicator */}
                          {selectedEpisode === episode.id && (
                            <div className="absolute top-2 right-2 bg-[#E50914] rounded-full p-1.5">
                              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            </div>
                          )}
                        </div>
                        <div className="p-3 bg-gradient-to-b from-[#1F1F1F] to-[#0A0A0A]">
                          <div className="text-white text-sm font-semibold line-clamp-2 mb-1">
                            {episode.name}
                          </div>
                          {episode.overview && (
                            <div className="text-white/60 text-xs line-clamp-2">
                              {episode.overview}
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-gray-400 text-lg">No episodes found for this season.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading indicator when stream is being loaded */}
      {selectedEpisode && !streamUrl && loadingStream && (
        <div className="relative z-10 w-full mt-6 px-6 md:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="relative w-full bg-black flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
              <div className="text-center">
                <Loader2 className="h-12 w-12 text-[#E50914] animate-spin mx-auto mb-4" />
                <div className="text-white text-xl font-medium">Loading episode...</div>
                {currentEpisode && (
                  <div className="text-gray-400 text-sm mt-2">
                    Episode {currentEpisode.episodeNumber}: {currentEpisode.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error message when stream fails to load */}
      {selectedEpisode && !streamUrl && !loadingStream && error && (
        <div className="relative z-10 w-full mt-6 px-6 md:px-12">
          <div className="max-w-6xl mx-auto">
            <div className="bg-red-900/50 border border-red-600 rounded-lg p-6 text-white">
              <div className="font-bold text-lg mb-2">Error loading episode</div>
              <div className="text-sm mb-4">{error}</div>
              <button
                onClick={() => {
                  setError(null);
                  if (selectedEpisode) {
                    loadStreamUrl(selectedEpisode);
                  }
                }}
                className="px-6 py-3 bg-[#E50914] hover:bg-[#F40612] rounded-lg transition-colors font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player - Mobile-friendly and fullscreen-capable */}
      {streamUrl && selectedEpisode && (
        <div
          className={`relative z-10 transition-all duration-300 ${
            playerSize === 'small' 
              ? 'w-full max-w-6xl mx-auto px-2 sm:px-4 mt-4 mb-8' 
              : playerSize === 'medium'
              ? 'w-full max-w-7xl mx-auto px-2 sm:px-4 mt-4 mb-8'
              : 'fixed inset-0 z-50 bg-black'
          }`}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchMove={() => {
            // Show controls on touch (mobile)
            setShowControls(true);
            if (controlsTimeoutRef.current) {
              clearTimeout(controlsTimeoutRef.current);
            }
            controlsTimeoutRef.current = window.setTimeout(() => {
              if (isPlaying) {
                setShowControls(false);
              }
            }, 3000);
          }}
          onClick={(e) => {
            // Close menus when clicking outside
            if (showSettingsMenu || showAudioMenu) {
              setShowSettingsMenu(false);
              setShowAudioMenu(false);
            }
            // Toggle play/pause on mobile tap
            if (window.innerWidth < 768) {
              const target = e.target as HTMLElement;
              if (target.tagName !== 'BUTTON' && !target.closest('button') && !target.closest('input')) {
                togglePlay();
              }
            }
          }}
        >
          <div 
            className={`relative w-full bg-black ${
              playerSize === 'fullscreen' 
                ? 'h-screen' 
                : 'aspect-video sm:aspect-[16/9]'
            }`}
          >
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              preload="metadata"
              controls={false}
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

            {/* Enhanced Play/Pause Button Overlay - Mobile-friendly */}
            {showControls && !isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-md z-10">
                <button
                  onClick={togglePlay}
                  className="bg-[#E50914]/90 hover:bg-[#E50914] active:bg-[#E50914] backdrop-blur-md rounded-full p-8 sm:p-10 transition-all transform hover:scale-110 active:scale-95 shadow-2xl border-4 border-white/30 hover:border-white/50 touch-manipulation"
                  aria-label="Play"
                >
                  <Play className="h-16 w-16 sm:h-24 sm:w-24 text-white" fill="currentColor" />
                </button>
              </div>
            )}

            {/* Professional Bottom Controls Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-sm transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Progress Bar - Mobile-friendly */}
              <div className="px-3 sm:px-6 pt-3 pb-2">
                <div className="relative">
                  <div className="absolute inset-0 h-2 sm:h-1.5 bg-white/20 rounded-full" />
                  <div 
                    className="absolute inset-y-0 left-0 h-2 sm:h-1.5 bg-[#E50914] rounded-full transition-all duration-150"
                    style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={progress}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-2 sm:h-1.5 opacity-0 cursor-pointer z-10 touch-manipulation"
                    style={{ WebkitAppearance: 'none', appearance: 'none' }}
                  />
                </div>
              </div>

              {/* Enhanced Control Buttons - Mobile-friendly with larger touch targets */}
              <div className="px-3 sm:px-6 pb-4 sm:pb-6 flex items-center gap-2 sm:gap-4">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-white active:text-white/80 transition-all p-3 sm:p-3 rounded-full hover:bg-white/25 active:bg-white/30 bg-white/15 backdrop-blur-md border border-white/20 hover:border-white/30 touch-manipulation min-w-[48px] min-h-[48px] flex items-center justify-center"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                  title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" />
                  ) : (
                    <Play className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" />
                  )}
                </button>

                {/* Enhanced Volume Control - Mobile-friendly */}
                <div className="flex items-center gap-2 group">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-white active:text-white/80 transition-all p-3 rounded-full hover:bg-white/25 active:bg-white/30 bg-white/15 backdrop-blur-md border border-white/20 hover:border-white/30 touch-manipulation min-w-[48px] min-h-[48px] flex items-center justify-center"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5 sm:h-6 sm:w-6" />
                    ) : (
                      <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" />
                    )}
                  </button>
                  <div className="w-0 group-hover:w-20 sm:group-hover:w-28 overflow-hidden transition-all duration-300 hidden sm:block">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-20 sm:w-28 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#E50914]"
                      style={{
                        background: `linear-gradient(to right, #E50914 0%, #E50914 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`
                      }}
                    />
                  </div>
                </div>

                {/* Enhanced Time Display - Mobile-friendly */}
                <div className="text-white text-sm sm:text-base font-semibold ml-1 sm:ml-2 font-mono tracking-wide">
                  <span className="text-white">{formatTime(progress)}</span>
                  <span className="text-white/50 mx-1 sm:mx-1.5">/</span>
                  <span className="text-white/70">{formatTime(duration)}</span>
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2 ml-auto">
                  {/* Audio Track Selection - Mobile-friendly */}
                  {audioTracks && audioTracks.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowAudioMenu(!showAudioMenu)}
                        className="text-white hover:text-white active:text-white/80 transition-all p-2 sm:p-2.5 rounded-full hover:bg-white/20 active:bg-white/25 bg-white/10 backdrop-blur-sm relative touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
                        aria-label="Audio Tracks"
                        title={`Audio Tracks (${audioTracks.length} available)`}
                      >
                        <Languages className="h-4 w-4 sm:h-5 sm:w-5" />
                        {audioTracks.length > 1 && (
                          <span className="absolute -top-1 -right-1 bg-[#E50914] text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                            {audioTracks.length}
                          </span>
                        )}
                      </button>
                      {showAudioMenu && (
                        <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg shadow-xl border border-white/20 min-w-[200px] z-50 max-h-[300px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                          <div className="p-2">
                            <div className="text-white text-xs font-semibold mb-2 px-2">Audio Tracks ({audioTracks.length})</div>
                            {audioTracks.map((track, index) => (
                              <button
                                key={index}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setShowAudioMenu(false);
                                  
                                  // CRITICAL: Jellyfin does NOT support live audio switching on an active stream
                                  // We MUST stop playback, destroy the HLS instance, and reload with AudioStreamIndex
                                  const wasPlaying = isPlaying;
                                  const currentTime = videoRef.current?.currentTime || 0;
                                  
                                  console.log('[WatchSeries] Switching audio track - stopping playback and reloading stream:', {
                                    arrayIndex: index,
                                    jellyfinIndex: track.index,
                                    track: track.name,
                                    currentTime,
                                    wasPlaying,
                                  });
                                  
                                  // Step 1: Stop current playback
                                  if (videoRef.current) {
                                    videoRef.current.pause();
                                    videoRef.current.currentTime = 0; // Reset to prevent buffering issues
                                  }
                                  
                                  // Step 2: Destroy existing HLS instance
                                  if (hlsRef.current) {
                                    console.log('[WatchSeries] Destroying existing HLS instance');
                                    hlsRef.current.destroy();
                                    hlsRef.current = null;
                                  }
                                  
                                  // Step 3: Clear video source
                                  if (videoRef.current) {
                                    videoRef.current.src = '';
                                    videoRef.current.load(); // Force reload
                                  }
                                  
                                  // Step 4: Update selected track
                                  setSelectedAudioTrack(index);
                                  
                                  // Step 5: Load new stream URL with AudioStreamIndex
                                  if (selectedEpisode) {
                                    // Clear stream URL first to trigger re-initialization
                                    setStreamUrl(null);
                                    
                                    // Load new stream with audio track parameter
                                    // This will generate a new Jellyfin URL with AudioStreamIndex={track.index}
                                    await loadStreamUrl(selectedEpisode, index, track.mediaSourceId);
                                    
                                    // Step 6: Wait for player to initialize, then restore position and resume
                                    // The useEffect will handle player initialization when streamUrl changes
                                    setTimeout(() => {
                                      if (videoRef.current && videoRef.current.readyState >= 2) {
                                        videoRef.current.currentTime = currentTime;
                                        if (wasPlaying) {
                                          videoRef.current.play().catch((err: any) => {
                                            console.error('[WatchSeries] Failed to resume playback:', err);
                                          });
                                        }
                                        toast.success(`Switched to ${track.name}`);
                                      } else {
                                        // If video not ready, wait a bit more
                                        setTimeout(() => {
                                          if (videoRef.current) {
                                            videoRef.current.currentTime = currentTime;
                                            if (wasPlaying) {
                                              videoRef.current.play().catch((err: any) => {
                                                console.error('[WatchSeries] Failed to resume playback:', err);
                                              });
                                            }
                                            toast.success(`Switched to ${track.name}`);
                                          }
                                        }, 1000);
                                      }
                                    }, 1000);
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
                                        console.warn('[WatchSeries] No language match found, using array index:', hlsTrackIndex);
                                      }
                                      
                                      // Switch audio track WITHOUT pausing or reloading
                                      hlsRef.current.audioTrack = hlsTrackIndex;
                                      setSelectedAudioTrack(index);
                                      
                                      console.log('[WatchSeries] ✅ Switched to audio track seamlessly:', {
                                        backendIndex: index,
                                        hlsIndex: hlsTrackIndex,
                                        track: track.name,
                                        hlsTrack: hlsRef.current.audioTracks[hlsTrackIndex],
                                      });
                                      
                                      toast.success(`Switched to ${track.name}`);
                                    } catch (error) {
                                      console.error('[WatchSeries] Failed to switch audio track:', error);
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
                                        console.log('[WatchSeries] Switched to native audio track:', trackIndex);
                                        toast.success(`Switched to ${track.name}`);
                                      }
                                    } catch (error) {
                                      console.error('[WatchSeries] Failed to switch native audio track:', error);
                                      toast.error('Failed to switch audio track');
                                    }
                                  } else {
                                    // Fallback: reload stream with new audio track
                                    console.log('[WatchSeries] HLS tracks not available, reloading stream with audio track:', index, track);
                                    setSelectedAudioTrack(index);
                                    if (selectedEpisode) {
                                      await loadStreamUrl(selectedEpisode, index, track.mediaSourceId);
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
                                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                  selectedAudioTrack === index
                                    ? 'bg-[#E50914] text-white'
                                    : 'text-white/80 hover:bg-white/10'
                                }`}
                              >
                                <div className="font-medium">{track.name}</div>
                                <div className="text-xs opacity-75">{track.language} • {track.codec}</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {/* Settings Menu */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowSettingsMenu(!showSettingsMenu);
                        setShowAudioMenu(false); // Close audio menu if open
                      }}
                      className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                      aria-label="Settings"
                      title="Settings"
                    >
                      <Settings className="h-5 w-5" />
                    </button>
                    {showSettingsMenu && (
                      <div className="absolute bottom-full right-0 mb-2 bg-black/95 backdrop-blur-md rounded-lg shadow-xl border border-white/20 min-w-[250px] z-50" onClick={(e) => e.stopPropagation()}>
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

                          {/* Video Quality */}
                          {hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 1 && (
                            <div className="mb-4">
                              <div className="text-white text-xs font-semibold mb-2">Quality</div>
                              <div className="space-y-1">
                                {['auto', '1080p', '720p', '480p'].map((quality) => (
                                  <button
                                    key={quality}
                                    onClick={() => handleQualityChange(quality)}
                                    className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                      videoQuality === quality
                                        ? 'bg-[#E50914] text-white'
                                        : 'text-white/80 hover:bg-white/10'
                                    }`}
                                  >
                                    {quality === 'auto' ? 'Auto (Best)' : quality}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* AirPlay Button - Mobile-friendly */}
                  {isAirPlayAvailable && (
                    <button
                      onClick={showAirPlayPicker}
                      className="text-white hover:text-white active:text-white/80 transition-all p-2 sm:p-2.5 rounded-full hover:bg-white/20 active:bg-white/25 bg-white/10 backdrop-blur-sm touch-manipulation min-w-[40px] min-h-[40px] flex items-center justify-center"
                      aria-label="AirPlay"
                      title="AirPlay"
                    >
                      <svg
                        className="h-4 w-4 sm:h-5 sm:w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M5 17C3.89543 17 3 16.2325 3 15.2857V6.71429C3 5.76751 3.89543 5 5 5H19C20.1046 5 21 5.76751 21 6.71429V15.2857C21 16.2325 20.1046 17 19 17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 15L17.1962 21H6.80385L12 15Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  )}
                  
                  {/* Fullscreen Button - Mobile-friendly */}
                  <button
                    onClick={toggleFullscreen}
                    className="text-white hover:text-white active:text-white/80 transition-all p-2 sm:p-3 rounded-full hover:bg-white/25 active:bg-white/30 bg-white/15 backdrop-blur-md border border-white/20 hover:border-white/30 touch-manipulation min-w-[48px] min-h-[48px] flex items-center justify-center"
                    aria-label="Toggle fullscreen"
                    title="Fullscreen (F)"
                  >
                    {document.fullscreenElement || (document as any).webkitFullscreenElement ? (
                      <Minimize2 className="h-5 w-5 sm:h-6 sm:w-6" />
                    ) : (
                      <Maximize className="h-5 w-5 sm:h-6 sm:w-6" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Series Info Below Player - Enhanced layout */}
      {streamUrl && selectedEpisode && (
        <div className="relative z-10 mt-12 px-6 md:px-12 pb-12">
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <div className="flex flex-wrap gap-3 mb-6">
                {series.genres.map((genre) => (
                  <span
                    key={genre}
                    className="px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    {genre}
                  </span>
                ))}
              </div>
              {series.overview && (
                <div className="mt-6">
                  <h2 className="text-2xl font-bold text-white mb-4">About</h2>
                  <p className="text-gray-200 leading-relaxed text-lg max-w-4xl">
                    {series.overview}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
