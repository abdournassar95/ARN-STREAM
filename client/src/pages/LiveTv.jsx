import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Tv,
  Film,
  Layers,
  Star,
  History,
  ListPlus,
  Search,
  FolderOpen,
  Radio,
  Play,
  X,
  ChevronDown,
  Maximize2,
  Minimize2,
  KeyRound,
  RefreshCw,
  Sun,
  Moon,
} from 'lucide-react';
import TopBar from '../components/shared/TopBar';
import { useSettingsStore } from '../store/useSettingsStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { HlsVideoPlayer } from '../components/iptv/HlsVideoPlayer';
import { PlaylistModal } from '../components/iptv/PlaylistModal';
import { getCategoryVisual, getChannelFallbackLogo } from '../utils/iptvIcons';
import {
  loadCatalogFromIdb,
  saveCatalogToIdb,
  normalizeChannelItem,
} from '../utils/catalogStorage';

const STORAGE_KEYS = {
  FAVORITES: 'arn_iptv_clean_v5_favorites',
  HISTORY: 'arn_iptv_clean_v5_history',
  CUSTOM_PLAYLISTS: 'arn_iptv_clean_v5_playlists',
  CUSTOM_CATEGORIES: 'arn_iptv_clean_v5_categories',
  CUSTOM_CHANNELS: 'arn_iptv_clean_v5_channels',
};

