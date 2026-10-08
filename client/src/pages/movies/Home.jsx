import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TopBar from '../../components/shared/TopBar';
import { MovieCard } from '../../components/shared/Card';
import GlassCarousel from '../../components/shared/GlassCarousel';
import { fetchMoviesHome } from '../../api/client';
import Spinner from '../../components/shared/Spinner';
import { Film, Settings, FolderPlus } from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';

function Row({ title, items, getTo, empty }) {
  if (!items || items.length === 0) return empty ? null : <div className="py-8 text-center text-muted text-sm">{empty || '—'}</div>;
  return (
    <GlassCarousel title={title} className="mb-8">
      {items.map(item => <MovieCard key={item.id} item={item} to={getTo(item)} />)}
    </GlassCarousel>
  );
}

export default function MoviesHome() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ['movies-home'], queryFn: fetchMoviesHome });
  const { homeSectionsOrder = ['continueWatching', 'recentlyAdded', 'collections', 'movies', 'series'] } = useSettingsStore();

  if (isLoading) return <div className="min-h-screen bg-bg"><TopBar variant="movies"/><div className="flex items-center justify-center h-[60vh]"><Spinner/></div></div>;

  const isEmpty = !data?.movies?.length && !data?.recentlyAdded?.length && !data?.series?.length && !data?.continueWatching?.length;

  const renderSection = (key) => {
    switch (key) {
      case 'continueWatching':
        if (!data?.continueWatching?.length) return null;
        return (
          <GlassCarousel key="continueWatching" title={t('common.continueWatching')} className="mb-8">
            {data.continueWatching.map(c => {
              const bgImage = c.backdrop || c.poster;
              return (
                <Link 
                  key={`${c.type}-${c.mediaId || c.seriesId || c.id}`} 
                  to={c.type === 'movie' ? `/watch/movie/${c.mediaId || c.id}?autoPlay=true` : `/watch/episode/${c.mediaId || c.episodeId}?autoPlay=true`} 
                  className="group relative flex-shrink-0 w-[280px] h-[160px] rounded-xl overflow-hidden bg-surface border border-border hover:border-primaryMovies/50 transition-colors shadow-lg flex flex-col justify-end"
                >
                  {bgImage && (
                    <div 
                      className="absolute inset-0 bg-cover bg-center group-hover:scale-105 transition-transform duration-500" 
                      style={{ backgroundImage: `url(${bgImage})` }} 
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
                  
                  <div className="relative p-4 z-10">
                    <div className="font-bold text-text truncate drop-shadow-md text-sm mb-1">{c.title}</div>
                    <div className="text-xs text-tx/70 font-medium">{Math.round(c.progress)}% watched</div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 z-20">
                    <div className="h-full bg-primaryMovies rounded-r-full shadow-[0_0_8px_rgba(229,9,20,0.8)]" style={{width: `${c.progress}%`}}/>
                  </div>
                </Link>
              );
            })}
          </GlassCarousel>
        );
      case 'recentlyAdded':
        return (
          <Row 
            key="recentlyAdded" 
            title={t('common.recentlyAdded')} 
            items={data?.recentlyAdded} 
            getTo={m => (m.media_type === 'series' || m.type === 'series') ? `/series/${m.id}` : `/movies/${m.id}`} 
          />
        );
      case 'collections':
        return <Row key="collections" title={t('common.collections')} items={data?.collections} getTo={c=>`/collections/${c.id}`} empty={null} />;
      case 'movies':
        return <Row key="movies" title={t('common.movies')} items={data?.movies} getTo={m=>`/movies/${m.id}`} />;
      case 'series':
        if (!data?.series?.length) return null;
        return (
          <GlassCarousel
            key="series"
            title={t('common.series')}
            className="mb-8"
            headerAction={<Link to="/series" className="text-xs text-muted hover:text-text transition-colors">{t('common.viewAll') || 'View all'}</Link>}
          >
            {data.series.map(s => (
              <MovieCard key={s.id} item={s} to={`/series/${s.id}`} />
            ))}
          </GlassCarousel>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-bg">
      <TopBar variant="movies" />
      <main className="w-full px-4 md:px-8 lg:px-12 py-6">
        {isEmpty ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-surface/60 border border-dashed border-border animate-fadeIn my-6">
            <div className="w-16 h-16 rounded-2xl bg-primaryMovies/20 border border-primaryMovies/30 flex items-center justify-center text-primaryMovies mb-4">
              <Film size={32} />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">{t('settings.emptyLibraryTitle')}</h2>
            <p className="text-sm text-muted max-w-md mb-6">{t('settings.emptyLibraryDesc')}</p>
            <Link
              to="/dashboard?tab=libraries"
              className="px-6 py-2.5 rounded-full bg-primaryMovies hover:brightness-110 text-white font-semibold text-xs flex items-center gap-2 transition shadow-lg"
            >
              <Settings size={15} />
              {t('settings.configureFolders')}
            </Link>
          </div>
        ) : (
          <>
            {homeSectionsOrder.map(sectionKey => renderSection(sectionKey))}
          </>
        )}
      </main>
    </div>
  );
}
