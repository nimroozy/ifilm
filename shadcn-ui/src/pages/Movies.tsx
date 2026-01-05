import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MediaItem } from '@/types/media.types';
import { Play, Star, Filter, RefreshCw, AlertTriangle, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { toast } from 'sonner';
import { api } from '@/services/api';
import Header from '@/components/Header';
import { resolveMediaUrl, getPlaceholderImage } from '@/utils/urlSanitizer';

export default function Movies() {
  const navigate = useNavigate();
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [filteredMovies, setFilteredMovies] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCorsError, setIsCorsError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sortBy, setSortBy] = useState<string>('title');
  const [filterGenre, setFilterGenre] = useState<string>('all');
  const [genres, setGenres] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMovies, setTotalMovies] = useState(0);
  const itemsPerPage = 20;

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
    
    loadMovies();
  }, [currentPage]);

  useEffect(() => {
    // Apply filtering and sorting to current page movies
    let result = [...movies];

    // Filter by genre
    if (filterGenre !== 'all') {
      result = result.filter(movie => movie.genres.includes(filterGenre));
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

    setFilteredMovies(result);
  }, [movies, sortBy, filterGenre]);

  // Reset to page 1 when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filterGenre, sortBy]);

  const loadMovies = async () => {
    setLoading(true);
    setError(null);
    setIsCorsError(false);

    try {
      // Use backend API with pagination
      const response = await api.get(`/media/movies?page=${currentPage}&limit=${itemsPerPage}`);
      const moviesData = response.data.items || [];
      const total = response.data.total || 0;
      const pages = response.data.pages || 1;
      
      if (moviesData.length > 0) {
        setMovies(moviesData);
        setTotalMovies(total);
        setTotalPages(pages);
        
        // Extract unique genres from all movies (we'll need to load all genres separately or accumulate)
        // For now, extract from current page
        const allGenres = new Set<string>();
        moviesData.forEach((movie: MediaItem) => {
          movie.genres.forEach(genre => allGenres.add(genre));
        });
        setGenres(prevGenres => {
          const combined = new Set([...prevGenres, ...allGenres]);
          return Array.from(combined).sort();
        });
      } else {
        setError('No movies found. Please configure Jellyfin in Admin Panel.');
        toast.info('No movies found. Please configure Jellyfin in Admin Panel.');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Failed to load movies:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlayClick = (movieId: string) => {
    if (!isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', `/watch/${movieId}`);
      navigate('/login');
      toast.info('Please login to watch this movie');
    } else {
      navigate(`/watch/${movieId}`);
    }
  };


  const handleRetry = () => {
    loadMovies();
  };

  return (
    <div className="min-h-screen bg-[#141414]">
      <Header currentPage="movies" />

      {/* Main Content */}
      <div className="pt-24 px-8 md:px-16 pb-16">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Movies</h1>
          <p className="text-[#B3B3B3]">Browse our collection of movies</p>
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
              Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalMovies)} of {totalMovies} movies
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

        {/* Movies Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredMovies.map((movie) => (
              <div
                key={movie.id}
                className="group relative cursor-pointer transition-transform hover:scale-105"
                onClick={() => handlePlayClick(movie.id)}
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
        )}

        {/* Empty State */}
        {!loading && !error && filteredMovies.length === 0 && (
          <Card className="bg-[#1F1F1F] border-[#2A2A2A]">
            <CardContent className="p-12 text-center">
              <p className="text-white text-lg mb-2">No movies found</p>
              <p className="text-[#B3B3B3]">Try adjusting your filters</p>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="mt-12 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer text-white hover:bg-[#2A2A2A]'}
                  />
                </PaginationItem>
                
                {/* Page Numbers */}
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setCurrentPage(pageNum)}
                        isActive={currentPage === pageNum}
                        className={`cursor-pointer ${
                          currentPage === pageNum
                            ? 'bg-[#E50914] text-white hover:bg-[#E50914]'
                            : 'text-white hover:bg-[#2A2A2A]'
                        }`}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                
                {totalPages > 7 && currentPage < totalPages - 3 && (
                  <PaginationItem>
                    <PaginationEllipsis className="text-white" />
                  </PaginationItem>
                )}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer text-white hover:bg-[#2A2A2A]'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </div>
  );
}