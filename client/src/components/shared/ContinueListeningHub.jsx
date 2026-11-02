import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Play, Pause, ChevronLeft, ChevronRight, X, Clock, Info, Music, BookOpen, Sparkles, Disc3, User } from 'lucide-react';
import client, { fetchAlbum } from '../../api/client';
import { usePlayerStore } from '../../store/usePlayerStore';

const formatTime = (s) => {
  if (!s || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

function cleanAudioTitle(raw) {
  if (!raw) return '';
  return String(raw).replace(/\.(mp3|flac|m4a|wav|ogg|aac|wma|opus)$/i, '').trim();
}

function isQuranItem(item) {
  const txt = `${item?.title || ''} ${item?.albumTitle || ''} ${item?.artistName || ''}`;
  return (
    txt.includes('قرآن') ||
    txt.includes('قران') ||
    txt.includes('الشيخ') ||
    txt.includes('القارئ') ||
    txt.includes('سورة') ||
    txt.includes('مصحف') ||
    txt.includes('تلاوة')
  );
}

/**
 * Smart Continue Listening Hub — Luxury Dark Glassmorphism edition.
 * Displays at most 8 in-progress audio/recitation items:
 *   - A large cinematic Hero Spotlight for the active / most recently listened track/recitation.
 *   - A sleek, scrollbar-free 8-card grid/dock underneath for instant switching & direct resume.
 *   - Direct actual resume from the exact saved timestamp (`position`) with full album queue loaded.
 */
export default function ContinueListeningHub({ items }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const qc = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());
  const [loadingId, setLoadingId] = useState(null);

  const playTrack = usePlayerStore((s) => s.playTrack);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  if (!items || items.length === 0) return null;

  // Filter valid items and cap strictly at 8 items maximum
  const list = items
    .filter((item) => {
      const k = `audio-${item.albumId || item.trackId || item.id}`;
      return Boolean(item.poster || item.cover || item.backdrop) && !hiddenKeys.has(k);
    })
    .slice(0, 8);

  if (list.length === 0) return null;

  const safeIndex = Math.min(activeIndex, list.length - 1);
  const active = list[safeIndex];
  const progress = Math.min(100, Math.max(0, active.progress || 0));
  const remaining = active.duration ? Math.max(0, active.duration - (active.position || 0)) : 0;
  const isQuran = isQuranItem(active);

  // Upgrade /thumb to /full automatically for crystal-clear hero banner rendering
  const rawHeroImg = active.backdrop || active.posterFull || active.poster || active.cover || '';
  const heroBackdrop = rawHeroImg.endsWith('/thumb')
    ? rawHeroImg.replace(/\/thumb$/, '/full')
    : rawHeroImg;

  const trackTitle = cleanAudioTitle(active.trackTitle || active.title || '');
  const albumTitle = cleanAudioTitle(active.albumTitle || '');
  const artistName = active.artistName || '';
  const albumUrl = active.albumId ? `/music/album/${active.albumId}` : '/music';
  const artistUrl = active.artistId ? `/music/artist/${active.artistId}` : null;

  const isCurrentlyActiveTrack =
    currentTrack && String(currentTrack.id) === String(active.trackId || active.id);

  const handleResumeListening = async (e, item) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const targetTrackId = item.trackId || item.id;
    const resumeSec = !item.isNextUp && item.position && item.position > 3 ? Math.floor(item.position) : 0;

    // If this exact track is already loaded in MiniPlayer, just toggle play/pause or seek if needed
    if (currentTrack && String(currentTrack.id) === String(targetTrackId)) {
      togglePlay();
      return;
    }

    setLoadingId(targetTrackId);
    try {
      if (item.albumId) {
        const albumData = await fetchAlbum(item.albumId);
        const albumCover =
          albumData?.covers?.[0]?.url ||
          item.posterFull ||
          item.poster ||
          item.cover ||
          null;
        if (albumData?.tracks?.length) {
          const queue = albumData.tracks.map((t) => ({
            ...t,
            artistName: albumData.artistName || item.artistName,
            artistId: albumData.artist_id || item.artistId,
            albumTitle: albumData.title || item.albumTitle,
            cover: albumCover,
            resumePosition: String(t.id) === String(targetTrackId) ? resumeSec : 0
          }));
          const found = queue.find((t) => String(t.id) === String(targetTrackId)) || queue[0];
          playTrack(found, queue, resumeSec);
          setLoadingId(null);
          return;
        }
      }
    } catch (err) {
      console.warn('Fallback to single track playback:', err);
    }

    // Fallback: play the track directly
    const singleTrack = {
      id: targetTrackId,
      title: item.trackTitle || item.title,
      artistName: item.artistName,
      artistId: item.artistId,
      albumTitle: item.albumTitle,
      album_id: item.albumId,
      duration: item.duration,
      cover: item.posterFull || item.poster || item.cover || null,
      url: `/api/stream/track/${targetTrackId}`,
      resumePosition: resumeSec
    };
    playTrack(singleTrack, [singleTrack], resumeSec);
    setLoadingId(null);
  };

  const handleRemove = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const removeType = item.albumId ? 'album' : 'track';
    const removeId = item.albumId || item.trackId || item.id;
    const k = `audio-${item.albumId || item.trackId || item.id}`;

    // Optimistic removal from UI immediately
    setHiddenKeys((prev) => new Set(prev).add(k));

    try {
      await client.delete(`/playback/${removeType}/${removeId}`);
      qc.invalidateQueries({ queryKey: ['landing'] });
      qc.invalidateQueries({ queryKey: ['music-home'] });
      qc.invalidateQueries({ queryKey: ['continue-listening'] });
    } catch (err) {
      console.error('Failed to remove audio playback state:', err);
    }
  };

  const handleCycleItem = (delta) => {
    if (list.length <= 1) return;
    setActiveIndex((prev) => {
      const curr = Math.min(prev, list.length - 1);
      return (curr + delta + list.length) % list.length;
    });
  };

  return (
    <div key="continueListening" className="mt-14 sm:mt-20">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-teal-500/15 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Music size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-text tracking-tight">
                {isAr ? 'متابعة الاستماع' : 'Continue Listening'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono">
                {safeIndex + 1} / {list.length}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted hidden sm:block">
              {isAr
                ? 'استكمل استماع آخر تلاواتك ومقاطعك الصوتية من حيث توقفت بنقرة واحدة'
                : 'Pick up your audio & recitations right where you left off'}
            </p>
          </div>
        </div>

        {/* Navigation Controls & Step Indicator Dots */}
        {list.length > 1 && (
          <div className="flex items-center gap-3">
            {/* Quick Indicator Dots (Desktop) */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface/60 border border-border/60 backdrop-blur-md">
              {list.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`${isAr ? 'المقطع' : 'Item'} ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === safeIndex
                      ? 'w-6 bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                      : 'w-1.5 bg-muted/40 hover:bg-muted'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleCycleItem(-1)}
                aria-label={isAr ? 'السابق' : 'Previous'}
                className="w-9 h-9 rounded-xl bg-surface/80 hover:bg-surfaceHover border border-border hover:border-emerald-400/50 text-muted hover:text-emerald-400 transition-all flex items-center justify-center shadow-sm active:scale-95"
              >
                <ChevronLeft size={17} className={isAr ? 'rotate-180' : ''} />
              </button>
              <button
                type="button"
                onClick={() => handleCycleItem(1)}
                aria-label={isAr ? 'التالي' : 'Next'}
                className="w-9 h-9 rounded-xl bg-surface/80 hover:bg-surfaceHover border border-border hover:border-emerald-400/50 text-muted hover:text-emerald-400 transition-all flex items-center justify-center shadow-sm active:scale-95"
              >
                <ChevronRight size={17} className={isAr ? 'rotate-180' : ''} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Spotlight Hero Banner (Large Featured Card) */}
      <div className="relative w-full h-[300px] sm:h-[360px] md:h-[410px] rounded-3xl overflow-hidden border border-white/10 dark:border-white/10 bg-[#0b0f19] group shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
        {/* High-Res Backdrop with subtle zoom effect */}
        <div
          key={`cl-hero-bg-${safeIndex}-${active.id}`}
          className="absolute inset-0 bg-cover bg-center animate-fadeIn transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
          style={{ backgroundImage: `url(${heroBackdrop})` }}
        />

        {/* Multi-layered Cinematic Scrims for crystal-clear legibility & vibrant center */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-[#070a12]/60 to-black/20" />
        <div
          className={`absolute inset-0 ${
            isAr
              ? 'bg-gradient-to-l from-[#070a12]/95 via-[#070a12]/55 to-transparent'
              : 'bg-gradient-to-r from-[#070a12]/95 via-[#070a12]/55 to-transparent'
          }`}
        />
        <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

        {/* Top-Corner Status Pill ("آخر استماع" / Position indicator) */}
        <div className="absolute top-4 sm:top-6 end-4 sm:end-6 z-20 flex items-center gap-2">
          {safeIndex === 0 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-emerald-400/40 text-emerald-400 text-[11px] font-bold shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isAr ? 'آخر مقطع تم الاستماع إليه' : 'Last Listened'}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-teal-400/35 text-teal-300 text-[11px] font-bold shadow-lg">
              <Sparkles size={12} />
              <span>
                {isAr ? `قيد الاستماع #${safeIndex + 1}` : `In Progress #${safeIndex + 1}`}
              </span>
            </div>
          )}
        </div>

        {/* Hero Foreground Content */}
        <div className="absolute inset-0 flex items-end justify-between p-5 sm:p-8 md:p-10 z-10 gap-6">
          {/* Primary Info & Controls */}
          <div className="max-w-2xl w-full space-y-3.5">
            {/* Badges Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold backdrop-blur-md border shadow-sm ${
                  isQuran
                    ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                    : 'bg-teal-500/20 border-teal-400/40 text-teal-300'
                }`}
              >
                {isQuran ? <BookOpen size={12} /> : <Music size={12} />}
                <span>
                  {isQuran
                    ? isAr
                      ? 'تلاوة قرآنية'
                      : 'Quran Recitation'
                    : isAr
                    ? 'مقطع صوتي'
                    : 'Audio Track'}
                </span>
              </div>

              {active.isNextUp && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300 text-[11px] font-bold backdrop-blur-md">
                  <Sparkles size={11} />
                  <span>{isAr ? 'المقطع التالي جاهز' : 'Next Track Ready'}</span>
                </div>
              )}

              {artistName && (
                <Link
                  to={artistUrl || albumUrl}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-white/90 text-[11px] font-semibold backdrop-blur-sm transition"
                >
                  <User size={11} className="text-emerald-400" />
                  <span>{artistName}</span>
                </Link>
              )}

              {active.year && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-[11px] font-mono backdrop-blur-sm">
                  {active.year}
                </span>
              )}
            </div>

            {/* Track Title & Album / Artist Subtitle */}
            <div>
              <h3 className="text-2xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] leading-normal py-1 line-clamp-2">
                {trackTitle}
              </h3>
              {(albumTitle || artistName) && (
                <p className="text-sm sm:text-base text-emerald-200/90 mt-1 font-semibold leading-normal py-0.5 line-clamp-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block flex-shrink-0" />
                  <span className="truncate">
                    {artistName}
                    {albumTitle && albumTitle !== trackTitle ? ` • ${albumTitle}` : ''}
                  </span>
                </p>
              )}
            </div>

            {/* Glass Progress Bar & Time Stats */}
            <div className="pt-1 space-y-2 max-w-lg">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  {!active.isNextUp ? (
                    <>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-bold">
                        {Math.round(progress)}%
                      </span>
                      {active.position > 0 && active.duration > 0 && (
                        <span className="text-white/60 text-[11px]">
                          {formatTime(active.position)} / {formatTime(active.duration)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="font-bold text-emerald-400">
                      {isAr ? 'مقطع جديد جاهز للاستماع' : 'New Unplayed Track'}
                    </span>
                  )}
                </div>

                {!active.isNextUp && remaining > 0 && (
                  <span className="inline-flex items-center gap-1 text-white/75 text-[11px]">
                    <Clock size={12} className="text-emerald-400" />
                    <span>
                      {isAr ? `متبقي ${formatTime(remaining)}` : `${formatTime(remaining)} left`}
                    </span>
                  </span>
                )}
              </div>

              <div className="w-full h-2 rounded-full bg-white/15 p-[1px] overflow-hidden backdrop-blur-sm border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-400 to-sky-400 transition-[width] duration-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]"
                  style={{ width: `${active.isNextUp ? 4 : Math.max(3, progress)}%` }}
                />
              </div>
            </div>

            {/* CTA Buttons Row */}
            <div className="flex items-center gap-2.5 sm:gap-3 pt-2 flex-wrap">
              <button
                type="button"
                onClick={(e) => handleResumeListening(e, active)}
                disabled={loadingId === (active.trackId || active.id)}
                className="inline-flex items-center gap-2.5 px-6 sm:px-7 py-3 rounded-2xl bg-primaryMusic hover:brightness-110 text-black font-extrabold text-xs sm:text-sm transition-all shadow-[0_10px_28px_rgba(16,185,129,0.4)] hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
              >
                {isCurrentlyActiveTrack && isPlaying ? (
                  <Pause size={17} fill="currentColor" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
                <span>
                  {isCurrentlyActiveTrack && isPlaying
                    ? isAr
                      ? 'إيقاف مؤقت'
                      : 'Pause'
                    : active.isNextUp || progress === 0
                    ? isAr
                      ? 'بدء الاستماع الآن'
                      : 'Start Listening'
                    : isAr
                    ? 'استئناف الاستماع'
                    : 'Resume Listening'}
                </span>
              </button>

              <Link
                to={albumUrl}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm backdrop-blur-md transition-all border border-white/15 hover:border-white/30 active:scale-95"
              >
                <Disc3 size={16} className="text-emerald-300" />
                <span>{isQuran ? (isAr ? 'صفحة المصحف' : 'Recitation') : isAr ? 'الألبوم' : 'Album'}</span>
              </Link>

              <button
                type="button"
                onClick={(e) => handleRemove(e, active)}
                title={isAr ? 'إزالة من متابعة الاستماع' : 'Remove from Continue Listening'}
                className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-black/45 hover:bg-red-500/25 text-white/75 hover:text-red-300 text-xs font-semibold backdrop-blur-md transition-all border border-white/10 hover:border-red-500/40 active:scale-95"
              >
                <X size={15} />
                <span>{isAr ? 'إزالة' : 'Remove'}</span>
              </button>
            </div>
          </div>

          {/* Floating Square Album / Reciter Artwork Card on Desktop (Opposite Side) */}
          {(active.poster || active.cover) && (
            <Link
              to={albumUrl}
              className="hidden lg:block relative flex-shrink-0 w-40 xl:w-44 aspect-square rounded-2xl overflow-hidden border-2 border-white/20 shadow-[0_20px_45px_rgba(0,0,0,0.85)] group/poster hover:border-emerald-400/70 transition-all duration-500 hover:-translate-y-1"
              title={albumTitle || trackTitle}
            >
              <img
                src={active.posterFull || active.poster || active.cover}
                alt={trackTitle}
                className="w-full h-full object-cover group-hover/poster:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/poster:opacity-100 transition-opacity" />
            </Link>
          )}
        </div>
      </div>

      {/* 8-Item Luxury Glass Dock (No ugly browser scrollbar!) */}
      {list.length > 1 && (
        <div className="mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
            {list.map((item, idx) => {
              const isActive = idx === safeIndex;
              const p = Math.min(100, Math.max(0, item.progress || 0));
              const quran = isQuranItem(item);
              const itemKey = `clh-${item.albumId || item.id}-${idx}`;
              const thumbImg = item.backdropThumb || item.poster || item.cover || item.backdrop;
              const isTrackPlayingNow =
                currentTrack && String(currentTrack.id) === String(item.trackId || item.id) && isPlaying;

              return (
                <div
                  key={itemKey}
                  onClick={() => setActiveIndex(idx)}
                  className={`relative aspect-[16/10] rounded-2xl overflow-hidden border transition-all duration-300 group/thumb cursor-pointer select-none ${
                    isActive
                      ? 'border-emerald-400 ring-2 ring-emerald-400/35 shadow-[0_10px_25px_rgba(16,185,129,0.25)] -translate-y-1 z-10'
                      : 'border-white/10 hover:border-emerald-400/50 opacity-75 hover:opacity-100 hover:-translate-y-0.5'
                  }`}
                  title={`${item.trackTitle || item.title} — ${item.artistName || ''}`}
                >
                  {/* Thumbnail Image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center group-hover/thumb:scale-110 transition-transform duration-500"
                    style={{ backgroundImage: `url(${thumbImg})` }}
                  />

                  {/* Dark Gradient Scrims */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070a12]/95 via-black/40 to-black/15" />

                  {/* Top Row: Number/Type Badge + Hover Remove Button */}
                  <div className="absolute top-2 inset-x-2 flex items-center justify-between z-20">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wide backdrop-blur-md border ${
                        isActive
                          ? 'bg-emerald-400 text-black border-emerald-300'
                          : quran
                          ? 'bg-emerald-600/80 text-white border-white/15'
                          : 'bg-teal-600/80 text-white border-white/15'
                      }`}
                    >
                      {idx === 0
                        ? isAr
                          ? 'الأحدث'
                          : 'LATEST'
                        : quran
                        ? isAr
                          ? 'تلاوة'
                          : 'QURAN'
                        : isAr
                        ? 'صوتي'
                        : 'AUDIO'}
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleRemove(e, item)}
                      title={isAr ? 'إزالة' : 'Remove'}
                      aria-label={isAr ? 'إزالة' : 'Remove'}
                      className="w-5 h-5 rounded-full bg-black/80 hover:bg-red-600 text-white/80 hover:text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-all backdrop-blur-sm shadow-md"
                    >
                      <X size={11} />
                    </button>
                  </div>

                  {/* Center Direct Resume Play Button on Hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/30 pointer-events-none z-10">
                    <button
                      type="button"
                      onClick={(e) => handleResumeListening(e, item)}
                      className="pointer-events-auto w-9 h-9 rounded-full bg-primaryMusic hover:scale-110 text-black flex items-center justify-center shadow-[0_4px_15px_rgba(16,185,129,0.6)] transition-transform"
                      aria-label={isAr ? 'استئناف مباشر' : 'Direct Resume'}
                      title={isAr ? 'استئناف الاستماع' : 'Resume Now'}
                    >
                      {isTrackPlayingNow ? (
                        <Pause size={14} fill="currentColor" />
                      ) : (
                        <Play size={14} fill="currentColor" className="ms-0.5" />
                      )}
                    </button>
                  </div>

                  {/* Bottom Title + Artist / Progress Info */}
                  <div className="absolute bottom-1.5 inset-x-2 z-10 pointer-events-none">
                    <div className="text-[11px] font-bold text-white leading-normal py-0.5 line-clamp-1 drop-shadow">
                      {cleanAudioTitle(item.trackTitle || item.title)}
                    </div>
                    <div className="flex items-center justify-between text-[9.5px] text-white/75 font-mono mt-0.5">
                      <span className="truncate max-w-[70%] font-sans">
                        {item.artistName || item.albumTitle || ''}
                      </span>
                      <span className={item.isNextUp ? 'text-sky-400 font-bold' : 'text-emerald-300 font-bold'}>
                        {item.isNextUp ? (isAr ? 'التالي' : 'NEXT') : `${Math.round(p)}%`}
                      </span>
                    </div>
                  </div>

                  {/* Sleek Bottom Progress Track */}
                  <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/15">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.isNextUp
                          ? 'bg-sky-400'
                          : isActive
                          ? 'bg-gradient-to-r from-emerald-400 to-teal-300'
                          : 'bg-emerald-400'
                      }`}
                      style={{ width: `${item.isNextUp ? 100 : Math.max(5, p)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
