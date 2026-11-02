import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Film, Tv, Music, User, Home, Compass, Sparkles,
  Sun, Moon, Languages, Zap, Activity, Folder, Play, ArrowLeft,
  ArrowRight, Command, X, Loader2
} from 'lucide-react';
import { fetchLibraries, fetchSearchSuggestions, fetchLibrary } from '../../api/client';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { localizeLibraryName } from '../../utils/localization';

export default function CommandPalette() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    theme,
    setTheme,
    performanceMode,
    togglePerformanceMode
  } = useSettingsStore();

  const isAdmin = useAuthStore((s) => s.isAdmin());
  const playTrack = usePlayerStore((s) => s.playTrack);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef(null);

  const { data: libraries = [] } = useQuery({
    queryKey: ['libraries', { nonEmpty: true }],
    queryFn: () => fetchLibraries(true),
    enabled: commandPaletteOpen
  });

  // Global Ctrl+K / Cmd+K / Alt+K / '/' shortcut (supports Arabic & English keyboard layouts in capture phase)
  useEffect(() => {
    const onKeyDown = (e) => {
      const isK =
        e.code === 'KeyK' ||
        e.keyCode === 75 ||
        e.which === 75 ||
        e.key?.toLowerCase() === 'k' ||
        e.key === 'ن' ||
        e.key === '،';

      if ((e.ctrlKey || e.metaKey || e.altKey) && isK) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        setCommandPaletteOpen(!useSettingsStore.getState().commandPaletteOpen);
        return false;
      }

      if (e.key === 'Escape' && useSettingsStore.getState().commandPaletteOpen) {
        e.preventDefault();
        e.stopPropagation();
        setCommandPaletteOpen(false);
        return false;
      }

      if (
        (e.code === 'Slash' || e.key === '/') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !useSettingsStore.getState().commandPaletteOpen
      ) {
        const active = document.activeElement;
        const tag = active?.tagName;
        const isEditable =
          active?.isContentEditable ||
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT';
        if (!isEditable) {
          e.preventDefault();
          setCommandPaletteOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [setCommandPaletteOpen]);

  // Close on route change
  useEffect(() => {
    setCommandPaletteOpen(false);
  }, [location.pathname, setCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [commandPaletteOpen]);

  // Debounced live search
  useEffect(() => {
    if (!commandPaletteOpen) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setIsSearching(false);
      setActiveIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchSearchSuggestions(q, 12);
        const items = data?.data || data?.results || (Array.isArray(data) ? data : []);
        setResults(items);
        setActiveIndex(0);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 110);

    return () => clearTimeout(timer);
  }, [query, commandPaletteOpen]);

  // Quick Commands & Navigation when query is empty
  const quickItems = useMemo(() => {
    const navItems = [
      {
        id: 'nav-home',
        group: isRtl ? 'التنقل السريع' : 'Quick Navigation',
        title: isRtl ? 'الصفحة الرئيسية' : 'Home Page',
        subtitle: isRtl ? 'العودة إلى واجهة المنصة الرئيسية' : 'Go to main landing screen',
        icon: Home,
        color: 'text-sky-400 bg-sky-500/15',
        action: () => navigate('/')
      },
      {
        id: 'nav-live',
        group: isRtl ? 'التنقل السريع' : 'Quick Navigation',
        title: isRtl ? 'البث المباشر (Live TV)' : 'Live TV Channels',
        subtitle: isRtl ? 'القنوات الرياضية والإخبارية المباشرة' : 'Watch live channels',
        icon: Tv,
        color: 'text-red-400 bg-red-500/15',
        action: () => {
          usePlayerStore.getState().stopMusicForVideo();
          navigate('/live');
        }
      },
      {
        id: 'nav-collections',
        group: isRtl ? 'التنقل السريع' : 'Quick Navigation',
        title: isRtl ? 'المجموعات والسلاسل' : 'Collections',
        subtitle: isRtl ? 'تصفح المجموعات السينمائية المنسقة' : 'Browse curated collections',
        icon: Compass,
        color: 'text-amber-400 bg-amber-500/15',
        action: () => navigate('/collections')
      }
    ];

    if (isAdmin) {
      navItems.push({
        id: 'nav-dashboard',
        group: isRtl ? 'التنقل السريع' : 'Quick Navigation',
        title: isRtl ? 'لوحة التحكم والإدارة' : 'Admin Dashboard',
        subtitle: isRtl ? 'إحصائيات السيرفر، المستخدمين، والمكتبات' : 'Server stats, users, and libraries',
        icon: Activity,
        color: 'text-cyan-400 bg-cyan-500/15',
        action: () => navigate('/dashboard')
      });
    }

    const libItems = libraries.map((lib) => ({
      id: `lib-${lib.id}`,
      group: isRtl ? 'المكتبات' : 'Libraries',
      title: localizeLibraryName(lib.name, isRtl),
      subtitle: isRtl ? `${lib.media_count || 0} عنصر متاح` : `${lib.media_count || 0} items`,
      icon: lib.type === 'music' ? Music : lib.type === 'shows' ? Tv : Film,
      color: lib.type === 'music' ? 'text-emerald-400 bg-emerald-500/15' : 'text-purple-400 bg-purple-500/15',
      onHover: () => {
        qc.prefetchQuery({
          queryKey: ['library', String(lib.id), { sort: 'added_at', order: 'desc', view: 'artists' }],
          queryFn: () => fetchLibrary(lib.id, { sort: 'added_at', order: 'desc', view: 'artists' }),
          staleTime: 5 * 60 * 1000
        });
      },
      action: () => navigate(`/library/${lib.id}`)
    }));

    const sysActions = [
      {
        id: 'act-perf',
        group: isRtl ? 'إجراءات سريعة' : 'Quick Actions',
        title: performanceMode === 'turbo'
          ? (isRtl ? 'تفعيل وضع الفخامة البصرية (Ultra Glass)' : 'Switch to Ultra Glass Mode')
          : (isRtl ? 'تفعيل وضع السرعة الفائقة (Turbo GPU 120fps)' : 'Switch to Turbo GPU Mode (120fps)'),
        subtitle: performanceMode === 'turbo'
          ? (isRtl ? 'الوضع الحالي: Turbo GPU الخفيف' : 'Current: Turbo GPU Eco Mode')
          : (isRtl ? 'تخفيف استهلاك كارت الشاشة للأجهزة الضعيفة والشاشات' : 'Reduce GPU load for maximum framerate'),
        icon: Zap,
        color: 'text-amber-400 bg-amber-500/15',
        action: () => {
          togglePerformanceMode();
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'act-theme',
        group: isRtl ? 'إجراءات سريعة' : 'Quick Actions',
        title: theme === 'light'
          ? (isRtl ? 'التبديل إلى الوضع الداكن' : 'Switch to Dark Mode')
          : (isRtl ? 'التبديل إلى الوضع الفاتح' : 'Switch to Light Mode'),
        subtitle: isRtl ? 'تغيير مظهر المنصة فوراً' : 'Toggle interface theme',
        icon: theme === 'light' ? Moon : Sun,
        color: 'text-indigo-400 bg-indigo-500/15',
        action: () => {
          setTheme(theme === 'light' ? 'dark' : 'light');
          setCommandPaletteOpen(false);
        }
      },
      {
        id: 'act-lang',
        group: isRtl ? 'إجراءات سريعة' : 'Quick Actions',
        title: isRtl ? 'Switch Language to English' : 'تغيير اللغة إلى العربية',
        subtitle: isRtl ? 'تبديل لغة واتجاه الواجهة' : 'Switch interface language & direction',
        icon: Languages,
        color: 'text-teal-400 bg-teal-500/15',
        action: () => {
          i18n.changeLanguage(isRtl ? 'en' : 'ar');
          setCommandPaletteOpen(false);
        }
      }
    ];

    return [...navItems, ...libItems, ...sysActions];
  }, [libraries, isRtl, isAdmin, performanceMode, theme, navigate, qc, togglePerformanceMode, setTheme, i18n, setCommandPaletteOpen]);

  const handleSelectSearchResult = (item) => {
    setCommandPaletteOpen(false);
    if (item.type === 'movie') {
      navigate(`/movies/${item.id}`);
    } else if (item.type === 'series') {
      navigate(`/series/${item.id}`);
    } else if (item.type === 'artist') {
      navigate(`/music/artist/${item.id}`);
    } else if (item.type === 'album') {
      navigate(`/music/album/${item.id}`);
    } else if (item.type === 'track') {
      if (item.id) {
        playTrack({
          id: item.id,
          title: item.title,
          artistName: item.artistName || item.subtitle || '',
          albumTitle: item.albumTitle || '',
          cover: item.poster || null,
          url: `/api/stream/track/${item.id}`
        });
      }
      if (item.album_id) navigate(`/music/album/${item.album_id}`);
    } else {
      navigate(`/search?q=${encodeURIComponent(item.title || query)}`);
    }
  };

  const isQueryMode = query.trim().length > 0;
  const activeList = isQueryMode ? results : quickItems;

  const handleKeyDown = (e) => {
    if (!activeList.length) {
      if (e.key === 'Enter' && isQueryMode) {
        setCommandPaletteOpen(false);
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % activeList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + activeList.length) % activeList.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = activeList[activeIndex];
      if (!chosen) return;
      if (isQueryMode) {
        handleSelectSearchResult(chosen);
      } else if (chosen.action) {
        chosen.action();
      }
    }
  };

  if (!commandPaletteOpen) return null;

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4 bg-black/65 backdrop-blur-md animate-fadeIn"
      onClick={() => setCommandPaletteOpen(false)}
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-3xl overflow-hidden bg-[#0f172a]/95 dark:bg-[#0b1120]/95 border border-white/15 shadow-[0_25px_80px_rgba(0,0,0,0.85)] text-white"
      >
        {/* Top Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 flex-shrink-0">
            {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRtl
                ? 'ابحث عن فيلم، مسلسل، قارئ، سورة، أو نفّذ أمراً سريعاً...'
                : 'Search movies, series, reciters, tracks, or run a command...'
            }
            className="w-full bg-transparent text-white placeholder-slate-400 text-sm sm:text-base font-medium focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            >
              <X size={16} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold text-slate-300 bg-white/10 rounded-lg border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Body List */}
        <div className="max-h-[60vh] overflow-y-auto p-2.5 space-y-1">
          {isQueryMode ? (
            results.length > 0 ? (
              results.map((item, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => handleSelectSearchResult(item)}
                    className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected ? 'bg-white/12 border border-white/15 shadow-md' : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="w-11 h-14 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 border border-white/10 flex items-center justify-center">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      ) : item.type === 'track' ? (
                        <Music size={18} className="text-emerald-400" />
                      ) : item.type === 'artist' ? (
                        <User size={18} className="text-amber-400" />
                      ) : item.type === 'series' ? (
                        <Tv size={18} className="text-sky-400" />
                      ) : (
                        <Film size={18} className="text-red-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{item.title}</div>
                      <div className="text-xs text-slate-400 truncate mt-0.5 flex items-center gap-2">
                        <span>
                          {item.type === 'movie'
                            ? (isRtl ? 'فيلم' : 'Movie')
                            : item.type === 'series'
                            ? (isRtl ? 'مسلسل' : 'Series')
                            : item.type === 'artist'
                            ? (isRtl ? 'فنان / قارئ' : 'Artist')
                            : item.type === 'album'
                            ? (isRtl ? 'ألبوم / مصحف' : 'Album')
                            : (isRtl ? 'مقطع صوتي' : 'Audio Track')}
                        </span>
                        {item.year && <span>• {item.year}</span>}
                        {(item.artistName || item.libraryName || item.subtitle) && (
                          <span>• {item.artistName || item.libraryName || item.subtitle}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.type === 'track' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold flex items-center gap-1">
                          <Play size={12} fill="currentColor" />
                          {isRtl ? 'تشغيل' : 'Play'}
                        </span>
                      ) : (
                        <ArrowIcon size={16} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                );
              })
            ) : !isSearching ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                {isRtl ? `لا توجد نتائج مطابقة لـ "${query}"` : `No matching results for "${query}"`}
              </div>
            ) : null
          ) : (
            quickItems.map((cmd, idx) => {
              const Icon = cmd.icon || Folder;
              const isSelected = idx === activeIndex;
              const prevGroup = idx > 0 ? quickItems[idx - 1].group : null;
              const showGroupHeader = cmd.group !== prevGroup;

              return (
                <div key={cmd.id}>
                  {showGroupHeader && (
                    <div className="px-3 pt-2.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      {cmd.group}
                    </div>
                  )}
                  <div
                    onMouseEnter={() => {
                      setActiveIndex(idx);
                      cmd.onHover?.();
                    }}
                    onClick={() => cmd.action?.()}
                    className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all ${
                      isSelected ? 'bg-white/12 border border-white/15 shadow-sm' : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cmd.color}`}>
                      <Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white truncate">{cmd.title}</div>
                      {cmd.subtitle && <div className="text-xs text-slate-400 truncate">{cmd.subtitle}</div>}
                    </div>
                    <ArrowIcon size={15} className="text-slate-400 flex-shrink-0" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hints */}
        <div className="px-5 py-2.5 border-t border-white/10 bg-black/30 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-300 font-mono">↑↓</kbd> {isRtl ? 'للتنقل' : 'Navigate'}</span>
            <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded text-slate-300 font-mono">Enter</kbd> {isRtl ? 'للاختيار' : 'Select'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
            <Command size={12} />
            <span>ARN Spotlight</span>
          </div>
        </div>
      </div>
    </div>
  );
}
