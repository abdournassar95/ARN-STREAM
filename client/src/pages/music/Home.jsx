import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import TopBar from '../../components/shared/TopBar';
import { ArtistCard, AlbumCard } from '../../components/shared/Card';
import GlassCarousel from '../../components/shared/GlassCarousel';
import { fetchMusicHome } from '../../api/client';
import Spinner from '../../components/shared/Spinner';
import { Link } from 'react-router-dom';
import { Play, Clock, Music as MusicIcon, Settings } from 'lucide-react';
import { usePlayerStore } from '../../store/usePlayerStore';
export default function MusicHome() {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({ queryKey: ['music-home'], queryFn: fetchMusicHome });
  const playTrack = usePlayerStore(s=>s.playTrack);
  const setQueue = usePlayerStore(s=>s.setQueue);

  if (isLoading) return <div className="min-h-screen bg-bg"><TopBar variant="music"/><div className="flex justify-center pt-20"><Spinner/></div></div>;

  const isEmpty = !data?.artists?.length && !data?.albums?.length && !data?.recentlyPlayed?.length && (!data?.playlists || data.playlists.length === 0);

  return (
    <div className="min-h-screen bg-bg pb-24">
      <TopBar variant="music" />
      <main className="w-full px-4 md:px-8 lg:px-12 py-6 space-y-8">
        {isEmpty ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-surface/60 border border-dashed border-border animate-fadeIn my-6">
            <div className="w-16 h-16 rounded-2xl bg-primaryMusic/20 border border-primaryMusic/30 flex items-center justify-center text-primaryMusic mb-4">
              <MusicIcon size={32} />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">{t('settings.emptyLibraryTitle')}</h2>
            <p className="text-sm text-muted max-w-md mb-6">{t('settings.emptyLibraryDesc')}</p>
            <Link
              to="/dashboard?tab=libraries"
              className="px-6 py-2.5 rounded-full bg-primaryMusic hover:brightness-110 text-black font-semibold text-xs flex items-center gap-2 transition shadow-lg"
            >
              <Settings size={15} />
              {t('settings.configureFolders')}
            </Link>
          </div>
        ) : (
          <>
            {/* Quick Links */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <Link to="/music/favorites" className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 to-rose-500/5 border border-pink-500/20 hover:border-pink-500/40 shadow-sm hover:shadow-md transition group">
                <div className="w-10 h-10 rounded-full bg-pink-500/20 text-pink-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">♥</span>
                </div>
                <div className="font-semibold text-sm text-text">{i18n.language === 'ar' ? 'المفضلة' : 'Favorites'}</div>
              </Link>
              <Link to="/music/smart-playlists" className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 border border-purple-500/20 hover:border-purple-500/40 shadow-sm hover:shadow-md transition group">
                <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">✨</span>
                </div>
                <div className="font-semibold text-sm text-text">{i18n.language === 'ar' ? 'قوائم ذكية' : 'Smart Playlists'}</div>
              </Link>
              <Link to="/music/recently-played" className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 hover:border-blue-500/40 shadow-sm hover:shadow-md transition group">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Clock size={18} />
                </div>
                <div className="font-semibold text-sm text-text">{i18n.language === 'ar' ? 'آخر المقاطع' : 'Recent'}</div>
              </Link>
              <Link to="/music/most-played" className="flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 hover:border-amber-500/40 shadow-sm hover:shadow-md transition group">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-lg">🔥</span>
                </div>
                <div className="font-semibold text-sm text-text">{i18n.language === 'ar' ? 'الأكثر استماعاً' : 'Most Played'}</div>
              </Link>
            </section>

            {/* Artists */}
            {data?.artists?.length > 0 && (
              <GlassCarousel
                title={t('music.allArtists')}
                headerAction={<Link to="/music/artists" className="text-xs text-muted hover:text-text">View all</Link>}
              >
                {data.artists.map(a => <ArtistCard key={a.id} artist={a} to={`/music/artist/${a.id}`} className="w-[180px] md:w-[200px] flex-shrink-0" />)}
              </GlassCarousel>
            )}

            {/* Albums */}
            {data?.albums?.length > 0 && (
              <GlassCarousel title={t('music.recentAlbums')}>
                {data.albums.map(al => <AlbumCard key={al.id} album={al} to={`/music/album/${al.id}`} className="w-[180px] md:w-[200px] flex-shrink-0" />)}
              </GlassCarousel>
            )}

            {/* Playlists */}
            <section>
              <h2 className="text-lg font-bold text-text mb-3">{t('music.topPlaylists')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {(data?.playlists || []).map(pl => (
                  <Link key={pl.id} to={`/music/playlist/${pl.id}`} className="flex items-center gap-3 p-3 rounded-xl bg-surface/50 border border-border/30 hover:border-border/60 hover:bg-surface shadow-sm transition">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primaryMusic to-emerald-800 flex items-center justify-center text-black font-bold shadow-sm">♫</div>
                    <div>
                      <div className="font-semibold text-sm text-text">{pl.name}</div>
                      <div className="text-xs text-muted">{pl.description || 'Playlist'}</div>
                    </div>
                  </Link>
                ))}
                {(!data?.playlists || data.playlists.length===0) && (
                  <div className="col-span-3 text-sm text-muted p-6 text-center border border-dashed border-border/40 rounded-xl">No playlists yet — create one from an album</div>
                )}
              </div>
            </section>

            {/* Recently played */}
            {data?.recentlyPlayed?.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-text mb-3">Recently Played</h2>
                <div className="rounded-2xl bg-surface/40 border border-border/30 overflow-hidden divide-y divide-border/20 shadow-sm">
                  {data.recentlyPlayed.map((track) => (
                    <div key={track.id} className="flex items-center gap-3 p-3 hover:bg-surfaceHover/60 transition">
                      <button onClick={()=>playTrack(track, data.recentlyPlayed)} className="w-8 h-8 rounded-full bg-primaryMusic text-black flex items-center justify-center hover:scale-105 shadow"><Play size={14} fill="black" className="ms-0.5"/></button>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-text truncate">{track.title}</div>
                        <div className="text-xs text-muted truncate">{track.artistName} • {track.albumTitle}</div>
                      </div>
                      <span className="text-xs text-muted flex items-center gap-1"><Clock size={12}/>{track.duration ? `${Math.floor(track.duration/60)}:${String(track.duration%60).padStart(2,'0')}` : '--:--'}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
