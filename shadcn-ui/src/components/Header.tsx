import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, User as UserIcon, LogOut, Shield, X, Film, Tv, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { User } from '@/types/auth.types';
import { MediaItem } from '@/types/media.types';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface HeaderProps {
  currentPage?: 'home' | 'movies' | 'series';
  isTransparent?: boolean;
}

export default function Header({ currentPage, isTransparent = false }: HeaderProps) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    setIsAuthenticated(!!token);
    
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user: User = JSON.parse(userStr);
      setIsAdmin(user.role === 'admin');
    }
  }, []);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Debounced search for suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await api.get(`/media/search?q=${encodeURIComponent(query)}&limit=5`);
      const items = response.data.items || [];
      setSuggestions(items.slice(0, 5)); // Limit to 5 suggestions
      setShowSuggestions(items.length > 0);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(searchQuery);
      }, 300); // 300ms debounce
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, fetchSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSuggestions]);

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    toast.success('Logged out successfully');
    setIsAuthenticated(false);
    setIsAdmin(false);
    window.location.reload();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setShowSearch(false);
      setSearchQuery('');
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (item: MediaItem) => {
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
    setShowSearch(false);
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (e.target.value.trim().length >= 2) {
      setShowSuggestions(true);
    }
  };

  const handleSearchClick = () => {
    setShowSearch(true);
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
  };

  const headerBgClass = isTransparent 
    ? 'bg-gradient-to-b from-[#141414] to-transparent' 
    : 'bg-[#141414] border-b border-[#2A2A2A]';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 ${headerBgClass}`}>
      <div className="flex items-center justify-between px-4 md:px-8 lg:px-16 py-4">
        <div className="flex items-center gap-4 md:gap-8 flex-1">
          <div className="flex items-center gap-2">
            <Link to="/" onClick={() => setShowMobileMenu(false)}>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-[#E50914] cursor-pointer">iFilm</h1>
            </Link>
          </div>
          {/* Desktop Navigation */}
          <nav className="hidden md:flex gap-6">
            <Link 
              to="/" 
              className={currentPage === 'home' ? 'text-white font-semibold transition' : 'text-[#B3B3B3] hover:text-white transition'}
            >
              Home
            </Link>
            <Link 
              to="/movies" 
              className={currentPage === 'movies' ? 'text-white font-semibold transition' : 'text-[#B3B3B3] hover:text-white transition'}
            >
              Movies
            </Link>
            <Link 
              to="/series" 
              className={currentPage === 'series' ? 'text-white font-semibold transition' : 'text-[#B3B3B3] hover:text-white transition'}
            >
              TV Shows
            </Link>
          </nav>
          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden text-white hover:text-[#B3B3B3]"
            aria-label="Toggle menu"
          >
            {showMobileMenu ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          {showSearch ? (
            <div ref={searchContainerRef} className="relative">
              <form onSubmit={handleSearch} className="flex items-center gap-2">
                <div className="relative">
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search movies and TV shows..."
                    value={searchQuery}
                    onChange={handleInputChange}
                    className="w-64 bg-[#2A2A2A] border-[#3A3A3A] text-white placeholder:text-[#B3B3B3] focus:border-[#E50914]"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        handleCloseSearch();
                      } else if (e.key === 'ArrowDown' && suggestions.length > 0) {
                        e.preventDefault();
                        const firstSuggestion = document.querySelector('[data-suggestion-index="0"]') as HTMLElement;
                        firstSuggestion?.focus();
                      }
                    }}
                    onFocus={() => {
                      if (suggestions.length > 0) {
                        setShowSuggestions(true);
                      }
                    }}
                  />
                  {/* Suggestions Dropdown */}
                  {showSuggestions && (suggestions.length > 0 || loadingSuggestions) && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1F1F1F] border border-[#2A2A2A] rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
                      {loadingSuggestions ? (
                        <div className="p-4 text-center text-[#B3B3B3]">
                          <div className="animate-pulse">Searching...</div>
                        </div>
                      ) : suggestions.length > 0 ? (
                        <>
                          {suggestions.map((item, index) => (
                            <button
                              key={item.id}
                              type="button"
                              data-suggestion-index={index}
                              onClick={() => handleSuggestionClick(item)}
                              className="w-full flex items-center gap-3 p-3 hover:bg-[#2A2A2A] transition-colors text-left focus:bg-[#2A2A2A] focus:outline-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSuggestionClick(item);
                                } else if (e.key === 'ArrowDown') {
                                  e.preventDefault();
                                  const next = document.querySelector(`[data-suggestion-index="${index + 1}"]`) as HTMLElement;
                                  next?.focus();
                                } else if (e.key === 'ArrowUp') {
                                  e.preventDefault();
                                  if (index === 0) {
                                    searchInputRef.current?.focus();
                                  } else {
                                    const prev = document.querySelector(`[data-suggestion-index="${index - 1}"]`) as HTMLElement;
                                    prev?.focus();
                                  }
                                }
                              }}
                            >
                              <div className="flex-shrink-0">
                                {item.type === 'movie' ? (
                                  <Film className="h-5 w-5 text-[#E50914]" />
                                ) : (
                                  <Tv className="h-5 w-5 text-[#E50914]" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-white font-medium truncate">{item.title}</div>
                                <div className="text-[#B3B3B3] text-sm">
                                  {item.type === 'movie' ? 'Movie' : 'TV Show'} {item.year > 0 ? `• ${item.year}` : ''}
                                </div>
                              </div>
                            </button>
                          ))}
                          <div className="border-t border-[#2A2A2A] p-2">
                            <button
                              type="button"
                              onClick={handleSearch}
                              className="w-full text-left text-[#E50914] hover:text-[#F40612] text-sm font-medium px-2 py-1"
                            >
                              View all results for "{searchQuery}"
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#E50914] hover:bg-[#F40612] text-white"
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseSearch}
                  className="text-white hover:text-[#B3B3B3]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </form>
            </div>
          ) : (
            <Button
              variant="ghost"
              onClick={handleSearchClick}
              className="text-white hover:text-[#B3B3B3]"
            >
              <Search className="h-5 w-5" />
            </Button>
          )}

          {/* User Menu */}
          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:text-[#B3B3B3]">
                  <UserIcon className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1F1F1F] border-[#2A2A2A] text-white">
                <DropdownMenuLabel>
                  My Account
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#2A2A2A]" />
                <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer hover:bg-[#2A2A2A]">
                  <UserIcon className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator className="bg-[#2A2A2A]" />
                    <DropdownMenuItem onClick={() => navigate('/admin/dashboard')} className="cursor-pointer hover:bg-[#2A2A2A]">
                      <Shield className="mr-2 h-4 w-4 text-blue-600" />
                      <span className="text-blue-600 font-semibold">Admin Panel</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-[#2A2A2A]" />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer hover:bg-[#2A2A2A]">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" className="text-white hover:text-[#B3B3B3]">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button className="bg-[#E50914] hover:bg-[#F40612] text-white">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
      
      {/* Mobile Menu */}
      {showMobileMenu && (
        <div className="md:hidden border-t border-[#2A2A2A] bg-[#141414]">
          <nav className="flex flex-col px-4 py-4 gap-4">
            <Link 
              to="/" 
              onClick={() => setShowMobileMenu(false)}
              className={`px-4 py-2 rounded-md transition ${
                currentPage === 'home' 
                  ? 'text-white font-semibold bg-[#2A2A2A]' 
                  : 'text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A]'
              }`}
            >
              Home
            </Link>
            <Link 
              to="/movies" 
              onClick={() => setShowMobileMenu(false)}
              className={`px-4 py-2 rounded-md transition ${
                currentPage === 'movies' 
                  ? 'text-white font-semibold bg-[#2A2A2A]' 
                  : 'text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A]'
              }`}
            >
              Movies
            </Link>
            <Link 
              to="/series" 
              onClick={() => setShowMobileMenu(false)}
              className={`px-4 py-2 rounded-md transition ${
                currentPage === 'series' 
                  ? 'text-white font-semibold bg-[#2A2A2A]' 
                  : 'text-[#B3B3B3] hover:text-white hover:bg-[#2A2A2A]'
              }`}
            >
              TV Shows
            </Link>
            {!isAuthenticated && (
              <>
                <div className="border-t border-[#2A2A2A] my-2"></div>
                <Link 
                  to="/login" 
                  onClick={() => setShowMobileMenu(false)}
                  className="px-4 py-2 text-white hover:bg-[#2A2A2A] rounded-md transition"
                >
                  Sign In
                </Link>
                <Link 
                  to="/register" 
                  onClick={() => setShowMobileMenu(false)}
                  className="px-4 py-2 bg-[#E50914] hover:bg-[#F40612] text-white rounded-md transition text-center font-semibold"
                >
                  Sign Up
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

