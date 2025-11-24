import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, FileText, Users, Calendar } from 'lucide-react';
import { Input } from './input';
import { Button } from './button';
import { useRouter } from 'next/router';

const SearchInput = ({ placeholder = "Search...", className = '' }) => {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const inputRef = useRef(null);
  const searchRef = useRef(null);

  // Mock search function - replace with actual API call
  const performSearch = async (searchQuery) => {
    if (!searchQuery.trim()) return [];
    
    setLoading(true);
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock results based on query
    const mockResults = [
      {
        id: 1,
        type: 'candidate',
        title: 'John Doe',
        subtitle: 'Software Engineer',
        href: '/recruiter/candidates/1',
        icon: Users
      },
      {
        id: 2,
        type: 'application',
        title: 'Google Application',
        subtitle: 'Senior Frontend Developer',
        href: '/recruiter/applications/2',
        icon: FileText
      },
      {
        id: 3,
        type: 'interview',
        title: 'Technical Interview',
        subtitle: 'Tomorrow at 2:00 PM',
        href: '/recruiter/interviews/3',
        icon: Calendar
      }
    ].filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setLoading(false);
    return mockResults;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      try {
        setRecentSearches(JSON.parse(savedSearches));
      } catch (e) {
        console.error('Failed to parse recent searches');
      }
    }
  }, []);

  useEffect(() => {
    if (query.trim()) {
      const timer = setTimeout(async () => {
        const searchResults = await performSearch(query);
        setResults(searchResults);
      }, 300);

      return () => clearTimeout(timer);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setIsOpen(true);
  };

  const handleResultClick = (result) => {
    // Add to recent searches
    const newRecentSearches = [
      { query: result.title, type: result.type, timestamp: Date.now() },
      ...recentSearches.filter(s => s.query !== result.title).slice(0, 4)
    ];
    setRecentSearches(newRecentSearches);
    localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));
    
    // Navigate to result
    router.push(result.href);
    setIsOpen(false);
    setQuery('');
  };

  const handleRecentSearchClick = (search) => {
    setQuery(search.query);
    setIsOpen(true);
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'Enter' && query.trim()) {
      // Add to recent searches
      const newRecentSearches = [
        { query, type: 'manual', timestamp: Date.now() },
        ...recentSearches.filter(s => s.query !== query).slice(0, 4)
      ];
      setRecentSearches(newRecentSearches);
      localStorage.setItem('recentSearches', JSON.stringify(newRecentSearches));
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="pl-10 pr-10"
        />
        {query && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              setResults([]);
              inputRef.current?.focus();
            }}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
          >
            <div className="p-2">
              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              )}

              {/* Search Results */}
              {!loading && results.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                    Results
                  </div>
                  {results.map((result) => {
                    const Icon = result.icon;
                    return (
                      <motion.button
                        key={result.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.1 }}
                        onClick={() => handleResultClick(result)}
                        className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors text-left"
                      >
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{result.title}</div>
                          <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {/* Recent Searches */}
              {!loading && results.length === 0 && recentSearches.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between px-3 py-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Recent Searches
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearRecentSearches}
                      className="text-xs h-auto p-1"
                    >
                      Clear
                    </Button>
                  </div>
                  {recentSearches.map((search, index) => (
                    <motion.button
                      key={`${search.query}-${index}`}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.1 }}
                      onClick={() => handleRecentSearchClick(search)}
                      className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-accent transition-colors text-left"
                    >
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-left">{search.query}</span>
                      <span className="text-xs text-muted-foreground">
                        {search.type}
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {!loading && results.length === 0 && recentSearches.length === 0 && query && (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">
                    No results found for &ldquo;{query}&rdquo;
                  </div>
                </div>
              )}

              {/* Empty State */}
              {!loading && results.length === 0 && recentSearches.length === 0 && !query && (
                <div className="text-center py-8">
                  <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-sm text-muted-foreground">
                    Start typing to search...
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SearchInput;



