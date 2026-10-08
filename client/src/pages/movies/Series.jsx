import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Search, Tv, Film, Play, Layers } from 'lucide-react';
import TopBar from '../../components/shared/TopBar';
import Spinner from '../../components/shared/Spinner';
import { fetchSeriesList } from '../../api/client';
import { useSettingsStore } from '../../store/useSettingsStore';

export default function Series() {
  const { t, i18n } = useTranslation();
  const { cardMinSize = 180 } = useSettingsStore();
  const isRtl = i18n.language === 'ar';
  const [search, setSearch] = useState('');

  const { data: response, isLoading } = useQuery({
    queryKey: ['all-series'],
    queryFn: () => fetchSeriesList({ limit: 500 })
  });

  const seriesList = Array.isArray(response) ? response : (response?.data || []);

  const filteredSeries = useMemo(() => {
    if (!search.trim()) return seriesList;
    const q = search.toLowerCase();
    return seriesList.filter(s =>
      s.title.toLowerCase().includes(q) ||
      (s.plot && s.plot.toLowerCase().includes(q))
    );
  }, [seriesList, search]);

  return (
    <div className="min-h-screen bg-bg text-text pb-24">
      <TopBar variant="movies" />

      <main className="w-full px-4 sm:px-6 md:px-8 lg:px-10 py-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primaryMovies/20 border border-primaryMovies/30 flex items-center justify-center text-primaryMovies">
                <Tv size={22} />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  {isRtl ? 'جميع المسلسلات' : 'All Series'}
                </h1>
                <p className="text-xs text-muted mt-0.5">
                  {seriesList.length} {isRtl ? 'مسلسلاً متوفراً في مكتبتك' : 'series available in your library'}
                </p>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-80">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 text-muted start-3.5" />
            <input
              type="text"
              placeholder={isRtl ? 'ابحث عن مسلسل...' : 'Search series...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-2.5 rounded-xl bg-white dark:bg-surface border border-slate-200/80 dark:border-border text-sm text-text placeholder-muted focus:outline-none focus:border-primaryMovies shadow-sm transition-all ps-10 pe-4"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute top-1/2 -translate-y-1/2 text-xs text-muted hover:text-text end-3"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Spinner />
          </div>
        ) : filteredSeries.length === 0 ? (
          <div className="min-h-[40vh] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-white/60 dark:bg-surface/40 border border-dashed border-slate-200/80 dark:border-border my-6">
            <Tv size={36} className="text-muted mb-3 opacity-50" />
            <h3 className="text-base font-semibold mb-1">
              {isRtl ? 'لم يتم العثور على أي مسلسل' : 'No series found'}
            </h3>
            <p className="text-xs text-muted max-w-sm">
              {search
                ? (isRtl ? `لا توجد نتائج مطابقة لـ "${search}"` : `No results matching "${search}"`)
                : (isRtl ? 'لم تتم إضافة مسلسلات بعد.' : 'No series have been added yet.')}
            </p>
          </div>
        ) : (
          <div 
            className="grid gap-4 sm:gap-6"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${cardMinSize}px, 1fr))` }}
          >
            {filteredSeries.map(s => (
              <Link
                key={s.id}
                to={`/series/${s.id}`}
                className="group relative flex flex-col rounded-2xl overflow-hidden bg-white dark:bg-surface/60 backdrop-blur-sm border border-slate-200/80 dark:border-white/10 hover:border-slate-300 dark:hover:border-border/60 transition-all duration-300 hover:scale-[1.02] shadow-md hover:shadow-xl hover:shadow-black/10 dark:shadow-black/60"
              >
                {/* Poster Container */}
                <div className="aspect-[2/3] bg-surfaceHover relative overflow-hidden">
                  {s.poster ? (
                    <img
                      src={s.poster}
                      alt={s.title}
                      className="w-full h-full object-cover group-hover:scale-105 group-hover:brightness-105 transition-all duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted p-4 text-center bg-gradient-to-br from-surfaceHover to-surface">
                      <Tv size={32} className="opacity-30 mb-2" />
                      <span className="text-xs font-medium text-tx/80 line-clamp-2">{s.title}</span>
                    </div>
                  )}

                  {/* Gradient Overlay & Centered Play Button */}
                  <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/95 dark:bg-tx/20 backdrop-blur-md flex items-center justify-center text-primaryMovies dark:text-text shadow-md group-hover:scale-110 transition-transform">
                      <Play size={16} className="fill-current translate-x-0.5" />
                    </div>
                  </div>

                  {/* Episode Count Badge */}
                  {s.episodesCount > 0 && (
                    <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[11px] font-medium text-white border border-white/10 shadow">
                      {s.episodesCount} {isRtl ? 'حلقة' : 'ep'}
                    </div>
                  )}
                </div>

                {/* Info Container */}
                <div className="p-2.5 pb-3 flex flex-col flex-1 text-center">
                  <div className="font-semibold text-sm truncate text-text group-hover:text-primaryMovies transition-colors">
                    {s.title}
                  </div>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted mt-1">
                    {s.seasonsCount > 0 && (
                      <span className="flex items-center gap-1 font-medium">
                        <Layers size={12} />
                        {s.seasonsCount} {isRtl ? 'مواسم' : 'seasons'}
                      </span>
                    )}
                    {s.year && <span>• {s.year}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
