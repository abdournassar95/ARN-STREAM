import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  Home, 
  Languages, 
  Scan, 
  Film, 
  Music, 
  Settings, 
  Tv, 
  Folder, 
  Sun, 
  Moon, 
  BookOpen, 
  Drama, 
  Compass, 
  Menu, 
  X,
  ArrowRight,
  ArrowLeft,
  QrCode,
  SlidersHorizontal,
  Cast
} from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLibraries, fetchSearchSuggestions } from '../../api/client';
import client from '../../api/client';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import PredictiveSearchDropdown from './PredictiveSearchDropdown';
import { localizeLibraryName } from '../../utils/localization';
import UserMenu from './UserMenu';
import ServerQrModal from './ServerQrModal';

export default function TopBar({ variant = 'movies' }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const isRtl = i18n.language === 'ar';
  
  const [showQrModal, setShowQrModal] = useState(false);
  const { activeRemoteSession, openFullRemote, openCastModal, onlineDevices } = useDeviceHandoffStore();
  
  const [q, setQ] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const desktopSearchRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const searchInputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  
  const { data: libraries = [] } = useQuery({ 
    queryKey: ['libraries', { nonEmpty: true }], 
    queryFn: () => fetchLibraries(true) 
  });
  
  const { theme, setTheme } = useSettingsStore();
  const isDark = theme !== 'light';

  const toggleTheme = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  const toggleLang = () => {
    const next = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(next);
  };

  // Identify active library or section
  const currentLibId = location.pathname.startsWith('/library/') ? location.pathname.split('/')[2] : null;
  const currentLib = currentLibId ? libraries.find(l => String(l.id) === String(currentLibId)) : null;

  // Compute theme colors dynamically per library / route
  const themeInfo = useMemo(() => {
    if (currentLib) {
      const n = (currentLib.name || '').toLowerCase();
      if (n.includes('قرآن') || n.includes('قران') || n.includes('quran')) {
        return {
          id: 'quran',
          color: '#0D9488',
          colorRgb: '13, 148, 136',
          glow: 'rgba(13, 148, 136, 0.45)',
          activePillBg: 'bg-teal-600/35 border-teal-400/50 shadow-teal-500/20',
          scanText: 'text-[#0D9488]',
        };
      }
      if (n.includes('مسرح') || n.includes('play')) {
        return {
          id: 'plays',
          color: '#8B5CF6',
          colorRgb: '139, 92, 246',
          glow: 'rgba(139, 92, 246, 0.45)',
          activePillBg: 'bg-purple-600/35 border-purple-400/50 shadow-purple-500/20',
          scanText: 'text-[#8B5CF6]',
        };
      }
      if (n.includes('وثائق') || n.includes('doc') || currentLib.icon === 'compass') {
        return {
          id: 'doc',
          color: '#D97706',
          colorRgb: '217, 119, 6',
          glow: 'rgba(217, 119, 6, 0.45)',
          activePillBg: 'bg-amber-600/35 border-amber-400/50 shadow-amber-500/20',
          scanText: 'text-[#D97706]',
        };
      }
      if (currentLib.type === 'shows' || currentLib.icon === 'tv') {
        return {
          id: 'shows',
          color: '#0284C7',
          colorRgb: '2, 132, 199',
          glow: 'rgba(2, 132, 199, 0.45)',
          activePillBg: 'bg-sky-600/35 border-sky-400/50 shadow-sky-500/20',
          scanText: 'text-[#0284C7]',
        };
      }
      if (currentLib.type === 'music') {
        return {
          id: 'music',
          color: '#1DB954',
          colorRgb: '29, 185, 84',
          glow: 'rgba(29, 185, 84, 0.45)',
          activePillBg: 'bg-emerald-600/35 border-emerald-400/50 shadow-emerald-500/20',
          scanText: 'text-[#1DB954]',
        };
      }
    }

    const path = location.pathname;
    if (path.startsWith('/music') || variant === 'music') {
      return {
        id: 'music',
        color: '#1DB954',
        colorRgb: '29, 185, 84',
        glow: 'rgba(29, 185, 84, 0.45)',
        activePillBg: 'bg-emerald-600/35 border-emerald-400/50 shadow-emerald-500/20',
        scanText: 'text-[#1DB954]',
      };
    }
    if (path.startsWith('/movies') || path.startsWith('/watch/movie')) {
      return {
        id: 'movies',
        color: '#E50914',
        colorRgb: '229, 9, 20',
        glow: 'rgba(229, 9, 20, 0.45)',
        activePillBg: 'bg-red-600/35 border-red-400/50 shadow-red-500/20',
        scanText: 'text-[#E50914]',
      };
    }
    if (path.startsWith('/live')) {
      return {
        id: 'live',
        color: '#EF4444',
        colorRgb: '239, 68, 68',
        glow: 'rgba(239, 68, 68, 0.45)',
        activePillBg: 'bg-red-600/35 border-red-400/50 shadow-red-500/20',
        scanText: 'text-[#EF4444]',
      };
    }

    return {
      id: 'general',
      color: '#E50914',
      colorRgb: '229, 9, 20',
      glow: 'rgba(229, 9, 20, 0.35)',
      activePillBg: 'bg-red-600/35 border-red-400/50 shadow-red-500/20',
      scanText: 'text-[#E50914]',
    };
  }, [currentLib, location.pathname, variant]);

  // Order libraries canonically
  const sortedLibraries = useMemo(() => {
    const canonicalOrder = ['أفلام', 'مسلسلات', 'مسرحيات', 'وثائقية', 'موسيقى', 'القرآن الكريم'];
    return [...libraries].sort((a, b) => {
      const idxA = canonicalOrder.findIndex(c => (a.name || '').includes(c));
      const idxB = canonicalOrder.findIndex(c => (b.name || '').includes(c));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  }, [libraries]);

  // Icon resolver per library
  const getLibIcon = (lib) => {
    const n = (lib.name || '').toLowerCase();
    if (n.includes('قرآن') || n.includes('قران') || n.includes('quran')) return <BookOpen size={18} />;
    if (n.includes('مسرح') || n.includes('play')) return <Drama size={18} />;
    if (n.includes('وثائق') || n.includes('doc') || lib.icon === 'compass') return <Compass size={18} />;
    if (lib.icon === 'film' || lib.type === 'movies') return <Film size={18} />;
    if (lib.icon === 'tv' || lib.type === 'shows') return <Tv size={18} />;
    if (lib.icon === 'music' || lib.type === 'music') return <Music size={18} />;
    return <Folder size={18} />;
  };

  // Predictive search query debounce
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setSearchSuggestions([]);
      setPrediction(null);
      setIsDropdownOpen(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchSearchSuggestions(query);
        setSearchSuggestions(data.results || []);
        setPrediction(data.prediction || null);
        setIsDropdownOpen(true);
      } catch (err) {
        console.error('Predictive search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [q]);

  // Click outside to dismiss predictive dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        desktopSearchRef.current && !desktopSearchRef.current.contains(e.target) &&
        mobileSearchRef.current && !mobileSearchRef.current.contains(e.target)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectItem = (item) => {
    setIsDropdownOpen(false);
    setMobileSearchOpen(false);
    if (item.type === 'movie') {
      navigate(`/movies/${item.id}`);
    } else if (item.type === 'series') {
      navigate(`/series/${item.id}`);
    } else if (item.type === 'track') {
      navigate(`/music/album/${item.album_id || ''}`);
    } else if (item.type === 'artist') {
      navigate(`/music/artist/${item.id}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(item.title)}`);
    }
  };

  const handleSelectPrediction = (predictedText) => {
    setQ(predictedText);
  };

  const handleViewAll = () => {
    if (!q.trim()) return;
    setIsDropdownOpen(false);
    setMobileSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (selectedIndex >= 0 && searchSuggestions[selectedIndex]) {
      handleSelectItem(searchSuggestions[selectedIndex]);
      return;
    }
    if (!q.trim()) return;
    setIsDropdownOpen(false);
    setMobileSearchOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Tab' && prediction && prediction.toLowerCase() !== q.toLowerCase().trim()) {
      e.preventDefault();
      setQ(prediction);
      return;
    }

    if (!isDropdownOpen || searchSuggestions.length === 0) {
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < searchSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : searchSuggestions.length - 1));
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try { 
      await client.post('/scan'); 
      window.location.reload(); 
    } catch (err) {
      console.error('Scan error:', err);
    } finally { 
      setScanning(false); 
    }
  };

  return (
    <>
      {/* =================================================================== */}
      {/* 1. DESKTOP VERTICAL GLASS FLOATING SIDEBAR (Expand on Hover)       */}
      {/* Positioned on RIGHT in Arabic (RTL), LEFT in English (LTR)         */}
      {/* =================================================================== */}
      <aside
        className={`arn-sidebar hidden md:flex fixed top-3.5 bottom-3.5 h-[calc(100vh-28px)] max-h-[calc(100vh-28px)] z-[90] ${
          isRtl ? 'right-3 sm:right-4' : 'left-3 sm:left-4'
        } w-[72px] hover:w-[250px] group/sidebar flex-col justify-between rounded-[28px] border transition-[width] duration-180 ease-out shadow-2xl backdrop-blur-2xl p-2.5 overflow-hidden will-change-[width] select-none ${
          isDark ? 'text-white' : 'text-slate-800'
        }`}
        style={{
          background: isDark
            ? `linear-gradient(180deg, rgba(${themeInfo.colorRgb}, 0.24) 0%, rgba(10, 15, 26, 0.93) 22%, rgba(4, 7, 13, 0.98) 100%)`
            : `linear-gradient(180deg, rgba(${themeInfo.colorRgb}, 0.14) 0%, rgba(255, 255, 255, 0.95) 22%, rgba(246, 248, 252, 0.98) 100%)`,
          borderColor: isDark
            ? `rgba(${themeInfo.colorRgb}, 0.38)`
            : `rgba(${themeInfo.colorRgb}, 0.28)`,
          boxShadow: isDark
            ? `0 20px 50px -10px rgba(0, 0, 0, 0.85), 0 0 32px -4px ${themeInfo.glow}, inset 0 1px 1px rgba(255, 255, 255, 0.2)`
            : `0 15px 40px -8px rgba(0, 0, 0, 0.12), 0 0 24px -4px rgba(${themeInfo.colorRgb}, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.95)`,
        }}
      >
        {/* Top Section: Brand Header, Back Button, Search */}
        <div className="flex flex-col gap-1.5 shrink-0 w-full">
          {/* 1. Brand Logo & Title (Always centered in collapsed mode, reveals title on hover) */}
          <Link 
            to="/" 
            className="flex items-center h-12 rounded-2xl group/brand w-full overflow-hidden transition-all duration-180 hover:bg-white/10 dark:hover:bg-white/10"
            title="ARN STREAM"
          >
            <div 
              style={{ boxShadow: `0 0 14px rgba(${themeInfo.colorRgb}, ${isDark ? '0.5' : '0.3'})` }}
              className="w-10 h-10 rounded-2xl overflow-hidden p-0.5 bg-gradient-to-tr from-white/20 via-white/50 to-white/80 shadow-lg flex-shrink-0 mx-auto group-hover/sidebar:mx-0 group-hover/brand:scale-105 transition-all duration-180"
            >
              <img 
                src="/favicon.jpg" 
                alt="ARN Technology" 
                className="w-full h-full rounded-xl object-cover" 
              />
            </div>
            <div className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-180 ease-out flex flex-col leading-tight whitespace-nowrap overflow-hidden ms-2.5">
              <span className={`font-black text-sm tracking-tight transition-colors ${
                isDark ? 'text-white group-hover/brand:text-amber-300' : 'text-slate-900 group-hover/brand:text-amber-600'
              }`}>
                ARN STREAM
              </span>
              <span className={`text-[10px] font-bold tracking-wider uppercase ${
                isDark ? 'text-white/60' : 'text-slate-500'
              }`}>
                Media Server
              </span>
            </div>
          </Link>

          {/* Active Remote Control Indicator (Desktop Sidebar) */}
          {activeRemoteSession && (
            <button
              type="button"
              onClick={openFullRemote}
              className="flex items-center h-11 rounded-2xl transition-all duration-180 w-full group/remote shadow-lg bg-gradient-to-r from-red-600/25 to-rose-600/25 border border-rose-500/40 text-white animate-pulse"
              title={isRtl ? `التحكم في ${activeRemoteSession.targetDeviceName}` : `Control ${activeRemoteSession.targetDeviceName}`}
            >
              <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0 text-rose-400">
                <SlidersHorizontal size={18} />
              </div>
              <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-180 ease-out font-bold text-xs truncate ms-1.5 whitespace-nowrap overflow-hidden text-rose-300">
                {activeRemoteSession.targetDeviceName}
              </span>
            </button>
          )}

          {/* 2. Back Button (Shown when not on homepage '/') */}
          {location.pathname !== '/' && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className={`flex items-center h-11 rounded-2xl transition-all duration-180 w-full group/back shadow-sm ${
                isDark
                  ? 'bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 hover:text-white'
                  : 'bg-black/5 hover:bg-black/10 border border-black/10 text-slate-700 hover:text-slate-950'
              }`}
              title={isRtl ? 'رجوع للخلف' : 'Go Back'}
            >
              <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0">
                {isRtl ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
              </div>
              <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-180 ease-out font-bold text-xs sm:text-sm truncate ms-1.5 whitespace-nowrap overflow-hidden">
                {isRtl ? 'رجوع للخلف' : 'Go Back'}
              </span>
            </button>
          )}

          {/* 3. Search Trigger / Input Box */}
          <div ref={desktopSearchRef} className="relative w-full">
            <form onSubmit={handleSearch} className="flex items-center relative">
              <button
                type="button"
                onClick={() => searchInputRef.current?.focus()}
                className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition mx-auto group-hover/sidebar:mx-0 ${
                  isDark 
                    ? 'text-white/70 hover:text-white hover:bg-white/10' 
                    : 'text-slate-600 hover:text-slate-950 hover:bg-black/5'
                }`}
                title={isRtl ? 'بحث' : 'Search'}
              >
                <Search size={18} />
              </button>

              <div className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-full transition-all duration-180 ease-out overflow-hidden flex items-center pe-1">
                <input
                  ref={searchInputRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  onFocus={() => { if (q.trim()) setIsDropdownOpen(true); }}
                  onKeyDown={handleKeyDown}
                  placeholder={isRtl ? 'بحث...' : t('actions.searchPlaceholder')}
                  className={`w-full h-9 rounded-xl border px-3 text-xs focus:outline-none transition-all shadow-inner ${
                    isDark 
                      ? 'bg-black/40 text-white border-white/15 placeholder:text-white/40 focus:border-white/40' 
                      : 'bg-black/[0.04] text-slate-900 border-black/10 placeholder:text-slate-400 focus:border-black/30'
                  }`}
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => { setQ(''); setIsDropdownOpen(false); }}
                    className="w-5 h-5 flex items-center justify-center text-muted hover:text-white ms-1 shrink-0"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </form>

            {/* Predictive Search Dropdown: Opens to the inside of the screen */}
            {isDropdownOpen && (
              <div 
                className={`absolute ${
                  isRtl ? 'end-full me-3' : 'start-full ms-3'
                } top-0 w-80 max-w-[80vw] z-[100]`}
              >
                <PredictiveSearchDropdown
                  isOpen={isDropdownOpen}
                  results={searchSuggestions}
                  prediction={prediction}
                  query={q}
                  selectedIndex={selectedIndex}
                  isLoading={isSearching}
                  onSelect={handleSelectItem}
                  onSelectPrediction={handleSelectPrediction}
                  onViewAll={handleViewAll}
                  isRtl={isRtl}
                />
              </div>
            )}
          </div>
        </div>

        {/* Middle Navigation Section (Scrollable with icons & hover labels) */}
        <nav className="flex-1 my-3 overflow-y-auto overflow-x-hidden scrollbar-none space-y-1.5 pe-0.5">
          {/* 1. الرئيسية (Home) */}
          <Link
            to="/"
            className={`flex items-center h-11 px-1 rounded-2xl transition-all duration-200 relative group/nav ${
              location.pathname === '/' 
                ? (isDark 
                    ? 'bg-white/20 text-white font-bold shadow-md border border-white/25 backdrop-blur-md' 
                    : 'bg-black/10 text-slate-950 font-bold shadow-sm border border-black/10')
                : (isDark 
                    ? 'text-white/75 hover:text-white hover:bg-white/10' 
                    : 'text-slate-600 hover:text-slate-950 hover:bg-black/5')
            }`}
            title={t('common.home')}
          >
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0">
              <Home size={19} />
            </div>
            <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 font-semibold text-xs sm:text-sm truncate ms-1.5 whitespace-nowrap overflow-hidden">
              {t('common.home')}
            </span>
          </Link>

          {/* 2. البث المباشر (Live TV with red dot) */}
          <Link
            to="/live"
            className={`flex items-center h-11 px-1 rounded-2xl transition-all duration-200 relative group/nav ${
              location.pathname === '/live' 
                ? (isDark 
                    ? 'bg-red-600/35 text-white font-bold shadow-md border border-red-400/50 shadow-red-500/20 backdrop-blur-md' 
                    : 'bg-red-50 text-red-600 font-bold shadow-sm border border-red-200')
                : (isDark 
                    ? 'text-white/75 hover:text-white hover:bg-white/10' 
                    : 'text-slate-600 hover:text-slate-950 hover:bg-black/5')
            }`}
            title={t('common.liveTv')}
          >
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 relative mx-auto group-hover/sidebar:mx-0">
              <Tv size={19} className={location.pathname === '/live' ? 'text-red-400' : ''} />
              <span className="absolute top-2.5 end-2.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            </div>
            <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 font-semibold text-xs sm:text-sm truncate ms-1.5 whitespace-nowrap overflow-hidden flex items-center gap-1.5">
              <span>{t('common.liveTv')}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-600 text-white shadow-sm">
                LIVE
              </span>
            </span>
          </Link>

          {/* 3. بث وتحكم الأجهزة (Cast & Remote Control) */}
          <button
            type="button"
            onClick={() => {
              if (activeRemoteSession) {
                openFullRemote();
              } else {
                openCastModal(null);
              }
            }}
            className={`flex items-center h-11 px-1 rounded-2xl transition-all duration-200 relative group/nav w-full ${
              activeRemoteSession
                ? 'bg-gradient-to-r from-rose-600/30 to-red-600/30 text-rose-300 font-bold border border-rose-500/40 shadow-lg shadow-rose-900/20 animate-pulse'
                : (isDark 
                    ? 'text-white/75 hover:text-white hover:bg-white/10' 
                    : 'text-slate-600 hover:text-slate-950 hover:bg-black/5')
            }`}
            title={activeRemoteSession 
              ? (isRtl ? `التحكم في ${activeRemoteSession.targetDeviceName}` : `Control ${activeRemoteSession.targetDeviceName}`)
              : (isRtl ? 'البث والتحكم الكامل في الأجهزة' : 'Cast & Remote Control')}
          >
            <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 relative mx-auto group-hover/sidebar:mx-0">
              <Cast size={19} className={activeRemoteSession ? 'text-rose-400' : 'text-emerald-400'} />
              {activeRemoteSession ? (
                <span className="absolute top-2.5 end-2.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              ) : (
                onlineDevices?.length > 1 && (
                  <span className="absolute top-2.5 end-2.5 flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm" />
                )
              )}
            </div>
            <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 font-semibold text-xs sm:text-sm truncate ms-1.5 whitespace-nowrap overflow-hidden flex items-center gap-1.5">
              <span>
                {activeRemoteSession
                  ? (isRtl ? `التحكم: ${activeRemoteSession.targetDeviceName}` : `Remote: ${activeRemoteSession.targetDeviceName}`)
                  : (isRtl ? 'بث وتحكم الأجهزة' : 'Cast & Remote')}
              </span>
              {activeRemoteSession ? (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                  ACTIVE
                </span>
              ) : (
                onlineDevices?.length > 1 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {onlineDevices.length - 1}
                  </span>
                )
              )}
            </span>
          </button>

          {/* 4. All Dynamic Libraries */}
          {sortedLibraries.map(lib => {
            const isLibActive = location.pathname === `/library/${lib.id}`;
            return (
              <Link
                key={lib.id}
                to={`/library/${lib.id}`}
                className={`flex items-center h-11 px-1 rounded-2xl transition-all duration-200 relative group/nav ${
                  isLibActive
                    ? (isDark 
                        ? 'bg-white/25 text-white font-bold shadow-md border border-white/30 backdrop-blur-md' 
                        : 'bg-black/10 text-slate-950 font-bold shadow-sm border border-black/10')
                    : (isDark 
                        ? 'text-white/75 hover:text-white hover:bg-white/10' 
                        : 'text-slate-600 hover:text-slate-950 hover:bg-black/5')
                }`}
                title={localizeLibraryName(lib.name, isRtl)}
              >
                <div className="w-11 h-11 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0">
                  {getLibIcon(lib)}
                </div>
                <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 font-semibold text-xs sm:text-sm truncate ms-1.5 whitespace-nowrap overflow-hidden">
                  {localizeLibraryName(lib.name, isRtl)}
                </span>
                {lib.media_count !== undefined && (
                  <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto ms-auto me-2 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 font-semibold">
                    {lib.media_count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section: Utility Actions & User Menu */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-white/10 shrink-0">
          {/* Scan Library Button */}
          {useAuthStore.getState().isAdmin() && (
            <button
              type="button"
              onClick={handleScan}
              disabled={scanning}
              className={`flex items-center h-10 px-1 rounded-2xl transition w-full ${
                isDark ? 'hover:bg-white/10 text-amber-300' : 'hover:bg-black/5 text-amber-600'
              }`}
              title={isRtl ? 'فحص ومزامنة المكتبة' : 'Scan Library'}
            >
              <div className="w-11 h-10 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0">
                <Scan size={18} className={scanning ? 'animate-spin' : ''} />
              </div>
              <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 text-xs font-bold truncate ms-1.5 whitespace-nowrap overflow-hidden">
                {scanning ? t('actions.scanning') : (isRtl ? 'فحص المكتبة' : t('actions.scan'))}
              </span>
            </button>
          )}

          {/* QR Code Phone Connect */}
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className={`flex items-center h-10 px-1 rounded-2xl transition w-full ${
              isDark ? 'hover:bg-white/10 text-emerald-400' : 'hover:bg-black/5 text-emerald-600'
            }`}
            title={isRtl ? 'ربط الهاتف عبر QR Code' : 'Connect Mobile via QR Code'}
          >
            <div className="w-11 h-10 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0">
              <QrCode size={18} />
            </div>
            <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 text-xs font-semibold truncate ms-1.5 whitespace-nowrap overflow-hidden">
              {isRtl ? 'ربط الهاتف' : 'Connect Phone'}
            </span>
          </button>

          {/* Settings / Dashboard */}
          <Link
            to="/dashboard?tab=general"
            className={`flex items-center h-10 px-1 rounded-2xl transition w-full ${
              isDark ? 'hover:bg-white/10 text-white/80 hover:text-white' : 'hover:bg-black/5 text-slate-700'
            }`}
            title={t('common.settings')}
          >
            <div className="w-11 h-10 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0">
              <Settings size={18} />
            </div>
            <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 text-xs font-semibold truncate ms-1.5 whitespace-nowrap overflow-hidden">
              {t('common.settings')}
            </span>
          </Link>

          {/* Theme Toggle (Full width button) */}
          <button
            type="button"
            onClick={toggleTheme}
            className={`flex items-center h-10 px-1 rounded-2xl transition w-full ${
              isDark ? 'hover:bg-white/10 text-amber-300' : 'hover:bg-black/5 text-amber-600'
            }`}
            title={isDark ? (isRtl ? 'الوضع النهاري' : 'Light Mode') : (isRtl ? 'الوضع الليلي' : 'Dark Mode')}
          >
            <div className="w-11 h-10 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </div>
            <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 text-xs font-semibold truncate ms-1.5 whitespace-nowrap overflow-hidden">
              {isDark ? (isRtl ? 'الوضع النهاري' : 'Light Mode') : (isRtl ? 'الوضع الليلي' : 'Dark Mode')}
            </span>
          </button>

          {/* Language Toggle (Full width button) */}
          <button
            type="button"
            onClick={toggleLang}
            className={`flex items-center h-10 px-1 rounded-2xl transition w-full ${
              isDark ? 'hover:bg-white/10 text-cyan-300' : 'hover:bg-black/5 text-cyan-700'
            }`}
            title={isRtl ? 'Switch to English' : 'التحويل إلى العربية'}
          >
            <div className="w-11 h-10 flex items-center justify-center flex-shrink-0 mx-auto group-hover/sidebar:mx-0 font-bold text-xs">
              <span className="px-1.5 py-0.5 rounded-lg border border-current text-[10px] leading-tight">
                {i18n.language === 'ar' ? 'EN' : 'ع'}
              </span>
            </div>
            <span className="opacity-0 w-0 group-hover/sidebar:opacity-100 group-hover/sidebar:w-auto transition-all duration-200 text-xs font-semibold truncate ms-1.5 whitespace-nowrap overflow-hidden">
              {i18n.language === 'ar' ? 'English' : 'العربية'}
            </span>
          </button>

          {/* User Menu Avatar */}
          <div className="pt-0.5 w-full">
            <UserMenu isSidebar={true} />
          </div>
        </div>
      </aside>

      {/* =================================================================== */}
      {/* 2. MOBILE TOP FLOATING BAR (Phone Screens < md)                    */}
      {/* =================================================================== */}
      <div className="md:hidden">
        {/* Spacer for Mobile Document Flow */}
        <div className="h-14 mt-2 w-full pointer-events-none opacity-0 shrink-0" aria-hidden="true" />

        <div className="fixed top-2.5 left-2.5 right-2.5 z-[90]">
          <header
            style={{
              background: isDark
                ? `linear-gradient(135deg, rgba(${themeInfo.colorRgb}, 0.24) 0%, rgba(11, 16, 27, 0.90) 45%, rgba(0, 0, 0, 0.96) 100%)`
                : `linear-gradient(135deg, rgba(${themeInfo.colorRgb}, 0.14) 0%, rgba(255, 255, 255, 0.94) 40%, rgba(246, 248, 252, 0.98) 100%)`,
              borderColor: isDark
                ? `rgba(${themeInfo.colorRgb}, 0.38)`
                : `rgba(${themeInfo.colorRgb}, 0.28)`,
              boxShadow: isDark
                ? `0 14px 45px -10px rgba(0, 0, 0, 0.85), 0 0 28px -4px ${themeInfo.glow}`
                : `0 12px 35px -8px rgba(0, 0, 0, 0.10), 0 0 20px -4px rgba(${themeInfo.colorRgb}, 0.25)`,
            }}
            className={`rounded-full backdrop-blur-2xl border transition-all duration-300 ${
              isDark ? 'text-white' : 'text-slate-800'
            }`}
          >
            <div className="h-14 px-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Back Button */}
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 border border-white/15 text-white/90'
                      : 'bg-black/5 hover:bg-black/10 border border-black/10 text-slate-700'
                  }`}
                  title={isRtl ? 'رجوع للخلف' : 'Go Back'}
                >
                  {isRtl ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
                </button>

                {/* Hamburger Toggle */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label={isRtl ? 'القائمة الرئيسية' : 'Menu'}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition flex-shrink-0 ${
                    isDark
                      ? 'bg-white/10 hover:bg-white/20 border border-white/15 text-white/90'
                      : 'bg-black/5 hover:bg-black/10 border border-black/10 text-slate-700'
                  }`}
                >
                  <Menu size={18} />
                </button>

                {/* Brand */}
                <Link to="/" className="flex items-center gap-2">
                  <img src="/favicon.jpg" alt="ARN" className="w-8 h-8 rounded-full object-cover shadow-sm" />
                  <span className="font-extrabold text-sm tracking-tight">ARN Stream</span>
                </Link>
              </div>

              {/* Mobile Right Tools */}
              <div className="flex items-center gap-1.5">
                {/* Cast / Remote Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (activeRemoteSession) {
                      openFullRemote();
                    } else {
                      openCastModal(null);
                    }
                  }}
                  className={`px-2 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1 shadow-sm transition active:scale-95 ${
                    activeRemoteSession
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white animate-pulse border border-rose-400/30'
                      : (isDark ? 'bg-white/10 hover:bg-white/20 text-white/90' : 'bg-black/5 hover:bg-black/10 text-slate-700')
                  }`}
                  title={activeRemoteSession
                    ? (isRtl ? `التحكم في ${activeRemoteSession.targetDeviceName}` : `Control ${activeRemoteSession.targetDeviceName}`)
                    : (isRtl ? 'البث والتحكم بالأجهزة' : 'Cast & Remote')}
                >
                  <Cast size={13} className={activeRemoteSession ? 'text-white' : 'text-emerald-400'} />
                  <span className="truncate max-w-[65px]">
                    {activeRemoteSession ? activeRemoteSession.targetDeviceName : (isRtl ? 'بث' : 'Cast')}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !mobileSearchOpen;
                    setMobileSearchOpen(next);
                    if (next && q.trim()) setIsDropdownOpen(true);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                    isDark ? 'bg-white/10 text-white' : 'bg-black/5 text-slate-700'
                  }`}
                  title={isRtl ? 'بحث' : 'Search'}
                >
                  <Search size={16} />
                </button>

                <UserMenu />
              </div>
            </div>

            {/* Mobile Search Input Drawer */}
            {mobileSearchOpen && (
              <div ref={mobileSearchRef} className={`px-3 pb-3 pt-1 border-t relative animate-fadeIn ${
                isDark ? 'border-white/10' : 'border-slate-200'
              }`}>
                <form onSubmit={handleSearch} className="flex items-center relative">
                  <Search size={15} className={`absolute start-3 pointer-events-none ${isDark ? 'text-white/50' : 'text-slate-400'}`} />
                  <input
                    autoFocus
                    value={q}
                    onChange={e => setQ(e.target.value)}
                    onFocus={() => { if (q.trim()) setIsDropdownOpen(true); }}
                    onKeyDown={handleKeyDown}
                    placeholder={isRtl ? 'بحث عن محتوى...' : t('actions.searchPlaceholder')}
                    className={`w-full h-9 rounded-full ps-9 pe-8 text-xs focus:outline-none border shadow-inner ${
                      isDark
                        ? 'bg-black/40 border-white/20 text-white placeholder:text-white/50'
                        : 'bg-black/[0.04] border-black/10 text-slate-900 placeholder:text-slate-400'
                    }`}
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => { setQ(''); setIsDropdownOpen(false); }}
                      className="absolute end-2.5 w-5 h-5 flex items-center justify-center text-muted hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  )}
                </form>

                <PredictiveSearchDropdown
                  isOpen={isDropdownOpen}
                  results={searchSuggestions}
                  prediction={prediction}
                  query={q}
                  selectedIndex={selectedIndex}
                  isLoading={isSearching}
                  onSelect={handleSelectItem}
                  onSelectPrediction={handleSelectPrediction}
                  onViewAll={handleViewAll}
                  isRtl={isRtl}
                />
              </div>
            )}
          </header>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 3. MOBILE SLIDE-OVER DRAWER (From Right in AR, Left in EN)         */}
      {/* =================================================================== */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] md:hidden animate-fadeIn">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div 
            style={{
              background: isDark
                ? `linear-gradient(180deg, rgba(${themeInfo.colorRgb}, 0.28) 0%, rgba(11, 16, 27, 0.96) 35%, rgba(0, 0, 0, 0.98) 100%)`
                : `linear-gradient(180deg, rgba(${themeInfo.colorRgb}, 0.15) 0%, rgba(255, 255, 255, 0.96) 35%, rgba(245, 247, 252, 0.99) 100%)`,
              borderColor: isDark ? `rgba(${themeInfo.colorRgb}, 0.35)` : `rgba(${themeInfo.colorRgb}, 0.25)`
            }}
            className={`absolute inset-y-0 ${isRtl ? 'right-0' : 'left-0'} w-72 max-w-[85vw] backdrop-blur-2xl border-${isRtl ? 's' : 'e'} shadow-2xl p-5 flex flex-col justify-between overflow-y-auto z-10 animate-slideIn ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            <div>
              {/* Drawer Header */}
              <div className={`flex items-center justify-between pb-4 border-b mb-4 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                <Link 
                  to="/" 
                  onClick={() => setMobileMenuOpen(false)} 
                  className={`font-bold text-lg tracking-tight flex items-center gap-2.5 ${isDark ? 'text-white' : 'text-slate-900'}`}
                >
                  <img src="/favicon.jpg" alt="ARN Technology" className="w-8 h-8 rounded-full object-cover shadow-sm" />
                  <span>ARN Stream</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition ${
                    isDark ? 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white' : 'bg-black/5 hover:bg-black/10 text-slate-600 hover:text-slate-950'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Navigation Links */}
              <div className="space-y-1 mb-5">
                <Link
                  to="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    location.pathname === '/' 
                      ? (isDark ? 'bg-white/20 text-white font-bold shadow-md border border-white/20' : 'bg-black/10 text-slate-950 font-bold shadow-sm border border-black/10')
                      : (isDark ? 'text-white/80 hover:bg-white/10' : 'text-slate-600 hover:bg-black/5')
                  }`}
                >
                  <Home size={18} /> 
                  <span>{t('common.home')}</span>
                </Link>

                {/* البث المباشر */}
                <Link
                  to="/live"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    location.pathname === '/live' 
                      ? (isDark ? 'bg-red-600/35 text-white font-bold shadow-md border border-red-500/30' : 'bg-red-50 text-red-600 font-bold shadow-sm border border-red-200')
                      : (isDark ? 'text-white/80 hover:bg-white/10' : 'text-slate-600 hover:bg-black/5')
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Tv size={18} className={location.pathname === '/live' ? 'text-red-400' : ''} /> 
                    <span>{t('common.liveTv')}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                    LIVE
                  </span>
                </Link>

                {/* بث وتحكم الأجهزة */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (activeRemoteSession) {
                      openFullRemote();
                    } else {
                      openCastModal(null);
                    }
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition ${
                    activeRemoteSession
                      ? 'bg-gradient-to-r from-red-600/30 to-rose-600/30 text-rose-300 font-bold border border-rose-500/40 shadow-md'
                      : (isDark ? 'text-white/80 hover:bg-white/10' : 'text-slate-600 hover:bg-black/5')
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Cast size={18} className={activeRemoteSession ? 'text-rose-400' : 'text-emerald-400'} />
                    <span>
                      {activeRemoteSession
                        ? (isRtl ? `التحكم: ${activeRemoteSession.targetDeviceName}` : `Remote: ${activeRemoteSession.targetDeviceName}`)
                        : (isRtl ? 'بث وتحكم الأجهزة' : 'Cast & Remote')}
                    </span>
                  </div>
                  {activeRemoteSession ? (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                      ACTIVE
                    </span>
                  ) : (
                    onlineDevices?.length > 1 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {onlineDevices.length - 1}
                      </span>
                    )
                  )}
                </button>
              </div>

              {/* Libraries List */}
              {sortedLibraries.length > 0 && (
                <div className="mb-4">
                  <div className={`text-[11px] font-bold uppercase tracking-wider px-3 mb-2 ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
                    {isRtl ? 'المكتبات المتاحة' : 'Libraries'}
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto pe-1">
                    {sortedLibraries.map(lib => (
                      <Link
                        key={lib.id}
                        to={`/library/${lib.id}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2 rounded-xl text-xs transition ${
                          location.pathname === `/library/${lib.id}`
                            ? (isDark ? 'bg-white/25 text-white font-bold border border-white/30 shadow' : 'bg-black/10 text-slate-950 font-bold border border-black/10 shadow-sm')
                            : (isDark ? 'text-white/80 hover:bg-white/10' : 'text-slate-600 hover:bg-black/5')
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          {getLibIcon(lib)}
                          <span className="truncate">{localizeLibraryName(lib.name, isRtl)}</span>
                        </div>
                        {lib.media_count !== undefined && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border flex-shrink-0 ${
                            isDark ? 'bg-white/10 border-white/15 text-white/80' : 'bg-black/5 border-black/10 text-slate-600'
                          }`}>
                            {lib.media_count}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Tools in Mobile Drawer */}
            <div className={`pt-4 border-t space-y-2 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              {useAuthStore.getState().isAdmin() && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleScan();
                  }}
                  disabled={scanning}
                  style={{ color: themeInfo.color }}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-50 ${
                    isDark ? 'bg-white text-black' : 'bg-white border border-slate-200 text-slate-800'
                  }`}
                >
                  <Scan size={15} className={scanning ? 'animate-spin' : ''} />
                  <span>{scanning ? t('actions.scanning') : (isRtl ? 'فحص ومزامنة المكتبة' : t('actions.scan'))}</span>
                </button>
              )}

              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition ${
                  isDark ? 'bg-white/10 hover:bg-white/20 border-white/15 text-[#10b981]' : 'bg-black/5 hover:bg-black/10 border-black/10 text-[#059669]'
                }`}
              >
                <Settings size={15} /> 
                <span>{isRtl ? 'لوحة التحكم والإعدادات' : 'Dashboard & Settings'}</span>
              </Link>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs transition ${
                    isDark ? 'bg-white/10 hover:bg-white/20 border-white/15 text-white' : 'bg-black/5 hover:bg-black/10 border-black/10 text-slate-700'
                  }`}
                >
                  {isDark ? <Sun size={15} /> : <Moon size={15} />}
                  <span>{isDark ? (isRtl ? 'النهاري' : 'Light') : (isRtl ? 'الليلي' : 'Dark')}</span>
                </button>
                <button
                  type="button"
                  onClick={toggleLang}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs transition font-bold ${
                    isDark ? 'bg-white/10 hover:bg-white/20 border-white/15 text-white' : 'bg-black/5 hover:bg-black/10 border-black/10 text-slate-700'
                  }`}
                >
                  <Languages size={15} />
                  <span>{i18n.language === 'ar' ? 'English' : 'عربي'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Glassmorphic QR Code Modal for Phone Connection */}
      <ServerQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />
    </>
  );
}
