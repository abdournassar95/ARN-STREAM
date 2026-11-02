import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Play, ChevronLeft, ChevronRight, X, Clock, Info, Film, Tv, Sparkles } from 'lucide-react';
import client from '../../api/client';

const formatTime = (s) => {
  if (!s || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
};

function buildTarget(item) {
  const isSeries = item.type === 'series' || item.media_type === 'series';
  const targetId = isSeries ? (item.mediaId || item.episodeId) : (item.mediaId || item.id);
  const resumeSec = !item.isNextUp && item.position && item.position > 5 ? Math.floor(item.position) : 0;
  const timeQuery = resumeSec > 0 ? `&t=${resumeSec}&resume=true` : '&startFromBeginning=true';
  const targetUrl = isSeries
    ? `/watch/episode/${targetId}?autoPlay=true${timeQuery}`
    : `/watch/movie/${targetId}?autoPlay=true${timeQuery}`;
  const detailsUrl = isSeries
    ? `/series/${item.seriesId || item.id}`
    : `/movies/${item.id || item.mediaId}`;
  return { isSeries, targetId, targetUrl, detailsUrl, resumeSec };
}

/**
 * Smart Continue Watching Hub — Luxury Dark Glassmorphism edition.
 * Displays at most 8 in-progress items:
 *   - A large cinematic Hero Spotlight for the active / most recently watched work.
 *   - A sleek, scrollbar-free 8-card grid/dock underneath for instant switching & direct play.
 */
export default function ContinueWatchingHub({ items }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const qc = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());

  if (!items || items.length === 0) return null;

  // Filter valid items and cap strictly at 8 items maximum
  const list = items
    .filter((item) => {
      const k = `${item.type || item.media_type}-${item.seriesId || item.id || item.mediaId}`;
      return Boolean(item.poster || item.backdrop) && !hiddenKeys.has(k);
    })
    .slice(0, 8);

  if (list.length === 0) return null;

  const safeIndex = Math.min(activeIndex, list.length - 1);
  const active = list[safeIndex];
  const { isSeries, targetUrl, detailsUrl } = buildTarget(active);
  const progress = Math.min(100, Math.max(0, active.progress || 0));
  const remaining = active.duration ? Math.max(0, active.duration - (active.position || 0)) : 0;

  // Upgrade /thumb to /full automatically for crystal-clear hero banner rendering
  const rawHeroImg = active.backdrop || active.poster || '';
  const heroBackdrop = rawHeroImg.endsWith('/thumb')
    ? rawHeroImg.replace(/\/thumb$/, '/full')
    : rawHeroImg;

  const title = active.title || '';
  const subtitle = isSeries && active.episodeTitle ? active.episodeTitle : null;

  const handleRemove = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const removeType = item.type === 'series' || item.media_type === 'series' ? 'series' : 'movie';
    const removeId = removeType === 'series' ? item.seriesId || item.id : item.id || item.mediaId;
    const k = `${item.type || item.media_type}-${item.seriesId || item.id || item.mediaId}`;

    // Optimistic removal from UI immediately
    setHiddenKeys((prev) => new Set(prev).add(k));

    try {
      await client.delete(`/playback/${removeType}/${removeId}`);
      qc.invalidateQueries({ queryKey: ['landing'] });
      qc.invalidateQueries({ queryKey: ['movies-home'] });
      qc.invalidateQueries({ queryKey: ['continue'] });
    } catch (err) {
      console.error('Failed to remove playback state:', err);
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
    <div key="continueWatching" className="mt-14 sm:mt-20">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500/25 to-emerald-500/15 border border-sky-400/30 flex items-center justify-center text-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)]">
            <Play size={18} fill="currentColor" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-text tracking-tight">
                {isAr ? 'متابعة المشاهدة' : 'Continue Watching'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 font-mono">
                {safeIndex + 1} / {list.length}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted hidden sm:block">
              {isAr
                ? 'استكمل مشاهدة آخر أعمالك من حيث توقفت بنقرة واحدة'
                : 'Pick up right where you left off'}
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
                  aria-label={`${isAr ? 'العمل' : 'Item'} ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === safeIndex
                      ? 'w-6 bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]'
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
                className="w-9 h-9 rounded-xl bg-surface/80 hover:bg-surfaceHover border border-border hover:border-sky-400/50 text-muted hover:text-sky-400 transition-all flex items-center justify-center shadow-sm active:scale-95"
              >
                <ChevronLeft size={17} className={isAr ? 'rotate-180' : ''} />
              </button>
              <button
                type="button"
                onClick={() => handleCycleItem(1)}
                aria-label={isAr ? 'التالي' : 'Next'}
                className="w-9 h-9 rounded-xl bg-surface/80 hover:bg-surfaceHover border border-border hover:border-sky-400/50 text-muted hover:text-sky-400 transition-all flex items-center justify-center shadow-sm active:scale-95"
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
          key={`hero-bg-${safeIndex}-${active.id}`}
          className="absolute inset-0 bg-cover bg-center animate-fadeIn transition-transform duration-1000 ease-out group-hover:scale-[1.03]"
          style={{ backgroundImage: `url(${heroBackdrop})` }}
        />

        {/* Multi-layered Cinematic Scrims for crystal-clear legibility & vibrant center */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#070a12] via-[#070a12]/55 to-black/15" />
        <div
          className={`absolute inset-0 ${
            isAr
              ? 'bg-gradient-to-l from-[#070a12]/95 via-[#070a12]/50 to-transparent'
              : 'bg-gradient-to-r from-[#070a12]/95 via-[#070a12]/50 to-transparent'
          }`}
        />
        <div className="absolute top-0 inset-x-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

        {/* Top-Corner Status Pill ("آخر مشاهدة" / Position indicator) */}
        <div className="absolute top-4 sm:top-6 end-4 sm:end-6 z-20 flex items-center gap-2">
          {safeIndex === 0 ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-emerald-400/40 text-emerald-400 text-[11px] font-bold shadow-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{isAr ? 'آخر عمل تمت مشاهدته' : 'Last Watched'}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-sky-400/35 text-sky-300 text-[11px] font-bold shadow-lg">
              <Sparkles size={12} />
              <span>
                {isAr ? `قيد المتابعة #${safeIndex + 1}` : `In Progress #${safeIndex + 1}`}
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
                  isSeries
                    ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                    : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                }`}
              >
                {isSeries ? <Tv size={12} /> : <Film size={12} />}
                <span>{isSeries ? (isAr ? 'مسلسل' : 'Series') : isAr ? 'فيلم' : 'Movie'}</span>
              </div>

              {active.isNextUp && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[11px] font-bold backdrop-blur-md">
                  <Sparkles size={11} />
                  <span>{isAr ? 'الحلقة التالية جاهزة' : 'Next Episode Ready'}</span>
                </div>
              )}

              {active.year && (
                <span className="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-[11px] font-mono backdrop-blur-sm">
                  {active.year}
                </span>
              )}
            </div>

            {/* Title & Episode Subtitle */}
            <div>
              <h3 className="text-2xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)] leading-normal py-1 line-clamp-2">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm sm:text-base text-sky-200/90 mt-1 font-semibold leading-normal py-0.5 line-clamp-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block flex-shrink-0" />
                  <span className="truncate">{subtitle}</span>
                </p>
              )}
            </div>

            {/* Glass Progress Bar & Time Stats */}
            <div className="pt-1 space-y-2 max-w-lg">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2">
                  {!active.isNextUp ? (
                    <>
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/30 text-sky-300 font-bold">
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
                      {isAr ? 'حلقة جديدة لم تُشاهد بعد' : 'New Unwatched Episode'}
                    </span>
                  )}
                </div>

                {!active.isNextUp && remaining > 0 && (
                  <span className="inline-flex items-center gap-1 text-white/75 text-[11px]">
                    <Clock size={12} className="text-sky-400" />
                    <span>
                      {isAr ? `متبقي ${formatTime(remaining)}` : `${formatTime(remaining)} left`}
                    </span>
                  </span>
                )}
              </div>

              <div className="w-full h-2 rounded-full bg-white/15 p-[1px] overflow-hidden backdrop-blur-sm border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 via-emerald-400 to-primaryMovies transition-[width] duration-500 shadow-[0_0_12px_rgba(56,189,248,0.6)]"
                  style={{ width: `${active.isNextUp ? 4 : Math.max(3, progress)}%` }}
                />
              </div>
            </div>

            {/* CTA Buttons Row */}
            <div className="flex items-center gap-2.5 sm:gap-3 pt-2 flex-wrap">
              <Link
                to={targetUrl}
                className="inline-flex items-center gap-2.5 px-6 sm:px-7 py-3 rounded-2xl bg-primaryMovies hover:brightness-110 text-white font-bold text-xs sm:text-sm transition-all shadow-[0_10px_28px_rgba(229,9,20,0.45)] hover:scale-[1.03] active:scale-[0.98]"
              >
                <Play size={17} fill="currentColor" />
                <span>
                  {active.isNextUp || progress === 0
                    ? isAr
                      ? 'بدء المشاهدة الآن'
                      : 'Start Watching'
                    : isAr
                    ? 'استئناف المشاهدة'
                    : 'Resume Watching'}
                </span>
              </Link>

              <Link
                to={detailsUrl}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm backdrop-blur-md transition-all border border-white/15 hover:border-white/30 active:scale-95"
              >
                <Info size={16} className="text-sky-300" />
                <span>{isAr ? 'التفاصيل' : 'Details'}</span>
              </Link>

              <button
                type="button"
                onClick={(e) => handleRemove(e, active)}
                title={isAr ? 'إزالة من متابعة المشاهدة' : 'Remove from Continue Watching'}
                className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-black/45 hover:bg-red-500/25 text-white/75 hover:text-red-300 text-xs font-semibold backdrop-blur-md transition-all border border-white/10 hover:border-red-500/40 active:scale-95"
              >
                <X size={15} />
                <span>{isAr ? 'إزالة' : 'Remove'}</span>
              </button>
            </div>
          </div>

          {/* Floating Glass Poster Card on Desktop (Opposite Side) */}
          {active.poster && (
            <Link
              to={detailsUrl}
              className="hidden lg:block relative flex-shrink-0 w-36 xl:w-40 aspect-[2/3] rounded-2xl overflow-hidden border-2 border-white/20 shadow-[0_20px_45px_rgba(0,0,0,0.85)] group/poster hover:border-sky-400/70 transition-all duration-500 hover:-translate-y-1"
              title={title}
            >
              <img
                src={active.poster}
                alt={title}
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
              const { isSeries: s, targetUrl: tUrl } = buildTarget(item);
              const isActive = idx === safeIndex;
              const p = Math.min(100, Math.max(0, item.progress || 0));
              const itemKey = `cwh-${item.type || item.media_type}-${item.seriesId || item.id || item.mediaId}-${idx}`;
              const thumbImg = item.backdropThumb || item.poster || item.backdrop;

              return (
                <div
                  key={itemKey}
                  onClick={() => setActiveIndex(idx)}
                  className={`relative aspect-[16/10] rounded-2xl overflow-hidden border transition-all duration-300 group/thumb cursor-pointer select-none ${
                    isActive
                      ? 'border-sky-400 ring-2 ring-sky-400/35 shadow-[0_10px_25px_rgba(56,189,248,0.25)] -translate-y-1 z-10'
                      : 'border-white/10 hover:border-sky-400/50 opacity-75 hover:opacity-100 hover:-translate-y-0.5'
                  }`}
                  title={item.title}
                >
                  {/* Thumbnail Image */}
                  <div
                    className="absolute inset-0 bg-cover bg-center group-hover/thumb:scale-110 transition-transform duration-500"
                    style={{ backgroundImage: `url(${thumbImg})` }}
                  />

                  {/* Dark Gradient Scrims */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070a12]/95 via-black/35 to-black/15" />

                  {/* Top Row: Number/Type Badge + Hover Remove Button */}
                  <div className="absolute top-2 inset-x-2 flex items-center justify-between z-20">
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-black tracking-wide backdrop-blur-md border ${
                        isActive
                          ? 'bg-sky-500 text-black border-sky-300'
                          : s
                          ? 'bg-sky-500/75 text-white border-white/15'
                          : 'bg-rose-500/75 text-white border-white/15'
                      }`}
                    >
                      {idx === 0
                        ? isAr
                          ? 'الأحدث'
                          : 'LATEST'
                        : s
                        ? isAr
                          ? 'مسلسل'
                          : 'TV'
                        : isAr
                        ? 'فيلم'
                        : 'MOVIE'}
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

                  {/* Center Direct Play Button on Hover */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/30 pointer-events-none z-10">
                    <Link
                      to={tUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="pointer-events-auto w-9 h-9 rounded-full bg-primaryMovies hover:scale-110 text-white flex items-center justify-center shadow-[0_4px_15px_rgba(229,9,20,0.6)] transition-transform"
                      aria-label={isAr ? 'استئناف مباشر' : 'Direct Resume'}
                      title={isAr ? 'تشغيل مباشر' : 'Play Now'}
                    >
                      <Play size={14} fill="currentColor" className="ms-0.5" />
                    </Link>
                  </div>

                  {/* Bottom Title + Episode / Progress Info */}
                  <div className="absolute bottom-1.5 inset-x-2 z-10 pointer-events-none">
                    <div className="text-[11px] font-bold text-white leading-normal py-0.5 line-clamp-1 drop-shadow">
                      {item.title}
                    </div>
                    <div className="flex items-center justify-between text-[9.5px] text-white/70 font-mono mt-0.5">
                      <span className="truncate max-w-[70%]">
                        {s && item.seasonNumber && item.episodeNumber
                          ? `S${item.seasonNumber}:E${item.episodeNumber}`
                          : item.year || ''}
                      </span>
                      <span className={item.isNextUp ? 'text-emerald-400 font-bold' : 'text-sky-300 font-bold'}>
                        {item.isNextUp ? (isAr ? 'جديد' : 'NEW') : `${Math.round(p)}%`}
                      </span>
                    </div>
                  </div>

                  {/* Sleek Bottom Progress Track */}
                  <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/15">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.isNextUp
                          ? 'bg-emerald-400'
                          : isActive
                          ? 'bg-gradient-to-r from-sky-400 to-emerald-400'
                          : 'bg-sky-400'
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
