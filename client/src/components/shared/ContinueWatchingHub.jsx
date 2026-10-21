import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Play, ChevronLeft, ChevronRight, X } from 'lucide-react';
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
  const targetUrl = isSeries ? `/watch/episode/${targetId}?autoPlay=true` : `/watch/movie/${targetId}?autoPlay=true`;
  return { isSeries, targetId, targetUrl };
}

/**
 * Smart Continue Watching Hub — a cinematic hero banner showing the most recently
 * watched item (backdrop, progress, resume CTA) plus a strip of switchable
 * thumbnails for the rest of the continue-watching list.
 */
export default function ContinueWatchingHub({ items }) {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const qc = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [hiddenKeys, setHiddenKeys] = useState(() => new Set());

  if (!items || items.length === 0) return null;

  const list = items.filter((item) => {
    const k = `${item.type || item.media_type}-${item.seriesId || item.id || item.mediaId}`;
    return Boolean(item.poster || item.backdrop) && !hiddenKeys.has(k);
  });

  if (list.length === 0) return null;

  const safeIndex = Math.min(activeIndex, list.length - 1);
  const active = list[safeIndex];
  const { isSeries, targetUrl } = buildTarget(active);
  const progress = Math.min(100, Math.max(0, active.progress || 0));
  const remaining = active.duration ? Math.max(0, active.duration - (active.position || 0)) : 0;
  const backdrop = active.backdrop || active.poster;

  const title = active.title || '';
  const subtitle = isSeries && active.episodeTitle ? active.episodeTitle : null;

  const handleRemove = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const removeType = (item.type === 'series' || item.media_type === 'series') ? 'series' : 'movie';
    const removeId = removeType === 'series' ? (item.seriesId || item.id) : (item.id || item.mediaId);
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

  const scrollStrip = (dir) => {
    const el = document.getElementById('cwh-strip');
    if (el) el.scrollBy({ left: dir * (isAr ? -220 : 220), behavior: 'smooth' });
  };

  return (
    <div key="continueWatching" className="mt-16 sm:mt-24">
      {/* Section header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm">
            <Play size={18} fill="currentColor" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-text">
            {isAr ? 'متابعة المشاهدة' : 'Continue Watching'}
          </h2>
        </div>
        {list.length > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => scrollStrip(-1)}
              aria-label={isAr ? 'السابق' : 'Previous'}
              className="w-8 h-8 rounded-lg bg-surface/70 hover:bg-surface border border-border text-muted hover:text-text transition flex items-center justify-center"
            >
              <ChevronLeft size={16} className={isAr ? 'rotate-180' : ''} />
            </button>
            <button
              onClick={() => scrollStrip(1)}
              aria-label={isAr ? 'التالي' : 'Next'}
              className="w-8 h-8 rounded-lg bg-surface/70 hover:bg-surface border border-border text-muted hover:text-text transition flex items-center justify-center"
            >
              <ChevronRight size={16} className={isAr ? 'rotate-180' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* Hero banner */}
      <div className="relative w-full h-[280px] sm:h-[340px] md:h-[380px] rounded-2xl overflow-hidden border border-border bg-surface group shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        {/* Backdrop */}
        <div
          key={safeIndex}
          className="absolute inset-0 bg-cover bg-center animate-fadeIn"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
        {/* Legibility gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7 md:p-9 z-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              {isSeries && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-[11px] font-bold w-fit">
                  <Play size={11} fill="currentColor" />
                  {isAr ? 'مسلسل' : 'Series'}
                </div>
              )}
              {active.isNextUp && (
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold w-fit">
                  {isAr ? 'الحلقة التالية' : 'Next Episode'}
                </div>
              )}
            </div>

            <h3 className="text-2xl sm:text-3xl md:text-4xl font-black text-white drop-shadow-lg leading-tight line-clamp-2">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm sm:text-base text-white/75 mt-1.5 font-medium line-clamp-1">{subtitle}</p>
            )}

            {/* Progress bar + meta */}
            <div className="mt-4 space-y-2">
              <div className="w-full max-w-md h-1.5 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-primaryMovies transition-[width] duration-500"
                  style={{ width: `${active.isNextUp ? 0 : progress}%` }}
                />
              </div>
              <div className="flex items-center gap-3 text-[12px] text-white/65 font-mono">
                {!active.isNextUp && (
                  <span className="font-bold text-sky-300">{Math.round(progress)}%</span>
                )}
                {!active.isNextUp && remaining > 0 && (
                  <span>
                    {isAr ? `متبقي ${formatTime(remaining)}` : `${formatTime(remaining)} left`}
                  </span>
                )}
                {active.isNextUp && (
                  <span className="font-bold text-emerald-400">
                    {isAr ? 'جديدة لم تُشاهد بعد' : 'Unwatched'}
                  </span>
                )}
                {active.year && <span className="text-white/45">{active.year}</span>}
              </div>
            </div>

            {/* Actions: Resume CTA + Dismiss Button */}
            <div className="flex items-center gap-3 mt-5 flex-wrap">
              <Link
                to={targetUrl}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primaryMovies hover:brightness-110 text-white font-bold text-sm transition-all shadow-[0_8px_24px_rgba(229,9,20,0.4)] hover:scale-[1.03] active:scale-[0.98] w-fit"
              >
                <Play size={16} fill="currentColor" />
                {active.isNextUp || progress === 0
                  ? (isAr ? 'بدء المشاهدة' : 'Play')
                  : (isAr ? 'استئناف المشاهدة' : 'Resume')}
              </Link>

              <button
                type="button"
                onClick={(e) => handleRemove(e, active)}
                title={isAr ? 'إزالة من متابعة المشاهدة' : 'Remove from Continue Watching'}
                className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-xs font-semibold backdrop-blur-md transition-all border border-white/15 active:scale-95"
              >
                <X size={15} />
                <span>{isAr ? 'إزالة' : 'Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {list.length > 1 && (
        <div className="relative mt-4">
          <div
            id="cwh-strip"
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin"
            style={{ scrollbarWidth: 'thin' }}
          >
            {list.map((item, idx) => {
              const { isSeries: s, targetUrl: tUrl } = buildTarget(item);
              const isActive = idx === safeIndex;
              const p = Math.min(100, Math.max(0, item.progress || 0));
              const itemKey = `cwh-${item.type || item.media_type}-${item.seriesId || item.id || item.mediaId}-${idx}`;

              return (
                <div
                  key={itemKey}
                  onClick={() => setActiveIndex(idx)}
                  className={`relative flex-shrink-0 w-[136px] sm:w-[156px] h-[78px] sm:h-[88px] rounded-xl overflow-hidden border transition-all duration-200 group/thumb text-start cursor-pointer ${
                    isActive
                      ? 'border-sky-400/70 ring-2 ring-sky-400/30 scale-[1.02]'
                      : 'border-border hover:border-sky-400/40 opacity-70 hover:opacity-100'
                  }`}
                  title={item.title}
                >
                  <div
                    className="absolute inset-0 bg-cover bg-center group-hover/thumb:scale-105 transition-transform duration-400"
                    style={{ backgroundImage: `url(${item.poster || item.backdrop})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                  {/* Remove button on thumbnail hover */}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, item)}
                    title={isAr ? 'إزالة' : 'Remove'}
                    aria-label={isAr ? 'إزالة' : 'Remove'}
                    className="absolute top-1.5 end-1.5 z-20 w-6 h-6 rounded-full bg-black/80 hover:bg-red-600 text-white/80 hover:text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity backdrop-blur-sm shadow-md"
                  >
                    <X size={12} />
                  </button>

                  <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-4">
                    <div className="text-[10.5px] font-bold text-white/95 leading-tight line-clamp-2 drop-shadow">
                      {item.title}
                    </div>
                  </div>

                  {/* Mini progress */}
                  <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-black/50">
                    <div
                      className={`h-full ${item.isNextUp ? 'bg-emerald-400' : 'bg-sky-400'}`}
                      style={{ width: `${item.isNextUp ? 100 : p}%` }}
                    />
                  </div>

                  {s && (
                    <div className="absolute top-1.5 start-1.5 px-1.5 py-0.5 rounded bg-sky-500/80 text-[9px] font-black text-white">
                      {isAr ? 'مسلسل' : 'TV'}
                    </div>
                  )}

                  {/* Quick resume overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity bg-black/35 pointer-events-none">
                    <Link
                      to={tUrl}
                      onClick={(e) => e.stopPropagation()}
                      className="pointer-events-auto w-9 h-9 rounded-full bg-primaryMovies/90 hover:bg-primaryMovies text-white flex items-center justify-center shadow-lg"
                      aria-label={isAr ? 'استئناف' : 'Resume'}
                    >
                      <Play size={15} fill="currentColor" />
                    </Link>
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
