import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  Search,
  Disc3,
  Disc,
  Calendar,
  Clock,
  LayoutGrid,
  List,
  Play,
  ArrowDownAZ,
  ArrowUpZA,
  Sparkles
} from 'lucide-react';
import TopBar from '../../components/shared/TopBar';
import Spinner from '../../components/shared/Spinner';
import { fetchAlbums } from '../../api/client';
import { useSettingsStore } from '../../store/useSettingsStore';

export default function Albums() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [search, setSearch] = useState('');

  const {
    albumsSortKey = 'year',
    albumsSortOrder = 'desc',
    albumsViewMode = 'grid',
    cardMinSize = 180,
    setAlbumsSort,
    setAlbumsViewMode
  } = useSettingsStore();

  const sortKey = albumsSortKey;
  const sortOrder = albumsSortOrder;
  const viewMode = albumsViewMode;

  const { data: albums = [], isLoading } = useQuery({
    queryKey: ['all-albums', sortKey, sortOrder],
    queryFn: () => fetchAlbums({ sort: sortKey, order: sortOrder, limit: 500 })
  });

  const handleSortToggle = (key) => {
    if (sortKey === key) {
      setAlbumsSort(key, sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setAlbumsSort(key, key === 'name' ? 'asc' : 'desc');
    }
  };

  const filteredAndSortedAlbums = useMemo(() => {
    let list = [...albums];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(al =>
        al.title.toLowerCase().includes(q) ||
        (al.artistName && al.artistName.toLowerCase().includes(q))
      );
    }

    const isDesc = sortOrder === 'desc';
    list.sort((x, y) => {
      if (sortKey === 'year') {
        const yX = x.year || (isDesc ? -Infinity : Infinity);
        const yY = y.year || (isDesc ? -Infinity : Infinity);
        if (yX !== yY) return isDesc ? yY - yX : yX - yY;
        return x.title.localeCompare(y.title, 'ar');
      }
      if (sortKey === 'name' || sortKey === 'title') {
        const comp = x.title.localeCompare(y.title, 'ar', { sensitivity: 'base' });
        return isDesc ? -comp : comp;
      }
      // added_at or default
      const dX = new Date(x.added_at || 0).getTime();
      const dY = new Date(y.added_at || 0).getTime();
      return isDesc ? dY - dX : dX - dY;
    });

    return list;
  }, [albums, search, sortKey, sortOrder]);

  return (
    <div className="min-h-screen bg-bg text-text pb-24 select-none">
      <TopBar variant="music" />

      <main className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-6">
        {/* Header Section */}
        <div className="flex flex-col gap-5 mb-8 pb-6 border-b border-border/80">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primaryMusic/30 to-primaryMusic/10 border border-primaryMusic/40 flex items-center justify-center text-primaryMusic shadow-lg shadow-primaryMusic/10">
                <Disc3 size={22} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {isRtl ? 'جميع الألبومات' : 'All Albums'}
                </h1>
                <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primaryMusic animate-pulse"></span>
                  <span>{albums.length} {isRtl ? 'ألبوماً مسجلاً في المكتبة' : 'albums in library'}</span>
                </p>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-muted pointer-events-none start-3.5" />
              <input
                type="text"
                placeholder={isRtl ? 'ابحث عن ألبوم أو فنان...' : 'Search albums or artists...'}
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

              {/* Sort by Recently Added */}
              <button
                onClick={() => handleSortToggle('added_at')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all border ${
                  sortKey === 'added_at'
                    ? 'bg-primaryMusic/15 border-primaryMusic text-primaryMusic shadow-sm shadow-primaryMusic/20'
                    : 'bg-surface/80 border-border text-muted hover:text-text hover:border-border/80'
                }`}
              >
                <Clock size={14} />
                <span>{isRtl ? 'المضاف حديثاً' : 'Recently Added'}</span>
              </button>
            </div>

            {/* View Mode (Grid / List) */}
            <div className="flex items-center bg-surface/90 border border-border rounded-xl p-1 shadow-inner">
              <button
                onClick={() => setAlbumsViewMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  viewMode === 'grid'
                    ? 'bg-primaryMusic text-black shadow font-bold'
                    : 'text-muted hover:text-text'
                }`}
                title={isRtl ? 'عرض كبطاقات مربعة' : 'Grid view'}
              >
                <LayoutGrid size={15} />
                <span className="hidden sm:inline">{isRtl ? 'مربعات' : 'Grid'}</span>
              </button>

              <button
                onClick={() => setAlbumsViewMode('list')}
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
            <span className="text-xs text-muted">{isRtl ? 'جاري تحميل الألبومات...' : 'Loading albums...'}</span>
          </div>
        ) : filteredAndSortedAlbums.length === 0 ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-surface/40 border border-dashed border-border my-6">
            <Disc size={36} className="text-muted mb-3 opacity-50" />
            <h3 className="text-base font-semibold mb-1">
              {isRtl ? 'لم يتم العثور على أي ألبوم' : 'No albums found'}
            </h3>
            <p className="text-xs text-muted max-w-sm">
              {search
                ? (isRtl ? `لا توجد نتائج مطابقة لـ "${search}"` : `No results matching "${search}"`)
                : (isRtl ? 'لم تتم إضافة ألبومات بعد.' : 'No albums have been added yet.')}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          /* Square Album Cards Grid with Smooth Soft Edges (aspect-square rounded-2xl) */
          <div 
            className="grid gap-4 sm:gap-6"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))` }}
          >
            {filteredAndSortedAlbums.map(album => (
              <Link
                key={album.id}
                to={`/music/album/${album.id}`}
                className="group relative flex flex-col p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-surface/60 backdrop-blur-sm hover:bg-slate-50 dark:hover:bg-surface/80 border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-border/60 transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-xl hover:shadow-black/10 dark:shadow-black/60 text-center"
              >
                {/* Square Album Cover with Smooth Soft Corners */}
                <div className="relative aspect-square w-full rounded-xl md:rounded-2xl overflow-hidden bg-surfaceHover shadow-md group-hover:shadow-xl transition-all duration-300">
                  {album.cover ? (
                    <img
                      src={album.cover}
                      alt={album.title}
                      className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                      loading="lazy"
                    />
                  ) : (
                    /* Stylized Vinyl Disc Cover Fallback */
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#1b222a] to-[#0f141a] p-4 text-center relative overflow-hidden">
                      <div className="w-16 h-16 rounded-full border-4 border-tx/10 flex items-center justify-center bg-black/40 mb-2 shadow-inner">
                        <Disc3 size={28} className="text-primaryMusic/70" />
                      </div>
                      <span className="text-xs font-semibold text-tx/80 line-clamp-1">{album.title}</span>
                    </div>
                  )}

                  {/* Top Badges (Production Year) */}
                  {album.year && (
                    <div className="absolute top-2.5 inset-x-2.5 flex justify-end pointer-events-none">
                      <span className="px-2 py-0.5 rounded-md bg-white/90 dark:bg-black/70 backdrop-blur-md text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border border-slate-200/80 dark:border-emerald-400/20 shadow-sm">
                        {album.year}
                      </span>
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
                </div>

                {/* Info Below Cover */}
                <div className="mt-3 min-w-0 text-center">
                  <div className="font-bold text-sm text-text group-hover:text-primaryMusic transition-colors truncate">
                    {album.title}
                  </div>
                  {album.artistName && (
                    <div className="text-xs text-muted truncate mt-0.5">
                      {album.artistName}
                    </div>
                  )}
                  <div className="text-[11px] text-muted/80 flex items-center justify-center gap-1.5 mt-1">
                    {album.tracksCount > 0 && (
                      <span>{album.tracksCount} {isRtl ? 'أغنية' : 'tracks'}</span>
                    )}
                    {album.tracksCount > 0 && album.year && <span>•</span>}
                    {album.year && (
                      <span className="text-emerald-600 dark:text-emerald-400/80 font-medium">{album.year}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* List View Mode */
          <div className="flex flex-col gap-2.5">
            {filteredAndSortedAlbums.map(album => (
              <Link
                key={album.id}
                to={`/music/album/${album.id}`}
                className="group flex items-center justify-between p-2.5 md:p-3 rounded-2xl bg-surface/30 hover:bg-surface/80 border border-transparent hover:border-border/30 transition-all duration-200"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Square Mini Cover */}
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-surfaceHover flex-shrink-0 relative shadow-sm">
                    {album.cover ? (
                      <img src={album.cover} alt={album.title} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primaryMusic bg-surface">
                        <Disc3 size={20} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-bold text-sm md:text-base text-text group-hover:text-primaryMusic transition-colors truncate">
                      {album.title}
                    </div>
                    <div className="text-xs text-muted mt-1 flex flex-wrap items-center gap-2">
                      {album.artistName && (
                        <span>{album.artistName}</span>
                      )}
                      {album.tracksCount > 0 && (
                        <>
                          <span>•</span>
                          <span>{album.tracksCount} {isRtl ? 'أغنية' : 'tracks'}</span>
                        </>
                      )}
                      {album.year && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-400/90 font-medium">{album.year}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-full bg-surfaceHover group-hover:bg-primaryMusic group-hover:text-black flex items-center justify-center transition-all flex-shrink-0 text-muted">
                  <Play size={15} fill="currentColor" className="ms-0.5" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
