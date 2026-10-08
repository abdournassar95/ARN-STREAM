import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchLanding } from '../api/client';
import GlassCarousel from '../components/shared/GlassCarousel';
import { MovieCard, AlbumCard } from '../components/shared/Card';
import EditLibraryCoversModal from '../components/modals/EditLibraryCoversModal';
import EditLiveTvCoversModal, { DEFAULT_LIVE_TV_COVERS } from '../components/modals/EditLiveTvCoversModal';
import ServerQrModal from '../components/shared/ServerQrModal';
import CosmicBackground from '../components/shared/CosmicBackground';
import { 
  Film, Music, Play, Tv, BookOpen, Drama, Compass, Sparkles, Folder, 
  Languages, Settings, FolderPlus, Activity, Palette, MessageCircle, 
  Send, Facebook, Ghost, Moon, Sun, ArrowRight, QrCode,
  SlidersHorizontal, GripVertical, ChevronLeft, ChevronRight, RotateCcw
} from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import UserMenu from '../components/shared/UserMenu';
import { localizeLibraryName } from '../utils/localization';

function getLibraryMeta(lib, i18n) {
  const nameLower = (lib.name || '').toLowerCase();
  const isArabic = i18n.language === 'ar';
  
  // Quran / Islamic audio
  if (nameLower.includes('قرآن') || nameLower.includes('قران') || nameLower.includes('quran') || nameLower.includes('اسلام') || lib.icon === 'book') {
    return {
      Icon: BookOpen,
      to: `/library/${lib.id}`,
      bgGradient: 'from-emerald-500/25 via-emerald-600/15 to-teal-500/10',
      borderColor: 'hover:border-emerald-500/50',
      iconBg: 'bg-emerald-500 text-black shadow-emerald-500/30',
      badgeBg: 'bg-emerald-500 text-black',
      countText: isArabic ? `${lib.media_count} تلاوة وسورة` : `${lib.media_count} recitations`,
    };
  }
  
  // Plays / Theater
  if (nameLower.includes('مسرح') || nameLower.includes('play') || nameLower.includes('theater')) {
    return {
      Icon: Drama,
      to: `/library/${lib.id}`,
      bgGradient: 'from-amber-500/25 via-orange-500/15 to-yellow-500/10',
      borderColor: 'hover:border-amber-500/50',
      iconBg: 'bg-amber-500 text-black shadow-amber-500/30',
      badgeBg: 'bg-amber-500 text-black',
      countText: isArabic ? `${lib.media_count} مسرحية` : `${lib.media_count} plays`,
    };
  }

  // Documentaries / وثائقيات (National Geographic Amber/Gold Aesthetic with Compass icon)
  if (nameLower.includes('وثائق') || nameLower.includes('doc') || lib.icon === 'compass' || lib.icon === 'documentary') {
    return {
      Icon: Compass,
      to: `/library/${lib.id}`,
      bgGradient: 'from-amber-500/30 via-yellow-600/20 to-orange-500/10',
      borderColor: 'hover:border-amber-500/60',
      iconBg: 'bg-gradient-to-tr from-amber-500 to-yellow-400 text-black shadow-amber-500/40',
      badgeBg: 'bg-amber-500 text-black font-bold',
      countText: isArabic ? `${lib.media_count} عمل وثائقي` : `${lib.media_count} documentaries`,
    };
  }

  // Shows / TV Series
  if (lib.type === 'shows' || lib.icon === 'tv' || nameLower.includes('مسلسل') || nameLower.includes('show') || nameLower.includes('series')) {
    return {
      Icon: Tv,
      to: `/library/${lib.id}`,
      bgGradient: 'from-sky-500/25 via-blue-500/15 to-indigo-500/10',
      borderColor: 'hover:border-sky-500/50',
      iconBg: 'bg-sky-500 text-white shadow-sky-500/30',
      badgeBg: 'bg-sky-500 text-white',
      countText: isArabic ? `${lib.media_count} مسلسل` : `${lib.media_count} series`,
    };
  }

  // Foreign Movies / Custom Movies
  if (lib.type === 'movies' && lib.id !== 1) {
    return {
      Icon: Film,
      to: `/library/${lib.id}`,
      bgGradient: 'from-purple-500/25 via-indigo-500/15 to-pink-500/10',
      borderColor: 'hover:border-purple-500/50',
      iconBg: 'bg-purple-600 text-white shadow-purple-600/30',
      badgeBg: 'bg-purple-600 text-white',
      countText: isArabic ? `${lib.media_count} فيلم` : `${lib.media_count} movies`,
    };
  }

  // Default Movies
  if (lib.type === 'movies') {
    return {
      Icon: Film,
      to: `/library/${lib.id}`,
      bgGradient: 'from-primaryMovies/30 via-red-600/15 to-transparent',
      borderColor: 'hover:border-primaryMovies/50',
      iconBg: 'bg-primaryMovies text-white shadow-primaryMovies/30',
      badgeBg: 'bg-primaryMovies text-white',
      countText: isArabic ? `${lib.media_count} فيلم` : `${lib.media_count} movies`,
    };
  }

  // General Music
  return {
    Icon: Music,
    to: `/library/${lib.id}`,
    bgGradient: 'from-primaryMusic/30 via-teal-500/15 to-transparent',
    borderColor: 'hover:border-primaryMusic/50',
    iconBg: 'bg-primaryMusic text-black shadow-primaryMusic/30',
    badgeBg: 'bg-primaryMusic text-black',
    countText: isArabic ? `${lib.media_count} مقطع صوتي` : `${lib.media_count} tracks`,
  };
}

