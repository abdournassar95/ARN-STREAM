import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { fetchMostPlayed } from '../../api/client';
import { usePlayerStore } from '../../store/usePlayerStore';
import TopBar from '../../components/shared/TopBar';
import { Clock, Play, Music2, TrendingUp, BarChart3 } from 'lucide-react';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function MostPlayed() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const playTrack = usePlayerStore(s => s.playTrack);
  const { data, isLoading } = useQuery({ queryKey: ['most-played'], queryFn: () => fetchMostPlayed({ limit: 100 }) });
  const tracks = data?.items || [];

  const playAll = () => { if (tracks.length) playTrack(tracks[0], tracks); };
  const maxPlayCount = tracks.length > 0 ? tracks[0].play_count : 1;

  return (
    <div className="min-h-screen bg-bg pb-24">
      <TopBar variant="music" />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
        <div className="flex flex-col md:flex-row items-start md:items-end gap-6 mb-10">
          <div className="w-48 h-48 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 flex items-center justify-center shadow-2xl shadow-orange-500/20 flex-shrink-0">
            <TrendingUp size={64} className="text-text" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted font-medium uppercase tracking-wider mb-1">{isRtl ? 'إحصائيات' : 'Stats'}</p>
            <h1 className="text-4xl md:text-5xl font-black mb-3">{isRtl ? 'الأكثر تشغيلاً' : 'Most Played'}</h1>
            <p className="text-muted text-sm">{tracks.length} {isRtl ? 'أغنية' : 'tracks'}</p>
            {tracks.length > 0 && (
              <button onClick={playAll} className="mt-4 flex items-center gap-2 px-8 py-3 rounded-full bg-primaryMusic text-black font-bold text-sm hover:brightness-110 transition shadow-lg shadow-primaryMusic/30">
                <Play size={18} fill="black" /> {isRtl ? 'تشغيل الكل' : 'Play All'}
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-muted">{isRtl ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : tracks.length === 0 ? (
          <div className="py-20 text-center">
            <BarChart3 size={48} className="mx-auto mb-4 text-muted/30" />
            <h3 className="text-lg font-bold mb-2">{isRtl ? 'لا توجد إحصائيات بعد' : 'No stats yet'}</h3>
            <p className="text-sm text-muted">{isRtl ? 'استمع لبعض الأغاني لبدء تتبع الإحصائيات' : 'Listen to some tracks to start tracking stats'}</p>
          </div>
        ) : (
          <div className="bg-surface/50 backdrop-blur-md border border-tx/10 rounded-2xl overflow-hidden">
            {tracks.map((track, idx) => (
              <div key={track.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-tx/5 transition group border-b border-tx/5 last:border-0">
                {/* Rank badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${idx < 3 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-black shadow-md' : 'text-muted'}`}>
                  {idx + 1}
                </div>
                <div className="w-11 h-11 rounded-lg overflow-hidden bg-surfaceHover flex-shrink-0 border border-tx/5">
                  {track.cover ? <img src={track.cover} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-muted/50"><Music2 size={16} /></div>}
                </div>
                <button onClick={() => playTrack(track, tracks)} className="flex-1 min-w-0 text-start">
                  <div className="text-sm font-semibold truncate group-hover:text-primaryMusic transition">{track.title}</div>
                  <div className="text-xs text-muted truncate">{track.artistName} {track.albumTitle ? `• ${track.albumTitle}` : ''}</div>
                </button>
                {/* Play count bar */}
                <div className="hidden md:flex items-center gap-3 w-40">
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primaryMusic to-emerald-400 rounded-full transition-all" style={{ width: `${(track.play_count / maxPlayCount) * 100}%` }} />
                  </div>
                  <span className="text-xs font-bold text-primaryMusic tabular-nums w-8 text-end">{track.play_count}×</span>
                </div>
                <span className="text-xs text-muted tabular-nums flex items-center gap-1 md:hidden"><BarChart3 size={12} />{track.play_count}×</span>
                <span className="text-xs text-muted tabular-nums flex items-center gap-1"><Clock size={12} />{track.duration ? fmt(track.duration) : '--:--'}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
