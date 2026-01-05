import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Settings, Minimize2, Square, Loader2, X, Languages, Gauge } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Hls from 'hls.js';
import { resolveMediaUrl, getPlaceholderImage } from '@/utils/urlSanitizer';

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

  useEffect(() => {
    if (!id) {
      setError('Invalid media ID');
      setLoading(false);
      return;
    }

    // Clear any existing stream URL on mount
    setStreamUrl(null);
    
    loadMediaDetails();
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
      
      
      console.log('[Watch] Backend returned stream URL:', finalStreamUrl);
      console.log('[Watch] Audio tracks available:', tracks.length);
      console.log('[Watch] Audio tracks data:', tracks);
      
      // Double-check we're not redirecting before setting stream URL
      if (!redirectingRef.current) {
        setStreamUrl(finalStreamUrl);
      }
    } catch (err: any) {
      console.error('[Watch] Failed to load stream URL:', err);
      if (!redirectingRef.current) {
        setError(err.response?.data?.message || 'Failed to load stream URL');
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

    const video = videoRef.current;

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
        console.log('[Watch] Available quality levels:', hls.levels?.length || 0);
        
        // Set audio track if one is selected
        if (selectedAudioTrack !== null && hls.audioTracks.length > 0) {
          try {
            const trackIndex = Math.min(selectedAudioTrack, hls.audioTracks.length - 1);
            hls.audioTrack = trackIndex;
            console.log('[Watch] Set audio track to index:', trackIndex);
          } catch (error) {
            console.warn('[Watch] Failed to set audio track:', error);
          }
        }
        
        // Set playback speed
        if (videoRef.current) {
          videoRef.current.playbackRate = playbackSpeed;
        }
      });
      
      // Listen for audio track changes
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        console.log('[Watch] Audio tracks updated:', hls.audioTracks.length);
        if (selectedAudioTrack !== null && hls.audioTracks.length > 0) {
          try {
            const trackIndex = Math.min(selectedAudioTrack, hls.audioTracks.length - 1);
            hls.audioTrack = trackIndex;
            console.log('[Watch] Set audio track to index:', trackIndex);
          } catch (error) {
            console.warn('[Watch] Failed to set audio track:', error);
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
    // This is mainly for UI feedback
    if (hlsRef.current && hlsRef.current.levels && hlsRef.current.levels.length > 0) {
      // Find the level that matches the requested quality
      const levels = hlsRef.current.levels;
      let targetLevel = -1;
      
      if (quality === '1080p') {
        targetLevel = levels.findIndex((level: any) => level.height === 1080) || levels.length - 1;
      } else if (quality === '720p') {
        targetLevel = levels.findIndex((level: any) => level.height === 720) || Math.floor(levels.length / 2);
      } else if (quality === '480p') {
        targetLevel = levels.findIndex((level: any) => level.height === 480) || 0;
      } else {
        // Auto - let HLS.js decide
        targetLevel = -1;
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
    <div className="min-h-screen bg-[#141414] relative overflow-hidden">
      {/* Backdrop with blur effect */}
      {media.backdropUrl && (
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${media.backdropUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#141414]/95 via-[#141414]/80 to-[#141414] backdrop-blur-sm" />
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

      {/* Video Player - Only show if we have a stream URL */}
      {streamUrl && (
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

            {/* Professional Play/Pause Button Overlay */}
            {showControls && !isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10">
                <button
                  onClick={togglePlay}
                  className="bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full p-8 transition-all transform hover:scale-110 border-2 border-white/20 hover:border-white/40"
                  aria-label="Play"
                >
                  <Play className="h-20 w-20 text-white" fill="currentColor" />
                </button>
              </div>
            )}

            {/* Professional Bottom Controls Bar */}
            <div
              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent backdrop-blur-sm transition-opacity duration-300 ${
                showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            >
              {/* Progress Bar */}
              <div className="px-6 pt-3 pb-2">
                <div className="relative">
                  <div className="absolute inset-0 h-1 bg-white/20 rounded-full" />
                  <div 
                    className="absolute inset-y-0 left-0 h-1 bg-[#E50914] rounded-full transition-all duration-150"
                    style={{ width: `${(progress / (duration || 1)) * 100}%` }}
                  />
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={progress}
                    onChange={handleSeek}
                    className="absolute inset-0 w-full h-1 opacity-0 cursor-pointer z-10"
                  />
                </div>
              </div>

              {/* Control Buttons */}
              <div className="px-6 pb-6 flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="text-white hover:text-white transition-all p-2.5 rounded-full hover:bg-white/20 bg-white/10 backdrop-blur-sm"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="h-6 w-6" fill="currentColor" />
                  ) : (
                    <Play className="h-6 w-6" fill="currentColor" />
                  )}
                </button>

                {/* Volume Control */}
                <div className="flex items-center gap-2 group">
                  <button
                    onClick={toggleMute}
                    className="text-white hover:text-white transition-all p-2.5 rounded-full hover:bg-white/20 bg-white/10 backdrop-blur-sm"
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-5 w-5" />
                    ) : (
                      <Volume2 className="h-5 w-5" />
                    )}
                  </button>
                  <div className="w-0 group-hover:w-24 overflow-hidden transition-all duration-300">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      className="w-24 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#E50914]"
                      style={{
                        background: `linear-gradient(to right, #E50914 0%, #E50914 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`
                      }}
                    />
                  </div>
                </div>

                {/* Time Display */}
                <div className="text-white text-sm font-medium ml-2 font-mono tracking-wide">
                  <span className="text-white">{formatTime(progress)}</span>
                  <span className="text-white/60 mx-1">/</span>
                  <span className="text-white/60">{formatTime(duration)}</span>
                </div>

                {/* Right Side Controls */}
                <div className="flex items-center gap-2 ml-auto">
                  {/* Audio Track Selection */}
                  {audioTracks && audioTracks.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowAudioMenu(!showAudioMenu)}
                        className="text-white hover:text-white transition-all p-2.5 rounded-full hover:bg-white/20 bg-white/10 backdrop-blur-sm"
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
                                  if (media?.id) {
                                    loadStreamUrl(media.id, index, track.mediaSourceId);
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
                      className="text-white hover:text-white transition-all p-2.5 rounded-full hover:bg-white/20 bg-white/10 backdrop-blur-sm"
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
                    onClick={togglePlayerSize}
                    className="text-white hover:text-white transition-all p-2.5 rounded-full hover:bg-white/20 bg-white/10 backdrop-blur-sm"
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

      {/* Media Info Below Player */}
      <div className="relative z-10 mt-8 px-6 md:px-12 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
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
            <div className="flex flex-wrap gap-2 mb-4">
              {media.genres.map((genre) => (
                <span
                  key={genre}
                  className="px-3 py-1.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm font-medium text-white hover:bg-white/20 transition-colors"
                >
                  {genre}
                </span>
              ))}
            </div>
            {media.overview && (
              <div className="mt-4">
                <h2 className="text-xl font-semibold text-white mb-3">About</h2>
                <p className="text-gray-300 leading-relaxed text-base max-w-3xl">
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
