import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchArtist, fetchTracks, triggerDownload } from '../../api/client';
import TopBar from '../../components/shared/TopBar';
import Spinner from '../../components/shared/Spinner';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../store/usePlayerStore';
import { Play, Shuffle, Calendar, ArrowDownAZ, ArrowUpZA, Disc3, Download, Edit2, Globe, Music2, Info, RefreshCw, Eye, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import AddToPlaylist from '../../components/music/AddToPlaylist';
import EditArtistModal from '../../components/music/EditArtistModal';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';

export default function Artist() {
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { data: artist, isLoading } = useQuery({ queryKey: ['artist', id], queryFn: () => fetchArtist(id) });
  const setQueue = usePlayerStore(s => s.setQueue);
  const user = useAuthStore(s => s.user);
  const isAdmin = user?.role === 'admin';
  const canDownload = user?.role === 'admin' || (user?.can_download !== false && user?.can_download !== 0);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const queryClient = useQueryClient();

  const {
    artistDetailSortKey = 'year',
    artistDetailSortOrder = 'desc',
    setArtistDetailSort
  } = useSettingsStore();

  const albumSortKey = artistDetailSortKey;
  const albumSortOrder = artistDetailSortOrder;

  const handleSortToggle = (key) => {
    if (albumSortKey === key) {
      setArtistDetailSort(key, albumSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setArtistDetailSort(key, key === 'name' ? 'asc' : 'desc');
    }
  };

  const sortedAlbums = useMemo(() => {
    if (!artist?.albums) return [];
    let list = [...artist.albums];
    const isDesc = albumSortOrder === 'desc';

    list.sort((x, y) => {
      if (albumSortKey === 'year') {
        const yX = x.year || (isDesc ? -Infinity : Infinity);
        const yY = y.year || (isDesc ? -Infinity : Infinity);
        if (yX !== yY) return isDesc ? yY - yX : yX - yY;
        return x.title.localeCompare(y.title, 'ar');
      }
      const comp = x.title.localeCompare(y.title, 'ar', { sensitivity: 'base' });
      return isDesc ? -comp : comp;
    });

    return list;
  }, [artist?.albums, albumSortKey, albumSortOrder]);

  const handlePlayAll = async (shuffle = false) => {
    setIsPlayingAll(true);
    try {
      const { items } = await fetchTracks({ artist_id: id, limit: 1000 });
      if (!items || !items.length) return;
      let queue = items.map(t => ({ ...t, artistName: artist.name, artistId: artist.id, cover: t.cover || artist.images?.[0]?.url }));
      if (shuffle) queue.sort(() => Math.random() - 0.5);
      setQueue(queue, 0);
    } catch (err) {
      console.error(err);
    } finally {
      setIsPlayingAll(false);
    }
  };

  const handlePlayAlbum = async (album) => {
    try {
      const { items } = await fetchTracks({ album_id: album.id, limit: 500 });
      if (!items || !items.length) return;
      const queue = items.map(t => ({ ...t, artistName: artist.name, artistId: artist.id, cover: album.cover || artist.images?.[0]?.url }));
      setQueue(queue, 0);
    } catch (err) {
      console.error('Failed to play album:', err);
    }
  };

  const handleRefresh = async () => {
    setIsScanning(true);
    try {
      const res = await fetch(`/api/artists/${id}/scan`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Scan failed');
      await queryClient.invalidateQueries({ queryKey: ['artist', id] });
    } catch (e) {
      console.error('Failed to refresh artist:', e);
    } finally {
      setIsScanning(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-bg"><TopBar variant="music"/><div className="flex justify-center pt-20"><Spinner/></div></div>;
  if (!artist) return <div className="min-h-screen bg-bg text-center pt-20 text-muted">{isRtl ? 'لم يتم العثور على الفنان / القارئ' : 'Artist not found'}</div>;

  const isQuran = (artist.name || '').includes('الشيخ') || (artist.name || '').includes('القارئ') || (artist.name || '').includes('قرآن') || (artist.name || '').includes('قران');

  // artist image fallback
  const backdropImg = artist.backdrop || artist.images?.find(i => i.image_type === 'backdrop' || i.image_type === 'fanart')?.url || null;
  const avatarImg = artist.poster || artist.images?.find(i => (i.image_type === 'poster' || i.image_type === 'avatar') && i.url)?.url || artist.fallbackCover;

  return (
    <div className="min-h-screen bg-bg pb-24 text-text">
      <TopBar variant="music" />

      {/* Hero Banner Section - Constrained banner layout (بانر أنيق محدد المساحة) */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="relative min-h-[300px] sm:min-h-[360px] md:min-h-[420px] lg:min-h-[460px] rounded-3xl overflow-hidden border border-border/40 shadow-2xl bg-surface/50 flex flex-col justify-end p-6 sm:p-8 md:p-10">
          
          {/* Backdrop Image - strictly bounded inside banner container */}
          {backdropImg ? (
            <>
              <img
                src={backdropImg}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-center opacity-85 dark:opacity-80 pointer-events-none transition-opacity duration-300"
              />
              {/* Refined subtle gradient scrim that preserves image clarity while ensuring text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-bg/95 via-bg/40 to-black/20 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-bg/85 via-bg/25 to-transparent pointer-events-none" />
            </>
          ) : (
            <>
              {/* Subtle ambient gradient when no backdrop is set */}
              <div className="absolute inset-0 bg-gradient-to-br from-primaryMusic/15 via-surface to-surface/80 pointer-events-none" />
              <div className="absolute -top-24 -end-24 w-96 h-96 bg-primaryMusic/10 rounded-full blur-3xl pointer-events-none" />
            </>
          )}

          {/* Banner Content (Avatar, Info, Controls) */}
          <div className="relative z-10 flex flex-col sm:flex-row gap-6 sm:gap-8 md:gap-10 items-start sm:items-end">
            {/* Prominent Artist photo with glowing aura & premium frame */}
            <div className="relative flex-shrink-0 group">
              {/* Ambient Glow Aura - Expands and intensifies on hover */}
              <div className="absolute -inset-2 rounded-[32px] bg-gradient-to-tr from-primaryMusic/40 via-primaryMusic/20 to-transparent blur-xl opacity-75 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 pointer-events-none" />

              <div 
                onClick={() => avatarImg && setLightboxImage(avatarImg)}
                className="w-44 h-44 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 rounded-3xl overflow-hidden bg-surface shadow-[0_25px_60px_rgba(0,0,0,0.7)] group-hover:shadow-[0_20px_60px_rgba(16,185,129,0.35)] relative border-4 border-white/20 dark:border-white/10 group-hover:border-primaryMusic/80 ring-4 ring-black/30 transition-all duration-500 cursor-pointer"
                title={avatarImg ? (isRtl ? 'انقر لتكبير وعرض الصورة' : 'Click to enlarge') : undefined}
              >
                {/* 1. Crystal Clear Image (NO BLUR EVER) with Smooth Zoom */}
                {avatarImg ? (
                  <img 
                    src={avatarImg} 
                    alt={artist.name} 
                    className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-108" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl md:text-8xl font-bold bg-surface text-primaryMusic">
                    {artist.name[0]}
                  </div>
                )}

                {/* 2. Cinematic Shimmer / Specular Light Reflection Sweep (انعكاس ضوئي لامع فائق الأناقة بدون أي تمويه) */}
                <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out bg-gradient-to-r from-transparent via-white/30 to-transparent z-10" />

                {/* 3. Non-Intrusive Floating Action Pill Bar at bottom (دون حجب الوجه أو تمويه الصورة) */}
                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/25 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-between z-20">
                  <span className="text-[11px] font-semibold text-white px-2.5 py-1 rounded-full bg-black/60 border border-white/15 flex items-center gap-1.5 shadow-md">
                    <Eye size={13} className="text-primaryMusic" />
                    <span>{isRtl ? 'عرض الصورة' : 'View'}</span>
                  </span>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-full bg-primaryMusic hover:bg-emerald-400 text-black text-[11px] font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-1.5 cursor-pointer"
                      title={isRtl ? 'تعديل الصورة الشخصية' : 'Change profile photo'}
                    >
                      <Edit2 size={12} />
                      <span>{isRtl ? 'تعديل' : 'Edit'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              {/* Tags: Country & Genre */}
              {(artist.country || artist.genre) && (
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {artist.country && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primaryMusic/15 text-primaryMusic border border-primaryMusic/30 backdrop-blur-sm shadow-sm">
                      <Globe size={13} />
                      <span>{artist.country}</span>
                    </span>
                  )}
                  {artist.genre && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-surface/80 dark:bg-surfaceHover text-text border border-border backdrop-blur-sm shadow-sm">
                      <Music2 size={13} className="text-primaryMusic" />
                      <span>{artist.genre}</span>
                    </span>
                  )}
                </div>
              )}

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)] text-text dark:text-white">{artist.name}</h1>
              <p className="text-xs sm:text-sm text-muted dark:text-slate-300 drop-shadow mt-1 mb-4">
                {artist.albums.length} {isQuran ? (isRtl ? 'مصاحف وتلاوات' : 'recitations') : (isRtl ? 'ألبومات' : 'albums')}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handlePlayAll(false)}
                  disabled={isPlayingAll}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-primaryMusic text-black flex items-center justify-center hover:scale-105 shadow-lg shadow-primaryMusic/30 disabled:opacity-50 transition"
                  title={isQuran ? (isRtl ? 'تشغيل كل التلاوات' : 'Play all') : (isRtl ? 'تشغيل الكل' : 'Play all')}
                >
                  {isPlayingAll ? <Spinner size={20}/> : <Play size={20} fill="black" className="ms-0.5"/>}
                </button>
                <button
                  onClick={() => handlePlayAll(true)}
                  disabled={isPlayingAll}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-surfaceHover hover:bg-surface text-text flex items-center justify-center hover:scale-105 shadow-lg disabled:opacity-50 transition border border-border"
                  title={isRtl ? 'تشغيل عشوائي' : 'Shuffle'}
                >
                  {isPlayingAll ? <Spinner size={20}/> : <Shuffle size={18}/>}
                </button>
                {canDownload && (
                  <button
                    onClick={() => triggerDownload(`/api/download/artist/${artist.id}`)}
                    className="h-11 sm:h-12 px-4 rounded-full bg-surfaceHover hover:bg-surface text-text flex items-center gap-2 hover:scale-105 shadow-lg transition border border-border text-xs font-semibold"
                    title={isQuran ? (isRtl ? 'تحميل كل التلاوات والمصاحف (ZIP)' : 'Download all recitations (ZIP)') : (isRtl ? 'تحميل جميع الألبومات (ZIP)' : 'Download all albums (ZIP)')}
                  >
                    <Download size={18} className="text-primaryMusic" />
                    <span className={isRtl ? 'hidden' : 'hidden sm:inline'}>
                      {isQuran ? 'Download All (ZIP)' : 'Download All (ZIP)'}
                    </span>
                  </button>
                )}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="h-11 sm:h-12 px-4 rounded-full bg-surfaceHover hover:bg-surface text-text flex items-center gap-2 hover:scale-105 shadow-lg transition border border-border text-xs font-semibold cursor-pointer"
                      title={isQuran ? (isRtl ? 'تعديل بيانات وصور القارئ' : 'Edit Reciter') : (isRtl ? 'تعديل بيانات وصور الفنان' : 'Edit Artist')}
                    >
                      <Edit2 size={16} className="text-primaryMusic" />
                      <span className={isRtl ? 'hidden' : 'hidden sm:inline'}>Edit Info</span>
                    </button>
                    <button
                      onClick={handleRefresh}
                      disabled={isScanning}
                      className="h-11 sm:h-12 px-4 rounded-full bg-surfaceHover hover:bg-surface text-text flex items-center gap-2 hover:scale-105 shadow-lg transition border border-border text-xs font-semibold cursor-pointer disabled:opacity-50"
                      title={isQuran ? (isRtl ? 'تحديث بيانات وملفات القارئ' : 'Refresh Reciter') : (isRtl ? 'تحديث بيانات وملفات الفنان' : 'Refresh Artist')}
                    >
                      <RefreshCw size={16} className={`text-primaryMusic ${isScanning ? 'animate-spin' : ''}`} />
                      <span className={isRtl ? 'hidden' : 'hidden sm:inline'}>Refresh</span>
                    </button>
                  </>
                )}
                <AddToPlaylist artistId={artist.id} iconSize={18} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Artist Biography if present */}
      {artist.bio && (
        <div className="max-w-[1600px] mx-auto px-6 pt-6">
          <div className="p-4 sm:p-6 rounded-2xl bg-surface/40 dark:bg-surface/30 border border-border/60 text-sm leading-relaxed text-text/90 relative shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <Info size={14} className="text-primaryMusic" />
                <span>{isQuran ? (isRtl ? 'نبذة عن القارئ والمسيرة' : 'Reciter Biography') : (isRtl ? 'نبذة عن الفنان والمسيرة' : 'Artist Biography')}</span>
              </h3>
              {isAdmin && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="text-xs text-primaryMusic hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Edit2 size={12} />
                  <span>{isRtl ? 'تعديل السيرة' : 'Edit Bio'}</span>
                </button>
              )}
            </div>
            <p className="whitespace-pre-line text-xs sm:text-sm text-text/85">
              {artist.bio}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {/* Albums Header with Sorting Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b border-border/70">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Disc3 className="text-primaryMusic" size={22} />
            <span>{isQuran ? (isRtl ? 'المصاحف والسور' : 'Surahs & Recitations') : (isRtl ? 'الألبومات' : 'Albums')}</span>
            <span className="text-xs text-muted font-normal">({sortedAlbums.length})</span>
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted font-medium me-1">
              {isRtl ? 'الترتيب:' : 'Sort:'}
            </span>

            {/* Sort by Year */}
            <button
              onClick={() => handleSortToggle('year')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border ${
                albumSortKey === 'year'
                  ? 'bg-primaryMusic/15 border-primaryMusic text-primaryMusic shadow-sm shadow-primaryMusic/20'
                  : 'bg-surface/80 border-border text-muted hover:text-text hover:border-border/80'
              }`}
            >
              <Calendar size={13} />
              <span>{isRtl ? 'سنة الإنتاج' : 'Year'}</span>
              {albumSortKey === 'year' && (
                <span className="text-[10px] opacity-80 font-mono">
                  ({albumSortOrder === 'desc' ? (isRtl ? 'الأحدث' : 'Newest') : (isRtl ? 'الأقدم' : 'Oldest')})
                </span>
              )}
            </button>

            {/* Sort by Name */}
            <button
              onClick={() => handleSortToggle('name')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border ${
                albumSortKey === 'name'
                  ? 'bg-primaryMusic/15 border-primaryMusic text-primaryMusic shadow-sm shadow-primaryMusic/20'
                  : 'bg-surface/80 border-border text-muted hover:text-text hover:border-border/80'
              }`}
            >
              {albumSortKey === 'name' && albumSortOrder === 'asc' ? <ArrowDownAZ size={13} /> : <ArrowUpZA size={13} />}
              <span>{isRtl ? 'الاسم' : 'Name'}</span>
              {albumSortKey === 'name' && (
                <span className="text-[10px] opacity-80 font-mono">
                  ({albumSortOrder === 'asc' ? (isRtl ? 'أ-ي' : 'A-Z') : (isRtl ? 'ي-أ' : 'Z-A')})
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Square Album Cards Grid with Smooth Edges */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-5">
          {sortedAlbums.map(al => (
            <Link
              key={al.id}
              to={`/music/album/${al.id}`}
              className="group flex flex-col p-2.5 sm:p-3 rounded-2xl bg-surface/30 hover:bg-surface/80 border border-transparent hover:border-border/20 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
            >
              <div className="relative aspect-square rounded-xl md:rounded-2xl overflow-hidden bg-surfaceHover shadow-md group-hover:shadow-xl transition-all duration-300">
                {al.cover ? (
                  <img
                    src={al.cover}
                    alt={al.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs p-4 text-center">
                    <Disc3 size={32} className="opacity-40 text-primaryMusic" />
                  </div>
                )}

                {al.year && (
                  <div className="absolute top-2.5 inset-x-2.5 flex justify-end pointer-events-none">
                    <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-medium text-emerald-400 border border-emerald-400/20 shadow-md">
                      {al.year}
                    </span>
                  </div>
                )}

                {/* 1. Cinematic Light Reflection Sweep on hover (انعكاس ضوئي زجاجي بدون أي تمويه) */}
                <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent z-10" />

                {/* 2. Floating Play Button: Crystal Clear cover, NO Blur */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none z-10">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handlePlayAlbum(al);
                    }}
                    className="pointer-events-auto w-12 h-12 rounded-full bg-primaryMusic hover:bg-emerald-400 text-black flex items-center justify-center shadow-[0_8px_25px_rgba(16,185,129,0.55)] transform scale-75 group-hover:scale-100 active:scale-95 transition-all duration-300"
                    title={isRtl ? 'تشغيل' : 'Play'}
                  >
                    <Play size={20} fill="black" className="ms-0.5" />
                  </button>
                </div>
                {/* Actions on hover - bottom corner */}
                <div className="absolute bottom-2 end-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 flex items-center gap-1.5" onClick={e => e.preventDefault()}>
                  {canDownload && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        triggerDownload(`/api/download/album/${al.id}`);
                      }}
                      className="p-1.5 rounded-lg bg-black/70 hover:bg-black/90 text-white/80 hover:text-primaryMusic backdrop-blur-md transition-all border border-white/10"
                      title={isRtl ? 'تحميل الألبوم / المصحف (ZIP)' : 'Download (ZIP)'}
                    >
                      <Download size={14} />
                    </button>
                  )}
                  <AddToPlaylist albumId={al.id} iconSize={14} />
                </div>
              </div>

              <div className="mt-2.5 min-w-0">
                <div className="text-sm font-semibold truncate text-text group-hover:text-primaryMusic transition-colors">
                  {al.title}
                </div>
                <div className="text-xs text-muted mt-1 flex items-center gap-1.5">
                  {al.year && <span className="text-emerald-400/80 font-medium">{al.year}</span>}
                  {al.year && al.tracksCount > 0 && <span>•</span>}
                  {al.tracksCount > 0 && <span>{al.tracksCount} {isQuran ? (isRtl ? 'تلاوة' : 'tracks') : (isRtl ? 'أغنية' : 'tracks')}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <EditArtistModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        artist={artist}
      />

      {/* Lightbox for Full Size Artist Image */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-6 end-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shadow-lg"
            onClick={() => setLightboxImage(null)}
            title={isRtl ? 'إغلاق' : 'Close'}
          >
            <X size={24} />
          </button>
          <img
            src={lightboxImage}
            alt={artist.name}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-3xl shadow-2xl border border-white/15"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
