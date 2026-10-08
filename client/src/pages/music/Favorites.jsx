import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchFavorites, toggleFavorite } from '../../api/client';
import { usePlayerStore } from '../../store/usePlayerStore';
import TopBar from '../../components/shared/TopBar';
import { Heart, Play, Clock, Music2 } from 'lucide-react';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Favorites() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const qc = useQueryClient();
  const playTrack = usePlayerStore(s => s.playTrack);
  const { data, isLoading } = useQuery({ queryKey: ['favorites'], queryFn: () => fetchFavorites() });

  const unfavMut = useMutation({
    mutationFn: (id) => toggleFavorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites'] })
  });

  const tracks = data?.items || [];
  const total = data?.total || 0;

  const playAll = () => {
    if (tracks.length > 0) playTrack(tracks[0], tracks);
  };

  return (
    <div className="min-h-screen bg-bg pb-24">
      <TopBar variant="music" />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        {/* Hero */}
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-10">
          <div className="w-48 h-48 rounded-3xl bg-gradient-to-br from-pink-500 via-red-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-pink-500/20 flex-shrink-0">
            <Heart size={64} className="text-text" fill="white" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted font-medium uppercase tracking-wider mb-1">{isRtl ? 'مجموعة' : 'Collection'}</p>
            <h1 className="text-4xl md:text-5xl font-black mb-3">{isRtl ? 'الأغاني المفضلة' : 'Favorite Tracks'}</h1>
            <p className="text-muted text-sm">{total} {isRtl ? 'أغنية' : 'tracks'}</p>
            {tracks.length > 0 && (
              <button onClick={playAll} className="mt-4 flex items-center gap-2 px-8 py-3 rounded-full bg-primaryMusic text-black font-bold text-sm hover:brightness-110 transition shadow-lg shadow-primaryMusic/30">
                <Play size={18} fill="black" /> {isRtl ? 'تشغيل الكل' : 'Play All'}
              </button>
            )}
          </div>
        </div>

        {/* Track List */}
        {isLoading ? (
          <div className="py-20 text-center text-muted">{t('common.loading', 'جاري التحميل...')}</div>
        ) : tracks.length === 0 ? (
          <div className="py-20 text-center">
            <Heart size={48} className="mx-auto mb-4 text-muted/30" />
            <h3 className="text-lg font-bold mb-2">{isRtl ? 'لا توجد أغاني مفضلة بعد' : 'No favorites yet'}</h3>
            <p className="text-sm text-muted">{isRtl ? 'اضغط على أيقونة القلب لإضافة أغاني للمفضلة' : 'Tap the heart icon to add tracks to your favorites'}</p>
          </div>
        ) : (
          <div className="bg-surface/50 backdrop-blur-md border border-tx/10 rounded-2xl overflow-hidden">
            {tracks.map((track, idx) => (
              <div
                key={track.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-tx/5 transition group border-b border-tx/5 last:border-0"
              >
                <span className="w-8 text-center text-sm text-muted font-mono">{idx + 1}</span>
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-surfaceHover flex-shrink-0 border border-tx/5">
                  {track.cover ? <img src={track.cover} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted/50"><Music2 size={16} /></div>}
                </div>
                <button onClick={() => playTrack(track, tracks)} className="flex-1 min-w-0 text-start">
                  <div className="text-sm font-semibold truncate group-hover:text-primaryMusic transition">{track.title}</div>
                  <div className="text-xs text-muted truncate">{track.artistName} {track.albumTitle ? `• ${track.albumTitle}` : ''}</div>
                </button>
                <span className="text-xs text-muted tabular-nums hidden sm:block">{track.play_count || 0} ×</span>
                <span className="text-xs text-muted tabular-nums flex items-center gap-1"><Clock size={12} />{track.duration ? fmt(track.duration) : '--:--'}</span>
                <button
                  onClick={() => unfavMut.mutate(track.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-pink-500 hover:bg-pink-500/20 transition"
                >
                  <Heart size={16} fill="currentColor" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
