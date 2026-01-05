import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Settings } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import Hls from 'hls.js';

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
  
  // Series-specific state
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<string | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

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
    if (!streamUrl || !videoRef.current || !selectedEpisode) {
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
    
    initializePlayer();

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, selectedEpisode, loadingEpisodes]);

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

  const loadStreamUrl = async (episodeId: string) => {
    try {
      // Get stream URL from backend
      const endpoint = `/media/movies/${episodeId}/stream`;
      
      const response = await api.get(endpoint);
      const streamUrlValue = response.data.streamUrl;
      
      // Extract ID from stream URL to verify
      const streamUrlIdMatch = streamUrlValue.match(/\/stream\/([^\/]+)/);
      const streamUrlId = streamUrlIdMatch ? streamUrlIdMatch[1] : null;
      
      // Verify the stream URL contains the episode ID
      if (streamUrlId !== episodeId) {
        console.error('[WatchSeries] Stream URL ID does not match episode ID!');
        setStreamUrl(null);
        setError('Invalid stream URL. Please select an episode again.');
        return;
      }
      
      setStreamUrl(streamUrlValue);
    } catch (err: any) {
      console.error('[WatchSeries] Failed to load stream URL:', err);
      setError(err.response?.data?.message || 'Failed to load stream URL');
      setStreamUrl(null);
    }
  };

  const handleEpisodeSelect = async (episodeId: string) => {
    console.log('[WatchSeries] User clicked on episode:', episodeId);
    
    // Set selected episode
    setSelectedEpisode(episodeId);
    
    // Clear existing stream URL before loading new one
    setStreamUrl(null);
    
    // Small delay to ensure state is updated
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Load stream URL for the selected episode
    await loadStreamUrl(episodeId);
  };

  const initializePlayer = () => {
    if (!videoRef.current || !streamUrl) {
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

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, ready to play');
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
      video.src = streamUrl;
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
      } else {
        document.exitFullscreen();
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
        <div className="px-4 mt-6">
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
            <div>
              <h3 className="text-white text-lg font-semibold mb-3">Episodes</h3>
              {loadingEpisodes ? (
                <div className="text-white">Loading episodes...</div>
              ) : episodes.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {episodes.map((episode) => (
                    <button
                      key={episode.id}
                      onClick={() => handleEpisodeSelect(episode.id)}
                      className={`text-left rounded-lg overflow-hidden transition-transform hover:scale-105 ${
                        selectedEpisode === episode.id
                          ? 'ring-2 ring-red-600'
                          : ''
                      }`}
                    >
                      {episode.thumbnailUrl && (
                        <img
                          src={episode.thumbnailUrl}
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

      {/* Video Player - Only show if we have a stream URL and selected episode */}
      {streamUrl && selectedEpisode && (
        <div
          className="relative z-10 w-full mt-6"
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
                  <button
                    className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                    aria-label="Settings"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="text-white hover:text-gray-300 transition-colors p-2 rounded-full hover:bg-white/10"
                    aria-label="Fullscreen"
                  >
                    <Maximize className="h-5 w-5" />
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

