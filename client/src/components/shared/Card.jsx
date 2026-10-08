import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Disc3, Play, Check, ListPlus, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';

export function MovieCard({ item, to, className = '', isSelectionMode = false, isSelected = false, onToggleSelect }) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [justAdded, setJustAdded] = useState(false);
  const addVideoToQueue = usePlayerStore(s => s.addVideoToQueue);
  const { activeRemoteSession, playMediaOnTarget, openFullRemote } = useDeviceHandoffStore();

  const handleClick = (e) => {
    if (isSelectionMode && onToggleSelect) {
      e.preventDefault();
      onToggleSelect(item);
    }
  };

  const handleQuickAddToQueue = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addVideoToQueue({
      id: item.id,
      title: item.title,
      type: item.media_type || (item.series_id ? 'episode' : 'movie'),
      media_type: item.media_type || (item.series_id ? 'episode' : 'movie'),
      poster: item.poster || item.backdrop || null,
      year: item.year || null,
      duration: item.duration || null
    });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <Link 
      to={to} 
      onClick={handleClick}
      className={`group relative flex-shrink-0 rounded-2xl overflow-hidden bg-white dark:bg-surface/60 backdrop-blur-sm border ${
        isSelected
          ? 'bg-primaryMovies/15 border-2 border-primaryMovies shadow-lg'
          : 'border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-border/60'
      } transition-all duration-180 ease-out hover:scale-[1.02] transform-gpu will-change-transform shadow-md hover:shadow-xl hover:shadow-black/10 dark:shadow-black/60 ${className || 'w-[160px] md:w-[180px]'}`}
    >
      {/* Selection Checkbox Badge */}
      {isSelectionMode && (
        <div 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect && onToggleSelect(item); }}
          className="absolute top-3 start-3 z-20"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shadow-md backdrop-blur-md ${
            isSelected ? 'bg-primaryMovies border-primaryMovies text-white scale-110' : 'bg-black/60 border-white/40 text-transparent hover:border-white'
          }`}>
            <Check size={14} className="stroke-[3]" />
          </div>
        </div>
      )}

      {/* Quick Actions on Hover */}
      {!isSelectionMode && (
        <div className="absolute top-2.5 end-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5">
          {activeRemoteSession && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                playMediaOnTarget({
                  type: item.media_type || (item.series_id ? 'episode' : 'movie'),
                  id: item.id,
                  title: item.title,
                  poster: item.poster || item.backdrop || null,
                  currentTime: 0,
                  duration: item.duration || null
                });
                openFullRemote();
              }}
              className="w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center shadow-md bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white transition-all active:scale-90"
              title={isRtl ? `تشغيل فوري على ${activeRemoteSession.targetDeviceName}` : `Play on ${activeRemoteSession.targetDeviceName}`}
            >
              <Send size={12} />
            </button>
          )}

          <button
            onClick={handleQuickAddToQueue}
            className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center shadow-md transition-all active:scale-90 ${
              justAdded 
                ? 'bg-emerald-500 text-white scale-110' 
                : 'bg-black/70 hover:bg-primaryMovies text-white/90 hover:text-white'
            }`}
            title={justAdded ? (isRtl ? 'تمت الإضافة لقائمة التشغيل!' : 'Added to queue!') : (isRtl ? 'إضافة إلى قائمة التشغيل المتتالية' : 'Add to playlist queue')}
          >
            {justAdded ? <Check size={13} className="stroke-[3]" /> : <ListPlus size={14} />}
          </button>
        </div>
      )}

      <div className="aspect-[2/3] bg-surfaceHover relative overflow-hidden">
        {item.poster ? (
          <img 
            src={item.poster} 
            alt={item.title} 
            className="w-full h-full object-cover group-hover:brightness-105 group-hover:scale-105 transition-transform duration-250 ease-out" 
            loading="lazy" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-xs p-4 text-center">
            {item.title}
          </div>
        )}
        {!isSelectionMode && (
          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 rounded-full bg-white/95 dark:bg-tx/20 backdrop-blur-md flex items-center justify-center text-primaryMovies dark:text-text shadow-md group-hover:scale-110 transition-transform duration-180">
              <Play size={16} fill="currentColor" className="ms-0.5" />
            </div>
          </div>
        )}
        {/* Watch Progress Bar */}
        {(item.progress > 0 || (item.position && item.duration)) && (
          <div className="absolute bottom-0 inset-x-0 h-1.5 bg-black/60 z-10">
            <div 
              className="h-full bg-primaryMovies rounded-r-full shadow-[0_0_8px_rgba(229,9,20,0.8)] transition-all"
              style={{ width: `${Math.min(100, Math.round(item.progress || (item.position / item.duration) * 100))}%` }}
            />
          </div>
        )}
      </div>
      <div className="p-2.5 pb-3 text-center">
        <div className="text-sm font-semibold truncate text-text group-hover:text-primaryMovies transition-colors">
          {item.title}
        </div>
        {item.year && <div className="text-xs text-muted mt-0.5 font-medium">{item.year}</div>}
        {item.artistName && <div className="text-xs text-muted truncate mt-0.5">{item.artistName}</div>}
      </div>
    </Link>
  );
}

