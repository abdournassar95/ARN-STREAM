import { useState, useEffect, useMemo } from 'react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import TopBar from '../components/shared/TopBar';
import { MovieCard, ArtistCard, AlbumCard } from '../components/shared/Card';
import { fetchLibrary, scanSingleLibrary, fetchTracks, fetchPlaylists, fetchPlaylist, triggerDownload, fetchSeries } from '../api/client';
import CosmicBackground from '../components/shared/CosmicBackground';
import client from '../api/client';
import AddToPlaylist from '../components/music/AddToPlaylist';
import AddToPlaylistModal from '../components/shared/AddToPlaylistModal';
import Spinner from '../components/shared/Spinner';

import { LayoutGrid, List, Columns, Maximize2, Play, Pause, BookOpen, Music, Users, Disc3, Radio, RefreshCw, Minus, Plus, Shuffle, CheckSquare, ListMusic, ListVideo, ListPlus, Check, Loader2, Trash2, Edit2, Search, Download } from 'lucide-react';
import { usePlayerStore } from '../store/usePlayerStore';
import { localizeLibraryName } from '../utils/localization';

const formatDuration = (s) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
};

export default function Library() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { 
    libraryPreferences = {}, 
    libraryGlobalSort = 'added_at', 
    libraryGlobalOrder = 'desc', 
    defaultLibraryView = 'grid', 
    cardMinSize = 180,
    setCardMinSize,
    enableBlur, 
    setLibraryPreferences 
  } = useSettingsStore();

  const playTrack = usePlayerStore(s => s.playTrack);
  const setQueue = usePlayerStore(s => s.setQueue);
  const setVideoQueue = usePlayerStore(s => s.setVideoQueue);
  const addVideoToQueue = usePlayerStore(s => s.addVideoToQueue);
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const { user, isAdmin, canDownload } = useAuthStore();

  const [mediaView, setMediaView] = useState('artists');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [modalTrackIds, setModalTrackIds] = useState([]);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const currentLibPrefs = libraryPreferences[id] || {};
  const sort = currentLibPrefs.sort || libraryGlobalSort;
  const order = currentLibPrefs.order || libraryGlobalOrder;
  const displayMode = currentLibPrefs.displayMode || defaultLibraryView;

  const qc = useQueryClient();
  const [isScanningLibrary, setIsScanningLibrary] = useState(false);

  const deleteMut = useMutation({
    mutationFn: (playlistId) => client.delete(`/playlists/${playlistId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playlists', id] })
  });

  const editMut = useMutation({
    mutationFn: ({ playlistId, name }) => client.put(`/playlists/${playlistId}`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['playlists', id] })
  });

  const handleEditPlaylist = (e, pl) => {
    e.preventDefault();
    e.stopPropagation();
    const newName = window.prompt(isRtl ? 'اسم القائمة الجديد:' : 'New playlist name:', pl.name);
    if (newName && newName.trim() !== pl.name) {
      editMut.mutate({ playlistId: pl.id, name: newName.trim() });
    }
  };

  const handleDeletePlaylist = (e, pl) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm(isRtl ? 'هل تريد حذف هذه القائمة؟' : 'Delete this playlist?')) {
      deleteMut.mutate(pl.id);
    }
  };

  const handleScanThisLibrary = async () => {
    setIsScanningLibrary(true);
    try {
      await scanSingleLibrary(id);
      await qc.invalidateQueries({ queryKey: ['library', id] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
    } catch (err) {
      console.error('Failed to scan library:', err);
    } finally {
      setIsScanningLibrary(false);
    }
  };

  const handleSortChange = (newSort, newOrder) => {
    setLibraryPreferences(id, { sort: newSort, order: newOrder });
  };

  const handleDisplayModeChange = (newMode) => {
    setLibraryPreferences(id, { displayMode: newMode });
  };

  // Playlists query (when in playlists view)
  const { data: playlists = [], isLoading: isPlaylistsLoading } = useQuery({
    queryKey: ['playlists', id],
    queryFn: () => fetchPlaylists(id),
    enabled: mediaView === 'playlists'
  });

  // Play entire library
  const handlePlayEntireLibrary = async (shuffle = false) => {
    setIsBatchLoading(true);
    try {
      const res = await fetchTracks({ library_id: id, limit: 3000 });
      let tracks = res?.items || [];
      if (!tracks.length && library?.items && mediaView === 'tracks') {
        tracks = library.items;
      }
      if (tracks.length) {
        if (shuffle) {
          tracks = [...tracks].sort(() => Math.random() - 0.5);
        }
        setQueue(tracks, 0);
      }
    } catch (err) {
      console.error('Failed to play entire library:', err);
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Play artist/reciter directly from card
  const handlePlayArtist = async (artist) => {
    setIsBatchLoading(true);
    try {
      const res = await fetchTracks({ artist_id: artist.id, limit: 1000 });
      const tracks = res?.items || [];
      if (tracks.length) {
        setQueue(tracks, 0);
      }
    } catch (err) {
      console.error('Failed to play artist:', err);
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Play album/surah directly from card
  const handlePlayAlbum = async (album) => {
    setIsBatchLoading(true);
    try {
      const res = await fetchTracks({ album_id: album.id, limit: 500 });
      const tracks = res?.items || [];
      if (tracks.length) {
        setQueue(tracks, 0);
      }
    } catch (err) {
      console.error('Failed to play album:', err);
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Toggle selection of an item (artist, album, or track)
  const handleToggleSelect = (item) => {
    const itemId = item.id;
    setSelectedIds(prev => 
      prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]
    );
  };

  // Select all or deselect all in current view
  const handleSelectAll = () => {
    if (!library?.items?.length) return;
    const allIds = library.items.map(i => i.id);
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  // Download selected items as a ZIP archive
  const handleDownloadSelected = () => {
    if (!selectedIds.length) return;
    let type = 'tracks';
    if (library?.type === 'movies') type = 'movies';
    else if (library?.type === 'series') type = 'series';
    else if (isAudio) {
      if (mediaView === 'artists') type = 'artists';
      else if (mediaView === 'albums') type = 'albums';
      else type = 'tracks';
    }
    
    triggerDownload('/api/download/batch', {
      type,
      ids: selectedIds.join(','),
      title: `${localizeLibraryName(library?.name, isRtl) || (isRtl ? 'مكتبة' : 'Library')}_${isRtl ? 'عناصر_مختارة' : 'selected_items'}`
    });
  };

  // Play selected items (reciters, albums, or tracks)
  const handlePlaySelected = async (shuffle = false) => {
    if (!selectedIds.length) return;
    setIsBatchLoading(true);
    try {
      let tracksToPlay = [];
      if (mediaView === 'tracks') {
        tracksToPlay = library.items.filter(t => selectedIds.includes(t.id));
      } else if (mediaView === 'artists') {
        const promises = selectedIds.map(artistId => fetchTracks({ artist_id: artistId, limit: 1000 }));
        const results = await Promise.all(promises);
        results.forEach(res => {
          if (res?.items) tracksToPlay.push(...res.items);
        });
      } else if (mediaView === 'albums') {
        const promises = selectedIds.map(albumId => fetchTracks({ album_id: albumId, limit: 500 }));
        const results = await Promise.all(promises);
        results.forEach(res => {
          if (res?.items) tracksToPlay.push(...res.items);
        });
      }

      if (tracksToPlay.length) {
        if (shuffle) {
          tracksToPlay = [...tracksToPlay].sort(() => Math.random() - 0.5);
        }
        setQueue(tracksToPlay, 0);
      }
    } catch (err) {
      console.error('Failed to play selected:', err);
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Play selected videos (movies or series episodes) consecutively as a video playlist
  const handlePlaySelectedMovies = async (shuffle = false) => {
    if (!selectedIds.length || !library?.items) return;
    const selectedItems = library.items.filter(item => selectedIds.includes(item.id));
    if (!selectedItems.length) return;

    setIsBatchLoading(true);
    try {
      let queue = [];
      if (library?.type === 'shows') {
        for (const sItem of selectedItems) {
          try {
            const seriesData = await fetchSeries(sItem.id);
            if (seriesData?.seasons) {
              for (const sn of seriesData.seasons) {
                if (sn.episodes?.length) {
                  const epPoster = sn.posters?.[0]?.thumb || sn.posters?.[0]?.url || sItem.poster;
                  for (const ep of sn.episodes) {
                    queue.push({
                      id: ep.id,
                      title: ep.title || (isRtl ? `الحلقة ${ep.episode_number}` : `Episode ${ep.episode_number}`),
                      episode_number: ep.episode_number,
                      season_number: sn.season_number,
                      season_id: sn.id,
                      series_id: sItem.id,
                      series_title: seriesData.title || sItem.title,
                      type: 'episode',
                      media_type: 'episode',
                      poster: epPoster || null,
                      duration: ep.duration || null,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch series episodes for playlist:', e);
          }
        }
      } else {
        queue = selectedItems.map(m => ({
          id: m.id,
          title: m.title,
          type: 'movie',
          media_type: 'movie',
          poster: m.poster || m.backdrop || null,
          duration: m.duration || null,
          year: m.year || null
        }));
      }

      if (!queue.length) return;

      if (shuffle) {
        queue.sort(() => Math.random() - 0.5);
      }

      setVideoQueue(queue, 0);
      const firstType = queue[0].type;
      navigate(`/watch/${firstType}/${queue[0].id}`);
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Add selected videos to the existing video queue
  const handleAddToVideoQueue = async () => {
    if (!selectedIds.length || !library?.items) return;
    const selectedItems = library.items.filter(item => selectedIds.includes(item.id));
    if (!selectedItems.length) return;

    setIsBatchLoading(true);
    try {
      let queueItems = [];
      if (library?.type === 'shows') {
        for (const sItem of selectedItems) {
          try {
            const seriesData = await fetchSeries(sItem.id);
            if (seriesData?.seasons) {
              for (const sn of seriesData.seasons) {
                if (sn.episodes?.length) {
                  const epPoster = sn.posters?.[0]?.thumb || sn.posters?.[0]?.url || sItem.poster;
                  for (const ep of sn.episodes) {
                    queueItems.push({
                      id: ep.id,
                      title: ep.title || (isRtl ? `الحلقة ${ep.episode_number}` : `Episode ${ep.episode_number}`),
                      episode_number: ep.episode_number,
                      season_number: sn.season_number,
                      season_id: sn.id,
                      series_id: sItem.id,
                      series_title: seriesData.title || sItem.title,
                      type: 'episode',
                      media_type: 'episode',
                      poster: epPoster || null,
                      duration: ep.duration || null,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch series episodes for queue:', e);
          }
        }
      } else {
        queueItems = selectedItems.map(m => ({
          id: m.id,
          title: m.title,
          type: 'movie',
          media_type: 'movie',
          poster: m.poster || m.backdrop || null,
          duration: m.duration || null,
          year: m.year || null
        }));
      }

      if (queueItems.length) {
        addVideoToQueue(queueItems);
      }
      setIsSelectionMode(false);
      setSelectedIds([]);
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Play all videos in this library / filtered view consecutively as a playlist
  const handlePlayAllMovies = async (shuffle = false) => {
    if (!displayedItems || !displayedItems.length) return;

    setIsBatchLoading(true);
    try {
      let queue = [];
      if (library?.type === 'shows') {
        for (const sItem of displayedItems) {
          try {
            const seriesData = await fetchSeries(sItem.id);
            if (seriesData?.seasons) {
              for (const sn of seriesData.seasons) {
                if (sn.episodes?.length) {
                  const epPoster = sn.posters?.[0]?.thumb || sn.posters?.[0]?.url || sItem.poster;
                  for (const ep of sn.episodes) {
                    queue.push({
                      id: ep.id,
                      title: ep.title || (isRtl ? `الحلقة ${ep.episode_number}` : `Episode ${ep.episode_number}`),
                      episode_number: ep.episode_number,
                      season_number: sn.season_number,
                      season_id: sn.id,
                      series_id: sItem.id,
                      series_title: seriesData.title || sItem.title,
                      type: 'episode',
                      media_type: 'episode',
                      poster: epPoster || null,
                      duration: ep.duration || null,
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.error('Failed to fetch series episodes for all playlist:', e);
          }
        }
      } else {
        queue = displayedItems.map(m => ({
          id: m.id,
          title: m.title,
          type: 'movie',
          media_type: 'movie',
          poster: m.poster || m.backdrop || null,
          duration: m.duration || null,
          year: m.year || null
        }));
      }

      if (!queue.length) return;

      if (shuffle) {
        queue.sort(() => Math.random() - 0.5);
      }

      setVideoQueue(queue, 0);
      const firstType = queue[0].type;
      navigate(`/watch/${firstType}/${queue[0].id}`);
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Prepare selected tracks to add to playlist
  const handleOpenPlaylistModal = async () => {
    if (!selectedIds.length) return;
    setIsBatchLoading(true);
    try {
      let trackIds = [];
      if (mediaView === 'tracks') {
        trackIds = [...selectedIds];
      } else if (mediaView === 'artists') {
        const promises = selectedIds.map(artistId => fetchTracks({ artist_id: artistId, limit: 1000 }));
        const results = await Promise.all(promises);
        results.forEach(res => {
          if (res?.items) trackIds.push(...res.items.map(t => t.id));
        });
      } else if (mediaView === 'albums') {
        const promises = selectedIds.map(albumId => fetchTracks({ album_id: albumId, limit: 500 }));
        const results = await Promise.all(promises);
        results.forEach(res => {
          if (res?.items) trackIds.push(...res.items.map(t => t.id));
        });
      }

      const uniqueIds = [...new Set(trackIds)];
      setModalTrackIds(uniqueIds);
      setIsPlaylistModalOpen(true);
    } catch (err) {
      console.error('Failed to prepare playlist tracks:', err);
    } finally {
      setIsBatchLoading(false);
    }
  };

  // Play a playlist
  const handlePlayPlaylist = async (playlist) => {
    try {
      const res = await fetchPlaylist(playlist.id);
      if (res?.items?.length) {
        const queue = res.items.map(it => ({
          id: it.track_id,
          title: it.title,
          duration: it.duration,
          artistName: it.artistName,
          artistId: it.artistId,
          albumTitle: it.albumTitle,
          cover: it.cover,
          album_id: it.album_id,
          library_id: it.library_id
        }));
        setQueue(queue, 0);
      } else {
        setQueue([], 0);
      }
    } catch (err) {
      console.error('Failed to play playlist:', err);
    }
  };

  const [bgImages, setBgImages] = useState([]);
  const [visibleCount, setVisibleCount] = useState(60);

  const { data: library, isLoading } = useQuery({ 
    queryKey: ['library', id, sort, order, mediaView], 
    queryFn: () => fetchLibrary(id, { sort, order, view: mediaView, limit: 10000 }) 
  });

  const isMovies = library?.type === 'movies' || library?.type === 'shows';

  const displayedItems = useMemo(() => {
    if (!library?.items) return [];
    if (!searchTerm.trim()) return library.items;
    const q = searchTerm.toLowerCase().trim();
    return library.items.filter(item => {
      const title = (item.title || item.name || '').toLowerCase();
      const plot = (item.plot || '').toLowerCase();
      const year = String(item.year || '');
      const artist = (item.artistName || '').toLowerCase();
      const album = (item.albumTitle || '').toLowerCase();
      return title.includes(q) || plot.includes(q) || year.includes(q) || artist.includes(q) || album.includes(q);
    });
  }, [library?.items, searchTerm]);

  // Always scroll to the top of the page when opening or switching a library
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  }, [id]);

  // Display all items from the beginning of the page without truncation
  const visibleItems = useMemo(() => {
    return displayedItems;
  }, [displayedItems]);

  // Background randomizer with stable dependencies
  useEffect(() => {
    if (!library?.items?.length) return;
    const itemsWithPosters = library.items.filter(i => i.poster || i.cover);
    if (!itemsWithPosters.length) return;

    const pickRandom = () => {
      const shuffled = [...itemsWithPosters].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 15).map(i => i.poster || i.cover);
      setBgImages(selected);
    };

    pickRandom();
    const iv = setInterval(pickRandom, 60 * 1000); // 1 minute
    return () => clearInterval(iv);
  }, [id, library?.items?.length]);

  if (isLoading) return <div className="min-h-screen bg-bg"><TopBar variant={library?.type === 'music' ? 'music' : 'movies'}/><div className="flex items-center justify-center h-[60vh]"><Spinner/></div></div>;
  if (!library) return <div className="min-h-screen bg-bg"><TopBar/><div className="text-center p-10 text-muted">{t('errors.notFound')}</div></div>;

  const isAudio = library.type === 'music';
  const isQuran = (library.name || '').includes('قرآن') || (library.name || '').includes('قران') || (library.name || '').toLowerCase().includes('quran');

  return (
    <div className="min-h-screen bg-bg relative pb-24">
      {/* 🌌 Animated Cosmic Galaxy Backdrop (always-on) */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <CosmicBackground density="normal" showShootingStar={false} />
      </div>

      {/* Dynamic Blurred Collage Background (additional layer above cosmic) */}
      {bgImages.length > 0 && (
        <div className="fixed inset-0 z-[1] overflow-hidden pointer-events-none transition-opacity duration-1000">
          <div className="absolute inset-[-100px] flex flex-wrap blur-[60px] saturate-150 opacity-100">
            {bgImages.map((img, i) => (
              <div key={i} className="w-1/3 h-1/3 md:w-1/5 md:h-1/3 bg-cover bg-center" style={{ backgroundImage: `url(${img})`, transition: 'background-image 3s ease-in-out' }} />
            ))}
          </div>
          <div className="absolute inset-0 bg-bg/85 dark:bg-black/80" />
        </div>
      )}
      
      {/* Sticky TopBar mounted at root so it stays fixed to viewport top on vertical scroll */}
      <TopBar variant={isAudio ? 'music' : 'movies'} />

      <div className="relative z-10">
        <main className="w-full px-4 sm:px-6 md:px-8 lg:px-10 pt-0 pb-12">
        
        {/* Header Banner for Quran / Special Audio */}
        {isQuran && (
          <div className="mt-4 mb-6 p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-surface to-surface/80 border border-emerald-500/30 flex flex-col justify-between gap-6 shadow-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-black flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
                  <BookOpen size={30} />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-text">{localizeLibraryName(library.name, isRtl)}</h1>
                  <p className="text-sm text-muted mt-1">{isRtl ? 'تلاوات قرآنية عطرة بأصوات كبار القراء والمشايخ' : 'Fragrant Quranic recitations by prominent reciters'}</p>
                </div>
              </div>

              {library.counts && (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-surface/80 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
                    {library.counts.artists} {isRtl ? 'قارئ' : 'Reciters'}
                  </span>
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-surface/80 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
                    {library.counts.albums} {isRtl ? 'مصحف وسورة' : "Mus'hafs & Surahs"}
                  </span>
                  <span className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-surface/80 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
                    {library.counts.tracks} {isRtl ? 'تلاوة' : 'Recitations'}
                  </span>
                </div>
              )}
            </div>


          </div>
        )}

        {/* Sticky Library Controls Header (Flush with the top of viewport: top-0 on desktop, no gap) */}
        <div className="sticky top-16 md:top-0 z-40 bg-bg/95 backdrop-blur-xl pt-3.5 pb-3.5 md:pt-4 md:pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 lg:-mx-10 lg:px-10 flex flex-col xl:flex-row xl:items-center justify-between mb-4 gap-4 border-b border-border/15 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_30px_-15px_rgba(0,0,0,0.6)] transition-all">
          <div className="flex flex-col xl:flex-row xl:items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {!isQuran && (
                <div className="flex items-center gap-3">
                  <h1 className="text-xl sm:text-2xl font-bold">{localizeLibraryName(library.name, isRtl)}</h1>
                  {library.media_count !== undefined && (
                    <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-xs font-semibold bg-white dark:bg-surface border border-slate-200/80 dark:border-border text-muted shadow-sm">
                      {library.media_count}
                    </span>
                  )}
                </div>
              )}

              {isAudio ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePlayEntireLibrary(false)}
                    disabled={isBatchLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primaryMusic text-black font-bold text-xs hover:brightness-110 shadow-sm active:scale-95 transition disabled:opacity-50"
                  >
                    {isBatchLoading ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} fill="black" />}
                    <span>{isRtl ? 'تشغيل الكل' : 'Play All'}</span>
                  </button>
                  <button
                    onClick={() => handlePlayEntireLibrary(true)}
                    disabled={isBatchLoading}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-surfaceHover border border-slate-200/80 dark:border-border/50 text-text font-semibold text-xs hover:bg-slate-50 dark:hover:bg-surface active:scale-95 shadow-sm transition disabled:opacity-50"
                    title={isRtl ? 'تشغيل عشوائي' : 'Shuffle'}
                  >
                    <Shuffle size={13} />
                  </button>
                  <button
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode);
                      setSelectedIds([]);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 shadow-sm ${
                      isSelectionMode ? 'bg-primaryMusic text-black border-primaryMusic' : 'bg-white dark:bg-surfaceHover border-slate-200/80 dark:border-border/50 text-text'
                    }`}
                  >
                    <CheckSquare size={13} />
                    <span>{isSelectionMode ? (isRtl ? 'تم' : 'Done') : (isRtl ? 'تحديد وتنزيل' : 'Select')}</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {/* Play All as Playlist */}
                  <button
                    disabled={!displayedItems?.length || isBatchLoading}
                    onClick={() => handlePlayAllMovies(false)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primaryMovies text-white text-xs font-semibold hover:brightness-110 active:scale-95 transition shadow-md disabled:opacity-40"
                    title={isRtl ? (library?.type === 'shows' ? 'تشغيل حلقات المسلسلات كقائمة تشغيل متتالية' : 'تشغيل جميع أفلام المكتبة كقائمة تشغيل متتالية') : 'Play all as playlist'}
                  >
                    {isBatchLoading ? <Loader2 size={14} className="animate-spin" /> : <ListVideo size={14} />}
                    <span>{isRtl ? 'تشغيل الكل متتالي' : 'Play All (Playlist)'}</span>
                  </button>

                  {/* Shuffle All */}
                  <button
                    disabled={!displayedItems?.length || isBatchLoading}
                    onClick={() => handlePlayAllMovies(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white dark:bg-surfaceHover border border-slate-200/80 dark:border-border/50 text-text text-xs font-semibold hover:bg-slate-100 dark:hover:bg-surface active:scale-95 transition shadow-sm disabled:opacity-40"
                    title={isRtl ? 'تشغيل عشوائي لكل عناصر المكتبة' : 'Shuffle all'}
                  >
                    <Shuffle size={13} />
                    <span className="hidden sm:inline">{isRtl ? 'خلط' : 'Shuffle'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode);
                      setSelectedIds([]);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition active:scale-95 shadow-sm ${
                      isSelectionMode ? 'bg-primaryMovies text-white border-primaryMovies' : 'bg-white dark:bg-surfaceHover border-slate-200/80 dark:border-border/50 text-text'
                    }`}
                  >
                    <CheckSquare size={13} />
                    <span>{isSelectionMode ? (isRtl ? 'تم' : 'Done') : (isRtl ? 'تحديد قائمة' : 'Select Playlist')}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Audio Library View Tabs */}
            {isAudio && (
              <div className="overflow-x-auto scrollbar-none max-w-full pb-1 xl:pb-0">
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-white/80 dark:bg-surface/60 border border-slate-200/80 dark:border-border/40 shadow-sm w-max sm:w-auto">
                  <button
                    onClick={() => {
                      setMediaView('artists');
                      setSelectedIds([]);
                    }}
                    className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${mediaView === 'artists' ? 'bg-primaryMusic text-black shadow-md' : 'text-muted hover:text-text'}`}
                  >
                    <Users size={15} />
                    {isQuran ? (isRtl ? 'القراء' : 'Reciters') : t('common.artists')}
                    {library.counts?.artists !== undefined && ` (${library.counts.artists})`}
                  </button>
                  <button
                    onClick={() => {
                      setMediaView('albums');
                      setSelectedIds([]);
                    }}
                    className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${mediaView === 'albums' ? 'bg-primaryMusic text-black shadow-md' : 'text-muted hover:text-text'}`}
                  >
                    <Disc3 size={15} />
                    {isQuran ? (isRtl ? 'المصاحف والسور' : 'Surahs & Albums') : t('common.albums')}
                    {library.counts?.albums !== undefined && ` (${library.counts.albums})`}
                  </button>
                  <button
                    onClick={() => {
                      setMediaView('tracks');
                      setSelectedIds([]);
                    }}
                    className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${mediaView === 'tracks' ? 'bg-primaryMusic text-black shadow-md' : 'text-muted hover:text-text'}`}
                  >
                    <Radio size={15} />
                    {isQuran ? (isRtl ? 'التلاوات' : 'Recitations') : t('common.tracks', isRtl ? 'التراكات' : 'Tracks')}
                    {library.counts?.tracks !== undefined && ` (${library.counts.tracks})`}
                  </button>
                  <button
                    onClick={() => {
                      setMediaView('playlists');
                      setIsSelectionMode(false);
                      setSelectedIds([]);
                    }}
                    className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${mediaView === 'playlists' ? 'bg-primaryMusic text-black shadow-md' : 'text-muted hover:text-text'}`}
                  >
                    <ListMusic size={15} />
                    {isQuran ? (isRtl ? 'قوائم التلاوة' : 'Playlists') : t('common.playlists')}
                    {playlists?.length > 0 && ` (${playlists.length})`}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto md:ms-auto justify-between sm:justify-end">
            {/* Quick In-Library Search */}
            <div className="relative flex-1 sm:w-56 max-w-xs">
              <Search size={14} className="absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none start-3" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={isRtl ? 'بحث وتصفية في المكتبة...' : 'Filter library...'}
                className={`w-full py-2 rounded-xl bg-white dark:bg-surfaceHover/80 border border-slate-200/80 dark:border-border/40 text-xs ${isRtl ? 'sm:text-xs' : 'sm:text-sm'} text-text placeholder:text-muted focus:outline-none focus:border-primaryMovies transition shadow-sm ps-8 pe-6`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute top-1/2 -translate-y-1/2 text-xs text-muted hover:text-text end-2.5"
                >
                  ✕
                </button>
              )}
            </div>

            <select 
              value={`${sort}|${order}`} 
              onChange={e => {
                const [s, o] = e.target.value.split('|');
                handleSortChange(s, o);
              }}
              className={`flex-1 sm:flex-none bg-white dark:bg-surfaceHover/80 border border-slate-200/80 dark:border-border/40 shadow-sm rounded-xl px-3 py-2 text-xs ${isRtl ? 'sm:text-xs' : 'sm:text-sm'} text-text outline-none focus:border-primaryMovies transition`}
            >
              <option className="bg-white dark:bg-surface text-text" value="added_at|desc">{i18n.language === 'ar' ? 'تاريخ الإضافة (الأحدث)' : 'Date Added (Newest)'}</option>
              <option className="bg-white dark:bg-surface text-text" value="added_at|asc">{i18n.language === 'ar' ? 'تاريخ الإضافة (الأقدم)' : 'Date Added (Oldest)'}</option>
              <option className="bg-white dark:bg-surface text-text" value="year|desc">{i18n.language === 'ar' ? 'تاريخ الإنتاج / الطرح (الأحدث)' : 'Release Year (Newest)'}</option>
              <option className="bg-white dark:bg-surface text-text" value="year|asc">{i18n.language === 'ar' ? 'تاريخ الإنتاج / الطرح (الأقدم)' : 'Release Year (Oldest)'}</option>
              <option className="bg-white dark:bg-surface text-text" value="title|asc">{i18n.language === 'ar' ? 'الاسم / العنوان (أ - ي)' : 'Title (A-Z)'}</option>
              <option className="bg-white dark:bg-surface text-text" value="title|desc">{i18n.language === 'ar' ? 'الاسم / العنوان (ي - أ)' : 'Title (Z-A)'}</option>
              {isMovies && <option className="bg-white dark:bg-surface text-text" value="rating|desc">{i18n.language === 'ar' ? 'التقييم (الأعلى)' : 'Rating (Highest)'}</option>}
            </select>

            {/* Card Size Control Slider */}
            {(!isAudio || mediaView !== 'tracks') && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-surfaceHover/80 border border-slate-200/80 dark:border-border/40 rounded-xl px-2.5 py-1.5 shadow-sm text-xs">
                <span className={i18n.language === 'ar' ? 'hidden' : 'text-muted hidden lg:inline font-medium'}>
                  {i18n.language === 'ar' ? 'حجم البطاقات' : 'Size'}
                </span>
                <button
                  type="button"
                  onClick={() => setCardMinSize(Math.max(130, cardMinSize - 20))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-slate-100 dark:hover:bg-surface transition"
                  title={i18n.language === 'ar' ? 'تصغير' : 'Zoom out'}
                >
                  <Minus size={13} />
                </button>
                <input
                  type="range"
                  min="130"
                  max="320"
                  step="10"
                  value={cardMinSize}
                  onChange={(e) => setCardMinSize(Number(e.target.value))}
                  className="w-16 sm:w-20 md:w-24 h-1.5 bg-slate-200 dark:bg-surface rounded-lg appearance-none cursor-pointer accent-primaryMovies"
                  title={`${cardMinSize}px`}
                />
                <button
                  type="button"
                  onClick={() => setCardMinSize(Math.min(320, cardMinSize + 20))}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-muted hover:text-text hover:bg-slate-100 dark:hover:bg-surface transition"
                  title={i18n.language === 'ar' ? 'تكبير' : 'Zoom in'}
                >
                  <Plus size={13} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              {isMovies && (
                <div className="flex items-center bg-white dark:bg-surfaceHover/80 border border-slate-200/80 dark:border-border/40 rounded-xl p-1 shadow-sm">
                  <button onClick={() => handleDisplayModeChange('grid')} className={`p-1.5 rounded-lg transition ${displayMode === 'grid' ? 'bg-primaryMovies text-white font-bold' : 'text-muted hover:text-text'}`} title="Grid"><LayoutGrid size={15}/></button>
                  <button onClick={() => handleDisplayModeChange('wide')} className={`p-1.5 rounded-lg transition ${displayMode === 'wide' ? 'bg-primaryMovies text-white font-bold' : 'text-muted hover:text-text'}`} title="Wide"><Maximize2 size={15}/></button>
                  <button onClick={() => handleDisplayModeChange('compact')} className={`p-1.5 rounded-lg transition ${displayMode === 'compact' ? 'bg-primaryMovies text-white font-bold' : 'text-muted hover:text-text'}`} title="Compact"><Columns size={15}/></button>
                  <button onClick={() => handleDisplayModeChange('list')} className={`p-1.5 rounded-lg transition ${displayMode === 'list' ? 'bg-primaryMovies text-white font-bold' : 'text-muted hover:text-text'}`} title="List"><List size={15}/></button>
                </div>
              )}
              {isAdmin() && (
                <button
                  onClick={handleScanThisLibrary}
                  disabled={isScanningLibrary}
                  title={i18n.language === 'ar' ? 'فحص مجلد هذه المكتبة وتحديث المحتوى' : 'Scan this library folder'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-surfaceHover/80 hover:bg-slate-50 dark:hover:bg-surfaceHover border border-slate-200/80 dark:border-border/40 text-text shadow-sm transition disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isScanningLibrary ? 'animate-spin text-primaryMovies' : ''} />
                  <span className="hidden sm:inline">{isScanningLibrary ? (i18n.language === 'ar' ? 'جاري الفحص...' : 'Scanning...') : (i18n.language === 'ar' ? 'فحص المكتبة' : 'Scan')}</span>
                </button>
              )}
            </div>
          </div>
        </div>


        {library.items?.length === 0 ? (
          <div className="text-center py-20 flex flex-col items-center justify-center gap-4">
            <div className="text-muted text-base">{t('common.empty', 'No media found in this library')}</div>
            {isAdmin() && (
              <button
                onClick={handleScanThisLibrary}
                disabled={isScanningLibrary}
                className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-primaryMovies to-primaryMusic hover:brightness-110 text-white font-bold flex items-center gap-2.5 shadow-lg transition disabled:opacity-50"
              >
                <RefreshCw size={16} className={isScanningLibrary ? 'animate-spin' : ''} />
                <span>{isScanningLibrary ? (i18n.language === 'ar' ? 'جاري فحص المجلد...' : 'Scanning folder...') : (i18n.language === 'ar' ? 'فحص مجلد المكتبة الآن' : 'Scan Folder Now')}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Audio: Tracks View */}
            {isAudio && mediaView === 'tracks' ? (
              <div className="flex flex-col gap-2">
                {visibleItems.map((item, idx) => {
                  const isCurrent = currentTrack?.id === item.id;
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        if (isSelectionMode) {
                          handleToggleSelect(item);
                        } else {
                          playTrack(item, displayedItems);
                        }
                      }}
                      className={`group flex items-center gap-3.5 sm:gap-4 p-3 sm:p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border ${
                        isSelected
                          ? 'bg-primaryMusic/15 border-primaryMusic/50 shadow-md'
                          : isCurrent 
                          ? 'bg-primaryMusic/10 border-primaryMusic/40' 
                          : 'bg-white dark:bg-surface/50 hover:bg-slate-50 dark:hover:bg-surface border-slate-200/80 dark:border-border/30 hover:border-slate-300 dark:hover:border-border/60 shadow-sm'
                      }`}
                    >
                      {/* Selection Checkbox or Play/Pause Button */}
                      {isSelectionMode ? (
                        <div 
                          onClick={(e) => { e.stopPropagation(); handleToggleSelect(item); }}
                          className={`w-8 h-8 rounded-xl flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                            isSelected 
                              ? 'bg-primaryMusic border-primaryMusic text-black scale-105' 
                              : 'border-slate-300 dark:border-white/30 hover:border-text text-transparent'
                          }`}
                        >
                          <Check size={16} className="stroke-[3]" />
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); playTrack(item, library.items); }}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all flex-shrink-0 ${isCurrent && isPlaying ? 'bg-primaryMusic text-black shadow-md' : 'bg-slate-100 dark:bg-surfaceHover text-text group-hover:scale-105'}`}
                        >
                          {isCurrent && isPlaying ? <Pause size={18} /> : <Play size={18} className="ms-0.5" />}
                        </button>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className={`font-semibold text-sm truncate ${isCurrent ? 'text-primaryMusic' : 'text-text'}`}>
                          {item.title}
                        </div>
                        <div className="text-xs text-muted truncate mt-0.5 flex items-center gap-2">
                          {item.artistName && <span>{item.artistName}</span>}
                          {item.albumTitle && <span>• {item.albumTitle}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted font-mono px-2">
                          {formatDuration(item.duration)}
                        </div>
                        {!isSelectionMode && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <AddToPlaylist trackId={item.id} libraryId={id} iconSize={16} />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isAudio && mediaView === 'albums' ? (
              /* Audio: Albums / Surahs View */
              <div 
                className="grid gap-4 sm:gap-6"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))` }}
              >
                {visibleItems.map(item => (
                  <AlbumCard 
                    key={item.id} 
                    album={item} 
                    to={`/music/album/${item.id}`} 
                    onPlayClick={handlePlayAlbum}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.includes(item.id)}
                    onToggleSelect={handleToggleSelect}
                  />
                ))}
              </div>
            ) : isAudio && mediaView === 'playlists' ? (
              /* Audio: Playlists View */
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-text">
                      {isQuran ? (isRtl ? 'قوائم التلاوة' : 'Recitation Playlists') : (isRtl ? 'قوائم التشغيل' : 'Playlists')}
                    </h2>
                    <p className="text-xs text-muted mt-1">
                      {isQuran ? (isRtl ? 'قوائم مخصصة لتلاواتك وسورك المفضلة' : 'Custom playlists for your favorite recitations and surahs') : (isRtl ? 'قوائمك الصوتية المخصصة' : 'Your custom audio playlists')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setModalTrackIds([]);
                      setIsPlaylistModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-black font-bold text-xs shadow-lg transition active:scale-95"
                  >
                    <Plus size={16} />
                    <span>{isQuran ? (isRtl ? 'إنشاء قائمة تلاوة جديدة' : 'Create Recitation Playlist') : (isRtl ? 'إنشاء قائمة جديدة' : 'Create New Playlist')}</span>
                  </button>
                </div>

                {isPlaylistsLoading ? (
                  <div className="py-20 flex justify-center"><Spinner /></div>
                ) : playlists.length === 0 ? (
                  <div className="text-center py-16 p-8 rounded-3xl bg-white/70 dark:bg-surface/30 border border-slate-200/80 dark:border-border/30 flex flex-col items-center justify-center gap-4 shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-primaryMusic/10 text-primaryMusic flex items-center justify-center">
                      <ListMusic size={32} />
                    </div>
                    <div className="text-muted text-sm">
                      {isQuran ? (isRtl ? 'لا توجد قوائم تلاوة بعد. يمكنك تحديد قراء أو سور وإضافتها لقائمة جديدة!' : 'No recitation playlists yet. Select reciters or surahs to create one!') : (isRtl ? 'لا توجد قوائم تشغيل حالياً.' : 'No playlists yet.')}
                    </div>
                    <button
                      onClick={() => {
                        setModalTrackIds([]);
                        setIsPlaylistModalOpen(true);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-primaryMusic text-black font-bold text-xs shadow-md hover:brightness-110 transition"
                    >
                      {isQuran ? (isRtl ? '+ إنشاء أول قائمة تلاوة' : '+ Create First Playlist') : (isRtl ? '+ إنشاء أول قائمة' : '+ Create First Playlist')}
                    </button>
                  </div>
                ) : (
                  <div 
                    className="grid gap-4 sm:gap-6"
                    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))` }}
                  >
                    {playlists.map(pl => (
                      <div 
                        key={pl.id}
                        className="group relative flex flex-col p-3 rounded-2xl bg-white dark:bg-surface/40 hover:bg-slate-50 dark:hover:bg-surface/80 border border-slate-200/80 dark:border-border/30 hover:border-slate-300 dark:hover:border-border/60 transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-xl"
                      >
                        {/* Link overlay */}
                        <Link to={`/music/playlist/${pl.id}`} className="absolute inset-0 z-0" />
                        
                        <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-950/20 via-surface to-surfaceHover border border-slate-200/60 dark:border-border/40 flex items-center justify-center shadow-md pointer-events-none">
                          <ListMusic size={42} className="text-primaryMusic/60 group-hover:scale-110 transition-transform duration-300" />

                          {/* Hover Play Button */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-auto">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handlePlayPlaylist(pl);
                              }}
                              className="w-12 h-12 rounded-full bg-primaryMusic text-black flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-transform"
                              title={isQuran ? 'تشغيل القائمة' : 'Play Playlist'}
                            >
                              <Play size={20} fill="black" className="ms-0.5" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 min-w-0 pointer-events-none relative z-10 text-center">
                          <div className="text-sm font-semibold truncate text-text group-hover:text-primaryMusic transition-colors">
                            {pl.name}
                          </div>
                          <div className="text-xs text-muted truncate mt-0.5 flex items-center justify-center gap-2">
                            <span>{pl.tracksCount || 0} {isQuran ? (isRtl ? 'تلاوة' : 'recitations') : (isRtl ? 'مقطع' : 'tracks')}</span>
                            {pl.totalDuration > 0 && <span>• {formatDuration(pl.totalDuration)}</span>}
                          </div>
                        </div>

                        {/* Action buttons (Edit, Delete) */}
                        {(pl.user_id === user?.id || isAdmin()) && (
                          <div className="absolute top-4 end-4 flex items-center gap-2 z-20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity pointer-events-auto">
                            <button
                              onClick={(e) => handleEditPlaylist(e, pl)}
                              className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center hover:bg-blue-500/20 transition shadow-sm"
                              title={isRtl ? 'تعديل' : 'Edit'}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDeletePlaylist(e, pl)}
                              className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition shadow-sm"
                              title={isRtl ? 'حذف' : 'Delete'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : isAudio ? (
              /* Audio: Artists / Reciters View */
              displayedItems.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
                  <Search size={32} className="text-muted opacity-50 mb-1" />
                  <div className="text-sm font-semibold text-text">
                    {isRtl ? `لا توجد نتائج مطابقة لـ "${searchTerm}"` : `No items matching "${searchTerm}"`}
                  </div>
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="text-xs text-primaryMusic font-bold hover:underline mt-1"
                  >
                    {isRtl ? 'إلغاء التصفية' : 'Clear filter'}
                  </button>
                </div>
              ) : (
                <div 
                  className="grid gap-4 sm:gap-6"
                  style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))` }}
                >
                  {visibleItems.map(item => (
                    <ArtistCard 
                      key={item.id} 
                      artist={item} 
                      to={`/music/artist/${item.id}`} 
                      onPlayClick={handlePlayArtist}
                      isSelectionMode={isSelectionMode}
                      isSelected={selectedIds.includes(item.id)}
                      onToggleSelect={handleToggleSelect}
                      isQuran={isQuran}
                    />
                  ))}
                </div>
              )
            ) : (
              /* Video: Movies / Shows */
              displayedItems.length === 0 ? (
                <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
                  <Search size={32} className="text-muted opacity-50 mb-1" />
                  <div className="text-sm font-semibold text-text">
                    {isRtl ? `لا توجد نتائج مطابقة لـ "${searchTerm}"` : `No items matching "${searchTerm}"`}
                  </div>
                  <button 
                    onClick={() => setSearchTerm('')} 
                    className="text-xs text-primaryMovies font-bold hover:underline mt-1"
                  >
                    {isRtl ? 'إلغاء التصفية' : 'Clear filter'}
                  </button>
                </div>
              ) : (
                <div 
                  className={displayMode === 'list' ? 'flex flex-col gap-2' : 'grid gap-4 sm:gap-6'}
                  style={
                    displayMode === 'grid'
                      ? { gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))` }
                      : displayMode === 'compact'
                      ? { gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(110, Math.round(cardMinSize * 0.65))}px, 1fr))` }
                      : displayMode === 'wide'
                      ? { gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(260, Math.round(cardMinSize * 1.5))}px, 1fr))` }
                      : undefined
                  }
                >
                  {visibleItems.map(item => {
                    const to = library.type === 'movies' ? `/movies/${item.id}` : `/series/${item.id}`;
                    const isSelected = selectedIds.includes(item.id);
                    
                    if (displayMode === 'list') {
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isSelectionMode) handleToggleSelect(item);
                          }}
                          className={`flex items-center gap-4 p-3 rounded-2xl bg-white dark:bg-surface hover:bg-slate-50 dark:hover:bg-surfaceHover border ${
                            isSelected ? 'border-primaryMovies bg-primaryMovies/10' : 'border-slate-200/80 dark:border-border/30'
                          } shadow-sm transition cursor-pointer`}
                        >
                          {isSelectionMode && (
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${
                              isSelected ? 'bg-primaryMovies border-primaryMovies text-white scale-105' : 'border-slate-300 dark:border-white/30 text-transparent'
                            }`}>
                              <Check size={14} className="stroke-[3]" />
                            </div>
                          )}
                          <Link to={isSelectionMode ? '#' : to} onClick={e => { if (isSelectionMode) e.preventDefault(); }} className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="w-12 h-16 bg-surfaceHover flex-shrink-0 rounded-xl overflow-hidden shadow-sm">
                              {item.poster && <img src={item.poster} alt={item.title} className="w-full h-full object-cover" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-text truncate">{item.title}</div>
                              <div className="text-xs text-muted mt-0.5">{item.year} {item.rating ? `• ★${item.rating}` : ''}</div>
                            </div>
                          </Link>
                        </div>
                      );
                    }
                    if (displayMode === 'wide') {
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (isSelectionMode) handleToggleSelect(item);
                          }}
                          className={`group relative rounded-2xl overflow-hidden bg-white dark:bg-surface border ${
                            isSelected ? 'border-2 border-primaryMovies shadow-lg' : 'border-slate-200/80 dark:border-border'
                          } aspect-video shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer`}
                        >
                          {isSelectionMode && (
                            <div className="absolute top-3 start-3 z-20">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all backdrop-blur-md shadow-md ${
                                isSelected ? 'bg-primaryMovies border-primaryMovies text-white scale-105' : 'bg-black/60 border-white/40 text-transparent'
                              }`}>
                                <Check size={14} className="stroke-[3]" />
                              </div>
                            </div>
                          )}
                          <Link to={isSelectionMode ? '#' : to} onClick={e => { if (isSelectionMode) e.preventDefault(); }} className="absolute inset-0 z-10" />
                          {item.backdrop ? <img src={item.backdrop} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" /> : <div className="w-full h-full bg-surfaceHover flex items-center justify-center">{item.title}</div>}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
                          <div className="absolute bottom-0 left-0 p-4 pointer-events-none">
                            <div className="font-bold text-lg text-white drop-shadow-md">{item.title}</div>
                            <div className="text-sm text-gray-200">{item.year} {item.rating ? `• ★${item.rating}` : ''}</div>
                          </div>
                        </div>
                      );
                    }

                    // grid or compact: uses MovieCard format with selection support
                    const isCompact = displayMode === 'compact';
                    return (
                      <MovieCard 
                        key={item.id} 
                        item={item} 
                        to={to} 
                        className={`w-full ${isCompact ? 'scale-95' : ''}`}
                        isSelectionMode={isSelectionMode}
                        isSelected={isSelected}
                        onToggleSelect={handleToggleSelect}
                      />
                    );
                  })}
                </div>
              )
            )}

            {/* Progressive batch rendering - Load More button (hidden for movies and series as all items are displayed upfront) */}
            {!isMovies && displayedItems.length > visibleCount && (
              <div className="flex justify-center mt-10 pb-6">
                <button
                  type="button"
                  onClick={() => setVisibleCount(c => c + 60)}
                  className="px-6 py-2.5 rounded-2xl bg-white dark:bg-surface border border-slate-200/80 dark:border-border/60 hover:bg-slate-50 dark:hover:bg-surfaceHover text-text font-semibold text-xs shadow-md transition active:scale-95 flex items-center gap-2"
                >
                  <span>{isRtl ? `عرض المزيد (${displayedItems.length - visibleCount} متبقية)` : `Load More (${displayedItems.length - visibleCount} remaining)`}</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* Floating Glass Action Bar for Batch Selection */}
        {isSelectionMode && (
          <div className={`fixed ${currentTrack ? 'bottom-24 sm:bottom-28' : 'bottom-6'} left-1/2 -translate-x-1/2 z-[60] flex items-center justify-between sm:justify-center gap-2 sm:gap-3 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-white/95 dark:bg-surface/95 border border-slate-300/80 dark:border-primaryMusic/40 shadow-2xl shadow-black/50 backdrop-blur-2xl animate-fadeIn max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-3rem)] overflow-x-auto scrollbar-none`}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-surface text-xs font-semibold text-text border border-slate-200 dark:border-border/50 transition whitespace-nowrap"
              >
                {selectedIds.length === (library.items?.length || 0) ? (isRtl ? 'إلغاء الكل' : 'Deselect All') : (isRtl ? 'تحديد الكل' : 'Select All')}
              </button>
              <span className="text-xs text-slate-800 dark:text-muted font-bold whitespace-nowrap">
                {isRtl ? `تم تحديد (${selectedIds.length})` : `Selected (${selectedIds.length})`}
              </span>
            </div>

            <div className="h-4 w-[1px] bg-slate-300 dark:bg-border/60 mx-1 hidden sm:block flex-shrink-0" />

            <div className="flex items-center gap-2 flex-shrink-0">
              {isAudio && (
                <>
                  <button
                    disabled={selectedIds.length === 0 || isBatchLoading}
                    onClick={() => handlePlaySelected(false)}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-primaryMusic text-black font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                  >
                    {isBatchLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="ms-0.5" />}
                    <span>{isQuran ? (isRtl ? 'تشغيل المحدد' : 'Play Selected') : (isRtl ? 'تشغيل' : 'Play')}</span>
                  </button>

                  <button
                    disabled={selectedIds.length === 0 || isBatchLoading}
                    onClick={() => handlePlaySelected(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-surface border border-slate-200 dark:border-border/60 text-text font-semibold text-xs active:scale-95 transition disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                    title={isRtl ? 'تشغيل عشوائي' : 'Shuffle'}
                  >
                    <Shuffle size={14} />
                    <span className="hidden md:inline">{isRtl ? 'خلط' : 'Shuffle'}</span>
                  </button>

                  <button
                    disabled={selectedIds.length === 0 || isBatchLoading}
                    onClick={handleOpenPlaylistModal}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-500/30 active:scale-95 transition disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                  >
                    <ListMusic size={14} />
                    <span>{isQuran ? (isRtl ? 'إضافة لقائمة تلاوة' : 'Add to List') : (isRtl ? 'إضافة لقائمة' : 'Add to Playlist')}</span>
                  </button>
                </>
              )}

              {/* Video: Movie / Shows Selection Actions */}
              {!isAudio && (
                <>
                  <button
                    disabled={selectedIds.length === 0 || isBatchLoading}
                    onClick={() => handlePlaySelectedMovies(false)}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-primaryMovies text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                    title={isRtl ? 'تشغيل العناصر المحددة كقائمة متتالية' : 'Play selected as playlist'}
                  >
                    {isBatchLoading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} className="fill-white ms-0.5" />}
                    <span>{isRtl ? `تشغيل المحدد (${selectedIds.length})` : `Play Selected (${selectedIds.length})`}</span>
                  </button>

                  <button
                    disabled={selectedIds.length === 0 || isBatchLoading}
                    onClick={() => handlePlaySelectedMovies(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-surface border border-slate-200 dark:border-border/60 text-text font-semibold text-xs active:scale-95 transition disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                    title={isRtl ? 'تشغيل عشوائي للعناصر المحددة' : 'Shuffle selected'}
                  >
                    <Shuffle size={14} />
                    <span className="hidden md:inline">{isRtl ? 'خلط' : 'Shuffle'}</span>
                  </button>

                  <button
                    disabled={selectedIds.length === 0 || isBatchLoading}
                    onClick={handleAddToVideoQueue}
                    className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-slate-200 dark:border-border/60 text-text font-semibold text-xs active:scale-95 transition disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                    title={isRtl ? 'إضافة إلى قائمة التشغيل الحالية' : 'Add to current queue'}
                  >
                    <ListPlus size={14} />
                    <span>{isRtl ? 'إضافة للقائمة' : 'Add to Queue'}</span>
                  </button>
                </>
              )}

              {/* Batch Download ZIP Button */}
              {canDownload() && (
                <button
                  disabled={selectedIds.length === 0}
                  onClick={handleDownloadSelected}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-black font-bold text-xs shadow-md active:scale-95 transition disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                  title={isRtl ? 'تنزيل العناصر المحددة في أرشيف ZIP واحد' : 'Download selected items as a single ZIP archive'}
                >
                  <Download size={14} />
                  <span>{isRtl ? 'تنزيل المحددة (ZIP)' : 'Download (ZIP)'}</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedIds([]);
                }}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-surface text-slate-700 dark:text-muted hover:text-text transition flex-shrink-0"
                title={isRtl ? 'إغلاق وضع التحديد' : 'Close Selection'}
              >
                <CheckSquare size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Add To Playlist Modal */}
        <AddToPlaylistModal
          isOpen={isPlaylistModalOpen}
          onClose={() => setIsPlaylistModalOpen(false)}
          trackIds={modalTrackIds}
          libraryId={id}
          isQuran={isQuran}
          onSuccess={() => {
            setIsSelectionMode(false);
            setSelectedIds([]);
            qc.invalidateQueries({ queryKey: ['playlists'] });
          }}
        />
      </main>
      </div>
    </div>
  );
}