export default function LiveTv() {
  const { theme, setTheme } = useSettingsStore();
  const isDark = theme !== 'light';

  // Stop background music and terminate music player immediately when Live TV opens
  useEffect(() => {
    usePlayerStore.getState().stopMusicForVideo();
  }, []);

  const [playlists, setPlaylists] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_PLAYLISTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [categories, setCategories] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CATEGORIES);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [channels, setChannels] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHANNELS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.map(normalizeChannelItem) : [];
    } catch {
      return [];
    }
  });

  const [radioCatalog, setRadioCatalog] = useState({ categories: [], channels: [] });

  const [activePlaylistId, setActivePlaylistId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_PLAYLISTS);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed[0].id : '';
    } catch {
      return '';
    }
  });

  const [activeSection, setActiveSection] = useState('live');
  const [selectedCategoryId, setSelectedCategoryId] = useState('ALL');
  const [loadingCategoryId, setLoadingCategoryId] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(false);

  // Collapsible Categories panel
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  // Cinema mode (hides TopBar to give 100% height to IPTV workspace)
  const [isCinemaMode, setIsCinemaMode] = useState(false);

  // Search and Filter States
  const [catSearch, setCatSearch] = useState('');
  const [chSearch, setChSearch] = useState('');
  const [onlyFavFilter, setOnlyFavFilter] = useState(false);

  // Favorites & Watch History IDs
  const [favoriteIds, setFavoriteIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [historyIds, setHistoryIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Currently Playing Channel (Prioritize MBC Masr on startup)
  const [activeChannel, setActiveChannel] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CHANNELS);
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const normalized = parsed.map(normalizeChannelItem);
        const mbcMasr = normalized.find(
          (c) =>
            c.fgLiveId === 'live_tv_mbcmsr' ||
            c.name?.includes('MBC Masr 1') ||
            c.name?.includes('إم بي سي مصر 1') ||
            c.name?.includes('MBC Masr') ||
            c.name?.includes('إم بي سي مصر')
        );
        return mbcMasr || normalized[0];
      }
      return null;
    } catch {
      return null;
    }
  });

  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);

  const handleImportSuccess = useCallback((newPlaylist, newCategories, newChannels) => {
    const normalizedChannels = (newChannels || []).map(normalizeChannelItem);

    setPlaylists((prev) => {
      const updated = [newPlaylist, ...prev.filter((p) => p.id !== newPlaylist.id)];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_PLAYLISTS, JSON.stringify(updated));
      } catch {}
      saveCatalogToIdb('playlists', updated);
      return updated;
    });

    setCategories((prev) => {
      const filtered = prev.filter((c) => c.playlistId !== newPlaylist.id);
      const updated = [...filtered, ...newCategories];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
      } catch {}
      saveCatalogToIdb('categories', updated);
      return updated;
    });

    setChannels((prev) => {
      const filtered = prev.filter((ch) => ch.playlistId !== newPlaylist.id);
      const updated = [...filtered, ...normalizedChannels];
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1000)));
      } catch {}
      saveCatalogToIdb('channels', updated);
      return updated;
    });

    setActivePlaylistId(newPlaylist.id);
    const egyptCat = newCategories.find(
      (c) =>
        c.name.includes('مصر') ||
        c.id.toLowerCase().includes('eg') ||
        c.name.toLowerCase().includes('egypt')
    );

    if (egyptCat) {
      setSelectedCategoryId(egyptCat.id);
      setActiveSection('live');
      const mbcMasr = normalizedChannels.find(
        (ch) =>
          (ch.categoryId === egyptCat.id || ch.groupTitle?.includes('مصر')) &&
          (ch.fgLiveId === 'live_tv_mbcmsr' ||
            ch.name?.includes('MBC Masr 1') ||
            ch.name?.includes('إم بي سي مصر 1') ||
            ch.name?.includes('MBC Masr') ||
            ch.name?.includes('إم بي سي مصر'))
      );
      if (mbcMasr) {
        setActiveChannel(mbcMasr);
      } else {
        const egyptChannel = normalizedChannels.find((ch) => ch.categoryId === egyptCat.id);
        setActiveChannel(egyptChannel || normalizedChannels[0] || null);
      }
    } else {
      setSelectedCategoryId('ALL');
      if (normalizedChannels.length > 0) {
        setActiveChannel(normalizedChannels[0]);
      }
    }
  }, []);

  const loadBuiltinCatalog = useCallback(async () => {
    setIsBootstrapping(true);
    try {
      const resp = await fetch('/api/live/catalog/builtin');
      const data = await resp.json();
      if (data.success && data.playlist) {
        handleImportSuccess(data.playlist, data.categories || [], data.channels || []);
      }
    } catch (err) {
      console.warn('[ARN IPTV] Failed to load built-in catalog:', err);
    } finally {
      setIsBootstrapping(false);
    }
  }, [handleImportSuccess]);

  // Fetch Arabic Radio & Quran catalog on mount
  useEffect(() => {
    let active = true;
    fetch('/api/live/radio/catalog')
      .then((r) => r.json())
      .then((data) => {
        if (!active || !data.success) return;
        setRadioCatalog({
          categories: data.categories || [],
          channels: (data.channels || []).map(normalizeChannelItem),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Hydrate full catalog from IndexedDB on startup, or bootstrap built-in catalog if empty
  useEffect(() => {
    let active = true;
    Promise.all([
      loadCatalogFromIdb('playlists'),
      loadCatalogFromIdb('categories'),
      loadCatalogFromIdb('channels'),
    ])
      .then(([idbPlaylists, idbCategories, idbChannels]) => {
        if (!active) return;
        const hasIdbData =
          idbPlaylists && idbPlaylists.length > 0 && idbChannels && idbChannels.length > 0;

        if (hasIdbData) {
          setPlaylists(idbPlaylists);
          setActivePlaylistId((prev) => prev || idbPlaylists[0].id);
          if (idbCategories && idbCategories.length > 0) {
            setCategories(idbCategories);
          }
          setChannels((prev) => (idbChannels.length >= prev.length ? idbChannels : prev));
          setActiveChannel((prev) => {
            if (prev) return normalizeChannelItem(prev);
            const mbcMasr = idbChannels.find(
              (c) =>
                c.fgLiveId === 'live_tv_mbcmsr' ||
                c.name?.includes('MBC Masr 1') ||
                c.name?.includes('إم بي سي مصر 1') ||
                c.name?.includes('MBC Masr') ||
                c.name?.includes('إم بي سي مصر')
            );
            return mbcMasr || idbChannels[0] || null;
          });
        } else if (playlists.length === 0 && channels.length === 0) {
          // Automatically bootstrap the built-in Arabic + 61 Egyptian + Radio catalog on first visit
          loadBuiltinCatalog();
        }
      })
      .catch(() => {
        if (active && playlists.length === 0 && channels.length === 0) {
          loadBuiltinCatalog();
        }
      });

    return () => {
      active = false;
    };
  }, []);

  // Persist Favorites & History
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favoriteIds));
    } catch {}
  }, [favoriteIds]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(historyIds));
    } catch {}
  }, [historyIds]);

  // Keep active playlist valid if lists change
  useEffect(() => {
    if (playlists.length > 0 && (!activePlaylistId || !playlists.some((p) => p.id === activePlaylistId))) {
      setActivePlaylistId(playlists[0].id);
    }
  }, [playlists, activePlaylistId]);

  // Set default category and active channel when switching section or playlist
  useEffect(() => {
    if (activeSection === 'radio') {
      setSelectedCategoryId('rad-cat-eg');
      const firstEgRadio =
        radioCatalog.channels.find((ch) => ch.categoryId === 'rad-cat-eg') ||
        radioCatalog.channels[0];
      if (firstEgRadio) {
        setActiveChannel(firstEgRadio);
      }
    } else if (activeSection === 'live') {
      const egyptCat = categories.find(
        (c) =>
          c.playlistId === activePlaylistId &&
          (c.name.includes('مصر') ||
            c.id.toLowerCase().includes('eg') ||
            c.name.toLowerCase().includes('egypt'))
      );
      if (egyptCat) {
        setSelectedCategoryId(egyptCat.id);
      } else {
        setSelectedCategoryId('ALL');
      }
      // If coming back from Radio, automatically resume a Live TV channel (MBC Masr 1 preferred)
      setActiveChannel((prev) => {
        if (prev && prev.section !== 'radio') return prev;
        const liveChs = channels.filter(
          (c) => c.playlistId === activePlaylistId && c.section !== 'radio'
        );
        const mbcMasr = liveChs.find(
          (c) =>
            c.fgLiveId === 'live_tv_mbcmsr' ||
            c.name?.includes('MBC Masr 1') ||
            c.name?.includes('إم بي سي مصر 1') ||
            c.name?.includes('MBC Masr') ||
            c.name?.includes('إم بي سي مصر')
        );
        return mbcMasr || liveChs[0] || prev;
      });
    } else {
      setSelectedCategoryId('ALL');
    }
  }, [activeSection, activePlaylistId, radioCatalog.channels.length]);

  // Fetch channels on demand when clicking a category with remoteTopic that hasn't loaded channels yet
  useEffect(() => {
    if (selectedCategoryId === 'ALL' || !activePlaylistId) return;
    const cat = categories.find(
      (c) => c.id === selectedCategoryId && c.playlistId === activePlaylistId
    );
    if (!cat || !cat.remoteTopic) return;

    const isEgypt =
      cat.name.includes('مصر') ||
      cat.id.toLowerCase().includes('eg') ||
      cat.name.toLowerCase().includes('egypt');

    const hasAhlyOrSport = channels.some(
      (ch) =>
        ch.playlistId === activePlaylistId &&
        (ch.categoryId === selectedCategoryId || ch.groupTitle?.includes('مصر')) &&
        (ch.fgLiveId === 'live_tv_alahlytv' ||
          ch.name?.includes('الاهلي') ||
          ch.name?.includes('Ahly') ||
          ch.name?.includes('أون سبورت') ||
          ch.name?.includes('Sport'))
    );

    const existingCount = channels.filter(
      (ch) =>
        ch.playlistId === activePlaylistId &&
        (ch.categoryId === selectedCategoryId || (isEgypt && ch.groupTitle?.includes('مصر')))
    ).length;

    if (existingCount >= (cat.count || 50) && (!isEgypt || hasAhlyOrSport)) return;

    let cancelled = false;
    const activePl = playlists.find((p) => p.id === activePlaylistId);
    const code = activePl?.type === 'fg_code' ? activePl.codeOrUrl : '232425';
    const remoteTopicToFetch = isEgypt ? '20' : cat.remoteTopic;

    setLoadingCategoryId(selectedCategoryId);
    fetch(
      `/api/live/fg/topic/${encodeURIComponent(remoteTopicToFetch)}?code=${encodeURIComponent(
        code
      )}&playlistId=${encodeURIComponent(activePlaylistId)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.success || !Array.isArray(data.channels)) return;
        const normalized = data.channels.map((ch) =>
          normalizeChannelItem({
            ...ch,
            playlistId: activePlaylistId,
            categoryId: cat.id,
          })
        );
        setChannels((prev) => {
          const filtered = prev.filter(
            (c) => !(c.playlistId === activePlaylistId && c.categoryId === cat.id)
          );
          const updated = [...filtered, ...normalized];
          try {
            localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1000)));
            saveCatalogToIdb('channels', updated);
          } catch {}
          return updated;
        });
        if (normalized.length > 0) {
          setCategories((prev) =>
            prev.map((c) =>
              c.id === cat.id && c.playlistId === activePlaylistId
                ? { ...c, count: normalized.length }
                : c
            )
          );
        }
      })
      .catch((fetchErr) => {
        console.warn(`[ARN IPTV] Failed to fetch channels for category "${cat?.name || selectedCategoryId}":`, fetchErr);
      })
      .finally(() => {
        if (!cancelled) setLoadingCategoryId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCategoryId, activePlaylistId, categories, channels, playlists]);

  const toggleFavorite = (channelId) => {
    setFavoriteIds((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [channelId, ...prev]
    );
  };

  const handleChannelWatched = useCallback((ch) => {
    setHistoryIds((prev) => [ch.id, ...prev.filter((id) => id !== ch.id)].slice(0, 50));
  }, []);

  const handleServersLoaded = useCallback((channelId, loadedServers) => {
    setChannels((prev) =>
      prev.map((ch) => (ch.id === channelId ? { ...ch, sources: loadedServers } : ch))
    );
    setActiveChannel((prev) =>
      prev && prev.id === channelId ? { ...prev, sources: loadedServers } : prev
    );
  }, []);

  const handleDeletePlaylist = (playlistId) => {
    setPlaylists((prev) => {
      const updated = prev.filter((p) => p.id !== playlistId);
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_PLAYLISTS, JSON.stringify(updated));
      } catch {}
      saveCatalogToIdb('playlists', updated);
      return updated;
    });
    setCategories((prev) => {
      const updated = prev.filter((c) => c.playlistId !== playlistId);
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(updated));
      } catch {}
      saveCatalogToIdb('categories', updated);
      return updated;
    });
    setChannels((prev) => {
      const updated = prev.filter((ch) => ch.playlistId !== playlistId);
      try {
        localStorage.setItem(STORAGE_KEYS.CUSTOM_CHANNELS, JSON.stringify(updated.slice(0, 1000)));
      } catch {}
      saveCatalogToIdb('channels', updated);
      return updated;
    });

    if (activePlaylistId === playlistId) {
      const remaining = playlists.filter((p) => p.id !== playlistId);
      const nextId = remaining.length > 0 ? remaining[0].id : '';
      setActivePlaylistId(nextId);
      const nextCh = channels.find((c) => c.playlistId === nextId);
      setActiveChannel(nextCh || null);
    }
  };

  // Filtered Categories for Categories Panel
  const visibleCategories = useMemo(() => {
    if (activeSection === 'radio') {
      const plId = activePlaylistId || 'arn-arabic-radio-2026';
      return radioCatalog.categories
        .map((cat) => {
          const matching = radioCatalog.channels.filter((ch) => ch.categoryId === cat.id);
          const count = matching.length > 0 ? matching.length : cat.count;
          return {
            ...cat,
            playlistId: plId,
            count,
          };
        })
        .filter((cat) => {
          if (catSearch.trim() && !cat.name.toLowerCase().includes(catSearch.trim().toLowerCase())) {
            return false;
          }
          return true;
        });
    }

    if (!activePlaylistId) return [];
    const baseSection = activeSection === 'fav' || activeSection === 'history' ? null : activeSection;
    return categories.filter((cat) => {
      if (cat.playlistId !== activePlaylistId) return false;
      if (baseSection && cat.section !== baseSection) return false;
      if (catSearch.trim() && !cat.name.toLowerCase().includes(catSearch.trim().toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [categories, activePlaylistId, activeSection, catSearch, radioCatalog]);

  // Filtered Channels for Channels Panel
  const visibleChannels = useMemo(() => {
    if (activeSection === 'radio') {
      const plId = activePlaylistId || 'arn-arabic-radio-2026';
      let list = radioCatalog.channels.map((ch) => ({ ...ch, playlistId: plId }));
      if (selectedCategoryId !== 'ALL') {
        list = list.filter((ch) => ch.categoryId === selectedCategoryId);
      }
      if (onlyFavFilter) {
        list = list.filter((ch) => favoriteIds.includes(ch.id));
      }
      if (chSearch.trim()) {
        const q = chSearch.trim().toLowerCase();
        list = list.filter(
          (ch) => ch.name.toLowerCase().includes(q) || ch.groupTitle.toLowerCase().includes(q)
        );
      }
      return list;
    }

    if (playlists.length === 0) return [];
    let list = channels.filter((ch) => ch.playlistId === activePlaylistId);

    if (activeSection === 'fav') {
      list = channels.filter((ch) => favoriteIds.includes(ch.id));
    } else if (activeSection === 'history') {
      list = historyIds
        .map((id) => channels.find((c) => c.id === id))
        .filter(Boolean);
    } else {
      list = list.filter((ch) => ch.section === activeSection);
    }

    if (selectedCategoryId !== 'ALL') {
      const selectedCat = categories.find(
        (c) => c.id === selectedCategoryId && c.playlistId === activePlaylistId
      );
      const isEgyptCategory =
        selectedCat &&
        (selectedCat.name.includes('مصر') ||
          selectedCat.id.toLowerCase().includes('eg') ||
          selectedCat.id.toLowerCase().includes('20') ||
          selectedCat.name.toLowerCase().includes('egypt'));

      list = list.filter((ch) => {
        if (ch.categoryId === selectedCategoryId) return true;
        if (
          isEgyptCategory &&
          (ch.groupTitle?.includes('مصر') ||
            ch.categoryId?.toLowerCase().includes('eg') ||
            ch.categoryId?.toLowerCase().includes('20'))
        ) {
          return true;
        }
        return false;
      });
    }

    if (onlyFavFilter) {
      list = list.filter((ch) => favoriteIds.includes(ch.id));
    }

    if (chSearch.trim()) {
      const q = chSearch.trim().toLowerCase();
      list = list.filter(
        (ch) => ch.name.toLowerCase().includes(q) || ch.groupTitle?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [
    channels,
    activePlaylistId,
    activeSection,
    selectedCategoryId,
    onlyFavFilter,
    chSearch,
    favoriteIds,
    historyIds,
    playlists.length,
    categories,
    radioCatalog.channels,
  ]);

  const currentCategoryObj = useMemo(() => {
    if (selectedCategoryId === 'ALL') return null;
    return (
      categories.find((c) => c.id === selectedCategoryId) ||
      radioCatalog.categories.find((c) => c.id === selectedCategoryId) ||
      null
    );
  }, [selectedCategoryId, categories, radioCatalog.categories]);

  const currentCategoryVisual = useMemo(() => {
    if (!currentCategoryObj) return null;
    return getCategoryVisual(
      currentCategoryObj.name,
      currentCategoryObj.remoteTopic,
      currentCategoryObj.icon,
      currentCategoryObj.flag
    );
  }, [currentCategoryObj]);

  const currentCategoryTitle = useMemo(() => {
    if (activeSection === 'fav') return 'المفضلة المحفوظة';
    if (activeSection === 'history') return 'سجل المشاهدة الأخيرة';
    if (selectedCategoryId === 'ALL') {
      if (activeSection === 'live') return 'كل القنوات المباشرة';
      if (activeSection === 'radio') return 'إذاعات الراديو والقرآن الكريم';
      if (activeSection === 'movies') return 'كل الأفلام (VOD)';
      return 'كل المسلسلات والحلقات';
    }
    return currentCategoryObj?.name || 'الكل';
  }, [activeSection, selectedCategoryId, currentCategoryObj]);

  return (
    <div className={`h-screen w-screen overflow-hidden flex flex-col select-none transition-colors duration-300 ${
      isDark ? 'bg-[#070b14] text-slate-100' : 'bg-[#f1f5f9] text-slate-800'
    }`}>
      {/* Global ARN-Stream TopBar (hidden when in Cinema Mode) */}
      {!isCinemaMode && <TopBar />}

      {/* Main IPTV Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden p-2.5 gap-2.5 relative">
        {/* Tactile Navigation Rail */}
        <aside className={`w-20 backdrop-blur-xl border rounded-2xl flex flex-col items-center justify-between py-3 shrink-0 transition-colors duration-200 ${
          isDark
            ? 'bg-[#0f172a]/75 border-white/[0.06] shadow-2xl'
            : 'bg-white/85 border-slate-200/80 shadow-lg shadow-slate-200/50'
        }`}>
          <div className="flex flex-col items-center gap-1 w-full px-1.5">
            <button
              type="button"
              onClick={() => setActiveSection('live')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'live'
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Tv className={`w-4 h-4 ${activeSection === 'live' ? 'text-violet-200' : ''}`} />
              <span>البث</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('radio')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'radio'
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Radio className={`w-4 h-4 ${activeSection === 'radio' ? 'text-violet-200' : ''}`} />
              <span>الراديو</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('movies')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'movies'
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Film className={`w-4 h-4 ${activeSection === 'movies' ? 'text-violet-200' : ''}`} />
              <span>الأفلام</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('series')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'series'
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Layers className={`w-4 h-4 ${activeSection === 'series' ? 'text-violet-200' : ''}`} />
              <span>المسلسلات</span>
            </button>

            {/* Categories Fold / Expand Button */}
            <button
              type="button"
              onClick={() => setIsCategoriesOpen((prev) => !prev)}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                isCategoriesOpen
                  ? (isDark ? 'bg-violet-600/25 text-violet-300 border border-violet-500/35 shadow-sm shadow-violet-600/20' : 'bg-violet-100 text-violet-700 border border-violet-300 font-bold')
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="عرض أو إخفاء قائمة التصنيفات"
            >
              <FolderOpen className={`w-4 h-4 ${isCategoriesOpen ? 'text-violet-400' : ''}`} />
              <span>التصنيفات</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('fav')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'fav'
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Star className={`w-4 h-4 ${activeSection === 'fav' ? 'text-violet-200' : ''}`} />
              <span>المفضلة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('history')}
              className={`w-full flex flex-col items-center gap-1 py-2.5 px-1 rounded-[10px] text-[11px] font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                activeSection === 'history'
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/25'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <History className={`w-4 h-4 ${activeSection === 'history' ? 'text-violet-200' : ''}`} />
              <span>الأخيرة</span>
            </button>
          </div>

          <div className={`flex flex-col items-center gap-1 w-full px-1.5 pt-2 border-t ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
            <button
              id="btnPlaylists"
              type="button"
              onClick={() => setIsPlaylistModalOpen(true)}
              className={`w-full flex flex-col items-center gap-1 py-2 px-1 rounded-[10px] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isDark
                  ? 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="إدارة القوائم وأكواد التفعيل (FG / Xtream / M3U)"
            >
              <KeyRound className="w-4 h-4 text-violet-400" />
              <span>الاشتراكات</span>
            </button>

            {/* Quick Theme Switcher Button */}
            <button
              type="button"
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
              className={`w-full flex flex-col items-center gap-1 py-2 px-1 rounded-[10px] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isDark
                  ? 'text-slate-400 hover:text-amber-300 hover:bg-white/[0.05]'
                  : 'text-slate-600 hover:text-amber-600 hover:bg-slate-100'
              }`}
              title={isDark ? 'التبديل إلى الوضع الفاتح (النهاري)' : 'التبديل إلى الوضع الداكن (الليلي)'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              <span>{isDark ? 'فاتح' : 'داكن'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCinemaMode((prev) => !prev)}
              className={`w-full flex flex-col items-center gap-1 py-2 px-1 rounded-[10px] text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                isCinemaMode
                  ? (isDark ? 'bg-violet-600/25 text-violet-300 border border-violet-500/40' : 'bg-violet-100 text-violet-700 border border-violet-300 font-bold')
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={isCinemaMode ? 'إظهار الشريط العلوي' : 'الوضع السينمائي الواسع'}
            >
              {isCinemaMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isCinemaMode ? 'عادي' : 'سينمائي'}</span>
            </button>
          </div>
        </aside>

        {/* Collapsible Categories Panel */}
        {isCategoriesOpen && (
          <section className={`w-64 lg:w-72 border rounded-2xl flex flex-col overflow-hidden shrink-0 shadow-2xl z-20 animate-fadeIn transition-colors duration-200 ${
            isDark ? 'bg-[#0f172a]/95 border-white/10' : 'bg-white/95 border-slate-200 shadow-slate-200/50'
          }`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              isDark ? 'border-white/[0.08]' : 'border-slate-200'
            }`}>
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-violet-400" />
                <h3 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>التصنيفات</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-mono tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {visibleCategories.length} {activeSection === 'radio' ? 'تصنيفات' : 'فئة'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsCategoriesOpen(false)}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title="إغلاق قائمة التصنيفات"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className={`p-2.5 border-b ${isDark ? 'border-white/[0.08]' : 'border-slate-200'}`}>
              <div className="relative">
                <Search className={`w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`} />
                <input
                  id="catSearchInput"
                  type="text"
                  value={catSearch}
                  onChange={(e) => setCatSearch(e.target.value)}
                  placeholder="بحث في التصنيفات..."
                  className={`w-full border rounded-lg pr-8 pl-3 py-1.5 text-xs focus:outline-none transition-colors ${
                    isDark
                      ? 'bg-[#070b14] border-white/10 text-slate-100 placeholder:text-slate-500 focus:border-violet-500/60'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-violet-500'
                  }`}
                />
              </div>
            </div>

            <div id="categoriesList" className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* All Channels Option */}
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('ALL');
                  setIsCategoriesOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  selectedCategoryId === 'ALL'
                    ? (isDark ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40' : 'bg-violet-100 text-violet-800 border border-violet-300 font-bold')
                    : (isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100')
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-md bg-violet-600/25 text-violet-400 flex items-center justify-center shrink-0 border border-violet-500/35">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">
                    {activeSection === 'radio' ? 'الكل (جميع الإذاعات)' : 'الكل (جميع القنوات)'}
                  </span>
                </div>
                <span className={`text-[11px] font-mono tabular-nums shrink-0 mr-1 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  {activeSection === 'radio'
                    ? radioCatalog.channels.length
                    : channels.filter(
                        (c) =>
                          c.playlistId === activePlaylistId &&
                          (activeSection === 'fav'
                            ? favoriteIds.includes(c.id)
                            : activeSection === 'history'
                            ? historyIds.includes(c.id)
                            : c.section === activeSection)
                      ).length}
                </span>
              </button>

              {visibleCategories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                const visual = getCategoryVisual(cat.name, cat.remoteTopic, cat.icon, cat.flag);

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      setIsCategoriesOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? (isDark ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40' : 'bg-violet-100 text-violet-800 border border-violet-300 font-bold')
                        : (isDark ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100')
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {visual?.type === 'icon' ? (
                        <div className={`w-8 h-5 rounded overflow-hidden shrink-0 border shadow-sm flex items-center justify-center ${
                          isDark ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-white'
                        }`}>
                          <img
                            src={visual.src}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : visual?.type === 'flag' ? (
                        <div className={`w-6 h-4 rounded overflow-hidden shrink-0 border shadow-sm ${
                          isDark ? 'border-white/15 bg-black/40' : 'border-slate-200 bg-white'
                        }`}>
                          <img
                            src={visual.src}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <FolderOpen className="w-4 h-4 text-violet-400/80 shrink-0" />
                      )}
                      <span className="truncate text-right">{cat.name}</span>
                    </div>
                    <span className={`text-[11px] font-mono tabular-nums shrink-0 mr-1 ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}>
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Playlist Switcher Footer */}
            {playlists.length > 0 && (
              <div className={`p-2.5 border-t flex items-center justify-between gap-2 ${
                isDark ? 'bg-[#070b14]/80 border-white/[0.08]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="min-w-0">
                  <div className={`text-[10px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>القائمة النشطة:</div>
                  <div className="text-xs font-bold text-violet-500 truncate">
                    {playlists.find((p) => p.id === activePlaylistId)?.name || 'افتراضي'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPlaylistModalOpen(true)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isDark ? 'bg-white/[0.08] hover:bg-white/15 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                  }`}
                >
                  تغيير
                </button>
              </div>
            )}
          </section>
        )}

        {/* Channels List Panel */}
        <section className={`w-80 lg:w-96 backdrop-blur-xl border rounded-2xl flex flex-col overflow-hidden shrink-0 transition-colors duration-200 ${
          isDark ? 'bg-[#0f172a]/75 border-white/[0.06]' : 'bg-white/85 border-slate-200/80 shadow-lg shadow-slate-200/50'
        }`}>
          {/* Prominent TV / Radio Mode Switcher Pill Bar */}
          <div className={`p-2 border-b flex items-center gap-1.5 ${
            isDark ? 'bg-[#0a101f]/90 border-white/[0.06]' : 'bg-slate-50/90 border-slate-200'
          }`}>
            <div className={`flex-1 grid grid-cols-2 gap-1 p-1 rounded-xl border ${
              isDark ? 'bg-[#060912] border-white/[0.07]' : 'bg-slate-200/70 border-slate-300/60'
            }`}>
              <button
                type="button"
                onClick={() => setActiveSection('live')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeSection !== 'radio'
                    ? 'bg-[#7c3aed] text-white shadow-md shadow-violet-600/35'
                    : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Tv className="w-3.5 h-3.5 shrink-0" />
                <span>قنوات التلفاز</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('radio')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeSection === 'radio'
                    ? 'bg-[#7c3aed] text-white shadow-md shadow-violet-600/35'
                    : isDark
                    ? 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Radio className="w-3.5 h-3.5 shrink-0" />
                <span>إذاعات الراديو</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsPlaylistModalOpen(true)}
              className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                isDark
                  ? 'bg-white/[0.05] hover:bg-white/[0.1] border-white/[0.08] text-violet-400 hover:text-violet-300'
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-violet-600 hover:text-violet-700 shadow-xs'
              }`}
              title="إدارة القوائم وأكواد التفعيل (FG / Xtream / M3U)"
            >
              <ListPlus className="w-4 h-4" />
            </button>
          </div>

          <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsCategoriesOpen((prev) => !prev)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold truncate transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.07] text-slate-100'
                    : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-800'
                }`}
                title="اضغط لاختيار تصنيف آخر"
              >
                {currentCategoryVisual?.type === 'icon' ? (
                  <div className={`w-6 h-4 rounded overflow-hidden shrink-0 border flex items-center justify-center ${
                    isDark ? 'border-white/10 bg-black/40' : 'border-slate-200 bg-white'
                  }`}>
                    <img src={currentCategoryVisual.src} alt="" className="w-full h-full object-contain" />
                  </div>
                ) : currentCategoryVisual?.type === 'flag' ? (
                  <div className={`w-6 h-4 rounded overflow-hidden shrink-0 border ${
                    isDark ? 'border-white/15 bg-black/40' : 'border-slate-200 bg-white'
                  }`}>
                    <img src={currentCategoryVisual.src} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null}
                <span className="truncate max-w-[9rem]">{currentCategoryTitle}</span>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
              </button>
            </div>
            <span id="chCountBadge" className={`text-xs font-mono tabular-nums shrink-0 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}>
              {visibleChannels.length} {activeSection === 'radio' ? 'إذاعة' : 'قناة'}
            </span>
          </div>

          {/* Search & Favorites Filter Toolbar */}
          <div className={`p-2.5 border-b flex items-center gap-2 ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}>
            <div className="relative flex-1">
              <Search className={`w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`} />
              <input
                id="chSearchInput"
                type="text"
                value={chSearch}
                onChange={(e) => setChSearch(e.target.value)}
                placeholder={activeSection === 'radio' ? 'ابحث عن إذاعة راديو...' : 'ابحث عن قناة...'}
                className={`w-full border rounded-lg pr-8 pl-3 py-1.5 text-xs focus:outline-none transition-colors ${
                  isDark
                    ? 'bg-[#070b14]/80 border-white/[0.07] text-slate-100 placeholder:text-slate-500 focus:border-violet-500/50'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-violet-500'
                }`}
              />
            </div>
            <button
              id="btnFavFilter"
              type="button"
              onClick={() => setOnlyFavFilter((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyFavFilter
                  ? (isDark ? 'bg-white/[0.1] border-white/20 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-700 font-bold')
                  : isDark
                  ? 'bg-[#070b14]/80 border-white/[0.07] text-slate-400 hover:text-slate-200'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              ★ المفضلة
            </button>
          </div>

          {/* Channels Scroll List */}
          <div id="channelsList" className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {isBootstrapping || loadingCategoryId === selectedCategoryId ? (
              <div className={`h-full flex flex-col items-center justify-center text-center p-6 space-y-3 ${
                isDark ? 'text-slate-300' : 'text-slate-700'
              }`}>
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {isBootstrapping
                    ? 'جاري تجهيز الباقة العربية والمصرية المدمجة...'
                    : `جاري جلب قنوات «${currentCategoryTitle}» الحية...`}
                </p>
                <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  فك تشفير AES-128-CBC ومزامنة القنوات المباشرة
                </p>
              </div>
            ) : playlists.length === 0 && activeSection !== 'radio' ? (
              <div className={`h-full flex flex-col items-center justify-center text-center p-6 space-y-3 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Radio className={`w-9 h-9 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>التطبيق جاهز للتشغيل</p>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  أدخل كود دراما لايف (FG Code) أو قم بتحميل الباقة العربية المدمجة فوراً.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <button
                    type="button"
                    onClick={loadBuiltinCatalog}
                    className="w-full px-4 py-2 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-violet-600/30"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تحميل الباقة العربية والمصرية فوراً</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPlaylistModalOpen(true)}
                    className={`w-full px-4 py-2 rounded-xl font-semibold text-xs transition-colors cursor-pointer ${
                      isDark ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                    }`}
                  >
                    إضافة كود FG أو قائمة M3U / Xtream
                  </button>
                </div>
              </div>
            ) : visibleChannels.length === 0 ? (
              <div className={`h-full flex flex-col items-center justify-center text-center p-6 space-y-2 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                <Tv className={`w-8 h-8 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} />
                <p className="text-xs font-semibold">لا توجد قنوات مطابقة للفلتر الحالي</p>
                <button
                  type="button"
                  onClick={() => {
                    setChSearch('');
                    setOnlyFavFilter(false);
                    setSelectedCategoryId('ALL');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    isDark ? 'bg-white/[0.06] text-slate-200 hover:bg-white/[0.1]' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  إعادة ضبط الفلاتر
                </button>
              </div>
            ) : (
              visibleChannels.map((ch, idx) => {
                const isPlayingNow = activeChannel?.id === ch.id;
                const isFav = favoriteIds.includes(ch.id);
                const hasProxyK9x = ch.sources?.some((s) => s.hasK9xSwap);

                return (
                  <div
                    key={ch.id}
                    onClick={() => setActiveChannel(ch)}
                    className={`group flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[10px] cursor-pointer transition-colors duration-150 ${
                      isPlayingNow
                        ? (isDark ? 'bg-violet-600/20 border border-violet-500/35 text-white shadow-sm' : 'bg-violet-100 border border-violet-300 text-violet-950 font-bold shadow-xs')
                        : (isDark ? 'hover:bg-white/[0.04] text-slate-300 border border-transparent' : 'hover:bg-slate-100/90 text-slate-700 border border-transparent')
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Channel Number / Play Indicator */}
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-mono font-semibold tabular-nums shrink-0 transition-colors ${
                          isPlayingNow
                            ? 'bg-[#7c3aed] text-white shadow-sm shadow-violet-600/40'
                            : isDark
                            ? 'text-slate-500 group-hover:text-slate-300'
                            : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                      >
                        {isPlayingNow ? <Play className="w-3 h-3 fill-current" /> : idx + 1}
                      </div>

                      {/* Channel Logo / Icon with smart fallback */}
                      {(() => {
                        const isRadioChannel = ch.section === 'radio' || activeSection === 'radio';
                        const fallbackSvg = isRadioChannel ? '/ARN-logo.png' : getChannelFallbackLogo(ch.name);
                        const effectiveLogo = isRadioChannel
                          ? '/ARN-logo.png'
                          : ch.logo && !ch.logo.includes('upload.wikimedia.org')
                            ? ch.logo
                            : fallbackSvg;

                        return (
                          <div className={`w-9 h-9 rounded-lg border flex items-center justify-center p-1 overflow-hidden shrink-0 relative ${
                            isDark ? 'bg-black/40 border-white/[0.07]' : 'bg-white border-slate-200 shadow-xs'
                          }`}>
                            <img
                              src={effectiveLogo}
                              alt={ch.name}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.src !== fallbackSvg) {
                                  target.src = fallbackSvg;
                                } else {
                                  target.style.display = 'none';
                                  const parent = target.parentElement;
                                  const fallback = parent?.querySelector('.logo-fallback');
                                  if (fallback) fallback.style.display = 'flex';
                                }
                              }}
                            />
                            <div className={`logo-fallback hidden items-center justify-center w-full h-full ${
                              isDark ? 'text-slate-400' : 'text-slate-500'
                            }`}>
                              {ch.section === 'radio' ? (
                                <Radio className="w-4 h-4" />
                              ) : (
                                <Tv className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      <div className="min-w-0 flex-1">
                        <div className={`text-xs font-semibold truncate ${
                          isPlayingNow
                            ? (isDark ? 'text-white' : 'text-violet-950 font-bold')
                            : (isDark ? 'text-slate-200' : 'text-slate-800')
                        }`}>
                          {ch.name}
                        </div>
                        <div className={`flex items-center gap-1.5 text-[11px] truncate mt-0.5 ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          <span className="truncate">{ch.groupTitle}</span>
                          {ch.resolution && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className={`font-mono tabular-nums ${isDark ? 'text-slate-300' : 'text-slate-600'}`} dir="ltr">
                                {ch.resolution}
                              </span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{ch.sources?.length || 1} سيرفر</span>
                          {hasProxyK9x && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-violet-500 font-bold">FG</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Favorite Star Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(ch.id);
                      }}
                      className={`p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer ${
                        isFav
                          ? (isDark ? 'text-amber-400 hover:bg-white/[0.06]' : 'text-amber-500 hover:bg-slate-100')
                          : (isDark
                          ? 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-slate-300 hover:bg-white/[0.06]'
                          : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-100')
                      }`}
                      title={isFav ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                    >
                      <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Column 3: Interactive HLS.js Video Player Container */}
        <HlsVideoPlayer
          channel={activeChannel}
          categoryChannels={visibleChannels}
          categoryTitle={currentCategoryTitle}
          activeSection={activeSection}
          onToggleSection={(sec) => setActiveSection(sec)}
          onSelectChannel={(ch) => setActiveChannel(ch)}
          onChannelWatched={handleChannelWatched}
          onServersLoaded={handleServersLoaded}
          onOpenPlaylistModal={() => setIsPlaylistModalOpen(true)}
        />
      </div>

      {/* Playlist & Activation Modal */}
      <PlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        playlists={playlists}
        activePlaylistId={activePlaylistId}
        onSelectPlaylist={(id) => {
          setActivePlaylistId(id);
          const firstCh = channels.find((c) => c.playlistId === id);
          if (firstCh) setActiveChannel(firstCh);
        }}
        onDeletePlaylist={handleDeletePlaylist}
        onImportSuccess={handleImportSuccess}
        onLoadBuiltinCatalog={loadBuiltinCatalog}
      />
    </div>
  );
}
