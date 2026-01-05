import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Settings, Minimize2, Square, Languages, Gauge } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Hls from 'hls.js';
import { resolveMediaUrl } from '@/utils/urlSanitizer';

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

      // Load first season's episodes
      if (seriesData.seasons && seriesData.seasons.length > 0) {
        const firstSeason = seriesData.seasons[0];
        setSelectedSeason(firstSeason.seasonNumber);
        await loadEpisodes(id!, firstSeason.id);
      }
    } catch (err: any) {
      console.error('Failed to load series details:', err);
      setError(err.response?.data?.message || 'Failed to load series');
      toast.error('Failed to load series details');
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodes = async (seriesId: string, seasonId: string) => {
    try {
      setLoadingEpisodes(true);
      // Clear stream URL before loading episodes
      setStreamUrl(null);
      setSelectedEpisode(null);
      
      // Get episodes for the season
      const response = await api.get(`/media/series/${seriesId}/episodes?seasonId=${seasonId}`);
      const episodesData = response.data.episodes || response.data.items || [];
      
      
      setEpisodes(episodesData.map((ep: any) => ({
        id: ep.id,
        name: ep.name || ep.title,
        episodeNumber: ep.episodeNumber || ep.indexNumber || 0,
        overview: ep.overview || '',
        thumbnailUrl: ep.thumbnailUrl || ep.posterUrl,
      })));
      
      
      // DO NOT auto-select or auto-load stream URL
      // User must explicitly click on an episode to play it
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
      
      // If audio track is specified, append it to the stream URL
      let finalStreamUrl = streamUrlValue;
      if (audioTrackIndex !== undefined && audioTrackIndex !== null && tracks.length > 0) {
        const selectedTrack = tracks[audioTrackIndex];
        if (selectedTrack) {
          const url = new URL(streamUrlValue, window.location.origin);
          url.searchParams.set('audioTrack', audioTrackIndex.toString());
          if (selectedTrack.mediaSourceId) {
            url.searchParams.set('mediaSourceId', selectedTrack.mediaSourceId);
          }
          finalStreamUrl = url.pathname + url.search;
          setSelectedAudioTrack(audioTrackIndex);
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

    const video = videoRef.current;

    // Clean up previous HLS instance if it exists
    if (hlsRef.current) {
      console.log('[WatchSeries] Destroying previous HLS instance');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Reset video element
    video.pause();
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
        
        // Set audio track if one is selected
        if (selectedAudioTrack !== null && hls.audioTracks.length > 0) {
          try {
            const trackIndex = Math.min(selectedAudioTrack, hls.audioTracks.length - 1);
            hls.audioTrack = trackIndex;
            console.log('[WatchSeries] Set audio track to index:', trackIndex);
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (error || !series) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">{error || 'Series not found'}</div>
          <button
            onClick={() => navigate('/series')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Back to Series
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Backdrop */}
      {series.backdropUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${series.backdropUrl})` }}
        />
      )}

      {/* Header */}
      <div className="relative z-10 p-4 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white hover:text-gray-300 transition"
        >
          <ArrowLeft className="h-6 w-6" />
          <span>Back</span>
        </button>
        <div className="text-white text-lg font-semibold">{series.title}</div>
        <div className="w-20" /> {/* Spacer */}
      </div>

      {/* Season Selection */}
      {series.seasons && series.seasons.length > 0 && (
        <div className="relative z-10 px-4 mt-6">
          <div className="mb-6">
            <h3 className="text-white text-lg font-semibold mb-3">Seasons</h3>
            <div className="flex gap-2 flex-wrap">
              {series.seasons.map((season) => (
                <button
                  key={season.id}
                  onClick={() => {
                    setSelectedSeason(season.seasonNumber);
                    loadEpisodes(series.id, season.id);
                  }}
                  className={`px-4 py-2 rounded transition-colors ${
                    selectedSeason === season.seasonNumber
                      ? 'bg-red-600 text-white'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {season.name || `Season ${season.seasonNumber}`}
                </button>
              ))}
            </div>
          </div>

          {/* Episode List */}
          {selectedSeason !== null && (
            <div className="relative z-10">
              <h3 className="text-white text-lg font-semibold mb-3">Episodes</h3>
              {loadingEpisodes ? (
                <div className="text-white">Loading episodes...</div>
              ) : episodes.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 relative z-10">
                  {episodes.map((episode) => (
                    <button
                      key={episode.id}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔴🔴🔴 [WatchSeries] Episode button clicked:', episode.id, episode.name);
                        console.log('🔴🔴🔴 [WatchSeries] handleEpisodeSelect function exists:', typeof handleEpisodeSelect);
                        try {
                          handleEpisodeSelect(episode.id);
                        } catch (error) {
                          console.error('🔴🔴🔴 [WatchSeries] ERROR in handleEpisodeSelect:', error);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('🔴 [WatchSeries] Episode button mousedown:', episode.id);
                      }}
                      className={`relative z-20 text-left rounded-lg overflow-hidden transition-transform hover:scale-105 cursor-pointer ${
                        selectedEpisode === episode.id
                          ? 'ring-2 ring-red-600'
                          : ''
                      }`}
                      style={{ pointerEvents: 'auto', position: 'relative', zIndex: 20 }}
                    >
                      {episode.thumbnailUrl && (
                        <img
                          src={resolveMediaUrl(episode.thumbnailUrl)}
                          alt={episode.name}
                          className="w-full aspect-video object-cover"
                        />
                      )}
                      <div className="p-2 bg-[#1F1F1F]">
                        <div className="text-white text-sm font-medium truncate">
                          E{episode.episodeNumber} - {episode.name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-white">No episodes found for this season.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading indicator when stream is being loaded */}
      {selectedEpisode && !streamUrl && loadingStream && (
        <div className="relative z-10 w-full mt-6">
          <div className="relative w-full bg-black flex items-center justify-center" style={{ aspectRatio: '16/9' }}>
            <div className="text-white text-xl">Loading episode...</div>
          </div>
        </div>
      )}

      {/* Error message when stream fails to load */}
      {selectedEpisode && !streamUrl && !loadingStream && error && (
        <div className="relative z-10 w-full mt-6 px-4">
          <div className="bg-red-900/50 border border-red-600 rounded-lg p-4 text-white">
            <div className="font-semibold mb-2">Error loading episode</div>
            <div className="text-sm">{error}</div>
            <button
              onClick={() => {
                setError(null);
                if (selectedEpisode) {
                  loadStreamUrl(selectedEpisode);
                }
              }}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Video Player - Only show if we have a stream URL and selected episode */}
      {streamUrl && selectedEpisode && (
        <div
          className={`relative z-10 mt-6 transition-all duration-300 ${
            playerSize === 'small' 
              ? 'w-full max-w-4xl mx-auto' 
              : playerSize === 'medium'
              ? 'w-full max-w-7xl mx-auto'
              : 'w-full'
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

            {/* Loading Overlay */}
            {loading && (
              <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                <div className="text-white text-xl">Loading video...</div>
              </div>
            )}

            {/* Play/Pause Button Overlay */}
            {showControls && !isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <button
                  onClick={togglePlay}
                  className="bg-white/20 hover:bg-white/30 rounded-full p-6 transition-all transform hover:scale-110"
                >
                  <Play className="h-16 w-16 text-white" fill="currentColor" />
                </button>
              </div>
            )}

            {/* Bottom Controls Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0'
              }`}
            >
              {/* Progress Bar */}
              <div className="px-4 pt-2">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={progress}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600 hover:accent-red-500 transition-colors"
                  style={{
                    background: `linear-gradient(to right, #E50914 0%, #E50914 ${(progress / (duration || 1)) * 100}%, #4B5563 ${(progress / (duration || 1)) * 100}%, #4B5563 100%)`
                  }}
                />
              </div>

              {/* Control Buttons */}
              <div className="px-4 pb-4 flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" fill="currentColor" />
                  ) : (
                    <Play className="h-6 w-6" fill="currentColor" />
                  )}
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-600"
                  />
                </div>

                {/* Time Display */}
                <div className="text-white text-sm font-mono ml-2">
                  {formatTime(progress)} / {formatTime(duration)}
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2 ml-auto">
                  {/* Audio Track Selection */}
                  {audioTracks && audioTracks.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowAudioMenu(!showAudioMenu)}
                        className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                        aria-label="Audio Tracks"
                        title={`Audio Tracks (${audioTracks.length} available)`}
                      >
                        <Languages className="h-5 w-5" />
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
                                onClick={() => {
                                  setSelectedAudioTrack(index);
                                  setShowAudioMenu(false);
                                  // Reload stream with new audio track
                                  if (selectedEpisode) {
                                    loadStreamUrl(selectedEpisode, index, track.mediaSourceId);
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
                  <button
                    onClick={showAirPlayPicker}
                    className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
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
                      {/* AirPlay Icon: TV/Monitor with triangle signal */}
                      <path d="M5 17C3.89543 17 3 16.2325 3 15.2857V6.71429C3 5.76751 3.89543 5 5 5H19C20.1046 5 21 5.76751 21 6.71429V15.2857C21 16.2325 20.1046 17 19 17" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M12 15L17.1962 21H6.80385L12 15Z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    onClick={togglePlayerSize}
                    className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                    aria-label="Toggle player size"
                    title={
                      playerSize === 'small' 
                        ? 'Medium' 
                        : playerSize === 'medium' 
                        ? 'Fullscreen' 
                        : 'Small'
                    }
                  >
                    {playerSize === 'small' ? (
                      <Square className="h-5 w-5" />
                    ) : playerSize === 'medium' ? (
                      <Maximize className="h-5 w-5" />
                    ) : (
                      <Minimize2 className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Series Info */}
      <div className="mt-6 px-4 text-white">
        <h1 className="text-3xl font-bold mb-2">{series.title}</h1>
        <div className="flex items-center gap-4 mb-4">
          <span>{series.year}</span>
          <span>•</span>
          <span>⭐ {series.rating.toFixed(1)}</span>
        </div>
        <div className="flex gap-2 mb-4">
          {series.genres.map((genre) => (
            <span
              key={genre}
              className="px-2 py-1 bg-white/20 rounded text-sm"
            >
              {genre}
            </span>
          ))}
        </div>
        {series.overview && (
          <p className="text-gray-300 max-w-3xl">{series.overview}</p>
        )}
      </div>
    </div>
  );
}
