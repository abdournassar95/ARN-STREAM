import { useSearchParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { searchAll } from '../api/client';
import TopBar from '../components/shared/TopBar';
import Spinner from '../components/shared/Spinner';
import { useState } from 'react';

export default function Search() {
  const [params] = useSearchParams();
  const q = params.get('q') || '';
  const { t } = useTranslation();
  const [type, setType] = useState('all');
  const { data, isLoading } = useQuery({ queryKey: ['search', q, type], queryFn: ()=>searchAll(q, type), enabled: !!q });

  return (
    <div className="min-h-screen bg-bg relative">
      <TopBar variant={type === 'track' ? 'music' : 'movies'} />
      <div className="max-w-[1000px] mx-auto px-6 py-8 relative z-10">
        <h1 className="text-2xl font-bold mb-2">{t('common.search')}: "{q}"</h1>
        <div className="flex flex-wrap gap-2 mb-6">
          {['all', 'movie', 'series', 'track', 'artist'].map(tp => (
            <button 
              key={tp} 
              onClick={() => setType(tp)} 
              className={`px-4 py-1.5 rounded-full text-sm backdrop-blur-md transition-all ${
                type === tp 
                  ? 'bg-white text-black font-semibold shadow-[0_0_15px_rgba(255,255,255,0.4)]' 
                  : 'glass-panel text-muted hover:text-white'
              }`}
            >
              {t(`common.${tp}`) || tp}
            </button>
          ))}
        </div>
        {isLoading ? <div className="flex justify-center py-20"><Spinner /></div> : (
          <div className="grid gap-3">
            {data?.length === 0 && <div className="text-center text-muted py-10 glass-panel rounded-2xl">{t('common.noResults')}</div>}
            {data?.map(item => (
              <Link 
                key={`${item.type}-${item.id}`} 
                to={
                  item.type === 'movie' ? `/movies/${item.id}` :
                  item.type === 'series' ? `/series/${item.id}` :
                  item.type === 'track' ? `/music/album/${item.album_id || ''}` :
                  item.type === 'artist' ? `/music/artist/${item.id}` : '#'
                } 
                className="flex items-center gap-4 p-3 rounded-2xl glass-panel glass-panel-hover"
              >
                {item.poster ? (
                  <img src={item.poster} alt={item.title || "Poster"} className="w-12 h-12 rounded object-cover shadow-md" />
                ) : (
                  <div className={`w-12 h-12 rounded flex items-center justify-center text-xs font-bold shadow-md ${
                    item.type === 'movie' ? 'bg-primaryMovies text-white' : 
                    item.type === 'track' ? 'bg-primaryMusic text-black' : 'bg-surfaceHover'
                  }`}>
                    {item.type[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-lg text-white">{item.title} {item.year ? <span className="text-sm font-normal text-muted">({item.year})</span> : ''}</div>
                  <div className="text-xs text-muted/80">{item.type} {item.artistName ? `• ${item.artistName}` : ''} {item.albumTitle ? `• ${item.albumTitle}` : ''}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
