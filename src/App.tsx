import React, { useState, useEffect, useCallback } from 'react';
import { Flame, Search, Settings, Coffee, Star, Heart, X, Check, Trash2, AlertCircle, Clock, SmilePlus, MessageSquareMore } from 'lucide-react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import clsx from 'clsx';

// Initialize Giphy client with a public API key
const gf = new GiphyFetch('pLURtkhVrUXr3KG25Gy5IvzziV5OrZGa');

type ContentType = 'gifs' | 'emojis' | 'kaomoji';

interface GIF {
  id: string;
  title: string;
  images: {
    fixed_height: {
      url: string;
      height: string;
      width: string;
    };
  };
}

interface FavoriteGif extends GIF {
  hotkey?: number;
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface RecentGif extends GIF {
  usedAt: number;
}

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [gifs, setGifs] = useState<GIF[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteGif[]>([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [recentGifs, setRecentGifs] = useState<RecentGif[]>([]);
  const [trendingGifs, setTrendingGifs] = useState<GIF[]>([]);
  const [activeTab, setActiveTab] = useState<ContentType>('gifs');
  
  // New flag to check if storage is loaded
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      if (window?.electronAPI?.closeApp) {
        window.electronAPI.closeApp();
      } else {
        console.error('electronAPI.closeApp not available');
      }
    }
  };

  // Read JSON data from file on mount instead of localStorage
  useEffect(() => {
    async function readStorage() {
      if (window.electronAPI?.readData) {
        try {
          const data = await window.electronAPI.readData();
          if (data) {
            if (data.favorites) setFavorites(data.favorites);
            if (data.recents) setRecentGifs(data.recents);
          }
        } catch (error) {
          console.error('Error reading data file:', error);
        }
      } else {
        console.error('electronAPI.readData not available');
      }
      // Mark the storage as loaded so writes can safely happen
      setIsStorageLoaded(true);
    }
    readStorage();
    loadTrendingGifs();
  }, []);

  // Write updated favorites and recent GIFs to the JSON file whenever they change,
  // but only after initial data is loaded.
  useEffect(() => {
    if (!isStorageLoaded) return;
    async function updateStorage() {
      if (window.electronAPI?.writeData) {
        try {
          await window.electronAPI.writeData({
            favorites,
            recents: recentGifs,
          });
        } catch (error) {
          console.error('Error writing to data file:', error);
        }
      } else {
        console.error("electronAPI.writeData is not available");
      }
    }
    updateStorage();
  }, [favorites, recentGifs, isStorageLoaded]);

  const loadTrendingGifs = async () => {
    try {
      const { data } = await gf.trending({ limit: 500 });
      setTrendingGifs(data);
    } catch (error) {
      console.error('Error loading trending GIFs:', error);
    }
  };


  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const searchGifs = useCallback(async (term: string) => {
    if (!term) {
      setGifs([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data } = await gf.search(term, { limit: 500 });
      setGifs(data);
    } catch (error) {
      console.error('Error searching GIFs:', error);
      showToast('Failed to load GIFs', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (!showFavorites && searchTerm && activeTab === 'gifs') {
        searchGifs(searchTerm);
      }
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, searchGifs, showFavorites, activeTab]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  const addToRecents = (gif: GIF) => {
    setRecentGifs(prevRecents => {
      const newRecent: RecentGif = { ...gif, usedAt: Date.now() };
      const filteredRecents = prevRecents.filter(g => g.id !== gif.id);
      return [newRecent, ...filteredRecents].slice(0, 10);
    });
  };

  const copyGifUrl = async (url: string, gif?: GIF) => {
    try {
      await navigator.clipboard.writeText(url);
      showToast('GIF URL copied to clipboard!', 'success');
      if (gif) {
        addToRecents(gif);
      }
    } catch (error) {
      console.error('Failed to copy GIF URL:', error);
      showToast('Failed to copy GIF URL', 'error');
    }
  };

  const toggleFavorite = (gif: GIF) => {
    setFavorites(prevFavorites => {
      const existingIndex = prevFavorites.findIndex(f => f.id === gif.id);
      if (existingIndex >= 0) {
        showToast('Removed from favorites', 'success');
        return prevFavorites.filter(f => f.id !== gif.id);
      } else {
        const usedHotkeys = prevFavorites.map(f => f.hotkey).filter(Boolean) as number[];
        let nextHotkey = 1;
        while (usedHotkeys.includes(nextHotkey) && nextHotkey <= 9) {
          nextHotkey++;
        }
        const newFavorite = {
          ...gif,
          hotkey: nextHotkey <= 9 ? nextHotkey : undefined
        };
        showToast('Added to favorites', 'success');
        return [...prevFavorites, newFavorite];
      }
    });
  };

  const updateHotkey = (gifId: string, newHotkey: number) => {
    setFavorites(prevFavorites => {
      return prevFavorites.map(gif => {
        if (gif.id === gifId) {
          return { ...gif, hotkey: newHotkey };
        }
        if (gif.hotkey === newHotkey) {
          return { ...gif, hotkey: undefined };
        }
        return gif;
      });
    });
    showToast(`Hotkey ${newHotkey} assigned`, 'success');
  };

  const removeFavorite = (gifId: string) => {
    setFavorites(prevFavorites => prevFavorites.filter(f => f.id !== gifId));
    showToast('Removed from favorites', 'success');
  };

  const isGifFavorited = (gifId: string) => {
    return favorites.some(f => f.id === gifId);
  };

  const displayedGifs = showFavorites
    ? favorites
    : searchTerm
      ? gifs
      : recentGifs.length > 0
        ? [...recentGifs, ...trendingGifs.filter(g => !recentGifs.some(r => r.id === g.id))].slice(0, 500)
        : trendingGifs;

  return (
    <div className="min-h-screen text-white bg-black bg-opacity-60">
      {/* Toast Notification */}
      {toast && (
        <div
          className={clsx(
            "fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg z-[60] transition-all transform",
            toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
          )}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Close Button */}
      <button 
        onClick={() => window.electronAPI.closeApp()}
        className="absolute top-4 right-4 p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors text-gray-400 hover:text-white z-20 cursor-pointer z-[100]"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Launcher Overlay */}
      <div className="fixed inset-0 launcher-overlay z-50 flex items-center justify-center" onClick={handleBackdropClick}>
        <div className="w-full max-w-4xl bg-[#1a1a1a] rounded-lg p-6 slide-up relative">
          {/* Settings Panel */}
          {showSettings && (
            <div className="absolute inset-0 bg-[#1a1a1a] rounded-lg p-6 z-10">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-[#00f3ff]">Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-[#2a2a2a] rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4">Support</h3>
                  <a
                    href="https://www.buymeacoffee.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#2a2a2a] hover:bg-[#333] rounded-lg transition-colors text-[#00f3ff]"
                  >
                    <Coffee className="w-5 h-5" />
                    <span>Buy me a coffee</span>
                  </a>
              </div>
              <div className="space-y-6 h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Favorite GIFs</h3>
                  <div className="space-y-4">
                    {favorites.map((gif) => (
                      <div
                        key={gif.id}
                        className="flex items-center gap-4 bg-[#2a2a2a] p-4 rounded-lg"
                      >
                        <img
                          src={gif.images.fixed_height.url}
                          alt={gif.title}
                          className="w-20 h-20 object-cover rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">Hotkey:</span>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                <button
                                  key={num}
                                  onClick={() => updateHotkey(gif.id, num)}
                                  className={clsx(
                                    "w-8 h-8 rounded flex items-center justify-center transition-colors",
                                    gif.hotkey === num
                                      ? "bg-[#00f3ff] text-[#111]"
                                      : "bg-[#333] hover:bg-[#444]"
                                  )}
                                >
                                  {num}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFavorite(gif.id)}
                          className="p-2 hover:bg-[#444] rounded transition-colors text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                    {favorites.length === 0 && (
                      <div className="text-gray-400 text-center py-8">
                        No favorites yet. Add some GIFs!
                      </div>
                    )}
                  </div>
                </div>
                
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 mb-8">
            <Flame className="w-12 h-12 text-[#00f3ff]" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-[#00f3ff] to-[#b537f2] text-transparent bg-clip-text tracking-widest">
              GIF<span className='text-4xl'>IRE</span>
            </h1>
          </div>

          {/* Content Type Tabs */}
          <div className="flex gap-2 mb-4">
            {[
              { id: 'gifs' as const, icon: Flame, label: 'GIFs' },
              { id: 'emojis' as const, icon: SmilePlus, label: 'Emojis' },
              { id: 'kaomoji' as const, icon: MessageSquareMore, label: 'Kaomoji' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== 'gifs') {
                    showToast('Coming soon!', 'error');
                  }
                }}
                className={clsx(
                  "px-4 py-2 rounded-lg flex items-center gap-2 transition-all",
                  activeTab === tab.id
                    ? "bg-[#00f3ff] text-[#111]"
                    : "bg-[#2a2a2a] text-[#00f3ff] hover:bg-[#333]"
                )}
              >
                <tab.icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Search Bar and Tabs */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={activeTab === 'gifs' ? "Search GIFs..." : `Search ${activeTab}... (Coming Soon)`}
                disabled={activeTab !== 'gifs'}
                className="w-full bg-[#2a2a2a] text-white rounded-lg pl-12 pr-10 py-3 border-2 border-[#333] focus:border-[#00f3ff] outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#333] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={clsx(
                "px-4 rounded-lg flex items-center gap-2 transition-all py-[0.9rem]",
                showFavorites
                  ? "bg-[#00f3ff] text-[#111]"
                  : "bg-[#2a2a2a] text-[#00f3ff] hover:bg-[#333]"
              )}
            >
              <Heart className="w-5 h-5" />
              <span>Favorites</span>
            </button>
          </div>

          {/* Section Title */}
          {!showFavorites && !searchTerm && activeTab === 'gifs' && (
            <div className="flex items-center gap-2 mb-4 text-gray-400">
              <Clock className="w-4 h-4" />
              <span>{recentGifs.length > 0 ? 'Recently Used & Trending' : 'Trending GIFs'}</span>
            </div>
          )}

          {/* Results Grid */}
          <div className="flex flex-wrap gap-4 mb-6 h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {activeTab !== 'gifs' ? (
              <div className="w-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <div className="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center">
                  {activeTab === 'emojis' ? (
                    <SmilePlus className="w-8 h-8 text-[#00f3ff]" />
                  ) : (
                    <MessageSquareMore className="w-8 h-8 text-[#00f3ff]" />
                  )}
                </div>
                <p className="text-lg">Coming Soon!</p>
                <p className="text-sm opacity-75">This feature is under development</p>
              </div>
            ) : isLoading ? (
              [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="w-[calc(33.333%-11px)] aspect-video bg-[#2a2a2a] rounded-lg animate-pulse"
                />
              ))
            ) : displayedGifs.length > 0 ? (
              displayedGifs.map((gif) => (
                <div
                  key={gif.id}
                  className="w-[calc(33.333%-11px)] relative group aspect-video bg-[#2a2a2a] rounded-lg overflow-hidden hover:border-2 hover:border-[#00f3ff] transition-all cursor-pointer"
                >
                  <img
                    src={gif.images.fixed_height.url}
                    alt={gif.title}
                    className="w-full h-full object-cover cursor-pointer"
                  />
                  <div 
                    className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200" 
                    onClick={() => copyGifUrl(gif.images.fixed_height.url, gif)}
                  >
                    <span className="text-white text-sm font-medium">Click to copy</span>
                  </div>
                  <button
                    onClick={() => toggleFavorite(gif)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black bg-opacity-50 hover:bg-opacity-75 transition-all"
                  >
                    <Star
                      className={clsx(
                        "w-5 h-5",
                        isGifFavorited(gif.id)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-white"
                      )}
                    />
                  </button>
                  {'hotkey' in gif && gif.hotkey && (
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black bg-opacity-75 text-white text-xs">
                      Press {gif.hotkey}
                    </div>
                  )}
                  {'usedAt' in gif && (
                    <div className="absolute top-2 left-2 p-1 rounded-full bg-black bg-opacity-50">
                      <Clock className="w-4 h-4 text-[#00f3ff]" />
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="w-full flex items-center justify-center text-gray-400">
                {showFavorites
                  ? "No favorites yet"
                  : searchTerm && displayedGifs.length === 0
                  ? "The GIFs you seek have ghosted you. Try again!"
                  : !searchTerm
                  ? "Loading trending GIFs..."
                  : null}
              </div>
            )}
            {displayedGifs.length > 0 && !showFavorites && searchTerm && (
              <div className="w-full text-center py-4 text-gray-400 text-sm">
                "The GIFs you seek have ghosted you. Try again!"
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <button
                onClick={() => setShowSettings(true)}
                className="text-[#00f3ff] hover:text-[#b537f2]"
              >
                <Settings className="w-5 h-5" />
              </button>
              <a
                href="https://www.buymeacoffee.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#00f3ff] hover:text-[#b537f2]"
              >
                <Coffee className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
