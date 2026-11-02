import React, { forwardRef, memo } from 'react';
import { ListVideo, Shuffle, Trash2, Play } from 'lucide-react';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getItemType(item, fallbackType = 'movie') {
  if (!item) return fallbackType;
  if (item.type === 'episode' || item.media_type === 'episode') return 'episode';
  if (item.type === 'movie' || item.media_type === 'movie') return 'movie';
  if (item.series_id || item.season_id || item.episode_number !== undefined) return 'episode';
  return item.type || item.media_type || fallbackType;
}

/**
 * PlayerQueueDrawer - Video Playlist / Queue Drawer
 * Smooth sliding right panel, sits above playback bar.
 * Provides queue overview, quick actions (shuffle, clear), and item switching/removal.
 * Encapsulated in React.memo to prevent unnecessary re-rendering of the player during frequent updates.
 */
const PlayerQueueDrawer = memo(
  forwardRef(function PlayerQueueDrawer(
    {
      isOpen = false,
      onClose,
      onOpen,
      videoQueue = [],
      videoQueueIndex = -1,
      setVideoQueueIndex,
      clearVideoQueue,
      removeVideoFromQueue,
      shuffleVideoQueue,
      isRtl = false,
      currentId = null,
      currentType = 'movie',
      isFullscreen = false,
      containerRef = null,
      navigate,
      onMouseEnter,
      onMouseLeave,
    },
    ref
  ) {
    if (!videoQueue || videoQueue.length === 0) {
      return null;
    }

    return (
      <>
        {/* Right edge hover trigger zone when queue exists */}
        {!isOpen && (
          <div
            onMouseEnter={onOpen}
            className="absolute top-16 bottom-24 right-0 w-6 z-20 pointer-events-auto"
            aria-hidden="true"
          />
        )}

        {/* Video Playlist / Queue Drawer (Smooth sliding right panel, sits above playback bar) */}
        <div
          ref={ref}
          onClick={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={`absolute top-0 bottom-20 sm:bottom-24 right-0 w-80 sm:w-96 max-w-[92vw] bg-slate-950/95 backdrop-blur-2xl border-l border-b border-white/15 z-20 flex flex-col shadow-2xl rounded-bl-2xl overflow-hidden transition-all duration-300 ease-out select-none ${
            isOpen
              ? 'translate-x-0 opacity-100 pointer-events-auto'
              : 'translate-x-full opacity-0 pointer-events-none'
          }`}
          style={{ willChange: 'transform, opacity' }}
        >
          {/* Header */}
          <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primaryMovies/20 border border-primaryMovies/40 flex items-center justify-center text-primaryMovies shadow-inner">
                <ListVideo size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white leading-tight">
                  {isRtl ? 'قائمة التشغيل المتتالية' : 'Playback Playlist'}
                </h3>
                <p className="text-[11px] text-white/60 mt-0.5">
                  {videoQueue.length} {isRtl ? 'عنصر في القائمة' : 'items in queue'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition"
              title={isRtl ? 'إغلاق' : 'Close'}
            >
              ✕
            </button>
          </div>

          {/* Quick Actions Toolbar */}
          <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-2 text-xs flex-shrink-0">
            <button
              type="button"
              onClick={() => shuffleVideoQueue?.()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition active:scale-95"
              title={isRtl ? 'خلط ترتيب القائمة عشوائياً' : 'Shuffle playlist'}
            >
              <Shuffle size={13} />
              <span>{isRtl ? 'خلط' : 'Shuffle'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (window.confirm(isRtl ? 'هل تريد مسح قائمة التشغيل بالكامل؟' : 'Clear entire playlist queue?')) {
                  clearVideoQueue?.();
                  onClose?.();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition active:scale-95"
              title={isRtl ? 'مسح القائمة' : 'Clear queue'}
            >
              <Trash2 size={13} />
              <span>{isRtl ? 'مسح القائمة' : 'Clear'}</span>
            </button>
          </div>

          {/* Queue Item List */}
          <div
            onWheel={(e) => e.stopPropagation()}
            className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 custom-scrollbar"
          >
            {videoQueue.map((item, idx) => {
              const targetType = getItemType(item, currentType);
              const isCurrent =
                idx === videoQueueIndex || (String(item.id) === String(currentId) && targetType === currentType);
              const poster = item.poster || item.backdrop || item.thumb;

              return (
                <div
                  key={`${item.id}-${idx}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const wasFs = !!(
                      document.fullscreenElement ||
                      document.webkitFullscreenElement ||
                      document.mozFullScreenElement ||
                      document.msFullscreenElement ||
                      isFullscreen
                    );
                    setVideoQueueIndex?.(idx);
                    if (navigate) {
                      navigate(`/watch/${targetType}/${item.id}?autoPlay=true&startFromBeginning=true`, {
                        replace: true,
                      });
                    }
                    if (wasFs && containerRef?.current && !document.fullscreenElement) {
                      containerRef.current.requestFullscreen?.().catch(() => {});
                    }
                  }}
                  className={`group flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer border ${
                    isCurrent
                      ? 'bg-primaryMovies/20 border-primaryMovies/60 shadow-lg shadow-primaryMovies/15'
                      : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/15'
                  }`}
                >
                  {/* Index / Status Icon */}
                  <div className="w-5 text-center flex-shrink-0 text-xs font-mono font-bold text-white/50">
                    {isCurrent ? (
                      <div className="w-2.5 h-2.5 rounded-full bg-primaryMovies animate-pulse mx-auto shadow-[0_0_8px_rgba(229,9,20,0.9)]" />
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Thumbnail */}
                  <div className="w-12 h-16 rounded-lg bg-surfaceHover overflow-hidden flex-shrink-0 relative shadow-sm">
                    {poster ? (
                      <img src={poster} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40 p-1 text-center">
                        {item.title}
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute inset-0 bg-primaryMovies/30 flex items-center justify-center">
                        <Play size={14} className="fill-white text-white animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold truncate ${isCurrent ? 'text-primaryMovies' : 'text-white'}`}>
                      {item.title}
                    </div>
                    <div className="text-[10px] text-white/60 truncate mt-1 flex items-center gap-2">
                      <span>{targetType === 'movie' ? (isRtl ? 'فيلم' : 'Movie') : (isRtl ? 'حلقة' : 'Episode')}</span>
                      {item.year && <span>• {item.year}</span>}
                      {item.duration && <span>• {formatTime(item.duration)}</span>}
                    </div>
                  </div>

                  {/* Delete button from queue */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeVideoFromQueue?.(idx);
                    }}
                    className="p-1.5 rounded-lg opacity-60 sm:opacity-0 group-hover:opacity-100 hover:bg-white/20 text-white/70 hover:text-red-400 transition"
                    title={isRtl ? 'إزالة من القائمة' : 'Remove from queue'}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  })
);

PlayerQueueDrawer.displayName = 'PlayerQueueDrawer';

export default PlayerQueueDrawer;
