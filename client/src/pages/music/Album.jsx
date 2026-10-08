import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchAlbum, createPlaylist, saveRating, fetchPlaylists, triggerDownload, addTrackToPlaylist, deleteAlbumApi } from '../../api/client';
import TopBar from '../../components/shared/TopBar';
import Spinner from '../../components/shared/Spinner';
import { usePlayerStore } from '../../store/usePlayerStore';
import { Play, Clock, Heart, ListPlus, MoreHorizontal, Shuffle, Plus, Download, CheckSquare, Check, X, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import Rating from '../../components/shared/Rating';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import AddToPlaylist from '../../components/music/AddToPlaylist';
import AddToPlaylistModal from '../../components/shared/AddToPlaylistModal';
import { useAuthStore } from '../../store/useAuthStore';

export default function Album() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const isArabic = i18n.language === 'ar';
  const user = useAuthStore(s => s.user);
  const canDownload = user?.role === 'admin' || (user?.can_download !== false && user?.can_download !== 0);
  const { data: album, isLoading } = useQuery({ queryKey: ['album', id], queryFn: ()=>fetchAlbum(id) });
  const playTrack = usePlayerStore(s=>s.playTrack);
  const setQueue = usePlayerStore(s=>s.setQueue);
  const currentTrack = usePlayerStore(s=>s.currentTrack);
  const navigate = useNavigate();
  const [rating, setRating] = useState(null);
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(null); // track id for menu
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const libraryId = album?.library_id;
  const { data: playlists = [] } = useQuery({ 
    queryKey: ['playlists', libraryId], 
    queryFn: () => fetchPlaylists(libraryId),
    enabled: !!libraryId
  });
  const qc = useQueryClient();

  const ratingMut = useMutation({
    mutationFn: (val)=> saveRating('album', id, val),
    onSuccess: ()=> qc.invalidateQueries({queryKey: ['album', id]})
  });

  if (isLoading) return <div className="min-h-screen bg-bg"><TopBar variant="music"/><div className="flex justify-center pt-20"><Spinner/></div></div>;
  if (!album) return <div>Not found</div>;

  const cover = album.covers?.[0]?.url;
  const totalDuration = album.tracks?.reduce((a,t)=>a+(t.duration||0),0) || 0;

  const handlePlayAll = () => {
    if (!album.tracks?.length) return;
    // enrich tracks with album cover and artistId for navigation
    const queue = album.tracks.map(t=> ({...t, artistName: album.artistName, artistId: album.artist_id, cover }));
    setQueue(queue, 0);
  };

  const handleShuffleAll = () => {
    if (!album.tracks?.length) return;
    const queue = album.tracks.map(t=> ({...t, artistName: album.artistName, artistId: album.artist_id, cover })).sort(() => Math.random() - 0.5);
    setQueue(queue, 0);
  };

  const handleAddToPlaylist = async (playlistId, trackId) => {
    try {
      await addTrackToPlaylist(playlistId, trackId);
      qc.invalidateQueries({ queryKey: ['playlists'] });
      qc.invalidateQueries({ queryKey: ['playlist', String(playlistId)] });
      setShowPlaylistMenu(null);
    } catch (err) {
      console.error('Failed to add track to playlist:', err);
    }
  };

  const handleToggleTrack = (trackId) => {
    setSelectedTrackIds(prev =>
      prev.includes(trackId) ? prev.filter(x => x !== trackId) : [...prev, trackId]
    );
  };

  const handleSelectAllTracks = () => {
    const allIds = (album?.tracks || []).map(t => t.id);
    if (selectedTrackIds.length === allIds.length) {
      setSelectedTrackIds([]);
    } else {
      setSelectedTrackIds(allIds);
    }
  };

  const handleDownloadSelectedTracks = () => {
    if (!selectedTrackIds.length) return;
    const albumTitle = album?.title || (isArabic ? 'ألبوم' : 'Album');
    const artistTitle = album?.artistName ? `${album.artistName}_` : '';
    triggerDownload('/api/download/batch', {
      type: 'tracks',
      ids: selectedTrackIds.join(','),
      title: `${artistTitle}${albumTitle}_${isQuran ? (isArabic ? 'تلاوات_مختارة' : 'selected_recitations') : (isArabic ? 'مقاطع_مختارة' : 'selected_tracks')}`
    });
    setIsSelectMode(false);
    setSelectedTrackIds([]);
  };

  const handleDownloadAlbum = () => {
    triggerDownload(`/api/download/album/${id}`);
  };

  const handleDownloadTrack = (e, trackId) => {
    e.stopPropagation();
    triggerDownload(`/api/download/track/${trackId}`);
  };

  const handleRefresh = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`/api/albums/${id}/scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Scan failed');
      await qc.invalidateQueries({ queryKey: ['album', id] });
    } catch (e) {
      console.error('Failed to refresh album:', e);
    } finally {
      setIsScanning(false);
    }
  };

  const handleDeleteAlbum = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteAlbumApi(album.id);
      await qc.invalidateQueries({ queryKey: ['albums'] });
      await qc.invalidateQueries({ queryKey: ['artists'] });
      await qc.invalidateQueries({ queryKey: ['tracks'] });
      await qc.invalidateQueries({ queryKey: ['library'] });
      await qc.invalidateQueries({ queryKey: ['libraries'] });
      setIsDeleteModalOpen(false);
      if (album.artist_id) {
        navigate(`/music/artists/${album.artist_id}`);
      } else if (album.library_id) {
        navigate(`/library/${album.library_id}`);
      } else {
        navigate('/music/albums');
      }
    } catch (err) {
      console.error('Failed to delete album:', err);
      alert(err.response?.data?.error?.message || err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const isQuran = (album.title || '').includes('قرآن') || (album.title || '').includes('قران') || (album.artistName || '').includes('الشيخ') || (album.artistName || '').includes('القارئ') || (album.title || '').includes('سورة') || (album.title || '').includes('مصحف');

  return (
    <div className="min-h-screen bg-bg pb-24">
      <TopBar variant="music" />
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-[280px] flex-shrink-0">
            <div className="aspect-square rounded-xl overflow-hidden bg-surface shadow-xl border border-border">
              {cover ? <img src={cover} alt={album.title} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-muted">No cover</div>}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-widest text-muted">
              {isQuran ? (isRtl ? 'مصحف / تلاوة' : 'Recitation') : (isRtl ? 'ألبوم' : 'Album')}
            </div>
            <h1 className={`font-bold mt-1 ${isRtl ? 'text-2xl md:text-3xl' : 'text-3xl md:text-4xl'}`}>{album.title}</h1>
            <p className="font-semibold mt-2">
              <Link to={`/music/artist/${album.artist_id}`} className="text-primaryMusic hover:underline transition">{album.artistName}</Link>
              {album.year ? <span className="text-muted"> • {album.year}</span> : null}
            </p>
            <p className="text-sm text-muted mt-1">
              {album.tracks.length} {isQuran ? (isRtl ? 'تلاوة' : 'recitations') : (isRtl ? 'أغنية' : 'songs')} • {Math.floor(totalDuration/60)} {isRtl ? 'دقيقة' : 'min'}
            </p>
            <div className="flex items-center gap-3 mt-6 flex-wrap">
              <button 
                onClick={handlePlayAll} 
                className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-primaryMusic text-black flex items-center justify-center hover:scale-105 shadow-lg active:scale-95 transition"
                title={isQuran ? (isRtl ? 'تشغيل كل التلاوات' : 'Play all') : (isRtl ? 'تشغيل الكل' : 'Play all')}
              >
                <Play size={24} fill="black" className="ms-1"/>
              </button>
              <button 
                onClick={handleShuffleAll} 
                className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-surfaceHover text-text flex items-center justify-center hover:scale-105 shadow-lg active:scale-95 transition border border-border"
                title={isRtl ? 'تشغيل عشوائي' : 'Shuffle'}
              >
                <Shuffle size={20} />
              </button>

              {/* Download Full Album / Quran ZIP */}
              {canDownload && (
                <button
                  onClick={handleDownloadAlbum}
                  className="flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 hover:bg-emerald-500/25 dark:hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-xs sm:text-sm font-bold shadow-sm active:scale-95 transition group"
                  title={isQuran ? (isRtl ? 'تحميل المصحف بالكامل كملف مضغوط (ZIP)' : 'Download full recitation (ZIP)') : (isRtl ? 'تحميل الألبوم بالكامل كملف مضغوط (ZIP)' : 'Download full album (ZIP)')}
                >
                  <Download size={17} className="group-hover:translate-y-0.5 transition-transform" />
                  <span className={isRtl ? 'hidden lg:inline' : ''}>{isQuran ? 'Download Quran' : 'Download Album'}</span>
                </button>
              )}

              {/* Refresh Album & Delete Album (Admin Only) */}
              {user?.role === 'admin' && (
                <>
                  <button
                    onClick={handleRefresh}
                    disabled={isScanning}
                    className="flex items-center gap-2 px-4 py-3 rounded-full bg-surfaceHover hover:bg-surface text-text border border-border text-xs sm:text-sm font-bold shadow-sm active:scale-95 transition disabled:opacity-50"
                    title={isRtl ? 'تحديث بيانات وملفات الألبوم' : 'Refresh Album Files'}
                  >
                    <RefreshCw size={17} className={isScanning ? 'animate-spin text-primaryMusic' : 'text-primaryMusic'} />
                    <span className={isRtl ? 'hidden lg:inline' : ''}>{isRtl ? 'تحديث' : 'Refresh'}</span>
                  </button>

                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-3 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 border border-rose-500/25 dark:border-rose-500/40 text-xs sm:text-sm font-bold shadow-sm active:scale-95 transition"
                    title={isRtl ? 'حذف الألبوم من الخادم' : 'Delete Album from Server'}
                  >
                    <Trash2 size={17} />
                    <span className={isRtl ? 'hidden lg:inline' : ''}>{isRtl ? 'حذف من الخادم' : 'Delete'}</span>
                  </button>
                </>
              )}

              {/* Toggle Track Select Mode */}
              {canDownload && (
                <button
                  onClick={() => {
                    setIsSelectMode(!isSelectMode);
                    setSelectedTrackIds([]);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-3 rounded-full border text-xs sm:text-sm font-semibold transition active:scale-95 shadow-sm ${
                    isSelectMode
                      ? 'bg-primaryMusic text-black border-primaryMusic font-bold shadow-md'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-surfaceHover dark:hover:bg-surface text-text border-slate-200 dark:border-border'
                  }`}
                  title={isRtl ? 'تحديد عناصر لتنزيلها معاً' : 'Select items to download'}
                >
                  <CheckSquare size={16} />
                  <span className={isRtl ? 'hidden lg:inline' : ''}>{isSelectMode ? 'Done' : 'Select'}</span>
                </button>
              )}

              <button className="w-9 h-9 rounded-full border border-border flex items-center justify-center hover:bg-surface"><Heart size={18}/></button>
              <AddToPlaylist albumId={album.id} libraryId={album.library_id} iconSize={18} />
              <div className="ms-4">
                <Rating value={album.rating || 0} onChange={(v)=>ratingMut.mutate(v)} size={18}/>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-xl bg-surface border border-border overflow-hidden">
          <div className="grid grid-cols-[40px_1fr_60px_70px] md:grid-cols-[40px_1fr_1fr_60px_70px] px-4 py-2 text-xs text-muted border-b border-border">
            <span>#</span>
            <span>{isQuran ? (isRtl ? 'السورة / التلاوة' : 'Recitation') : (isRtl ? 'العنوان' : 'Title')}</span>
            <span className="hidden md:block">{isQuran ? (isRtl ? 'المصحف' : 'Album') : (isRtl ? 'الألبوم' : 'Album')}</span>
            <span className="flex justify-end"><Clock size={14}/></span>
            <span className="text-center">{isRtl ? 'خيارات' : 'Actions'}</span>
          </div>
          <div className="divide-y divide-border/50">
            {album.tracks.map((track, idx)=> {
              const isSelected = selectedTrackIds.includes(track.id);

              return (
                <div
                  key={track.id}
                  onClick={() => {
                    if (isSelectMode) handleToggleTrack(track.id);
                  }}
                  className={`grid grid-cols-[40px_1fr_60px_70px] md:grid-cols-[40px_1fr_1fr_60px_70px] px-4 py-2.5 items-center hover:bg-surfaceHover group transition ${
                    isSelected ? 'bg-primaryMusic/10 border-s-2 border-primaryMusic' : ''
                  } ${isSelectMode ? 'cursor-pointer' : ''}`}
                >
                  {isSelectMode ? (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleTrack(track.id);
                      }}
                      className="w-5 h-5 rounded border flex items-center justify-center transition cursor-pointer"
                      style={{ borderColor: isSelected ? '#10b981' : '#666', background: isSelected ? '#10b981' : 'transparent' }}
                    >
                      {isSelected && <Check size={13} className="text-black stroke-[3]" />}
                    </div>
                  ) : (
                    <>
                      <span className="text-sm text-muted group-hover:hidden">{track.track_number || idx+1}</span>
                      <button onClick={()=>{ const queue = album.tracks.map(t=>({...t, artistName: album.artistName, artistId: album.artist_id, cover})); const tIdx = queue.findIndex(q=>q.id===track.id); playTrack(queue[tIdx], queue); }} className="hidden group-hover:flex w-6 h-6 rounded-full bg-white text-black items-center justify-center"><Play size={12} fill="black" className="ms-0.5"/></button>
                    </>
                  )}

                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${isSelected ? 'text-emerald-400 font-bold' : ''}`}>{track.title}</div>
                    <div className="text-xs text-muted truncate md:hidden">{album.artistName}</div>
                  </div>
                  <div className="hidden md:block text-sm text-muted truncate">{album.title}</div>
                  <div className="text-xs text-muted text-right tabular-nums">{track.duration ? `${Math.floor(track.duration/60)}:${String(track.duration%60).padStart(2,'0')}` : '--:--'}</div>
                  
                  {/* Action buttons (Download + AddToPlaylist) */}
                  <div className="flex items-center justify-center gap-2">
                    {/* Quick Single Track Download */}
                    {canDownload && (
                      <button
                        onClick={(e) => handleDownloadTrack(e, track.id)}
                        className="p-1 text-muted hover:text-emerald-400 transition"
                        title={isQuran ? (isRtl ? 'تحميل السورة' : 'Download') : (isRtl ? 'تحميل التراك' : 'Download')}
                      >
                        <Download size={15} />
                      </button>
                    )}

                    <div className="relative flex justify-center">
                      <button onClick={(e) => { e.stopPropagation(); setShowPlaylistMenu(showPlaylistMenu === track.id ? null : track.id); }}>
                        <ListPlus size={16} className="text-muted hover:text-primaryMusic transition" title={isQuran ? (isRtl ? 'أضف إلى قائمة تلاوة' : 'Add to playlist') : (isRtl ? 'أضف إلى قائمة تشغيل' : 'Add to playlist')} />
                      </button>
                      {showPlaylistMenu === track.id && (
                        <div className="absolute bottom-full end-0 mb-1 w-48 bg-surface border border-border rounded-xl shadow-xl z-50 p-1 max-h-52 overflow-y-auto">
                          {playlists.length === 0 ? (
                            <div className="text-xs text-muted text-center py-3">{isQuran ? (isRtl ? 'لا توجد قوائم تلاوة' : 'No playlists') : (isRtl ? 'لا توجد قوائم تشغيل' : 'No playlists')}</div>
                          ) : playlists.map(pl => (
                            <button key={pl.id} onClick={(e) => { e.stopPropagation(); handleAddToPlaylist(pl.id, track.id); }} className="w-full text-start px-3 py-2 text-xs hover:bg-surfaceHover rounded-lg flex items-center gap-2">
                              <Plus size={12} className="text-primaryMusic" />
                              <span className="truncate">{pl.name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 text-xs text-muted">
          {album.tracks.length} {isQuran ? (isRtl ? 'تلاوة مباركة' : 'recitations') : (isRtl ? 'تراك' : 'tracks')}
        </div>
      </div>

      {/* Floating Batch Selection Bar */}
      {isSelectMode && (
        <div className={`fixed ${currentTrack ? 'bottom-24 sm:bottom-28' : 'bottom-6'} left-1/2 -translate-x-1/2 z-[60] max-w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-3rem)] overflow-x-auto scrollbar-none bg-slate-900/95 dark:bg-black/95 backdrop-blur-xl border border-emerald-500/40 rounded-2xl shadow-2xl shadow-black/80 px-4 sm:px-5 py-2.5 sm:py-3 flex items-center gap-2.5 sm:gap-3.5 animate-scaleUp`}>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-white whitespace-nowrap flex-shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {isArabic
                ? `تم تحديد ${selectedTrackIds.length} ${isQuran ? 'تلاوة' : 'مقطع'}`
                : `${selectedTrackIds.length} selected`}
            </span>
          </div>

          <div className="h-4 w-px bg-white/20 flex-shrink-0" />

          <button
            onClick={handleDownloadSelectedTracks}
            disabled={!selectedTrackIds.length}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-xs sm:text-sm font-extrabold shadow-lg shadow-emerald-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap flex-shrink-0"
          >
            <Download size={15} />
            <span>{isArabic ? 'تحميل المحددة (ZIP)' : 'Download Selected'}</span>
          </button>

          <button
            onClick={() => setIsPlaylistModalOpen(true)}
            disabled={!selectedTrackIds.length}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 text-xs sm:text-sm font-bold shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap flex-shrink-0"
          >
            <ListPlus size={15} />
            <span>{isQuran ? (isArabic ? 'إضافة لقائمة تلاوة' : 'Add to Recitation List') : (isArabic ? 'إضافة لقائمة تشغيل' : 'Add to Playlist')}</span>
          </button>

          <button
            onClick={handleSelectAllTracks}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition whitespace-nowrap flex-shrink-0"
          >
            {selectedTrackIds.length === (album?.tracks?.length || 0)
              ? (isArabic ? 'إلغاء الكل' : 'Deselect All')
              : (isArabic ? 'تحديد الكل' : 'Select All')}
          </button>

          <button
            onClick={() => {
              setIsSelectMode(false);
              setSelectedTrackIds([]);
            }}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition flex-shrink-0"
            title={isArabic ? 'إغلاق' : 'Close'}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Add To Playlist Modal for batch selected tracks */}
      <AddToPlaylistModal
        isOpen={isPlaylistModalOpen}
        onClose={() => setIsPlaylistModalOpen(false)}
        trackIds={selectedTrackIds}
        libraryId={album?.library_id}
        isQuran={isQuran}
        onSuccess={() => {
          setIsSelectMode(false);
          setSelectedTrackIds([]);
          qc.invalidateQueries({ queryKey: ['playlists'] });
        }}
      />

      {/* Delete Album from Server Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fadeIn">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900/95 border border-rose-500/30 shadow-[0_25px_60px_-15px_rgba(244,63,94,0.35)] text-text text-start">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
                <Trash2 size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">{isRtl ? 'حذف الألبوم من الخادم' : 'Delete Album from Server'}</h3>
                <p className="text-xs text-slate-400 truncate max-w-[280px]">{album.title}</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-4">
              {isRtl 
                ? `هل أنت متأكد من رغبتك في حذف ألبوم "${album.title}" (${album.tracks?.length || 0} مسار صوتي) نهائياً من الخادم وقاعدة البيانات؟`
                : `Are you sure you want to remove "${album.title}" (${album.tracks?.length || 0} tracks) from the server and database?`}
            </p>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs leading-relaxed mb-6 flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <span>
                {isRtl
                  ? 'ملاحظة هامة: سيتم تنظيف كافة التراكات والبيانات والصور الخاصة بالألبوم من قاعدة البيانات، ولن يتم حذف أي ملفات صوتية نهائياً من القرص الصلب أو جهاز الكمبيوتر.'
                  : 'Important note: All tracks, artwork, and metadata for this album will be cleaned from the database. No audio files will be deleted from your disk or computer.'}
              </span>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition active:scale-95 disabled:opacity-50"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={handleDeleteAlbum}
                disabled={isDeleting}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-bold shadow-lg shadow-rose-600/30 border border-rose-400/30 transition active:scale-95 disabled:opacity-50"
              >
                {isDeleting && <Spinner size="sm" />}
                <span>{isDeleting ? (isRtl ? 'جاري الحذف...' : 'Deleting...') : (isRtl ? 'تأكيد الحذف من الخادم' : 'Confirm Delete')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
