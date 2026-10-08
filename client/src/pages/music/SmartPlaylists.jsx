import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchSmartPlaylists } from '../../api/client';
import { usePlayerStore } from '../../store/usePlayerStore';
import TopBar from '../../components/shared/TopBar';
import { Play, Sparkles, Music2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function SmartListSection({ title, tracks, icon: Icon }) {
  const playTrack = usePlayerStore(s => s.playTrack);
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  if (!tracks || tracks.length === 0) return null;

  return (
    <div className="mb-12">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primaryMusic/10 flex items-center justify-center text-primaryMusic">
          <Icon size={20} />
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <button onClick={() => playTrack(tracks[0], tracks)} className="ms-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-surfaceHover hover:bg-tx/10 text-sm font-medium transition">
          <Play size={14} /> {isRtl ? 'تشغيل' : 'Play'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {tracks.slice(0, 5).map((track) => (
          <div key={track.id} className="group relative rounded-2xl bg-surface border border-tx/5 hover:bg-surfaceHover transition p-4">
            <div className="aspect-square rounded-xl overflow-hidden mb-3 relative bg-surfaceHover">
              {track.cover ? <img src={track.cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" /> : <div className="w-full h-full flex items-center justify-center text-muted/30"><Music2 size={32} /></div>}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => playTrack(track, tracks)} className="w-12 h-12 rounded-full bg-primaryMusic text-black flex items-center justify-center hover:scale-110 transition shadow-lg">
                  <Play size={20} fill="black" className="ms-1" />
                </button>
              </div>
            </div>
            <div className="font-semibold text-sm truncate">{track.title}</div>
            <div className="text-xs text-muted truncate mt-0.5">{track.artistName}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SmartPlaylists() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { data, isLoading } = useQuery({ queryKey: ['smart-playlists'], queryFn: fetchSmartPlaylists });
  const playTrack = usePlayerStore(s => s.playTrack);

  return (
    <div className="min-h-screen bg-bg pb-24">
      <TopBar variant="music" />
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center gap-4 mb-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Sparkles size={28} className="text-text" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black">{isRtl ? 'قوائم ذكية' : 'Smart Playlists'}</h1>
            <p className="text-muted mt-1">{isRtl ? 'قوائم تشغيل يتم إنشاؤها تلقائياً لك' : 'Auto-generated playlists just for you'}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (
          <div>
            <SmartListSection title={data?.hotThisMonth?.title} tracks={data?.hotThisMonth?.items} icon={Sparkles} />
            <SmartListSection title={data?.forgotten?.title} tracks={data?.forgotten?.items} icon={Clock} />
            <SmartListSection title={data?.sameGenre?.title} tracks={data?.sameGenre?.items} icon={Music2} />
            
            {/* Incomplete Albums */}
            {data?.incompleteAlbums?.items?.length > 0 && (
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primaryMusic/10 flex items-center justify-center text-primaryMusic">
                    <Music2 size={20} />
                  </div>
                  <h2 className="text-2xl font-bold">{data.incompleteAlbums.title}</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {data.incompleteAlbums.items.map((album) => (
                    <Link key={album.id} to={`/music/album/${album.id}`} className="group block rounded-2xl bg-surface border border-tx/5 hover:bg-surfaceHover transition p-4">
                      <div className="aspect-square rounded-xl overflow-hidden mb-3 relative bg-surfaceHover">
                        {album.cover ? <img src={album.cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-500" /> : <div className="w-full h-full flex items-center justify-center text-muted/30"><Music2 size={32} /></div>}
                      </div>
                      <div className="font-semibold text-sm truncate">{album.title}</div>
                      <div className="text-xs text-muted truncate mt-0.5">{album.artistName}</div>
                      <div className="text-[10px] text-primaryMusic font-medium mt-2">{album.unplayed} {isRtl ? 'أغاني غير مستمعة' : 'unplayed tracks'}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
