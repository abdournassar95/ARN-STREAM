import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Tv, 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  ExternalLink, 
  Server, 
  Info, 
  ChevronDown, 
  Sparkles,
  Radio,
  Tv2,
  Copy,
  Check,
  KeyRound,
  Smartphone,
  Monitor,
  X
} from 'lucide-react';
import TopBar from '../components/shared/TopBar';
import CosmicBackground from '../components/shared/CosmicBackground';
import { useSettingsStore } from '../store/useSettingsStore';

const DEFAULT_FG_CODE = '232425';

const PRESET_SERVERS = [
  { id: 'auto', label: 'الخادم المباشر المدمج (تفعيل تلقائي 232425)', url: '/api/live/player' },
  { id: 'primary', label: 'web.dramalive.cc (الرسمي المباشر)', url: 'https://web.dramalive.cc' },
  { id: 'backup', label: 'web.dramalive.app (السيرفر البديل)', url: 'https://web.dramalive.app' },
  { id: 'website', label: 'dramalive.website', url: 'https://dramalive.website' },
];

export default function LiveTv() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { liveTvUrl, setLiveTvUrl, theme } = useSettingsStore();
  const isDark = theme !== 'light';

  const [activeUrl, setActiveUrl] = useState(liveTvUrl || PRESET_SERVERS[0].url);
  const [iframeKey, setIframeKey] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState('wide'); // 'wide' | 'mobile'
  const [showExpandHint, setShowExpandHint] = useState(true);

  const containerRef = useRef(null);
  const iframeRef = useRef(null);

  // Sync activeUrl with store
  useEffect(() => {
    if (liveTvUrl && liveTvUrl !== activeUrl) {
      setActiveUrl(liveTvUrl);
    }
  }, [liveTvUrl]);

  // Handle Fullscreen change listeners
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Copy FG Code to clipboard
  const handleCopyFgCode = () => {
    navigator.clipboard.writeText(DEFAULT_FG_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Reload iframe
  const handleReload = () => {
    setIsLoading(true);
    setIframeKey(k => k + 1);
  };

  // Toggle native full screen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Change server URL
  const handleSelectServer = (url) => {
    setActiveUrl(url);
    setLiveTvUrl(url);
    setIsLoading(true);
    setIframeKey(k => k + 1);
    setShowServerMenu(false);
  };

  // Apply custom URL
  const handleApplyCustomUrl = (e) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    let url = customUrlInput.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
      url = 'https://' + url;
    }
    handleSelectServer(url);
    setShowCustomModal(false);
    setCustomUrlInput('');
  };

  // Open stream in a standalone external tab/window
  const handleOpenExternal = () => {
    const target = activeUrl.startsWith('/') ? window.location.origin + activeUrl : activeUrl;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  // Keyboard shortcut listener: F for fullscreen, C for cinema, R for reload
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'c' || e.key === 'C') {
        setIsCinemaMode(prev => !prev);
      } else if (e.key === 'r' || e.key === 'R') {
        handleReload();
      } else if (e.key === 'Escape' && isCinemaMode) {
        setIsCinemaMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCinemaMode]);

  const isMaximized = isCinemaMode || isFullscreen;

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen relative flex flex-col ${
        isMaximized 
          ? 'fixed inset-0 z-[100] bg-black' 
          : isDark ? 'bg-[#04060b] text-white' : 'bg-bg text-text'
      }`}
    >
      {/* Dynamic TopBar (only in non-cinema mode) */}
      {!isMaximized && <TopBar />}

      {/* Cosmic background decoration */}
      {!isMaximized && isDark && (
        <>
          <CosmicBackground density="medium" />
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-[900px] h-[350px] bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15),transparent_70%)] blur-2xl pointer-events-none" />
        </>
      )}

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col ${isMaximized ? 'p-0' : 'px-3 sm:px-6 lg:px-10 pt-2 sm:pt-4 pb-12'} relative z-10 max-w-7xl mx-auto w-full`}>
        
        {/* Header Bar & Live Controls (Shown in Normal Mode) */}
        {!isMaximized && (
          <div className="relative z-50 flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 animate-fadeIn">
            {/* Title & Live Status Indicator */}
            <div className="flex items-center gap-3">
              <div className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-red-600/30 to-red-500/10 border border-red-500/40 flex items-center justify-center text-red-500 ${
                isDark ? 'shadow-[0_0_20px_rgba(239,68,68,0.25)]' : 'shadow-sm'
              }`}>
                <Tv2 size={22} className="animate-pulse" />
                <span className="absolute -top-1 -end-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 bg-red-600 border-2 ${isDark ? 'border-[#04060b]' : 'border-white'}`}></span>
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {t('liveTv.title')}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-sm shadow-red-600/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                  {t('liveTv.badge')}
                </span>
              </div>
            </div>

            {/* Action Tools Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {/* FG Code Badge with 1-click Copy */}
              <button
                type="button"
                onClick={handleCopyFgCode}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition shadow-sm group active:scale-95 ${
                  isDark
                    ? 'bg-gradient-to-r from-red-600/20 via-amber-600/15 to-red-600/20 hover:from-red-600/30 hover:to-amber-600/30 border-red-500/40 text-white'
                    : 'bg-red-50 hover:bg-red-100 border-red-200 text-red-800'
                }`}
                title={isRtl ? 'اضغط لنسخ كود التفعيل 232425' : 'Click to copy FG Code 232425'}
              >
                <KeyRound size={14} className={isDark ? 'text-amber-400' : 'text-red-500'} />
                <span className={isDark ? 'text-white/70' : 'text-red-600/70'}>{isRtl ? 'كود FG:' : 'FG Code:'}</span>
                <span className={`font-mono font-black tracking-wider text-sm ${isDark ? 'text-amber-300' : 'text-red-700'}`}>{DEFAULT_FG_CODE}</span>
                {copied ? (
                  <span className="text-emerald-500 text-[11px] font-bold flex items-center gap-1 ms-1 animate-fadeIn">
                    <Check size={13} /> {isRtl ? 'تم النسخ' : 'Copied'}
                  </span>
                ) : (
                  <Copy size={13} className={isDark ? 'text-white/50 group-hover:text-white ms-1' : 'text-red-400 group-hover:text-red-600 ms-1'} />
                )}
              </button>

              {/* Viewport Mode Switcher (Wide vs Mobile) */}
              <button
                type="button"
                onClick={() => setViewMode(m => m === 'wide' ? 'mobile' : 'wide')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition backdrop-blur-md shadow-sm ${
                  isDark ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title={viewMode === 'wide' ? (isRtl ? 'مقاس الهاتف' : 'Mobile View') : (isRtl ? 'عرض عريض' : 'Wide View')}
              >
                {viewMode === 'wide' ? <Smartphone size={14} className="text-sky-500" /> : <Monitor size={14} className="text-sky-500" />}
                <span className="hidden sm:inline">{viewMode === 'wide' ? (isRtl ? 'مقاس الهاتف' : 'Mobile View') : (isRtl ? 'عرض عريض' : 'Wide View')}</span>
              </button>

              {/* Server Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowServerMenu(v => !v)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition backdrop-blur-md shadow-sm ${
                    isDark ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                  title={t('liveTv.changeServer')}
                >
                  <Server size={14} className="text-red-500" />
                  <span className="truncate max-w-[140px] sm:max-w-[170px]">
                    {PRESET_SERVERS.find(s => s.url === activeUrl)?.label || activeUrl.replace(/^https?:\/\//, '')}
                  </span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showServerMenu ? 'rotate-180' : ''}`} />
                </button>

                {showServerMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setShowServerMenu(false)} 
                    />
                    <div className={`absolute top-full mt-2 ${isRtl ? 'right-0' : 'left-0'} w-72 rounded-2xl backdrop-blur-2xl border shadow-2xl p-2 z-50 animate-fadeIn ${
                      isDark ? 'bg-[#0f172a]/95 border-white/15' : 'bg-white/95 border-slate-200'
                    }`}>
                      <div className={`text-[11px] font-bold px-3 py-1.5 uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-slate-400'}`}>
                        {t('liveTv.changeServer')}
                      </div>
                      {PRESET_SERVERS.map(srv => (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => handleSelectServer(srv.url)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition ${
                            activeUrl === srv.url 
                              ? (isDark ? 'bg-red-600/30 text-white font-bold border border-red-500/40 shadow-sm' : 'bg-red-50 text-red-700 font-bold border border-red-200 shadow-sm')
                              : (isDark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900')
                          }`}
                        >
                          <span className="truncate text-start">{srv.label}</span>
                          {activeUrl === srv.url && (
                            <span className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-400 shrink-0 ms-2"></span>
                          )}
                        </button>
                      ))}
                      <div className={`border-t my-1 pt-1 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowServerMenu(false);
                            setShowCustomModal(true);
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs transition ${
                            isDark ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                        >
                          <Radio size={14} className="text-red-500" />
                          <span>{t('liveTv.customServer')}</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Reload Stream Button */}
              <button
                type="button"
                onClick={handleReload}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition backdrop-blur-md shadow-sm group ${
                  isDark ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title={`${t('liveTv.reload')} (R)`}
              >
                <RotateCw size={14} className={`group-hover:rotate-180 transition-transform duration-500 ${isLoading ? 'animate-spin text-red-500' : ''}`} />
                <span className="hidden sm:inline">{t('liveTv.reload')}</span>
              </button>

              {/* Cinema Mode Button */}
              <button
                type="button"
                onClick={() => setIsCinemaMode(true)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition backdrop-blur-md shadow-sm ${
                  isDark ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title={`${t('liveTv.cinemaMode')} (C)`}
              >
                <Tv size={14} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                <span className="hidden sm:inline">{t('liveTv.cinemaMode')}</span>
              </button>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition backdrop-blur-md shadow-sm ${
                  isDark ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title={`${isFullscreen ? t('liveTv.exitFullscreen') : t('liveTv.fullscreen')} (F)`}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                <span className="hidden md:inline">{isFullscreen ? t('liveTv.exitFullscreen') : t('liveTv.fullscreen')}</span>
              </button>

              {/* Open in External Tab Button */}
              <button
                type="button"
                onClick={handleOpenExternal}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs sm:text-sm font-medium transition backdrop-blur-md shadow-sm ${
                  isDark ? 'bg-white/10 hover:bg-white/15 border-white/10 text-white' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
                title={t('liveTv.openExternal')}
              >
                <ExternalLink size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Tip Banner removed — cleaner UI */}

        {/* Floating Controls Bar (Appears ONLY in Cinema Mode/Fullscreen) */}
        {isMaximized && (
          <div className="absolute top-4 inset-x-4 z-50 flex items-center justify-between p-3 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/15 shadow-2xl transition-opacity hover:opacity-100 opacity-80">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
              </span>
              <span className="font-bold text-sm text-white flex items-center gap-2">
                <span>{t('liveTv.title')}</span>
                <span className="text-xs font-mono text-amber-300 font-bold bg-white/10 px-2 py-0.5 rounded">FG: {DEFAULT_FG_CODE}</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReload}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                title={t('liveTv.reload')}
              >
                <RotateCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                title={t('liveTv.fullscreen')}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCinemaMode(false);
                  if (document.fullscreenElement) document.exitFullscreen();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg transition active:scale-95"
                title={`${t('liveTv.exitCinema')} (Esc)`}
              >
                <Minimize2 size={14} />
                <span>{t('liveTv.exitCinema')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Drama Live Iframe Container */}
        <div 
          className={`relative transition-all duration-300 mx-auto ${
            isMaximized 
              ? 'w-full h-screen rounded-none' 
              : viewMode === 'mobile'
                ? 'w-full max-w-lg min-h-[580px] h-[calc(100vh-220px)] rounded-3xl overflow-hidden border-2 border-red-500/40 shadow-[0_0_40px_rgba(239,68,68,0.2)] bg-[#090d16]'
                : 'w-full min-h-[580px] h-[calc(100vh-220px)] rounded-3xl overflow-hidden border border-red-500/30 shadow-[0_0_35px_rgba(239,68,68,0.15)] bg-[#090d16]'
          }`}
        >
          {/* Loading Indicator Overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#090d16] z-20">
              <div className="relative mb-4">
                <div className="w-14 h-14 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin" />
                <Tv2 size={24} className="absolute inset-0 m-auto text-red-500 animate-pulse" />
              </div>
              <p className="text-sm font-semibold text-white/80 animate-pulse">
                {isRtl ? 'جاري الاتصال وتفعيل قنوات البث المباشر (كود 232425)...' : 'Connecting to Drama Live Stream (Code: 232425)...'}
              </p>
              <span className="text-xs text-amber-400 font-mono mt-1">
                FG Activation Code: {DEFAULT_FG_CODE}
              </span>
            </div>
          )}

          {/* Embedded Drama Live Flutter Web Frame */}
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={activeUrl}
            title="Drama Live Web Player"
            onLoad={() => setIsLoading(false)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full border-0 relative z-10"
          />
        </div>

        {/* Quick Tips / Instructions Card (Collapsible) */}
        {!isMaximized && showTips && (
          <div className="mt-4 p-4 sm:p-5 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/10 animate-fadeIn">
            <div className="flex items-center gap-2 mb-3 text-red-400 font-bold text-sm">
              <Sparkles size={16} />
              <span>{t('liveTv.tipsTitle')}</span>
            </div>
            <ul className="space-y-2 text-xs sm:text-sm text-white/70 list-disc list-inside">
              <li>{isRtl ? `كود التفعيل الأساسي المدمج هو: ${DEFAULT_FG_CODE}` : `Default FG Activation Code is: ${DEFAULT_FG_CODE}`}</li>
              <li>{t('liveTv.tip1')}</li>
              <li>{t('liveTv.tip2')}</li>
              <li>{t('liveTv.tip3')}</li>
            </ul>
          </div>
        )}
      </main>

      {/* Custom URL Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-[#0f172a] border border-white/15 p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Radio size={18} className="text-red-400" />
              <span>{t('liveTv.customServer')}</span>
            </h3>
            <p className="text-xs text-white/60 mb-4">
              {t('liveTv.enterCustomUrl')}
            </p>
            <form onSubmit={handleApplyCustomUrl} className="space-y-4">
              <input
                type="text"
                value={customUrlInput}
                onChange={e => setCustomUrlInput(e.target.value)}
                placeholder="https://..."
                className="w-full h-10 rounded-xl bg-black/40 border border-white/20 px-3 text-sm text-white focus:outline-none focus:border-red-500 transition"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomModal(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white transition"
                >
                  {t('actions.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-md transition"
                >
                  {t('liveTv.applyUrl')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
