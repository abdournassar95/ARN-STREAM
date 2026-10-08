import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Search,
  Music2,
  Users,
  Calendar,
  Disc3,
  LayoutGrid,
  List,
  Play,
  ArrowUpDown,
  Sparkles,
  ArrowDownAZ,
  ArrowUpZA,
  Edit2
} from 'lucide-react';
import TopBar from '../../components/shared/TopBar';
import Spinner from '../../components/shared/Spinner';
import { fetchArtists } from '../../api/client';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import EditArtistModal from '../../components/music/EditArtistModal';

export default function Artists() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [search, setSearch] = useState('');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const isAdmin = useAuthStore(s => s.isAdmin);

  const {
    artistsSortKey = 'name',
    artistsSortOrder = 'asc',
    artistsViewMode = 'grid',
    cardMinSize = 180,
    setArtistsSort,
    setArtistsViewMode
  } = useSettingsStore();

  const sortKey = artistsSortKey;
  const sortOrder = artistsSortOrder;
  const viewMode = artistsViewMode;

  const { data: artists = [], isLoading } = useQuery({
    queryKey: ['all-artists', sortKey, sortOrder],
    queryFn: () => fetchArtists({ sort: sortKey, order: sortOrder, limit: 500 })
  });

  const handleSortToggle = (key) => {
    if (sortKey === key) {
      setArtistsSort(key, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Default directions for best UX
      setArtistsSort(key, key === 'year' || key === 'albums' ? 'desc' : 'asc');
    }
  };

  const filteredAndSortedArtists = useMemo(() => {
    let list = [...artists];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q));
    }

    const isDesc = sortOrder === 'desc';
    list.sort((x, y) => {
      if (sortKey === 'year') {
        const yX = x.year || (isDesc ? -Infinity : Infinity);
        const yY = y.year || (isDesc ? -Infinity : Infinity);
        if (yX !== yY) return isDesc ? yY - yX : yX - yY;
        return x.name.localeCompare(y.name, 'ar');
      }
      if (sortKey === 'albums') {
        if (x.albumsCount !== y.albumsCount) {
          return isDesc ? y.albumsCount - x.albumsCount : x.albumsCount - y.albumsCount;
        }
        return x.name.localeCompare(y.name, 'ar');
      }
      // default: name
      const comp = x.name.localeCompare(y.name, 'ar', { sensitivity: 'base' });
      return isDesc ? -comp : comp;
    });

    return list;
  }, [artists, search, sortKey, sortOrder]);

  return (
    <div className="min-h-screen bg-bg text-text pb-24 select-none">
      <TopBar variant="music" />

      <main className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-6">
        {/* Header Section */}
        <div className="flex flex-col gap-5 mb-8 pb-6 border-b border-border/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primaryMusic/30 to-primaryMusic/10 border border-primaryMusic/40 flex items-center justify-center text-primaryMusic shadow-lg shadow-primaryMusic/10">
                <Users size={22} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {isRtl ? 'جميع الفنانين' : 'All Artists'}
                </h1>
                <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primaryMusic animate-pulse"></span>
                  <span>{artists.length} {isRtl ? 'فناناً مسجلاً في المكتبة' : 'artists in library'}</span>
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none start-3.5" />
              <input
                type="text"
                placeholder={isRtl ? 'ابحث عن فنان...' : 'Search artists...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full py-2.5 rounded-xl bg-surface/90 border border-border text-sm text-text placeholder-muted focus:outline-none focus:border-primaryMusic focus:ring-1 focus:ring-primaryMusic/50 transition-all ps-10 pe-8"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-surfaceHover text-muted hover:text-text text-xs end-2.5"
                  title={isRtl ? 'مسح البحث' : 'Clear search'}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action & Filter Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            {/* Sort Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted font-medium me-1">
                {isRtl ? 'الترتيب حسب:' : 'Sort by:'}
              </span>

              {/* Sort by Name */}
              <button
                onClick={() => handleSortToggle('name')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border ${
                  sortKey === 'name'
                    ? 'bg-primaryMusic/15 border-primaryMusic text-primaryMusic shadow-sm shadow-primaryMusic/20'
                    : 'bg-surface/80 border-border text-muted hover:text-text hover:border-border/80'
                }`}
              >
                {sortKey === 'name' && sortOrder === 'asc' ? <ArrowDownAZ size={14} /> : <ArrowUpZA size={14} />}
                <span>{isRtl ? 'الاسم' : 'Name'}</span>
                {sortKey === 'name' && (
                  <span className="text-[10px] opacity-75 font-mono">
                    ({sortOrder === 'asc' ? (isRtl ? 'أ-ي' : 'A-Z') : (isRtl ? 'ي-أ' : 'Z-A')})
                  </span>
                )}
              </button>

              {/* Sort by Production Year */}
              <button
                onClick={() => handleSortToggle('year')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border ${
                  sortKey === 'year'
                    ? 'bg-primaryMusic/15 border-primaryMusic text-primaryMusic shadow-sm shadow-primaryMusic/20'
                    : 'bg-surface/80 border-border text-muted hover:text-text hover:border-border/80'
                }`}
              >
                <Calendar size={14} />
                <span>{isRtl ? 'سنة الإنتاج' : 'Release Year'}</span>
                {sortKey === 'year' && (
                  <span className="text-[10px] opacity-75">
                    ({sortOrder === 'desc' ? (isRtl ? 'الأحدث' : 'Newest') : (isRtl ? 'الأقدم' : 'Oldest')})
                  </span>
                )}
              </button>

              {/* Sort by Albums Count */}
              <button
                onClick={() => handleSortToggle('albums')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border ${
                  sortKey === 'albums'
                    ? 'bg-primaryMusic/15 border-primaryMusic text-primaryMusic shadow-sm shadow-primaryMusic/20'
                    : 'bg-surface/80 border-border text-muted hover:text-text hover:border-border/80'
                }`}
              >
                <Disc3 size={14} />
                <span>{isRtl ? 'عدد الألبومات' : 'Albums Count'}</span>
                {sortKey === 'albums' && (
                  <span className="text-[10px] opacity-75">
                    ({sortOrder === 'desc' ? (isRtl ? 'الأكثر' : 'Most') : (isRtl ? 'الأقل' : 'Least')})
                  </span>
                )}
              </button>
            </div>

            {/* View Mode (Grid / List) */}
            <div className="flex items-center bg-surface/90 border border-border rounded-xl p-1 shadow-inner">
              <button
                onClick={() => setArtistsViewMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-primaryMusic text-black shadow font-bold'
                    : 'text-muted hover:text-text'
                }`}
                title={isRtl ? 'عرض كبوسترات' : 'Grid view'}
              >
                <LayoutGrid size={15} />
                <span className="hidden sm:inline">{isRtl ? 'بوسترات' : 'Posters'}</span>
              </button>

              <button
                onClick={() => setArtistsViewMode('list')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-primaryMusic text-black shadow font-bold'
                    : 'text-muted hover:text-text'
                }`}
                title={isRtl ? 'عرض كقائمة' : 'List view'}
              >
                <List size={15} />
                <span className="hidden sm:inline">{isRtl ? 'قائمة' : 'List'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-28 gap-3">
            <Spinner />
            <span className="text-xs text-muted">{isRtl ? 'جاري تحميل الفنانين...' : 'Loading artists...'}</span>
          </div>
        ) : filteredAndSortedArtists.length === 0 ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-surface/40 border border-dashed border-border my-6">
            <Music2 size={36} className="text-muted mb-3 opacity-50" />
            <h3 className="text-base font-semibold mb-1">
              {isRtl ? 'لم يتم العثور على أي فنان' : 'No artists found'}
            </h3>
            <p className="text-xs text-muted max-w-sm">
              {search
                ? (isRtl ? `لا توجد نتائج مطابقة لـ "${search}"` : `No results matching "${search}"`)
                : (isRtl ? 'لم تتم إضافة فنانين بعد.' : 'No artists have been added yet.')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Square Cards Grid like Albums (aspect-square) */
          <div 
            className="grid gap-4 sm:gap-6"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))` }}
          >
            {filteredAndSortedArtists.map(artist => {
              const displayYear = artist.year || artist.maxYear || (artist.minYear ? `${artist.minYear}` : null);

              return (
                <Link
                  key={artist.id}
                  to={`/music/artist/${artist.id}`}
                  className="group relative flex flex-col p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-surface/60 backdrop-blur-sm hover:bg-slate-50 dark:hover:bg-surface/80 border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-border/60 transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-xl hover:shadow-black/10 dark:shadow-black/60 text-center"
                >
                  {/* Square Image Container like Albums */}
                  <div className="relative aspect-square w-full rounded-xl md:rounded-2xl overflow-hidden bg-surfaceHover shadow-md group-hover:shadow-xl transition-all duration-300">
                    {(artist.image || artist.poster) ? (
                      <img
                        src={artist.image || artist.poster}
                        alt={artist.name}
                        className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                        loading="lazy"
                      />
                    ) : (
                      /* Elegant stylized fallback poster */
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface to-surfaceHover p-4 relative overflow-hidden">
                        <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-primaryMusic/10 blur-xl"></div>
                        <div className="w-16 h-16 rounded-full bg-primaryMusic/20 border border-primaryMusic/30 flex items-center justify-center text-3xl font-bold text-primaryMusic mb-2 shadow-inner">
                          {artist.name ? artist.name[0] : '♫'}
                        </div>
                        <span className="text-[11px] text-muted text-center line-clamp-1">{artist.name}</span>
                      </div>
                    )}

                    {/* Cinematic Light Reflection Sweep on hover (بدون أي تمويه) */}
                    <div className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out bg-gradient-to-r from-transparent via-white/25 to-transparent z-10" />

                    {/* Play Button Overlay on Hover: Crystal clear, NO blur */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10 pointer-events-none">
                      <div className="w-12 h-12 rounded-full bg-primaryMusic text-black flex items-center justify-center shadow-[0_8px_25px_rgba(16,185,129,0.55)] transform scale-75 group-hover:scale-100 transition-all duration-300">
                        <Play size={20} fill="black" className="ms-0.5" />
                      </div>
                    </div>

                    {/* Top Badges (Year of activity / albums) */}
                    <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none">
                      {displayYear ? (
                        <span className="px-2 py-0.5 rounded-md bg-white/90 dark:bg-black/70 backdrop-blur-md text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-slate-200/80 dark:border-emerald-400/20 shadow-sm">
                          {displayYear}
                        </span>
                      ) : <span />}

                      {artist.albumsCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-white/90 dark:bg-black/70 backdrop-blur-md text-[11px] font-medium text-slate-700 dark:text-tx/90 border border-slate-200/80 dark:border-tx/10 shadow-sm flex items-center gap-1">
                          <Disc3 size={11} className="text-primaryMusic" />
                          <span>{artist.albumsCount}</span>
                        </span>
                      )}
                    </div>

                    {/* Bottom Actions Overlay on Hover */}
                    {isAdmin() && (
                      <div className="absolute bottom-2 end-2 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 flex items-center gap-1.5" onClick={e => e.preventDefault()}>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedArtist(artist);
                            setIsEditOpen(true);
                          }}
                          className="p-2 rounded-xl bg-black/75 hover:bg-primaryMusic text-white/90 hover:text-black backdrop-blur-md transition-all border border-white/10 shadow-md active:scale-95"
                          title={isRtl ? 'تعديل بيانات الفنان' : 'Edit Artist'}
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Info Below Image */}
                  <div className="mt-3 min-w-0 text-center">
                    <div className="font-bold text-sm text-text group-hover:text-primaryMusic transition-colors truncate">
                      {artist.name}
                    </div>
                    <div className="text-[11px] text-muted/80 flex items-center justify-center gap-1.5 mt-1">
                      {artist.tracksCount > 0 && (
                        <span>{artist.tracksCount} {isRtl ? 'أغنية' : 'tracks'}</span>
                      )}
                      {artist.tracksCount > 0 && displayYear && <span>•</span>}
                      {displayYear && (
                        <span className="text-emerald-600 dark:text-emerald-400/80 font-medium">{displayYear}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* List View Mode */
          <div className="flex flex-col gap-2.5">
            {filteredAndSortedArtists.map(artist => {
              const displayYear = artist.year || artist.maxYear || artist.minYear;
              return (
                <Link
                  key={artist.id}
                  to={`/music/artist/${artist.id}`}
                  className="group flex items-center justify-between p-2.5 md:p-3 rounded-2xl bg-surface/30 hover:bg-surface/80 border border-transparent hover:border-border/30 transition-all duration-200"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* Square Mini Thumbnail */}
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-surfaceHover flex-shrink-0 relative shadow-sm">
                      {(artist.image || artist.poster) ? (
                        <img src={artist.image || artist.poster} alt={artist.name} className="w-full h-full object-cover group-hover:scale-105 transition" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-primaryMusic bg-surface">
                          {artist.name[0]}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-bold text-sm md:text-base text-text group-hover:text-primaryMusic transition-colors truncate">
                        {artist.name}
                      </div>
                      <div className="text-xs text-muted mt-1 flex flex-wrap items-center gap-2">
                        {artist.albumsCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Disc3 size={13} className="text-primaryMusic" />
                            {artist.albumsCount} {isRtl ? 'ألبوم' : 'albums'}
                          </span>
                        )}
                        {artist.tracksCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{artist.tracksCount} {isRtl ? 'أغنية' : 'tracks'}</span>
                          </>
                        )}
                        {displayYear && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400/90">{displayYear}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isAdmin() && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedArtist(artist);
                          setIsEditOpen(true);
                        }}
                        className="p-2 rounded-xl bg-surfaceHover hover:bg-primaryMusic text-muted hover:text-black transition-all"
                        title={isRtl ? 'تعديل بيانات الفنان' : 'Edit Artist'}
                      >
                        <Edit2 size={15} />
                      </button>
                    )}
                    <div className="w-9 h-9 rounded-full bg-surfaceHover group-hover:bg-primaryMusic group-hover:text-black flex items-center justify-center transition-all flex-shrink-0 text-muted">
                      <Play size={15} fill="currentColor" className="ms-0.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit Artist Modal */}
      <EditArtistModal
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedArtist(null);
        }}
        artist={selectedArtist}
      />
    </div>
  );
}
