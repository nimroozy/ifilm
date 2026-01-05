import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { MediaItem, ContinueWatchingItem } from '@/types/media.types';
import { Play, Plus, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import Header from '@/components/Header';

export default function Home() {
  const navigate = useNavigate();
  const [featuredMovie, setFeaturedMovie] = useState<MediaItem | null>(null);
  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem('accessToken');
    setIsAuthenticated(!!token);
    
    loadContent();
  }, []);

  const loadContent = async () => {
    try {
      // Fetch movies without authentication (public endpoint)
      const moviesResponse = await api.get('/media/movies?limit=20');
      const movies = moviesResponse.data.items || [];

      if (movies.length > 0) {
        setFeaturedMovie(movies[0]);
        setTrendingMovies(movies.slice(1, 7));
      }

      // Load continue watching only if authenticated
      if (isAuthenticated) {
        try {
          const historyResponse = await api.get('/user/watch-history?limit=6');
          setContinueWatching(historyResponse.data.items || []);
        } catch (error) {
          console.log('Could not load watch history (user not authenticated)');
        }
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

      {/* Hero Section */}
      {featuredMovie && (
        <div className="relative h-[80vh] w-full">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${featuredMovie.backdropUrl})`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/60 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col justify-end h-full px-8 md:px-16 pb-32">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 max-w-2xl">
              {featuredMovie.title}
            </h1>
            <p className="text-lg text-white/90 mb-6 max-w-xl line-clamp-3">
              {featuredMovie.overview}
            </p>
            <div className="flex gap-4">
              <Button
                onClick={() => handlePlayClick(featuredMovie.id)}
                className="bg-white hover:bg-white/80 text-black font-semibold px-8"
              >
                <Play className="mr-2 h-5 w-5" fill="currentColor" />
                {isAuthenticated ? 'Play' : 'Login to Watch'}
              </Button>
              <Link to={`/details/${featuredMovie.id}`}>
                <Button variant="secondary" className="bg-[#6D6D6E]/70 hover:bg-[#6D6D6E]/50 text-white font-semibold px-8">
                  <Info className="mr-2 h-5 w-5" />
                  More Info
                </Button>
              </Link>
            </div>
          </div>
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
                    src={item.posterUrl}
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

      {/* Trending Now */}
      <div className="px-8 md:px-16 py-8">
        <h2 className="text-2xl font-semibold text-white mb-4">Trending Now</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {trendingMovies.map((item) => (
            <Link key={item.id} to={`/details/${item.id}`}>
              <div className="group relative cursor-pointer transition-transform hover:scale-105">
                <img
                  src={item.posterUrl}
                  alt={item.title}
                  className="w-full rounded-md"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md">
                  <div className="text-center">
                    <Play className="h-12 w-12 text-white mx-auto mb-2" fill="currentColor" />
                    <p className="text-white text-sm font-semibold">{item.title}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

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