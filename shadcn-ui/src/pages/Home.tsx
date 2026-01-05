import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { MediaItem, ContinueWatchingItem } from '@/types/media.types';
import { Play, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Header from '@/components/Header';
import { resolveMediaUrl, getPlaceholderImage } from '@/utils/urlSanitizer';

export default function Home() {
  const navigate = useNavigate();
  const [featuredMovies, setFeaturedMovies] = useState<MediaItem[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [trendingSeries, setTrendingSeries] = useState<MediaItem[]>([]);
  const [newMovies, setNewMovies] = useState<MediaItem[]>([]);
  const [newSeries, setNewSeries] = useState<MediaItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem('accessToken');
    const authenticated = !!token;
    setIsAuthenticated(authenticated);
    
    loadContent();
  }, []);

  // Reload content when authentication status changes
  useEffect(() => {
    const handleStorageChange = () => {
      const token = localStorage.getItem('accessToken');
      const authenticated = !!token;
      if (authenticated !== isAuthenticated) {
        setIsAuthenticated(authenticated);
        loadContent();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAuthenticated]);

  // Auto-rotate slider every 4 seconds
  useEffect(() => {
    if (featuredMovies.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlideIndex((prevIndex) => (prevIndex + 1) % featuredMovies.length);
    }, 4000); // 4 seconds

    return () => clearInterval(interval);
  }, [featuredMovies.length]);

  const loadContent = async () => {
    try {
      setLoading(true);
      // Check authentication directly from localStorage
      const token = localStorage.getItem('accessToken');
      const authenticated = !!token;
      
      // Fetch movies without authentication (public endpoint) - use smaller limit for faster loading
      const moviesResponse = await api.get('/media/movies?limit=10');
      const movies = moviesResponse.data.items || [];

      if (movies.length > 0) {
        // Shuffle movies randomly for slider
        const shuffled = [...movies].sort(() => Math.random() - 0.5);
        // Take up to 10 movies for the slider
        const sliderMovies = shuffled.slice(0, Math.min(10, shuffled.length));
        setFeaturedMovies(sliderMovies);
        // Ensure we get exactly 6 items for trending
        const trendingCount = 6;
        // Get slider movie IDs to avoid duplicates
        const sliderIds = new Set(sliderMovies.map(m => m.id));
        // Get movies that aren't in the slider
        const availableMovies = shuffled.filter(m => !sliderIds.has(m.id));
        // Take 6 items from available movies, or 6 from all movies if not enough available
        let trendingItems: MediaItem[] = [];
        if (availableMovies.length >= trendingCount) {
          trendingItems = availableMovies.slice(0, trendingCount);
        } else if (shuffled.length >= trendingCount) {
          // If not enough non-slider movies, just take 6 from all shuffled movies
          trendingItems = shuffled.slice(0, trendingCount);
        } else {
          // If we have less than 6 movies total, take what we have
          trendingItems = shuffled.slice(0, shuffled.length);
        }
        setTrendingMovies(trendingItems);
      }

      // Load additional content only if authenticated
      if (authenticated) {
        try {
          console.log('[Home] Loading additional content for authenticated user');
          
          // Load continue watching
          try {
            const historyResponse = await api.get('/watch-history?limit=6');
            setContinueWatching(historyResponse.data.items || []);
            console.log('[Home] Continue watching loaded:', historyResponse.data.items?.length || 0);
          } catch (historyError) {
            console.log('[Home] Could not load watch history:', historyError);
            setContinueWatching([]);
          }

          // Load series data (reduced limit for faster loading)
          const seriesResponse = await api.get('/media/series?limit=20');
          const series = seriesResponse.data.items || [];
          console.log('[Home] Series loaded:', series.length);

          // Get trending series (shuffle and take 6)
          if (series.length > 0) {
            const shuffledSeries = [...series].sort(() => Math.random() - 0.5);
            const trendingSeriesItems = shuffledSeries.slice(0, 6);
            setTrendingSeries(trendingSeriesItems);
            console.log('[Home] Trending series set:', trendingSeriesItems.length);

            // Get new series (sort by year descending, take 6)
            const sortedByYearSeries = [...series].sort((a, b) => (b.year || 0) - (a.year || 0));
            const newSeriesItems = sortedByYearSeries.slice(0, 6);
            setNewSeries(newSeriesItems);
            console.log('[Home] New series set:', newSeriesItems.length);
          } else {
            console.log('[Home] No series found');
            setTrendingSeries([]);
            setNewSeries([]);
          }

          // Get new movies (sort by year descending, take 6)
          if (movies.length > 0) {
            const sortedByYearMovies = [...movies].sort((a, b) => (b.year || 0) - (a.year || 0));
            const newMoviesItems = sortedByYearMovies.slice(0, 6);
            setNewMovies(newMoviesItems);
            console.log('[Home] New movies set:', newMoviesItems.length);
          } else {
            setNewMovies([]);
          }
        } catch (error) {
          console.error('[Home] Could not load additional content:', error);
        }
      } else {
        console.log('[Home] User not authenticated, skipping additional content');
      }
    } catch (error) {
      console.error('Failed to load content:', error);
      toast.error('Failed to load content. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayClick = (movieId: string) => {
    if (!isAuthenticated) {
      // Store the movie ID to play after login
      localStorage.setItem('redirectAfterLogin', `/watch/${movieId}`);
      navigate('/login');
      toast.info('Please login to watch this movie');
    } else {
      navigate(`/watch/${movieId}`);
    }
  };

  const handleSeriesClick = (seriesId: string) => {
    if (!isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', `/watch-series/${seriesId}`);
      navigate('/login');
      toast.info('Please login to watch this series');
    } else {
      navigate(`/watch-series/${seriesId}`);
    }
  };

  const renderMediaGrid = (items: MediaItem[], onClick: (id: string) => void) => (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={() => onClick(item.id)}
          className="group relative cursor-pointer transition-transform hover:scale-105"
        >
          <img
            src={resolveMediaUrl(item.posterUrl)}
            alt={item.title}
            className="w-full rounded-md"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = getPlaceholderImage();
            }}
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
            <div className="text-center">
              <Play className="h-12 w-12 text-white mx-auto mb-2" fill="currentColor" />
              <p className="text-white text-sm font-semibold">{item.title}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );


  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414]">
        <div className="h-[80vh] w-full">
          <Skeleton className="h-full w-full bg-[#2A2A2A]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      <Header currentPage="home" isTransparent={true} />

      {/* Hero Section - Auto-rotating Slider */}
      {featuredMovies.length > 0 && (
        <div className="relative h-[80vh] w-full overflow-hidden">
          {featuredMovies.map((movie, index) => (
            <div
              key={movie.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentSlideIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-1000"
                style={{
                  backgroundImage: `url(${movie.backdropUrl})`,
                  transform: index === currentSlideIndex ? 'scale(1)' : 'scale(1.1)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent" />
              </div>

              <div className="relative z-10 flex flex-col justify-end h-full px-8 md:px-16 pb-32">
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 max-w-2xl">
                  {movie.title}
                </h1>
                <p className="text-lg text-white/90 mb-6 max-w-xl line-clamp-3">
                  {movie.overview}
                </p>
                <div className="flex gap-4">
                  <Button
                    onClick={() => handlePlayClick(movie.id)}
                    className="bg-white hover:bg-white/80 text-black font-semibold px-8"
                  >
                    <Play className="mr-2 h-5 w-5" fill="currentColor" />
                    {isAuthenticated ? 'Play' : 'Login to Watch'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          
          {/* Slider Indicators */}
          {featuredMovies.length > 1 && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex gap-2">
              {featuredMovies.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlideIndex(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlideIndex
                      ? 'w-8 bg-white'
                      : 'w-2 bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Continue Watching - Only show if authenticated */}
      {isAuthenticated && continueWatching.length > 0 && (
        <div className="px-8 md:px-16 py-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Continue Watching</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {continueWatching.map((item) => (
              <div
                key={item.id}
                onClick={() => handlePlayClick(item.id)}
                className="cursor-pointer"
              >
                <div className="group relative transition-transform hover:scale-105">
                  <img
                    src={resolveMediaUrl(item.posterUrl)}
                    alt={item.title}
                    className="w-full rounded-md"
                  />
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#2A2A2A]">
                    <div className="h-full bg-[#E50914]" style={{ width: `${item.progress || 45}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trending Now - Show for all users */}
      {trendingMovies.length > 0 && (
        <div className="px-8 md:px-16 py-8">
          <h2 className="text-2xl font-semibold text-white mb-4">Trending Now</h2>
          {renderMediaGrid(trendingMovies, handlePlayClick)}
        </div>
      )}

      {/* Additional sections - Only show when authenticated */}
      {isAuthenticated && (
        <>
          {/* Trending Series */}
          {trendingSeries.length > 0 && (
            <div className="px-8 md:px-16 py-8">
              <h2 className="text-2xl font-semibold text-white mb-4">Trending TV Shows</h2>
              {renderMediaGrid(trendingSeries, handleSeriesClick)}
            </div>
          )}

          {/* New Movies */}
          {newMovies.length > 0 && (
            <div className="px-8 md:px-16 py-8">
              <h2 className="text-2xl font-semibold text-white mb-4">New Movies</h2>
              {renderMediaGrid(newMovies, handlePlayClick)}
            </div>
          )}

          {/* New Series */}
          {newSeries.length > 0 && (
            <div className="px-8 md:px-16 py-8">
              <h2 className="text-2xl font-semibold text-white mb-4">New TV Shows</h2>
              {renderMediaGrid(newSeries, handleSeriesClick)}
            </div>
          )}
        </>
      )}

      {/* Call to Action for Non-Authenticated Users */}
      {!isAuthenticated && (
        <div className="px-8 md:px-16 py-16 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Ready to watch? Sign up to start streaming.
            </h2>
            <p className="text-lg text-[#B3B3B3] mb-8">
              Create an account to access unlimited movies and TV shows.
            </p>
            <div className="flex gap-4 justify-center">
              <Link to="/register">
                <Button className="bg-[#E50914] hover:bg-[#F40612] text-white px-8 py-6 text-lg">
                  Get Started
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="border-white text-white hover:bg-white/10 px-8 py-6 text-lg">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}