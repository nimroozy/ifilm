import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MediaItem } from '@/types/media.types';
import { Play, Star, Filter, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { toast } from 'sonner';
import { api } from '@/services/api';
import Header from '@/components/Header';
import { resolveMediaUrl, getPlaceholderImage } from '@/utils/urlSanitizer';

export default function Series() {
  const navigate = useNavigate();
  const [series, setSeries] = useState<MediaItem[]>([]);
  const [filteredSeries, setFilteredSeries] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCorsError, setIsCorsError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortBy, setSortBy] = useState<string>('title');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [genres, setGenres] = useState<string[]>([]);

  useEffect(() => {
    // Check authentication status
    const token = localStorage.getItem('accessToken');
    setIsAuthenticated(!!token);
    
    // Check if user is admin
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setIsAdmin(user.role === 'admin');
    }
    
    // Load series with cache-busting on initial load to ensure fresh data
    loadSeries(true);
  }, []);

  useEffect(() => {
    // Apply filtering and sorting
    let result = [...series];

    // Filter by genre
    if (filterGenre !== 'all') {
      result = result.filter(show => show.genres.includes(filterGenre));
    }

    // Sort
    switch (sortBy) {
      case 'title':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'year':
        result.sort((a, b) => b.year - a.year);
        break;
    }

    setFilteredSeries(result);
  }, [series, sortBy, filterGenre]);

  const loadSeries = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    setIsCorsError(false);

    try {
      // Use backend API instead of direct Jellyfin connection
      // Add timestamp to bypass cache when forceRefresh is true
      const cacheBuster = forceRefresh ? `&_t=${Date.now()}` : '';
      const response = await api.get(`/media/series?limit=50${cacheBuster}`);
      const seriesData = response.data.items || [];
      
      if (seriesData.length > 0) {
        setSeries(seriesData);
        
        // Extract unique genres
        const allGenres = new Set<string>();
        seriesData.forEach((show: MediaItem) => {
          show.genres.forEach(genre => allGenres.add(genre));
        });
        setGenres(Array.from(allGenres).sort());
      } else {
        setError('No TV shows found. Please configure Jellyfin in Admin Panel.');
        toast.info('No TV shows found. Please configure Jellyfin in Admin Panel.');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Failed to load TV shows:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayClick = (seriesId: string) => {
    if (!isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', `/watch-series/${seriesId}`);
      navigate('/login');
      toast.info('Please login to watch this show');
    } else {
      navigate(`/watch-series/${seriesId}`);
    }
  };


  const handleRetry = () => {
    loadSeries();
  };

  return (
    <div className="min-h-screen bg-[#141414]">
      <Header currentPage="series" />

      {/* Main Content */}
      <div className="pt-24 px-8 md:px-16 pb-16">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">TV Shows</h1>
          <p className="text-[#B3B3B3]">Browse our collection of TV series</p>
        </div>

        {/* Filters and Sorting */}
        {!loading && !error && (
          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-[#B3B3B3]" />
              <span className="text-white">Filter & Sort:</span>
            </div>
            
            <Select value={filterGenre} onValueChange={setFilterGenre}>
              <SelectTrigger className="w-48 bg-[#2A2A2A] border-[#3A3A3A] text-white">
                <SelectValue placeholder="All Genres" />
              </SelectTrigger>
              <SelectContent className="bg-[#1F1F1F] border-[#2A2A2A]">
                <SelectItem value="all" className="text-red-500 focus:text-black focus:bg-white data-[highlighted]:text-black data-[highlighted]:bg-white">All Genres</SelectItem>
                {genres.map(genre => (
                  <SelectItem key={genre} value={genre} className="text-red-500 focus:text-black focus:bg-white data-[highlighted]:text-black data-[highlighted]:bg-white">{genre}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48 bg-[#2A2A2A] border-[#3A3A3A] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1F1F1F] border-[#2A2A2A]">
                <SelectItem value="title" className="text-red-500 focus:text-black focus:bg-white data-[highlighted]:text-black data-[highlighted]:bg-white">Sort by Title</SelectItem>
                <SelectItem value="rating" className="text-red-500 focus:text-black focus:bg-white data-[highlighted]:text-black data-[highlighted]:bg-white">Sort by Rating</SelectItem>
                <SelectItem value="year" className="text-red-500 focus:text-black focus:bg-white data-[highlighted]:text-black data-[highlighted]:bg-white">Sort by Year</SelectItem>
              </SelectContent>
            </Select>

            <div className="text-[#B3B3B3] ml-auto">
              {filteredSeries.length} {filteredSeries.length === 1 ? 'show' : 'shows'}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full bg-[#2A2A2A]" />
            ))}
          </div>
        )}

        {/* CORS Error State */}
        {isCorsError && (
          <Alert className="bg-[#1F1F1F] border-yellow-600 mb-6">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <AlertTitle className="text-white text-lg">CORS Configuration Required</AlertTitle>
            <AlertDescription className="text-[#B3B3B3] space-y-3 mt-2">
              <p>{error}</p>
              <div className="space-y-2">
                <p className="font-semibold text-white">Quick Fix:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Open Jellyfin Dashboard</li>
                  <li>Go to <strong>Networking</strong> → <strong>CORS</strong></li>
                  <li>Add this URL: <code className="bg-[#2A2A2A] px-2 py-1 rounded">{window.location.origin}</code></li>
                  <li>Save and restart Jellyfin</li>
                </ol>
              </div>
              <div className="flex gap-3 mt-4">
                <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Connection
                </Button>
                {isAdmin && (
                  <Link to="/admin/jellyfin-settings">
                    <Button variant="outline" className="border-[#3A3A3A] text-white hover:bg-[#2A2A2A]">
                      <Shield className="mr-2 h-4 w-4" />
                      Go to Settings
                    </Button>
                  </Link>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* General Error State */}
        {error && !isCorsError && (
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardContent className="p-12 text-center">
              <p className="text-white text-lg mb-4">{error}</p>
              <div className="flex gap-3 justify-center">
                <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry
                </Button>
                {error.includes('configure') && isAdmin && (
                  <Link to="/admin/jellyfin-settings">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Shield className="mr-2 h-4 w-4" />
                      Configure Jellyfin
                    </Button>
                  </Link>
                )}
              </div>
              {error.includes('configure') && !isAdmin && (
                <p className="text-[#B3B3B3] mt-4">Please contact an administrator to configure the Jellyfin server.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Series Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredSeries.map((show) => (
              <div
                key={show.id}
                className="group relative cursor-pointer transition-transform hover:scale-105"
                onClick={() => handlePlayClick(show.id)}
              >
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md">
                  <img
                    src={resolveMediaUrl(show.posterUrl)}
                    alt={show.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = getPlaceholderImage();
                    }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                    <Play className="h-12 w-12 text-white mb-2" fill="currentColor" />
                    <p className="text-white text-sm font-semibold text-center line-clamp-2">{show.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500" fill="currentColor" />
                        <span className="text-white text-xs">{show.rating.toFixed(1)}</span>
                      </div>
                      <span className="text-white text-xs">{show.year}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-white text-sm font-medium line-clamp-1">{show.title}</p>
                  <p className="text-[#B3B3B3] text-xs">{show.year}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredSeries.length === 0 && (
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardContent className="p-12 text-center">
              <p className="text-white text-lg mb-2">No TV shows found</p>
              <p className="text-[#B3B3B3]">Try adjusting your filters</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}