function LibraryCardCollage({ covers = [], type, meta, isArabic }) {
  if (!covers || covers.length === 0) {
    

  return (
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.bgGradient} opacity-60 group-hover:opacity-80 transition duration-300 pointer-events-none`} />
    );
  }

  const isMusic = type === 'music';
  const count = Math.min(covers.length, 5);
  const displayCovers = covers.slice(0, count);

  // Large overlapping dynamic 3D fan layers (proportional for default 100% zoom)
  const getCardClasses = (idx) => {
    if (count === 1) {
      return {
        cls: isArabic
          ? 'rotate-3 group-hover:rotate-6 scale-100 group-hover:scale-105 opacity-100 translate-x-[4rem] group-hover:translate-x-[5rem] translate-y-0 group-hover:-translate-y-1'
          : '-rotate-3 group-hover:-rotate-6 scale-100 group-hover:scale-105 opacity-100 -translate-x-[4rem] group-hover:-translate-x-[5rem] translate-y-0 group-hover:-translate-y-1',
        z: 'z-[2]'
      };
    }
    if (count === 2) {
      if (idx === 0) {
        return {
          cls: isArabic
            ? 'rotate-10 group-hover:rotate-14 translate-x-[8rem] group-hover:translate-x-[9.5rem] opacity-80 group-hover:opacity-100 scale-95 translate-y-1.5 group-hover:translate-y-0'
            : '-rotate-10 group-hover:-rotate-14 -translate-x-[8rem] group-hover:-translate-x-[9.5rem] opacity-80 group-hover:opacity-100 scale-95 translate-y-1.5 group-hover:translate-y-0',
          z: 'z-[1]'
        };
      }
      return {
        cls: isArabic
          ? '-rotate-8 group-hover:-rotate-12 translate-x-4 group-hover:translate-x-3 opacity-100 scale-100 group-hover:scale-105 -translate-y-1 group-hover:-translate-y-2'
          : 'rotate-8 group-hover:rotate-12 -translate-x-4 group-hover:-translate-x-3 opacity-100 scale-100 group-hover:scale-105 -translate-y-1 group-hover:-translate-y-2',
        z: 'z-[2]'
      };
    }
    if (count === 3) {
      if (idx === 0) {
        return {
          cls: isArabic
            ? 'rotate-14 group-hover:rotate-18 translate-x-[10.5rem] group-hover:translate-x-[12rem] opacity-75 group-hover:opacity-100 scale-90 translate-y-2 group-hover:translate-y-1'
            : '-rotate-14 group-hover:-rotate-18 -translate-x-[10.5rem] group-hover:-translate-x-[12rem] opacity-75 group-hover:opacity-100 scale-90 translate-y-2 group-hover:translate-y-1',
          z: 'z-[1]'
        };
      }
      if (idx === 1) {
        return {
          cls: isArabic
            ? 'rotate-4 group-hover:rotate-6 translate-x-[6rem] group-hover:translate-x-[7rem] opacity-90 group-hover:opacity-100 scale-95 -translate-y-1 group-hover:-translate-y-2'
            : '-rotate-4 group-hover:-rotate-6 -translate-x-[6rem] group-hover:-translate-x-[7rem] opacity-90 group-hover:opacity-100 scale-95 -translate-y-1 group-hover:-translate-y-2',
          z: 'z-[2]'
        };
      }
      return {
        cls: isArabic
          ? '-rotate-10 group-hover:-rotate-14 translate-x-4 group-hover:translate-x-3 opacity-100 scale-100 group-hover:scale-105 translate-y-1 group-hover:-translate-y-0.5'
          : 'rotate-10 group-hover:rotate-14 -translate-x-4 group-hover:-translate-x-3 opacity-100 scale-100 group-hover:scale-105 translate-y-1 group-hover:-translate-y-0.5',
        z: 'z-[3]'
      };
    }
    if (count === 4) {
      switch (idx) {
        case 0:
          return {
            cls: isArabic
              ? 'rotate-20 group-hover:rotate-28 translate-x-[12.5rem] group-hover:translate-x-[14rem] opacity-70 group-hover:opacity-100 scale-85 translate-y-2.5 group-hover:translate-y-1'
              : '-rotate-20 group-hover:-rotate-28 -translate-x-[12.5rem] group-hover:-translate-x-[14rem] opacity-70 group-hover:opacity-100 scale-85 translate-y-2.5 group-hover:translate-y-1',
            z: 'z-[1]'
          };
        case 1:
          return {
            cls: isArabic
              ? 'rotate-10 group-hover:rotate-14 translate-x-[8.5rem] group-hover:translate-x-[9.5rem] opacity-80 group-hover:opacity-100 scale-90 translate-y-1 group-hover:-translate-y-0.5'
              : '-rotate-10 group-hover:-rotate-14 -translate-x-[8.5rem] group-hover:-translate-x-[9.5rem] opacity-80 group-hover:opacity-100 scale-90 translate-y-1 group-hover:-translate-y-0.5',
            z: 'z-[2]'
          };
        case 2:
          return {
            cls: isArabic
              ? '-rotate-5 group-hover:-rotate-8 translate-x-[4.5rem] group-hover:translate-x-[3.5rem] opacity-90 group-hover:opacity-100 scale-95 -translate-y-1.5 group-hover:-translate-y-2.5'
              : 'rotate-5 group-hover:rotate-8 -translate-x-[4.5rem] group-hover:-translate-x-[3.5rem] opacity-90 group-hover:opacity-100 scale-95 -translate-y-1.5 group-hover:-translate-y-2.5',
            z: 'z-[3]'
          };
        case 3:
        default:
          return {
            cls: isArabic
              ? '-rotate-14 group-hover:-rotate-20 translate-x-5 group-hover:-translate-x-4 opacity-100 scale-100 group-hover:scale-105 translate-y-1 group-hover:-translate-y-0.5'
              : 'rotate-14 group-hover:rotate-20 -translate-x-5 group-hover:translate-x-4 opacity-100 scale-100 group-hover:scale-105 translate-y-1 group-hover:-translate-y-0.5',
            z: 'z-[4]'
          };
      }
    }
    // 5 covers
    switch (idx) {
      case 0:
        return {
          cls: isArabic
            ? 'rotate-24 group-hover:rotate-[32deg] translate-x-[14rem] group-hover:translate-x-[15.5rem] opacity-70 group-hover:opacity-100 scale-75 translate-y-3 group-hover:translate-y-2'
            : '-rotate-24 group-hover:-rotate-[32deg] -translate-x-[14rem] group-hover:-translate-x-[15.5rem] opacity-70 group-hover:opacity-100 scale-75 translate-y-3 group-hover:translate-y-2',
          z: 'z-[1]'
        };
      case 1:
        return {
          cls: isArabic
            ? 'rotate-14 group-hover:rotate-20 translate-x-[10.5rem] group-hover:translate-x-[11.5rem] opacity-80 group-hover:opacity-100 scale-85 translate-y-1.5 group-hover:translate-y-0'
            : '-rotate-14 group-hover:-rotate-20 -translate-x-[10.5rem] group-hover:-translate-x-[11.5rem] opacity-80 group-hover:opacity-100 scale-85 translate-y-1.5 group-hover:translate-y-0',
          z: 'z-[2]'
        };
      case 2:
        return {
          cls: isArabic
            ? 'rotate-4 group-hover:rotate-6 translate-x-[7rem] group-hover:translate-x-[6.5rem] opacity-90 group-hover:opacity-100 scale-90 -translate-y-0.5 group-hover:-translate-y-1.5'
            : '-rotate-4 group-hover:-rotate-6 -translate-x-[7rem] group-hover:-translate-x-[6.5rem] opacity-90 group-hover:opacity-100 scale-90 -translate-y-0.5 group-hover:-translate-y-1.5',
          z: 'z-[3]'
        };
      case 3:
        return {
          cls: isArabic
            ? '-rotate-8 group-hover:-rotate-12 translate-x-[3.8rem] group-hover:translate-x-[2.5rem] opacity-95 group-hover:opacity-100 scale-95 -translate-y-1.5 group-hover:-translate-y-2.5'
            : 'rotate-8 group-hover:rotate-12 -translate-x-[3.8rem] group-hover:-translate-x-[2.5rem] opacity-95 group-hover:opacity-100 scale-95 -translate-y-1.5 group-hover:-translate-y-2.5',
          z: 'z-[4]'
        };
      case 4:
      default:
        return {
          cls: isArabic
            ? '-rotate-16 group-hover:-rotate-24 translate-x-5 group-hover:-translate-x-5 opacity-100 scale-100 group-hover:scale-105 translate-y-0.5 group-hover:-translate-y-0.5'
            : 'rotate-16 group-hover:rotate-24 -translate-x-5 group-hover:translate-x-5 opacity-100 scale-100 group-hover:scale-105 translate-y-0.5 group-hover:-translate-y-0.5',
          z: 'z-[5]'
        };
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl sm:rounded-[22px] select-none">
      {/* Background ambient colorful tint and glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.bgGradient} opacity-50 group-hover:opacity-75 transition-opacity duration-500`} />
      
      {/* Radial backlight glow centered behind the cards */}
      <div className={`absolute ${isArabic ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-gradient-to-tr ${meta.bgGradient} blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-700`} />

      {/* Floating Fan Posters Container - Spacious & Prominent */}
      <div className={`absolute -top-3 -bottom-3 ${isArabic ? '-left-4 sm:-left-2' : '-right-4 sm:-right-2'} flex items-center justify-center`}>
        <div className="relative flex items-center justify-center w-48 sm:w-56 md:w-60 h-48 sm:h-56 md:h-60">
          {displayCovers.map((coverUrl, idx) => {
            const { cls, z } = getCardClasses(idx);
            return (
              <div
                key={idx}
                className={`absolute transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] transform-gpu ${cls} ${z}`}
              >
                <img
                  src={coverUrl}
                  alt=""
                  loading="lazy"
                  className={`object-cover rounded-xl shadow-[0_12px_28px_rgba(0,0,0,0.8)] ring-1 ring-white/20 group-hover:ring-white/30 group-hover:brightness-105 transition-all duration-300 ${
                    isMusic
                      ? 'w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 aspect-square'
                      : 'w-24 h-36 sm:w-28 sm:h-42 md:w-32 md:h-48 aspect-[2/3]'
                  }`}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Directional gradient to protect text on the start side without killing poster vibrancy */}
      <div className={`absolute inset-0 z-[10] pointer-events-none ${
        isArabic
          ? 'bg-gradient-to-l from-surface/90 via-surface/50 via-40% to-transparent'
          : 'bg-gradient-to-r from-surface/90 via-surface/50 via-40% to-transparent'
      }`} />

      {/* Soft bottom overlay to keep the title & enter button sharp and readable */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface via-surface/75 via-45% to-transparent z-[10] pointer-events-none" />

      {/* Soft top gradient */}
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-surface/65 via-surface/20 to-transparent z-[10] pointer-events-none" />
    </div>
  );
}

export default function Landing() {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['landing'], queryFn: fetchLanding });

  const [editingLibrary, setEditingLibrary] = useState(null);
  const [showLiveTvCoversModal, setShowLiveTvCoversModal] = useState(false);
  const [isCustomizingCards, setIsCustomizingCards] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);

  const { 
    theme, 
    setTheme, 
    homeSectionsOrder, 
    homeLibrariesOrder,
    homeLibraryCardSize = 'medium',
    liveTvCovers,
    setHomeLibrariesOrder,
    setHomeLibraryCardSize,
    resetHomeLibrariesOrder
  } = useSettingsStore();

let currentSections = (homeSectionsOrder || []).map(sec => typeof sec === 'string' ? { id: sec, enabled: true } : sec);
  
  // Auto-merge dynamic library sections if they don't exist in homeSectionsOrder
  const baseSections = ['continueWatching', 'continueListening', 'recentlyAdded', 'collections', 'latestAudio', 'latestMovies', 'latestSeries'];
  if (data?.libraries?.length > 0) {
    for (const lib of data.libraries) {
      const lid = 'lib_' + lib.id;
      if (!currentSections.find(s => s.id === lid)) {
        currentSections.push({ id: lid, enabled: true });
      }
    }
    // Filter out obsolete generic sections
    currentSections = currentSections.filter(s => baseSections.includes(s.id) || ((s?.id || '').startsWith('lib_') && data.libraries.some(l => 'lib_' + l.id === s.id)));
  } else if (data) {
    currentSections = currentSections.filter(s => baseSections.includes(s.id));
  }

  const renderSection = (sectionId) => {
    switch (sectionId) {
      case 'recentlyAdded':
        if (!data?.recentlyAdded?.length) return null;
        return (
          <div key="recentlyAdded" className="mt-16 sm:mt-24">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primaryMovies/20 border border-primaryMovies/30 flex items-center justify-center text-primaryMovies shadow-sm">
                  <Sparkles size={18} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-text">
                  {i18n.language === 'ar' ? 'المضاف مؤخراً' : 'Recently Added'}
                </h2>
              </div>
            </div>
            <GlassCarousel>
              {data.recentlyAdded.filter(item => Boolean(item.poster)).map(item => (
                <MovieCard key={`recently-${item.media_type}-${item.id}`} item={item} to={item.media_type === 'series' ? `/series/${item.id}` : `/movies/${item.id}`} />
              ))}
            </GlassCarousel>
          </div>
        );

      case 'continueWatching':
        if (!data?.continueWatching?.length) return null;
        return (
          <div key="continueWatching" className="mt-16 sm:mt-24">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm">
                  <Play size={18} fill="currentColor" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-text">
                  {i18n.language === 'ar' ? 'متابعة المشاهدة' : 'Continue Watching'}
                </h2>
              </div>
            </div>
            <GlassCarousel>
              {data.continueWatching.filter(item => Boolean(item.poster)).map(item => {
                const isSeries = item.type === 'series' || item.media_type === 'series';
                const targetId = isSeries ? (item.mediaId || item.episodeId) : (item.mediaId || item.id);
                const targetUrl = isSeries ? `/watch/episode/${targetId}?autoPlay=true` : `/watch/movie/${targetId}?autoPlay=true`;
                return (
                  <MovieCard 
                    key={`cw-${item.type || item.media_type}-${item.id || item.mediaId}`} 
                    item={item} 
                    to={targetUrl} 
                  />
                );
              })}
            </GlassCarousel>
          </div>
        );

      case 'continueListening':
        if (!data?.continueListening?.length) return null;
        return (
          <div key="continueListening" className="mt-16 sm:mt-24">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primaryMusic/20 border border-primaryMusic/30 flex items-center justify-center text-primaryMusic shadow-sm">
                  <Music size={18} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-text">
                  {i18n.language === 'ar' ? 'متابعة الاستماع' : 'Continue Listening'}
                </h2>
              </div>
            </div>
            <GlassCarousel>
              {data.continueListening.filter(item => Boolean(item.poster)).map(item => (
                <MovieCard key={`cl-${item.id}`} item={item} to={`/music/album/${item.albumId}`} />
              ))}
            </GlassCarousel>
          </div>
        );

      case 'latestAudio':
        if (!data?.latestAudio?.length) return null;
        return (
          <div key="latestAudio" className="mt-16 sm:mt-24">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 shadow-sm">
                  <Folder size={18} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-text">
                  {i18n.language === 'ar' ? 'أحدث الصوتيات' : 'Latest Audio'}
                </h2>
              </div>
            </div>
            <GlassCarousel>
              {data.latestAudio.filter(item => Boolean(item.poster)).map(item => (
                <AlbumCard key={`la-${item.id}`} album={item} to={`/music/album/${item.id}`} className="w-[160px] md:w-[180px] flex-shrink-0" />
              ))}
            </GlassCarousel>
          </div>
        );

      case 'latestMovies':
      case 'movies':
        if (!data?.movies?.length) return null;
        return (
          <div key="latestMovies" className="mt-16 sm:mt-24">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-sm">
                  <Film size={18} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-text">
                  {i18n.language === 'ar' ? 'أحدث الأفلام' : 'Latest Movies'}
                </h2>
              </div>
            </div>
            <GlassCarousel>
              {data.movies.filter(item => Boolean(item.poster)).map(item => (
                <MovieCard key={`m-${item.id}`} item={item} to={`/movies/${item.id}`} />
              ))}
            </GlassCarousel>
          </div>
        );

      case 'latestSeries':
      case 'series':
        if (!data?.series?.length) return null;
        return (
          <div key="latestSeries" className="mt-16 sm:mt-24">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-sm">
                  <Tv size={18} />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-text">
                  {i18n.language === 'ar' ? 'أحدث المسلسلات' : 'Latest Series'}
                </h2>
              </div>
            </div>
            <GlassCarousel>
              {data.series.filter(item => Boolean(item.poster)).map(item => (
                <MovieCard key={`s-${item.id}`} item={item} to={`/series/${item.id}`} />
              ))}
            </GlassCarousel>
          </div>
        );

      default:
        if ((sectionId || '').startsWith('lib_')) {
          const libId = parseInt(sectionId.split('_')[1]);
          const libData = data?.latestByLibrary?.[libId];
          const libInfo = data?.libraries?.find(l => l.id === libId);
          if (!libData || libData.length === 0 || !libInfo) return null;
          
          const meta = getLibraryMeta(libInfo, i18n);
          const IconComp = meta?.Icon || (libInfo.type === 'shows' ? Tv : (libInfo.type === 'music' ? Music : Film));
          
          let bgColor = 'bg-purple-500/20';
          let borderColor = 'border-purple-500/30';
          let textColor = 'text-purple-400';
          
          const nameLower = (libInfo.name || '').toLowerCase();
          if (nameLower.includes('قرآن') || nameLower.includes('قران') || nameLower.includes('quran') || nameLower.includes('اسلام') || libInfo.icon === 'book') {
            bgColor = 'bg-emerald-500/20';
            borderColor = 'border-emerald-500/30';
            textColor = 'text-emerald-400';
          } else if (nameLower.includes('مسرح') || nameLower.includes('play') || nameLower.includes('theater')) {
            bgColor = 'bg-amber-500/20';
            borderColor = 'border-amber-500/30';
            textColor = 'text-amber-400';
          } else if (libInfo.type === 'shows') {
            bgColor = 'bg-sky-500/20';
            borderColor = 'border-sky-500/30';
            textColor = 'text-sky-400';
          } else if (libInfo.type === 'music') {
            bgColor = 'bg-teal-500/20';
            borderColor = 'border-teal-500/30';
            textColor = 'text-teal-400';
          }
          
          const title = i18n.language === 'ar' 
            ? (libInfo.name.startsWith('أحدث') ? libInfo.name : `أحدث ${libInfo.name}`)
            : `Latest in ${localizeLibraryName(libInfo.name, false)}`;
          
          return (
            <div key={`lib-${libId}`} className="mt-16 sm:mt-24">
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl ${bgColor} border ${borderColor} flex items-center justify-center ${textColor} shadow-sm`}>
                    <IconComp size={18} />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-bold text-text">
                    {title}
                  </h2>
                </div>
              </div>
              <GlassCarousel>
                {libData.map(item => (
                  libInfo.type === 'music' ? 
                    <AlbumCard key={`album-${item.id}`} album={item} to={`/music/album/${item.id}`} className="w-[160px] md:w-[180px] flex-shrink-0" /> :
                    <MovieCard key={`item-${item.id}`} item={item} to={item.media_type === 'series' ? `/series/${item.id}` : `/movies/${item.id}`} />
                ))}
              </GlassCarousel>
            </div>
          );
        }
        return null;
    }
  };

  const { isAdmin } = useAuthStore();
  const [showQrModal, setShowQrModal] = useState(false);

  const toggleLang = () => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar');
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  const isEmpty = data && data.movies?.count === 0 && data.music?.tracks === 0 && (!data.libraries || data.libraries.length === 0);

  const librariesList = data?.libraries || [];
  const isDark = theme !== 'light';

  // Unified items list (libraries + Live TV) respecting user custom order
  const unifiedItems = useMemo(() => {
    const currentLiveCovers = (liveTvCovers && liveTvCovers.length > 0) ? liveTvCovers : DEFAULT_LIVE_TV_COVERS;
    const baseItems = [
      ...librariesList.map(lib => ({ ...lib, itemType: 'library' })),
      { 
        id: 'live_tv', 
        itemType: 'live_tv', 
        name: isArabic ? 'البث المباشر' : 'Live TV',
        type: 'channels',
        covers: currentLiveCovers
      }
    ];

    if (!homeLibrariesOrder || homeLibrariesOrder.length === 0) {
      return baseItems;
    }

    const result = [];
    for (const savedId of homeLibrariesOrder) {
      const item = baseItems.find(b => String(b.id) === String(savedId));
      if (item) result.push(item);
    }
    for (const b of baseItems) {
      if (!result.some(r => String(r.id) === String(b.id))) {
        result.push(b);
      }
    }
    return result;
  }, [librariesList, homeLibrariesOrder, liveTvCovers, isArabic]);

  // Card Size Configuration
  const sizeConfig = useMemo(() => {
    switch (homeLibraryCardSize) {
      case 'small':
        return {
          gridCols: 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4',
          minHeight: 'min-h-[175px] sm:min-h-[195px] p-3.5 sm:p-4',
          titleSize: 'text-base sm:text-lg font-bold',
          subtitleSize: 'text-[11px]',
          iconWrap: 'w-9 h-9 sm:w-10 sm:h-10 rounded-xl',
          iconSize: 18,
          arrowBtn: 'w-7 h-7 sm:w-8 sm:h-8',
          arrowSize: 14,
          badgeSize: 'text-[10px] px-2 py-0.5'
        };
      case 'large':
        return {
          gridCols: 'grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 lg:gap-8',
          minHeight: 'min-h-[290px] sm:min-h-[320px] lg:min-h-[350px] p-6 sm:p-8',
          titleSize: 'text-2xl sm:text-3xl font-black',
          subtitleSize: 'text-sm sm:text-base',
          iconWrap: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl',
          iconSize: 28,
          arrowBtn: 'w-10 h-10 sm:w-12 sm:h-12',
          arrowSize: 20,
          badgeSize: 'text-sm px-3.5 py-1'
        };
      case 'medium':
      default:
        return {
          gridCols: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6',
          minHeight: 'min-h-[240px] sm:min-h-[260px] lg:min-h-[275px] p-5 sm:p-6',
          titleSize: 'text-xl sm:text-2xl font-black',
          subtitleSize: 'text-xs sm:text-sm',
          iconWrap: 'w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl',
          iconSize: 22,
          arrowBtn: 'w-8 h-8 sm:w-9 sm:h-9',
          arrowSize: 16,
          badgeSize: 'text-xs px-3 py-1'
        };
    }
  }, [homeLibraryCardSize]);

  // Reorder Item via Direction (-1: left, 1: right)
  const handleMoveItem = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= unifiedItems.length) return;
    const newItems = [...unifiedItems];
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    setHomeLibrariesOrder(newItems.map(item => String(item.id)));
  };

  // Drag and Drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    const newItems = [...unifiedItems];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);
    setDraggedIndex(null);
    setHomeLibrariesOrder(newItems.map(item => String(item.id)));
  };

  return (
    <div className={`min-h-screen relative overflow-hidden page-transition ${isDark ? 'bg-[#04060b]' : 'bg-bg'}`}>
      {/* 🌌 Animated Cosmic Galaxy Backdrop */}
      <CosmicBackground density="normal" />

      {/* Extra top hero glow for the title (layered above the cosmic bg) */}
      {isDark && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[480px] bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.18),transparent_70%)] blur-2xl pointer-events-none" />
      )}

      {/* Top */}
      <header className="relative z-50 w-full px-4 sm:px-8 lg:px-12 h-14 sm:h-16 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <img src="/favicon.jpg" alt="ARN Technology" className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg object-cover shadow-lg border border-tx/10" />
          <span className="font-bold text-base sm:text-lg tracking-tight text-text drop-shadow-md">ARN Stream</span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {/* QR Code Quick Connect for Mobile (Desktop Only) */}
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-surfaceHover text-xs sm:text-sm font-medium transition text-emerald-400 shadow-sm group"
            title={isArabic ? 'تشغيل على الهاتف عبر QR Code' : 'Connect Mobile via QR Code'}
          >
            <QrCode size={14} className="group-hover:scale-110 transition-transform text-emerald-400" />
            <span className="hidden lg:inline">{isArabic ? 'ربط الهاتف' : 'Connect Phone'}</span>
          </button>

          {isAdmin() && (
            <Link to="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface border border-border hover:bg-surfaceHover text-xs sm:text-sm font-medium transition text-[#10b981]">
              <Activity size={14} /> <span className="hidden sm:inline">{isArabic ? 'لوحة التحكم' : 'Dashboard'}</span>
            </Link>
          )}
          <button onClick={toggleTheme} className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface border border-border hover:bg-surfaceHover text-text transition">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <button 
            onClick={toggleLang} 
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-surface border border-border hover:bg-surfaceHover text-xs sm:text-sm"
            title={isArabic ? 'Switch to English' : 'التحويل إلى العربية'}
          >
            <Languages size={14}/> <span className="font-bold">{i18n.language === 'ar' ? 'EN' : 'AR'}</span>
          </button>
          <UserMenu />
        </div>
      </header>

      <main className="relative z-10 w-full px-4 sm:px-8 lg:px-12 xl:px-16 pt-2 sm:pt-4 pb-16">
        <div className="flex flex-col items-center justify-center mb-5 sm:mb-6 animate-fadeIn">
          {/* Main Title Text */}
          <h1 className="relative text-3xl sm:text-5xl md:text-6xl font-black tracking-tighter mb-1.5 sm:mb-2 text-center">
            {/* Background Glow */}
            <span className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-blue-500/20 blur-2xl z-0 rounded-full"></span>
            
            {/* Text Surface */}
            <span className="relative z-10 bg-clip-text text-transparent bg-gradient-to-b from-white via-gray-100 to-gray-400 drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
              ARN MEDIA SERVER
            </span>
          </h1>
          
          {/* Subtitle */}
          <div className="relative">
            <p className="relative z-10 text-xs sm:text-sm md:text-base text-blue-400 font-bold drop-shadow-[0_0_12px_rgba(59,130,246,0.9)] tracking-[0.35em] sm:tracking-[0.5em] uppercase ms-1 sm:ms-2">
              By-ABDOU NASSAR
            </p>
            {/* Soft underline glow */}
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3/4 h-[2px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent blur-[1px]"></div>
          </div>
        </div>

        {/* Customization Toolbar & Size Selector */}
        {!isLoading && !isEmpty && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-6 px-1 animate-fadeIn">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCustomizingCards(prev => !prev)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition backdrop-blur-md border shadow-sm ${
                  isCustomizingCards 
                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 shadow-amber-500/20 ring-2 ring-amber-500/20' 
                    : 'bg-surface/80 hover:bg-surface border-border text-text/90 hover:text-text'
                }`}
              >
                <SlidersHorizontal size={14} className={isCustomizingCards ? 'text-amber-400' : ''} />
                <span>{isCustomizingCards ? t('landing.doneCustomizing') : t('landing.customizeGrid')}</span>
              </button>

              {isCustomizingCards && (
                <button
                  type="button"
                  onClick={() => resetHomeLibrariesOrder()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition"
                  title={t('landing.resetDefaultOrder')}
                >
                  <RotateCcw size={12} />
                  <span className="hidden sm:inline">{t('landing.resetDefaultOrder')}</span>
                </button>
              )}
            </div>

            {/* Card Size Selector (Small / Medium / Large) */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-surface/80 border border-border backdrop-blur-md shadow-sm">
              <span className="text-[11px] font-bold text-muted px-2 hidden sm:inline">
                {t('landing.cardSize')}:
              </span>
              {[
                { id: 'small', label: t('landing.cardSizeSmall') },
                { id: 'medium', label: t('landing.cardSizeMedium') },
                { id: 'large', label: t('landing.cardSizeLarge') },
              ].map(size => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => setHomeLibraryCardSize(size.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    homeLibraryCardSize === size.id
                      ? 'bg-white text-black shadow font-bold'
                      : 'text-muted hover:text-text hover:bg-white/10'
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Customization active hint banner */}
        {!isLoading && isCustomizingCards && (
          <div className="flex items-center justify-between gap-3 p-3 sm:p-3.5 mb-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm animate-fadeIn backdrop-blur-md">
            <div className="flex items-center gap-2">
              <GripVertical size={16} className="text-amber-400 shrink-0" />
              <span>{t('landing.reorderTip')}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsCustomizingCards(false)}
              className="px-3.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition shrink-0"
            >
              {t('landing.doneCustomizing')}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-60 sm:h-[260px] lg:h-[275px] rounded-2xl sm:rounded-[22px] bg-surface/50 animate-pulse border border-border/20" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="text-center py-16 bg-surface/30 backdrop-blur rounded-2xl sm:rounded-[22px] border border-border/30 p-8">
            <FolderPlus size={44} className="mx-auto text-muted mb-3 opacity-50" />
            <h2 className="text-lg font-bold mb-2">{isArabic ? 'لا توجد مكتبات مضافة حتى الآن' : 'No libraries added yet'}</h2>
            <p className="text-muted mb-5 text-xs sm:text-sm">{isArabic ? 'قم بالدخول إلى لوحة التحكم لإضافة مجلداتك الأولى وبدء الفحص' : 'Go to Dashboard to add your folders and start scanning'}</p>
            <Link to="/dashboard?tab=libraries" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primaryMovies text-white font-semibold text-xs sm:text-sm hover:brightness-110 transition shadow-lg">
              {isArabic ? 'إضافة مكتبة الآن' : 'Add Library Now'}
            </Link>
          </div>
        ) : (
          <div className={sizeConfig.gridCols}>
            {unifiedItems.map((item, index) => {
              // 1. Live TV Card
              if (item.itemType === 'live_tv') {
                const liveMeta = {
                  Icon: Tv,
                  to: '/live',
                  bgGradient: 'from-red-600/30 via-rose-600/15 to-transparent',
                  borderColor: 'hover:border-red-500/60',
                  iconBg: 'bg-gradient-to-tr from-red-600 to-rose-500 text-white shadow-red-600/30',
                  badgeBg: 'bg-red-600 text-white',
                  countText: isArabic ? 'بث حي ومباشر' : 'LIVE 24/7',
                };

                return (
                  <Link
                    key="live_tv"
                    to="/live"
                    onClick={(e) => { if (isCustomizingCards) e.preventDefault(); }}
                    draggable={isCustomizingCards}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`group relative rounded-2xl sm:rounded-[22px] overflow-hidden bg-surface border ${
                      isCustomizingCards ? 'border-amber-400/60 ring-2 ring-amber-500/20 shadow-amber-500/20' : 'border-red-500/30 hover:border-red-500/70'
                    } ${draggedIndex === index ? 'opacity-40 scale-95 border-dashed border-amber-400' : ''} shadow-xl hover:shadow-[0_0_30px_rgba(239,68,68,0.25)] transition-all duration-180 ease-out hover:scale-[1.02] transform-gpu will-change-transform flex flex-col justify-between ${sizeConfig.minHeight}`}
                  >
                    {/* Overlapping TV Channel Posters Collage */}
                    <LibraryCardCollage
                      covers={item.covers}
                      type="channels"
                      meta={liveMeta}
                      isArabic={isArabic}
                    />

                    {/* Reorder controls bar on card */}
                    {isCustomizingCards && (
                      <div 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        className="relative z-30 flex items-center justify-between gap-1 p-1 mb-2 rounded-xl bg-black/85 backdrop-blur-xl border border-amber-400/50 shadow-lg text-amber-300"
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMoveItem(index, isArabic ? 1 : -1); }}
                          disabled={isArabic ? index === unifiedItems.length - 1 : index === 0}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center transition"
                          title={isArabic ? 'تحريك لليمين' : 'Move Left'}
                        >
                          <ChevronLeft size={16} className={isArabic ? 'rotate-180' : ''} />
                        </button>

                        <div className="flex items-center gap-1.5 text-[11px] font-bold cursor-grab active:cursor-grabbing px-2 py-0.5">
                          <GripVertical size={14} className="text-amber-400" />
                          <span className="select-none">{index + 1}</span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMoveItem(index, isArabic ? -1 : 1); }}
                          disabled={isArabic ? index === 0 : index === unifiedItems.length - 1}
                          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center transition"
                          title={isArabic ? 'تحريك لليسار' : 'Move Right'}
                        >
                          <ChevronRight size={16} className={isArabic ? 'rotate-180' : ''} />
                        </button>
                      </div>
                    )}

                    {/* Top Bar: Icon & Live Badge */}
                    <div className="relative z-20 flex items-start justify-between gap-2">
                      <div className={`${sizeConfig.iconWrap} bg-gradient-to-tr from-red-600 to-rose-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/20`}>
                        <Tv size={sizeConfig.iconSize} />
                      </div>

                      <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* Customize Live TV channel posters button */}
                        {isAdmin() && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowLiveTvCoversModal(true);
                            }}
                            className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md border border-white/20 hover:border-red-500/70 text-white/80 hover:text-red-400 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                            title={isArabic ? 'تخصيص صور قنوات البث المباشر' : 'Customize Live TV channel posters'}
                          >
                            <Sparkles size={14} className="text-red-400" />
                          </button>
                        )}

                        <span className={`rounded-full font-black uppercase tracking-wider bg-red-600 text-white shadow-md shadow-red-600/50 flex items-center gap-1.5 animate-pulse ${sizeConfig.badgeSize}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                          {isArabic ? 'مباشر' : 'LIVE'}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Bar: Title & Action Button */}
                    <div className="relative z-20 mt-auto flex items-center justify-between gap-3">
                      <h2 className={`${sizeConfig.titleSize} text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.95)] group-hover:text-red-400 transition-colors truncate`}>
                        {isArabic ? 'البث المباشر' : 'Live TV'}
                      </h2>
                      <span className={`inline-flex items-center justify-center rounded-full bg-red-600 text-white group-hover:bg-red-500 shadow-xl group-hover:scale-110 transition-all duration-180 ease-out shrink-0 ${sizeConfig.arrowBtn}`}>
                        <ArrowRight size={sizeConfig.arrowSize} className={isArabic ? 'rotate-180' : ''} />
                      </span>
                    </div>
                  </Link>
                );
              }

              // 2. Library Card
              const lib = item;
              const meta = getLibraryMeta(lib, i18n);
              const IconComp = meta.Icon;
              return (
                <Link
                  key={lib.id}
                  to={meta.to}
                  onClick={(e) => { if (isCustomizingCards) e.preventDefault(); }}
                  draggable={isCustomizingCards}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`group relative rounded-2xl sm:rounded-[22px] overflow-hidden bg-surface border ${
                    isCustomizingCards ? 'border-amber-400/60 ring-2 ring-amber-500/20 shadow-amber-500/20' : `border-border/40 ${meta.borderColor}`
                  } ${draggedIndex === index ? 'opacity-40 scale-95 border-dashed border-amber-400' : ''} shadow-xl hover:shadow-2xl transition-all duration-180 ease-out hover:scale-[1.02] transform-gpu will-change-transform flex flex-col justify-between ${sizeConfig.minHeight}`}
                >
                  {/* Overlapping Poster Collage Background */}
                  <LibraryCardCollage
                    covers={lib.covers}
                    type={lib.type}
                    meta={meta}
                    isArabic={isArabic}
                  />

                  {/* Reorder controls bar on card */}
                  {isCustomizingCards && (
                    <div 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      className="relative z-30 flex items-center justify-between gap-1 p-1 mb-2 rounded-xl bg-black/85 backdrop-blur-xl border border-amber-400/50 shadow-lg text-amber-300"
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMoveItem(index, isArabic ? 1 : -1); }}
                        disabled={isArabic ? index === unifiedItems.length - 1 : index === 0}
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center transition"
                        title={isArabic ? 'تحريك لليمين' : 'Move Left'}
                      >
                        <ChevronLeft size={16} className={isArabic ? 'rotate-180' : ''} />
                      </button>

                      <div className="flex items-center gap-1.5 text-[11px] font-bold cursor-grab active:cursor-grabbing px-2 py-0.5">
                        <GripVertical size={14} className="text-amber-400" />
                        <span className="select-none">{index + 1}</span>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleMoveItem(index, isArabic ? -1 : 1); }}
                        disabled={isArabic ? index === 0 : index === unifiedItems.length - 1}
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-25 disabled:pointer-events-none flex items-center justify-center transition"
                        title={isArabic ? 'تحريك لليسار' : 'Move Right'}
                      >
                        <ChevronRight size={16} className={isArabic ? 'rotate-180' : ''} />
                      </button>
                    </div>
                  )}
                  
                  {/* Top Bar: Icon & Actions */}
                  <div className="relative z-20 flex items-start justify-between gap-2">
                    <div className={`${sizeConfig.iconWrap} ${meta.iconBg} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 ring-1 ring-white/20`}>
                      <IconComp size={sizeConfig.iconSize} />
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {/* Customize background covers button */}
                      {isAdmin() && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingLibrary(lib);
                          }}
                          className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/75 backdrop-blur-md border border-white/20 hover:border-emerald-500/70 text-white/80 hover:text-emerald-400 flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-lg"
                          title={isArabic ? 'تخصيص صور الغلاف للخلفية' : 'Customize background covers'}
                        >
                          <Sparkles size={14} className="text-emerald-400" />
                        </button>
                      )}

                      {/* Counter Badge */}
                      <span className={`rounded-full font-semibold bg-surface/90 border border-border/80 text-text/90 shadow-md backdrop-blur-md ${sizeConfig.badgeSize}`}>
                        {meta.countText}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Bar: Title & Action Button */}
                  <div className="relative z-20 mt-3 flex items-center justify-between gap-3">
                    <h2 className={`${sizeConfig.titleSize} text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.95)] group-hover:text-white transition-colors truncate`}>
                      {localizeLibraryName(lib.name, isArabic)}
                    </h2>
                    <span className={`inline-flex items-center justify-center rounded-full ${meta.badgeBg} group-hover:brightness-110 shadow-xl group-hover:scale-110 transition-all duration-180 ease-out shrink-0 ${sizeConfig.arrowBtn}`}>
                      <ArrowRight size={sizeConfig.arrowSize} className={isArabic ? 'rotate-180' : ''} />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        


        {/* Dynamic Rendered Sections */}
        {currentSections.filter(s => s.enabled).map(s => renderSection(s.id))}

        <div className="mt-16 border-t border-border/50 pt-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-start">
            <h3 className="font-bold text-lg text-text mb-1">ARN Technology</h3>
            <p className="text-sm text-muted">{isArabic ? 'جميع الحقوق محفوظة © 2026' : 'All rights reserved © 2026'}</p>
            <p className="text-sm mt-1">{isArabic ? 'تطوير وبرمجة:' : 'Developed by:'} <span className="text-[#10b981] font-semibold">{isArabic ? 'عبده رجب نصار' : 'Abdou Ragab Nassar'}</span></p>
          </div>
          
          <div className="flex items-center gap-4">
            <a href="https://wa.me/201556710314" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted hover:text-text hover:bg-[#1e293b] hover:border-[#10b981] transition shadow-md group" title="WhatsApp">
              <MessageCircle size={20} className="group-hover:scale-110 transition" />
            </a>
            <a href="https://t.me/ABDOURNASSAR95" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted hover:text-text hover:bg-[#1e293b] hover:border-[#3b82f6] transition shadow-md group" title="Telegram">
              <Send size={20} className="group-hover:scale-110 transition" />
            </a>
            <a href="https://www.facebook.com/abdouragab.nassar" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted hover:text-text hover:bg-[#1e293b] hover:border-[#3b82f6] transition shadow-md group" title="Facebook">
              <Facebook size={20} className="group-hover:scale-110 transition" />
            </a>
            <a href="https://m.me/abdouragab.nassar" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted hover:text-text hover:bg-[#1e293b] hover:border-[#8b5cf6] transition shadow-md group" title="Messenger">
              <Ghost size={20} className="group-hover:scale-110 transition" />
            </a>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-muted/50">
          <p>localhost only • Direct Play • No transcoding</p>
        </div>
      </main>

      {/* Modal to customize library background covers */}
      <EditLibraryCoversModal
        library={editingLibrary}
        isOpen={Boolean(editingLibrary)}
        onClose={() => setEditingLibrary(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['landing'] });
        }}
      />

      {/* Modal to customize Live TV channel covers */}
      <EditLiveTvCoversModal
        isOpen={showLiveTvCoversModal}
        onClose={() => setShowLiveTvCoversModal(false)}
      />

      {/* Floating Glassmorphic QR Code Modal for Phone Connection */}
      <ServerQrModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
      />
    </div>
  );
}
