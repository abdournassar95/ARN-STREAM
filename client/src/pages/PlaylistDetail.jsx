import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPlaylist, fetchTracks, addTrackToPlaylist } from '../api/client';
import TopBar from '../components/shared/TopBar';
import Spinner from '../components/shared/Spinner';
import { usePlayerStore } from '../store/usePlayerStore';
import { useTranslation } from 'react-i18next';
import { Play, Shuffle, Trash2, Clock, ListMusic, Edit2, Plus, Search, X, Check, Loader2 } from 'lucide-react';
import client from '../api/client';

export default function PlaylistDetail() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const qc = useQueryClient();
  const { data: playlist, isLoading } = useQuery({ queryKey: ['playlist', id], queryFn: () => fetchPlaylist(id) });
  const playTrack = usePlayerStore(s => s.playTrack);
  const setQueue = usePlayerStore(s => s.setQueue);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [addingTrackId, setAddingTrackId] = useState(null);

  const isQuran = (playlist?.name || '').includes('قرآن') || (playlist?.name || '').includes('قران') || (playlist?.description || '').includes('تلاوات') || playlist?.library_id === 4;

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['playlist-search-tracks', playlist?.library_id, trackSearch],
    queryFn: () => fetchTracks({ q: trackSearch.trim(), library_id: playlist?.library_id || undefined, limit: 40 }),
    enabled: isAddModalOpen
  });

  const removeMut = useMutation({
    mutationFn: (itemId) => client.delete(`/playlists/${id}/items/${itemId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['playlist', id] });
      qc.invalidateQueries({ queryKey: ['playlists'] });
    }
  });

  const editMut = useMutation({
    mutationFn: ({ id, name }) => client.put(`/playlists/${id}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['playlist', id] });
      qc.invalidateQueries({ queryKey: ['playlists'] });
    }
  });

  const handleEdit = () => {
    const newName = window.prompt(isRtl ? 'اسم القائمة الجديد:' : 'New playlist name:', playlist.name);
    if (newName && newName.trim() !== playlist.name) {
      editMut.mutate({ id: playlist.id, name: newName.trim() });
    }
  };

  const handleAddTrack = async (trackId) => {
    setAddingTrackId(trackId);
    try {
      await addTrackToPlaylist(id, trackId);
      qc.invalidateQueries({ queryKey: ['playlist', id] });
      qc.invalidateQueries({ queryKey: ['playlists'] });
    } catch (err) {
      console.error('Failed to add track to playlist:', err);
    } finally {
      setTimeout(() => setAddingTrackId(null), 1000);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-bg"><TopBar variant="music" /><div className="flex justify-center pt-20"><Spinner /></div></div>;
  if (!playlist) return <div className="min-h-screen bg-bg text-center pt-20 text-muted">{isRtl ? 'لم يتم العثور على القائمة' : 'Playlist not found'}</div>;

  const items = playlist.items || [];
  const existingTrackIds = new Set(items.map(it => it.track_id));
  const totalDuration = items.reduce((a, t) => a + (t.duration || 0), 0);

  const handlePlayAll = () => {
    if (!items.length) {
      setQueue([], 0);
      return;
    }
    const queue = items.map(it => ({
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
  };

  const handleShuffle = () => {
    if (!items.length) {
      setQueue([], 0);
      return;
    }
    const queue = items.map(it => ({
      id: it.track_id,
      title: it.title,
      duration: it.duration,
      artistName: it.artistName,
      artistId: it.artistId,
      albumTitle: it.albumTitle,
      cover: it.cover,
      album_id: it.album_id,
      library_id: it.library_id
    })).sort(() => Math.random() - 0.5);
    setQueue(queue, 0);
  };

  const handlePlayTrack = (item, idx) => {
    const queue = items.map(it => ({
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
    playTrack(queue[idx], queue);
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <TopBar variant="music" />
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end mb-8">
          <div className="w-40 h-40 rounded-3xl bg-gradient-to-br from-primaryMusic/30 via-surface to-surfaceHover border border-border shadow-xl flex items-center justify-center flex-shrink-0">
            <ListMusic size={56} className="text-primaryMusic" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted mb-1">
              {isQuran ? (isRtl ? 'قائمة تلاوة' : 'Recitation Playlist') : (isRtl ? 'قائمة تشغيل' : 'Playlist')}
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-bold truncate">{playlist.name}</h1>
              <button onClick={handleEdit} className="text-muted hover:text-primaryMusic transition p-2" title={isRtl ? 'تعديل' : 'Edit'}>
                <Edit2 size={20} />
              </button>
            </div>
            {playlist.description && <p className="text-sm text-muted mt-1">{playlist.description}</p>}
            <p className="text-sm text-muted mt-2">
              {items.length} {isQuran ? (isRtl ? 'تلاوة' : 'recitations') : (isRtl ? 'مقطع صوتي' : 'tracks')} • {Math.floor(totalDuration / 60)} {isRtl ? 'دقيقة' : 'min'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                onClick={handlePlayAll}
                disabled={!items.length}
                className="w-12 h-12 rounded-full bg-primaryMusic text-black flex items-center justify-center hover:scale-105 shadow-lg disabled:opacity-50 transition"
                title={isRtl ? 'تشغيل الكل' : 'Play All'}
              >
                <Play size={20} fill="black" className="ms-0.5" />
              </button>
              <button
                onClick={handleShuffle}
                disabled={!items.length}
                className="w-12 h-12 rounded-full bg-surfaceHover text-text flex items-center justify-center hover:scale-105 shadow-lg disabled:opacity-50 transition"
                title={isRtl ? 'خلط' : 'Shuffle'}
              >
                <Shuffle size={18} />
              </button>
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="h-12 px-5 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg transition active:scale-95"
              >
                <Plus size={18} />
                <span>{isQuran ? (isRtl ? 'إضافة تلاوات للقائمة' : 'Add Recitations') : (isRtl ? 'إضافة صوتيات للقائمة' : 'Add Tracks')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Track List */}
        {items.length === 0 ? (
          <div className="text-center py-16 px-6 border border-dashed border-border/80 rounded-3xl bg-surface/30 flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-primaryMusic/10 text-primaryMusic flex items-center justify-center mb-1">
              <ListMusic size={32} />
            </div>
            <h3 className="text-base font-bold text-text">
              {isQuran ? (isRtl ? 'لا توجد تلاوات في هذه القائمة بعد' : 'No recitations in this playlist yet') : (isRtl ? 'لا توجد صوتيات في هذه القائمة بعد' : 'No tracks in this playlist yet')}
            </h3>
            <p className="text-xs text-muted max-w-md">
              {isQuran
                ? (isRtl ? 'يمكنك إضافة تلاوات وسور مباشرة من هنا أو من صفحات المصاحف والألبومات' : 'Add recitations directly here or from album pages')
                : (isRtl ? 'يمكنك إضافة مقاطع صوتية مباشرة من هنا أو من صفحات الألبومات' : 'Add audio tracks directly here or from album pages')}
            </p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-xs font-bold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <Plus size={16} />
              <span>{isQuran ? (isRtl ? 'إضافة تلاوات الآن' : 'Add Recitations Now') : (isRtl ? 'إضافة صوتيات الآن' : 'Add Tracks Now')}</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-surface border border-border overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[40px_1fr_1fr_60px_40px] px-4 py-2.5 text-xs text-muted border-b border-border">
              <span>#</span>
              <span>{isRtl ? 'العنوان' : 'Title'}</span>
              <span className="hidden md:block">{isQuran ? (isRtl ? 'القارئ' : 'Reciter') : (isRtl ? 'الفنان' : 'Artist')}</span>
              <span className="flex justify-end"><Clock size={14} /></span>
              <span></span>
            </div>
            <div className="divide-y divide-border/50">
              {items.map((item, idx) => (
                <div key={item.id} className="grid grid-cols-[40px_1fr_60px_40px] md:grid-cols-[40px_1fr_1fr_60px_40px] px-4 py-2.5 items-center hover:bg-surfaceHover group transition">
                  <span className="text-sm text-muted group-hover:hidden">{idx + 1}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePlayTrack(item, idx); }}
                    className="hidden group-hover:flex w-6 h-6 rounded-full bg-primaryMusic text-black items-center justify-center shadow"
                  >
                    <Play size={12} fill="black" className="ms-0.5" />
                  </button>
                  <div className="min-w-0 flex items-center gap-3">
                    {item.cover && (
                      <img src={item.cover} alt={item.title} className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{item.title}</div>
                      <div className="text-xs text-muted truncate md:hidden">{item.artistName}</div>
                    </div>
                  </div>
                  <div className="hidden md:block text-sm text-muted truncate">{item.artistName}</div>
                  <div className="text-xs text-muted text-right tabular-nums">
                    {item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : '--:--'}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeMut.mutate(item.id); }}
                    className="flex justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition p-2"
                    title={isRtl ? 'إزالة' : 'Remove'}
                  >
                    <Trash2 size={16} className="text-red-400 hover:text-red-300" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal: Search & Add Audio Directly to Playlist */}
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
            <div className="relative w-full max-w-lg bg-surface/95 border border-white/15 rounded-3xl p-6 shadow-2xl overflow-hidden backdrop-blur-xl flex flex-col max-h-[85vh]">
              {/* Glow */}
              <div className="absolute -top-24 -left-24 w-48 h-48 bg-primaryMusic/20 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primaryMusic/20 border border-primaryMusic/30 flex items-center justify-center text-primaryMusic shadow-sm">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-text">
                      {isQuran ? (isRtl ? 'إضافة تلاوات إلى القائمة' : 'Add Recitations to Playlist') : (isRtl ? 'إضافة صوتيات إلى القائمة' : 'Add Tracks to Playlist')}
                    </h3>
                    <p className="text-xs text-muted">
                      {playlist.name}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surfaceHover transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search input */}
              <div className="relative mb-4">
                <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none start-3" />
                <input
                  type="text"
                  value={trackSearch}
                  onChange={(e) => setTrackSearch(e.target.value)}
                  placeholder={isQuran ? (isRtl ? 'ابحث باسم السورة، التلاوة، أو الشيخ...' : 'Search surah, recitation, or reciter...') : (isRtl ? 'ابحث باسم الأغنية أو الفنان...' : 'Search song or artist...')}
                  className="w-full py-2.5 rounded-xl bg-surfaceHover/80 border border-border/50 text-sm text-text placeholder:text-muted focus:outline-none focus:border-primaryMusic transition ps-9 pe-4"
                  autoFocus
                />
              </div>

              {/* Track Search Results */}
              <div className="flex-1 overflow-y-auto space-y-2 pe-1 min-h-[200px]">
                {isSearching ? (
                  <div className="py-12 flex items-center justify-center gap-2 text-muted text-xs">
                    <Loader2 size={16} className="animate-spin text-primaryMusic" />
                    <span>{isRtl ? 'جاري البحث في المكتبة...' : 'Searching library...'}</span>
                  </div>
                ) : !searchResults?.items || searchResults.items.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted">
                    {isRtl ? 'لا توجد نتائج مطابقة لبحثك' : 'No tracks found'}
                  </div>
                ) : (
                  searchResults.items.map((t) => {
                    const isAlreadyAdded = existingTrackIds.has(t.id);
                    const isAddingThis = addingTrackId === t.id;
                    return (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3 rounded-2xl bg-surface/50 hover:bg-surfaceHover border border-border/40 transition gap-3"
                      >
                        <div className="min-w-0 flex items-center gap-3">
                          {t.cover && (
                            <img src={t.cover} alt={t.title} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate text-text">{t.title}</div>
                            <div className="text-xs text-muted truncate mt-0.5">
                              {t.artistName && <span>{t.artistName}</span>}
                              {t.albumTitle && <span> • {t.albumTitle}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] text-muted font-mono">{t.duration ? `${Math.floor(t.duration/60)}:${String(t.duration%60).padStart(2,'0')}` : '--:--'}</span>
                          {isAlreadyAdded ? (
                            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1">
                              <Check size={13} />
                              <span>{isRtl ? 'مُضاف' : 'Added'}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddTrack(t.id)}
                              disabled={isAddingThis}
                              className="px-3 py-1.5 rounded-xl bg-primaryMusic text-black text-xs font-bold hover:brightness-110 active:scale-95 transition flex items-center gap-1 shadow-sm disabled:opacity-50"
                            >
                              {isAddingThis ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <>
                                  <Plus size={13} />
                                  <span>{isRtl ? 'إضافة' : 'Add'}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Close */}
              <div className="pt-4 border-t border-border/50 flex justify-end">
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-surfaceHover hover:bg-surface text-xs font-semibold text-text transition"
                >
                  {isRtl ? 'إغلاق' : 'Close'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
