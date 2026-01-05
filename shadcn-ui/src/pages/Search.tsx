import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MediaItem } from '@/types/media.types';
import { Play, Star, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { api } from '@/services/api';
import Header from '@/components/Header';
import { resolveMediaUrl, getPlaceholderImage } from '@/utils/urlSanitizer';

export default function Search() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query) {
      performSearch(query);
    } else {
      setResults([]);
    }
  }, [query]);

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.get(`/media/search?q=${encodeURIComponent(searchQuery)}`);
      const items = response.data.items || [];
      setResults(items);
      
      if (items.length === 0) {
        toast.info('No results found');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Search failed';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayClick = (item: MediaItem) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      localStorage.setItem('redirectAfterLogin', item.type === 'movie' ? `/watch/${item.id}` : `/watch-series/${item.id}`);
      navigate('/login');
      toast.info('Please login to watch');
    } else {
      if (item.type === 'movie') {
        navigate(`/watch/${item.id}`);
      } else {
        navigate(`/watch-series/${item.id}`);
      }
    }
  };

  const movies = results.filter(item => item.type === 'movie');
  const series = results.filter(item => item.type === 'series');

  return (
    <div className="min-h-screen bg-[#141414]">
      <Header />
      
      <div className="pt-24 px-8 md:px-16 pb-16">
        {/* Search Header */}
        <div className="mb-8">
          {query ? (
            <>
              <h1 className="text-4xl font-bold text-white mb-2">
                Search Results for "{query}"
              </h1>
              <p className="text-[#B3B3B3]">
                Found {results.length} {results.length === 1 ? 'result' : 'results'}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-4xl font-bold text-white mb-2">Search</h1>
              <p className="text-[#B3B3B3]">Search for movies and TV shows</p>
            </>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-[2/3] w-full bg-[#2A2A2A]" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardContent className="p-12 text-center">
              <p className="text-white text-lg mb-4">{error}</p>
              <Button onClick={() => performSearch(query)} className="bg-blue-600 hover:bg-blue-700">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {!loading && !error && query && results.length === 0 && (
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardContent className="p-12 text-center">
              <SearchIcon className="h-16 w-16 text-[#B3B3B3] mx-auto mb-4" />
              <p className="text-white text-lg mb-2">No results found</p>
              <p className="text-[#B3B3B3]">Try searching with different keywords</p>
            </CardContent>
          </Card>
        )}

        {/* No Query */}
        {!query && !loading && (
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardContent className="p-12 text-center">
              <SearchIcon className="h-16 w-16 text-[#B3B3B3] mx-auto mb-4" />
              <p className="text-white text-lg mb-2">Start searching</p>
              <p className="text-[#B3B3B3]">Use the search bar in the header to find movies and TV shows</p>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {!loading && !error && results.length > 0 && (
          <>
            {/* Movies */}
            {movies.length > 0 && (
              <div className="mb-12">
                <h2 className="text-2xl font-semibold text-white mb-4">Movies ({movies.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {movies.map((movie) => (
                    <div
                      key={movie.id}
                      className="group relative cursor-pointer transition-transform hover:scale-105"
                      onClick={() => handlePlayClick(movie)}
                    >
                      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md">
                        <img
                          src={resolveMediaUrl(movie.posterUrl)}
                          alt={movie.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = getPlaceholderImage();
                          }}
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4">
                          <Play className="h-12 w-12 text-white mb-2" fill="currentColor" />
                          <p className="text-white text-sm font-semibold text-center line-clamp-2">{movie.title}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500" fill="currentColor" />
                              <span className="text-white text-xs">{movie.rating.toFixed(1)}</span>
                            </div>
                            <span className="text-white text-xs">{movie.year}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-white text-sm font-medium line-clamp-1">{movie.title}</p>
                        <p className="text-[#B3B3B3] text-xs">{movie.year}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TV Shows */}
            {series.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold text-white mb-4">TV Shows ({series.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {series.map((show) => (
                    <div
                      key={show.id}
                      className="group relative cursor-pointer transition-transform hover:scale-105"
                      onClick={() => handlePlayClick(show)}
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

