import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useScanStore } from '../../store/useScanStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { 
  Sparkles, 
  Film, 
  Tv, 
  Music, 
  FolderCheck, 
  X, 
  ArrowRight, 
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  HardDrive
} from 'lucide-react';

export default function ScanProgressNotification() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isRtl = i18n.language === 'ar';
  const { theme } = useSettingsStore();
  const isDark = theme !== 'light';

  const { 
    isScanning, 
    progress, 
    currentFile, 
    libraryName, 
    phase, 
    newItems, 
    isToastVisible, 
    isDetailsModalOpen,
    openDetailsModal, 
    closeDetailsModal, 
    dismissToast 
  } = useScanStore();

  const [activeTab, setActiveTab] = useState('all');

  const filteredItems = useMemo(() => {
    if (activeTab === 'all') return newItems;
    return newItems.filter(item => item.type === activeTab);
  }, [newItems, activeTab]);

  const counts = useMemo(() => {
    const movies = newItems.filter(i => i.type === 'movie').length;
    const episodes = newItems.filter(i => i.type === 'episode').length;
    const tracks = newItems.filter(i => i.type === 'track').length;
    return { all: newItems.length, movie: movies, episode: episodes, track: tracks };
  }, [newItems]);

  const handleNavigateToItem = (item) => {
    closeDetailsModal();
    if (item.type === 'movie') {
      if (item.libraryId) navigate(`/library/${item.libraryId}`);
      else navigate('/');
    } else if (item.type === 'episode') {
      if (item.libraryId) navigate(`/library/${item.libraryId}`);
      else navigate('/');
    } else if (item.type === 'track') {
      if (item.libraryId) navigate(`/library/${item.libraryId}`);
      else navigate('/');
    }
  };

  return (
    <>
      {/* 1. Real-Time Top Progress Bar (Appears globally during scanning) */}
      {isScanning && (
        <div className="fixed top-0 left-0 right-0 z-[999] pointer-events-none animate-fadeIn">
          {/* Glowing Animated Bar */}
          <div className="h-1.5 w-full bg-black/40 overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-cyan-400 transition-all duration-200 ease-out shadow-[0_0_12px_rgba(52,211,153,0.8)]"
              style={{ width: `${Math.max(3, progress)}%` }}
            />
          </div>

          {/* Floating Pill Badge under header */}
          <div className="flex justify-center mt-2 pointer-events-auto">
            <div className={`flex items-center gap-2.5 px-4 py-1.5 rounded-full border shadow-2xl backdrop-blur-xl text-xs ${
              isDark 
                ? 'bg-slate-900/90 border-emerald-500/30 text-white shadow-emerald-950/40' 
                : 'bg-white/95 border-emerald-500/40 text-slate-900 shadow-slate-400/20'
            }`}>
              {/* Spinner & Pulsing status */}
              <div className="relative flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 relative" />
              </div>

              {/* Percentage */}
              <span className="font-mono font-black text-emerald-400 text-xs">
                {progress}%
              </span>

              <span className="text-white/30 dark:text-white/30">•</span>

              {/* Status details */}
              <span className="font-semibold truncate max-w-[220px] sm:max-w-md">
                {libraryName ? `${libraryName}: ` : ''}
                <span className="text-white/70 dark:text-white/70 font-normal">
                  {currentFile || (isRtl ? 'جاري الفحص والمزامنة...' : 'Scanning media...')}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Interactive Discovery Toast (Appears upon finding new items) */}
      {isToastVisible && newItems.length > 0 && !isDetailsModalOpen && (
        <div className={`fixed bottom-6 ${isRtl ? 'left-6' : 'right-6'} z-[950] animate-bounce-short`}>
          <div className={`flex items-center gap-3.5 p-3.5 sm:p-4 rounded-2xl border shadow-2xl backdrop-blur-2xl max-w-sm sm:max-w-md transition-all ${
            isDark 
              ? 'bg-slate-900/95 border-emerald-500/40 text-white shadow-emerald-950/60' 
              : 'bg-surface border-emerald-500/50 text-slate-900 shadow-xl'
          }`}>
            {/* Discovery Icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-500/30">
              <Sparkles size={20} className="animate-pulse" />
            </div>

            {/* Content */}
            <div className="flex flex-col text-start flex-1 min-w-0 cursor-pointer" onClick={openDetailsModal}>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm text-emerald-400">
                  {isRtl ? 'تم اكتشاف ملفات جديدة على القرص!' : 'New Media Discovered on Disk!'}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                  +{newItems.length}
                </span>
              </div>
              <p className="text-[11px] text-white/70 dark:text-white/70 truncate mt-0.5">
                {isRtl 
                  ? 'اضغط هنا لمعاينة تفاصيل الأفلام والحلقات المكتشفة' 
                  : 'Click here to review detailed list of added media'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={openDetailsModal}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-md"
              >
                {isRtl ? 'عرض' : 'View'}
              </button>
              <button
                type="button"
                onClick={dismissToast}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition"
                title={isRtl ? 'إغلاق' : 'Dismiss'}
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Detailed New Media Modal */}
      {isDetailsModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className={`w-full max-w-2xl max-h-[85vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
            isDark 
              ? 'bg-slate-900 border-white/15 text-white shadow-black/80' 
              : 'bg-surface border-border text-text shadow-2xl'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                  <HardDrive size={22} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black flex items-center gap-2">
                    <span>{isRtl ? 'الملفات المكتشفة حديثاً' : 'Newly Discovered Media Files'}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                      {newItems.length}
                    </span>
                  </h3>
                  <p className="text-xs text-white/60 dark:text-white/60 mt-0.5">
                    {isRtl 
                      ? 'تم رصد وتحديث هذه الوسائط على القرص الصلب وإضافتها لقاعدة البيانات' 
                      : 'These items were newly found on disk and added to library database'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDetailsModal}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10 bg-white/[0.02] overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  activeTab === 'all'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                }`}
              >
                <span>{isRtl ? 'الكل' : 'All'}</span>
                <span className="opacity-80">({counts.all})</span>
              </button>

              {counts.movie > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('movie')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'movie'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Film size={13} />
                  <span>{isRtl ? 'الأفلام' : 'Movies'}</span>
                  <span className="opacity-80">({counts.movie})</span>
                </button>
              )}

              {counts.episode > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('episode')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'episode'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Tv size={13} />
                  <span>{isRtl ? 'المسلسلات والحلقات' : 'Episodes'}</span>
                  <span className="opacity-80">({counts.episode})</span>
                </button>
              )}

              {counts.track > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('track')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    activeTab === 'track'
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-white/5 hover:bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Music size={13} />
                  <span>{isRtl ? 'الصوتيات' : 'Audio'}</span>
                  <span className="opacity-80">({counts.track})</span>
                </button>
              )}
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-2.5 divide-y divide-white/5">
              {filteredItems.length === 0 ? (
                <div className="text-center py-12 text-white/40 text-sm">
                  {isRtl ? 'لا توجد عناصر في هذا التصنيف' : 'No items found in this filter'}
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isMovie = item.type === 'movie';
                  const isEpisode = item.type === 'episode';
                  const isTrack = item.type === 'track';

                  return (
                    <div 
                      key={idx}
                      className="pt-2.5 first:pt-0 flex items-start gap-3.5 group hover:bg-white/[0.02] p-2 rounded-2xl transition"
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isMovie 
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                          : isEpisode 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      }`}>
                        {isMovie && <Film size={16} />}
                        {isEpisode && <Tv size={16} />}
                        {isTrack && <Music size={16} />}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 text-start">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-white group-hover:text-emerald-400 transition truncate">
                            {isMovie && item.title}
                            {isEpisode && `${item.seriesTitle || ''} — الموسم ${item.seasonNumber || 1} • الحلقة ${item.episodeNumber || 1}`}
                            {isTrack && `${item.title || item.filename} (${item.artist || 'فنان'})`}
                          </h4>
                          {item.year && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-white/70 font-mono">
                              {item.year}
                            </span>
                          )}
                          {item.libraryName && (
                            <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {item.libraryName}
                            </span>
                          )}
                        </div>

                        {isEpisode && item.title && item.title !== `الحلقة ${item.episodeNumber}` && (
                          <p className="text-[11px] text-white/80 font-medium mt-0.5">
                            {item.title}
                          </p>
                        )}

                        {/* File path */}
                        <div className="mt-1 font-mono text-[10px] text-white/40 truncate select-all">
                          {item.fullPath || item.filename}
                        </div>
                      </div>

                      {/* Navigate Action */}
                      <button
                        type="button"
                        onClick={() => handleNavigateToItem(item)}
                        className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-emerald-500 hover:text-slate-950 text-white/80 text-[11px] font-bold transition shrink-0 self-center"
                        title={isRtl ? 'عرض في المكتبة' : 'View in Library'}
                      >
                        {isRtl ? 'انتقال' : 'Open'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/[0.02]">
              <span className="text-xs text-white/50">
                {isRtl ? 'تمت إضافة كافة البيانات تلقائياً بنجاح.' : 'All media items were indexed successfully.'}
              </span>
              <button
                type="button"
                onClick={closeDetailsModal}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-emerald-500/20"
              >
                {isRtl ? 'حسناً، تم' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
