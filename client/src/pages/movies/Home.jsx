import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import TopBar from '../../components/shared/TopBar';
import { MovieCard } from '../../components/shared/Card';
import GlassCarousel from '../../components/shared/GlassCarousel';
import ContinueWatchingHub from '../../components/shared/ContinueWatchingHub';
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
  const { data, isLoading } = useQuery({ 
    queryKey: ['movies-home'], 
    queryFn: fetchMoviesHome,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });
  const { homeSectionsOrder = ['continueWatching', 'recentlyAdded', 'collections', 'movies', 'series'] } = useSettingsStore();

  if (isLoading) return <div className="min-h-screen bg-bg"><TopBar variant="movies"/><div className="flex items-center justify-center h-[60vh]"><Spinner/></div></div>;

  const isEmpty = !data?.movies?.length && !data?.recentlyAdded?.length && !data?.series?.length && !data?.continueWatching?.length;

  const renderSection = (key) => {
    switch (key) {
      case 'continueWatching':
        if (!data?.continueWatching?.length) return null;
        return <ContinueWatchingHub key="continueWatching" items={data.continueWatching} />;
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