export function AlbumCard({ album, to, className = '', onPlayClick, isSelectionMode = false, isSelected = false, onToggleSelect }) {
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const handleClick = (e) => {
    if (isSelectionMode && onToggleSelect) {
      e.preventDefault();
      onToggleSelect(album);
    }
  };

  return (
    <Link 
      to={to} 
      onClick={handleClick}
      className={`group w-full flex flex-col p-3 rounded-[22px] transition-[transform,box-shadow,border-color] duration-160 ease-out hover:-translate-y-1.5 transform-gpu will-change-transform shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_20px_45px_-8px_rgba(0,0,0,0.7)] relative ${
        isSelected 
          ? 'bg-primaryMusic/15 border-2 border-primaryMusic shadow-lg shadow-primaryMusic/10' 
          : 'bg-white dark:bg-surface/60 backdrop-blur-sm hover:bg-slate-50 dark:hover:bg-surface/80 border border-slate-200/80 dark:border-white/10 hover:border-emerald-500/30 dark:hover:border-emerald-500/40'
      } ${className}`}
    >
      {/* Selection Checkbox Badge */}
      {isSelectionMode && (
        <div 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect && onToggleSelect(album); }}
          className="absolute top-4 start-4 z-20"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shadow-md backdrop-blur-md ${
            isSelected ? 'bg-primaryMusic border-primaryMusic text-black scale-110' : 'bg-black/60 border-white/40 text-transparent hover:border-white'
          }`}>
            <Check size={14} className="stroke-[3]" />
          </div>
        </div>
      )}

      {/* Square aspect ratio with optically coherent concentric radius and subtle image outline */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-surfaceHover shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 group-hover:shadow-md transition-[box-shadow,transform] duration-200">
        {album.cover ? (
          <img src={album.cover} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250 ease-out" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-surfaceHover flex items-center justify-center text-muted">
            <Disc3 size={32} className="opacity-40 text-primaryMusic" />
          </div>
        )}

        {/* Floating play button on hover (44x44px accessible hit area, optically centered play icon) */}
        {!isSelectionMode && (
          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center">
            <div
              onClick={(e) => {
                if (onPlayClick) {
                  e.preventDefault();
                  e.stopPropagation();
                  onPlayClick(album);
                }
              }}
              className="w-11 h-11 rounded-full bg-primaryMusic text-black flex items-center justify-center shadow-lg shadow-black/30 hover:scale-105 active:scale-95 transition-transform duration-150 cursor-pointer"
              title={isArabic ? 'تشغيل' : 'Play'}
            >
              <Play size={18} fill="black" className="ms-0.5" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 min-w-0 text-center">
        <div className="text-sm font-semibold truncate text-text group-hover:text-primaryMusic transition-colors [text-wrap:balance]">{album.title}</div>
        {album.artistName && <div className="text-xs text-muted truncate mt-0.5">{album.artistName}</div>}
        {album.year && <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums mt-0.5">{album.year}</div>}
      </div>
    </Link>
  );
}

export function ArtistCard({ artist, to, className = '', onPlayClick, isSelectionMode = false, isSelected = false, onToggleSelect, isQuran, displayYear: overrideDisplayYear }) {
  const displayYear = overrideDisplayYear || artist.year || artist.maxYear || artist.minYear;
  const { i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  
  // Auto-detect if not explicitly passed
  const isQuranMedia = isQuran !== undefined 
    ? isQuran 
    : (artist.name || '').match(/قرآن|قران|شيخ|مقرئ|قارئ|سورة|تلاوة|مصحف/i) != null;

  const albumsLabel = isQuranMedia 
    ? (isArabic ? 'مصحف' : 'Recitations') 
    : (isArabic ? 'ألبوم' : 'Albums');

  const handleClick = (e) => {
    if (isSelectionMode && onToggleSelect) {
      e.preventDefault();
      onToggleSelect(artist);
    }
  };

  return (
    <Link 
      to={to} 
      onClick={handleClick}
      className={`group relative w-full flex flex-col p-3 rounded-[22px] transition-[transform,box-shadow,border-color] duration-160 ease-out hover:-translate-y-1.5 transform-gpu will-change-transform shadow-[0_4px_16px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_24px_-6px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_20px_45px_-8px_rgba(0,0,0,0.7)] ${
        isSelected 
          ? 'bg-primaryMusic/15 border-2 border-primaryMusic shadow-lg shadow-primaryMusic/10' 
          : 'bg-white dark:bg-surface/60 backdrop-blur-sm hover:bg-slate-50 dark:hover:bg-surface/80 border border-slate-200/80 dark:border-white/10 hover:border-emerald-500/30 dark:hover:border-emerald-500/40'
      } ${className}`}
    >
      {/* Selection Checkbox Badge */}
      {isSelectionMode && (
        <div 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSelect && onToggleSelect(artist); }}
          className="absolute top-4 start-4 z-20"
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all shadow-md backdrop-blur-md ${
            isSelected ? 'bg-primaryMusic border-primaryMusic text-black scale-110' : 'bg-black/60 border-white/40 text-transparent hover:border-white'
          }`}>
            <Check size={14} className="stroke-[3]" />
          </div>
        </div>
      )}

      {/* Square card with concentric radius and image outline */}
      <div className="relative aspect-square w-full rounded-2xl overflow-hidden bg-surfaceHover shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10 group-hover:shadow-md transition-[box-shadow,transform] duration-200">
        {(artist.image || artist.poster) ? (
          <img src={artist.image || artist.poster} alt={artist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-250 ease-out" loading="lazy" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface to-surfaceHover p-2">
            <div className="w-12 h-12 rounded-full bg-primaryMusic/20 border border-primaryMusic/30 flex items-center justify-center text-2xl font-bold text-primaryMusic mb-1">
              {artist.name ? artist.name[0] : '♫'}
            </div>
          </div>
        )}

        {/* Floating play button on hover (44x44px accessible hit area, optically centered play icon) */}
        {!isSelectionMode && (
          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <div
              onClick={(e) => {
                if (onPlayClick) {
                  e.preventDefault();
                  e.stopPropagation();
                  onPlayClick(artist);
                }
              }}
              className="w-11 h-11 rounded-full bg-primaryMusic text-black flex items-center justify-center shadow-lg shadow-black/30 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
              title={isArabic ? 'تشغيل' : 'Play'}
            >
              <Play size={18} fill="black" className="ms-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Info Below Image */}
      <div className="mt-2.5 min-w-0 text-center">
        <div className="text-sm font-semibold text-text group-hover:text-primaryMusic transition-colors truncate [text-wrap:balance]">
          {artist.name}
        </div>
        <div className="text-[11px] text-muted flex items-center justify-center gap-1 mt-0.5">
          {artist.albumsCount > 0 && <span>{artist.albumsCount} {displayYear ? 'alb' : albumsLabel}</span>}
          {displayYear && (
            <>
              <span>•</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{displayYear}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
