import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { X, Film, Tv } from 'lucide-react';

/**
 * PlayerNowPlayingBanner - Fullscreen "Now Playing" Banner
 * Emerges gracefully from middle-left edge every 5 minutes (for 30 seconds) while in fullscreen playback.
 * Separated poster and details panel with dark glassmorphism aesthetic.
 * Tuned with cinematic, slow, and ultra-fluid entrance and exit animations.
 * Encapsulated in React.memo to keep main player lightweight and responsive.
 */
const PlayerNowPlayingBanner = memo(function PlayerNowPlayingBanner({
  isFullscreen = false,
  isPlaying = false,
  isRtl = false,
  posterSrc = '',
  displayTitle = '',
  type = 'movie',
  mediaInfo = null,
}) {
  const [showNowPlayingBanner, setShowNowPlayingBanner] = useState(false);
  const [nowPlayingTextVisible, setNowPlayingTextVisible] = useState(false);
  const nowPlayingHideTimerRef = useRef(null);
  const nowPlayingTextTimerRef = useRef(null);
  const exitSlideTimerRef = useRef(null);

  const dismissNowPlaying = useCallback(() => {
    // 1. Fold and fade the text panel first
    setNowPlayingTextVisible(false);

    if (nowPlayingHideTimerRef.current) {
      clearTimeout(nowPlayingHideTimerRef.current);
      nowPlayingHideTimerRef.current = null;
    }
    if (nowPlayingTextTimerRef.current) {
      clearTimeout(nowPlayingTextTimerRef.current);
      nowPlayingTextTimerRef.current = null;
    }
    if (exitSlideTimerRef.current) {
      clearTimeout(exitSlideTimerRef.current);
      exitSlideTimerRef.current = null;
    }

    // 2. Allow 350ms for text to gently fold, then initiate slow, fluid glide away to the left
    exitSlideTimerRef.current = setTimeout(() => {
      setShowNowPlayingBanner(false);
      exitSlideTimerRef.current = null;
    }, 350);
  }, []);

  useEffect(() => {
    // Only active when playing in fullscreen
    if (!isFullscreen || !isPlaying) {
      setShowNowPlayingBanner(false);
      setNowPlayingTextVisible(false);
      if (nowPlayingHideTimerRef.current) clearTimeout(nowPlayingHideTimerRef.current);
      if (nowPlayingTextTimerRef.current) clearTimeout(nowPlayingTextTimerRef.current);
      if (exitSlideTimerRef.current) clearTimeout(exitSlideTimerRef.current);
      return;
    }

    const triggerNowPlaying = () => {
      if (exitSlideTimerRef.current) clearTimeout(exitSlideTimerRef.current);

      // Step 1: Slide in poster first with slow, luxurious ease-out curve (1200ms)
      setShowNowPlayingBanner(true);
      setNowPlayingTextVisible(false);

      if (nowPlayingTextTimerRef.current) clearTimeout(nowPlayingTextTimerRef.current);
      if (nowPlayingHideTimerRef.current) clearTimeout(nowPlayingHideTimerRef.current);

      // Step 2: Gracefully unfold details panel underneath poster after 550ms
      nowPlayingTextTimerRef.current = setTimeout(() => {
        setNowPlayingTextVisible(true);
      }, 550);

      // Step 3: Dismiss after 30 seconds
      nowPlayingHideTimerRef.current = setTimeout(() => {
        dismissNowPlaying();
      }, 30 * 1000);
    };

    // Show initial presentation 3.5 seconds after entering fullscreen
    const initialTimer = setTimeout(() => {
      triggerNowPlaying();
    }, 3500);

    // Then repeats every 5 minutes (300,000 ms)
    const interval = setInterval(() => {
      triggerNowPlaying();
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      if (nowPlayingHideTimerRef.current) clearTimeout(nowPlayingHideTimerRef.current);
      if (nowPlayingTextTimerRef.current) clearTimeout(nowPlayingTextTimerRef.current);
      if (exitSlideTimerRef.current) clearTimeout(exitSlideTimerRef.current);
    };
  }, [isFullscreen, isPlaying, dismissNowPlaying]);

  return (
    <div
      aria-hidden={!showNowPlayingBanner}
      onClick={(e) => e.stopPropagation()}
      className={`absolute left-4 sm:left-8 md:left-10 top-1/2 -translate-y-1/2 z-35 flex flex-col items-start select-none will-change-transform ${
        showNowPlayingBanner
          ? 'translate-x-0 opacity-100 scale-100 pointer-events-auto blur-0'
          : '-translate-x-[190%] opacity-0 scale-[0.90] pointer-events-none blur-sm'
      }`}
      style={{
        transition: showNowPlayingBanner
          ? 'transform 1250ms cubic-bezier(0.16, 1, 0.3, 1), opacity 1100ms ease-out, filter 1100ms ease-out, scale 1250ms cubic-bezier(0.16, 1, 0.3, 1)'
          : 'transform 1150ms cubic-bezier(0.4, 0, 0.2, 1), opacity 950ms ease-in, filter 950ms ease-in, scale 1150ms cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* 1. STANDALONE CINEMA POSTER */}
      <div className="relative w-36 sm:w-48 md:w-52 aspect-[2/3] rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_25px_60px_-10px_rgba(0,0,0,0.95),0_0_35px_rgba(229,9,20,0.35)] border-2 border-white/25 bg-black/80 flex-shrink-0 group">
        {/* Ambient Glow Behind Poster */}
        <div className="absolute -inset-2 bg-gradient-to-r from-red-600/30 via-amber-500/20 to-purple-600/20 rounded-3xl blur-2xl -z-10 pointer-events-none" />

        {/* Broadcast Live Badge ("يعرض الآن") */}
        <div className="absolute top-2.5 start-2.5 z-10 px-2.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-white/20 flex items-center gap-1.5 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.9)]" />
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white">
            {isRtl ? 'يعرض الآن' : 'NOW PLAYING'}
          </span>
        </div>

        {/* Quick Dismiss Button */}
        <button
          type="button"
          onClick={dismissNowPlaying}
          className="absolute top-2.5 end-2.5 z-10 w-6 h-6 rounded-full bg-black/75 hover:bg-black/95 text-white/70 hover:text-white flex items-center justify-center transition border border-white/20 backdrop-blur-md active:scale-90"
          title={isRtl ? 'إغلاق' : 'Dismiss'}
        >
          <X size={12} />
        </button>

        {/* Full High-Quality Poster Image */}
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={displayTitle}
            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/40">
            {type === 'movie' ? <Film size={36} /> : <Tv size={36} />}
          </div>
        )}

        {/* Subtle Top-Glass Gloss Sheen */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-white/10 pointer-events-none" />
      </div>

      {/* 2. TEXT & DETAILS PANEL (REVEALED UNDERNEATH THE POSTER) */}
      <div
        className={`w-36 sm:w-48 md:w-52 mt-2 sm:mt-2.5 relative rounded-2xl p-2.5 sm:p-3.5 bg-[#070b14]/92 backdrop-blur-2xl border border-white/20 shadow-2xl overflow-hidden will-change-transform ${
          nowPlayingTextVisible
            ? 'translate-y-0 opacity-100 scale-100 pointer-events-auto'
            : '-translate-y-4 opacity-0 scale-[0.94] pointer-events-none'
        }`}
        style={{
          borderColor: 'rgba(255, 255, 255, 0.18)',
          boxShadow: '0 20px 45px -8px rgba(0, 0, 0, 0.95), inset 0 1px 1px rgba(255, 255, 255, 0.18)',
          transition: nowPlayingTextVisible
            ? 'transform 900ms cubic-bezier(0.16, 1, 0.3, 1), opacity 800ms ease-out, scale 900ms cubic-bezier(0.16, 1, 0.3, 1)'
            : 'transform 600ms cubic-bezier(0.4, 0, 0.2, 1), opacity 500ms ease-in, scale 600ms cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* Content Type Badge */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/80 text-[10px] font-black uppercase tracking-wider">
            {type === 'movie' ? (isRtl ? 'فيلم' : 'Movie') : (isRtl ? 'مسلسل' : 'Series')}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-black text-xs sm:text-sm md:text-base text-white tracking-tight truncate leading-tight drop-shadow">
          {type === 'movie'
            ? (mediaInfo?.title || displayTitle)
            : (mediaInfo?.series_title || displayTitle)}
        </h3>

        {/* Series Episode & Season Details */}
        {type === 'episode' && (
          <div className="flex items-center flex-wrap gap-1 mt-1.5">
            {mediaInfo?.season_number !== undefined && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/25 border border-amber-400/40 text-amber-300 text-[10px] sm:text-[10.5px] font-extrabold shadow-sm">
                {isRtl ? `الموسم ${mediaInfo.season_number}` : `S${mediaInfo.season_number}`}
              </span>
            )}
            {mediaInfo?.episode_number !== undefined && (
              <span className="px-1.5 py-0.5 rounded-md bg-sky-500/25 border border-sky-400/40 text-sky-300 text-[10px] sm:text-[10.5px] font-extrabold shadow-sm">
                {isRtl ? `الحلقة ${mediaInfo.episode_number}` : `Ep ${mediaInfo.episode_number}`}
              </span>
            )}
            {mediaInfo?.title &&
              !['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].includes(String(mediaInfo.title).trim()) &&
              !String(mediaInfo.title).toLowerCase().startsWith('episode') &&
              !String(mediaInfo.title).startsWith('الحلقة') && (
                <p className="w-full text-[10.5px] text-white/75 font-medium truncate mt-0.5">
                  {mediaInfo.title}
                </p>
              )}
          </div>
        )}

        {/* Movie Year, Duration & Genre Details */}
        {type === 'movie' && (
          <div className="flex items-center flex-wrap gap-1.5 mt-1.5 text-[11px] text-white/80">
            {mediaInfo?.year && (
              <span className="px-1.5 py-0.5 rounded-md bg-purple-500/25 border border-purple-400/40 text-purple-300 text-[10px] font-bold shadow-sm">
                {mediaInfo.year}
              </span>
            )}
            {mediaInfo?.runtime ? (
              <span className="text-[10.5px] font-semibold text-white/70">
                {isRtl ? `${mediaInfo.runtime} د` : `${mediaInfo.runtime}m`}
              </span>
            ) : null}
            {mediaInfo?.genre && (
              <p className="w-full text-[10.5px] text-white/60 truncate mt-0.5">
                {mediaInfo.genre}
              </p>
            )}
          </div>
        )}

        {/* 30-Second Countdown Neon Progress Bar */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-2 sm:mt-2.5">
          <div
            className={`h-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400 rounded-full ${
              nowPlayingTextVisible ? 'animate-nowPlayingTimer' : 'w-0'
            }`}
            style={{
              animationDuration: '30s',
              animationTimingFunction: 'linear',
              animationFillMode: 'forwards',
            }}
          />
        </div>
      </div>
    </div>
  );
});

PlayerNowPlayingBanner.displayName = 'PlayerNowPlayingBanner';

export default PlayerNowPlayingBanner;
