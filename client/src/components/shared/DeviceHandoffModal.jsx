import { useState, useEffect } from 'react';
import {
  Tv,
  Monitor,
  Smartphone,
  Tablet,
  X,
  RefreshCw,
  Edit2,
  Check,
  Radio,
  Share2,
  Copy,
  ExternalLink,
  Cast,
  Sparkles,
  ArrowLeft,
  User,
  RotateCcw,
  Sliders,
  Play
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import { useAuthStore } from '../../store/useAuthStore';

function getDeviceIcon(type) {
  switch (type) {
    case 'tv':
      return <Tv size={20} />;
    case 'mobile':
      return <Smartphone size={20} />;
    case 'tablet':
      return <Tablet size={20} />;
    default:
      return <Monitor size={20} />;
  }
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export default function DeviceHandoffModal() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const {
    isModalOpen,
    closeCastModal,
    currentMediaToCast,
    deviceId,
    deviceName,
    deviceType,
    isCustomName,
    setDeviceName,
    resetToUserDeviceName,
    onlineDevices,
    isLoadingDevices,
    fetchDevices,
    transferMedia,
    connectToDevice
  } = useDeviceHandoffStore();
  const currentUser = useAuthStore(s => s.user);

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [pauseLocal, setPauseLocal] = useState(true);
  const [transferringId, setTransferringId] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isModalOpen) {
      setNameInput(deviceName);
      fetchDevices();
    }
  }, [isModalOpen, deviceName, fetchDevices]);

  if (!isModalOpen || !currentMediaToCast) return null;

  const handleSaveName = (e) => {
    e.preventDefault();
    if (nameInput.trim()) {
      setDeviceName(nameInput);
      setIsEditingName(false);
    }
  };

  const handleTransfer = async (targetDev) => {
    setTransferringId(targetDev.id);
    const success = await transferMedia(targetDev.id, targetDev.name, currentMediaToCast, pauseLocal, targetDev.isDlna);
    setTransferringId(null);
  };

  const directUrl = `${window.location.origin}/watch/${currentMediaToCast.type}/${currentMediaToCast.id}?t=${Math.floor(currentMediaToCast.currentTime || 0)}&autoPlay=true`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const otherDevices = onlineDevices.filter(d => d.id !== deviceId);
  const dlnaDevices = otherDevices.filter(d => d.isDlna);
  const appDevices = otherDevices.filter(d => !d.isDlna);

  const renderDeviceCard = (dev) => (
    <div
      key={dev.id}
      className={`flex items-center justify-between p-3 rounded-2xl border transition group ${
        dev.isDlna
          ? 'bg-gradient-to-r from-emerald-500/5 to-teal-500/5 hover:bg-emerald-500/10 border-emerald-500/20'
          : 'bg-slate-50 dark:bg-surface/50 hover:bg-slate-100 dark:hover:bg-surface border-slate-200/80 dark:border-white/5'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 ${
          dev.isDlna
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-white dark:bg-surfaceHover border border-slate-200/60 dark:border-white/10 text-primaryMovies'
        }`}>
          {getDeviceIcon(dev.type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-xs text-text truncate">{dev.name}</span>
            {dev.isDlna && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                DLNA TV
              </span>
            )}
          </div>
          {dev.currentMedia && (
            <div className="text-[10px] text-rose-500 font-semibold truncate flex items-center gap-1 mt-0.5">
              <Play size={9} fill="currentColor" />
              <span className="truncate">{dev.currentMedia.title}</span>
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <div className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{isRtl ? 'متصل وجاهز' : 'Ready'}</span>
            </div>
            {(dev.userDisplayName || dev.userName) && !dev.isDlna && (
              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 bg-slate-200/50 dark:bg-white/5 px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                <User size={10} className="text-primaryMovies flex-shrink-0" />
                <span className="truncate">{dev.userDisplayName || dev.userName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0 ms-2">
        {/* Control this device directly */}
        <button
          onClick={() => {
            connectToDevice(dev);
            closeCastModal();
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-text font-bold text-xs transition active:scale-95"
          title={isRtl ? 'التحكم الكامل في هذا الجهاز' : 'Full Remote Control'}
        >
          <Sliders size={12} className={dev.isDlna ? 'text-emerald-400' : 'text-rose-500'} />
          <span className="hidden sm:inline">{isRtl ? 'تحكم' : 'Control'}</span>
        </button>

        {/* Cast current media */}
        <button
          onClick={() => handleTransfer(dev)}
          disabled={transferringId === dev.id}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white font-bold text-xs shadow-md active:scale-95 transition disabled:opacity-50 ${
            dev.isDlna
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110'
              : 'bg-primaryMovies hover:brightness-110'
          }`}
          title={isRtl ? 'بث وتشغيل فوري' : 'Cast immediately'}
        >
          {transferringId === dev.id ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <Share2 size={12} />
          )}
          <span>{isRtl ? 'بث' : 'Cast'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn"
      onClick={closeCastModal}
    >
      <div 
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col gap-5 text-text"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primaryMovies/15 text-primaryMovies border border-primaryMovies/30 flex items-center justify-center shadow-sm">
              <Cast size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">{isRtl ? 'نقل المشاهدة إلى جهاز آخر' : 'Cast to Another Device'}</h2>
              <p className="text-xs text-muted">{isRtl ? 'إرسال العرض لشاشتك الذكية أو هاتفك واستئنافه فوراً' : 'Send playback to your Smart TV or phone instantly'}</p>
            </div>
          </div>
          <button
            onClick={closeCastModal}
            className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-slate-100 dark:hover:bg-surfaceHover transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Media Preview Card */}
        <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50 dark:bg-surface/60 border border-slate-200/80 dark:border-white/5">
          {currentMediaToCast.poster ? (
            <div className="w-12 h-16 rounded-xl overflow-hidden bg-surfaceHover flex-shrink-0 shadow-sm border border-border/40">
              <img src={currentMediaToCast.poster} alt={currentMediaToCast.title || "Poster"} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-12 h-16 rounded-xl bg-primaryMovies/10 text-primaryMovies flex items-center justify-center flex-shrink-0">
              <Tv size={24} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate text-text">{currentMediaToCast.title}</div>
            <div className="text-xs text-muted mt-1 flex items-center gap-2">
              <span className="font-mono text-primaryMovies font-semibold">{formatTime(currentMediaToCast.currentTime)}</span>
              <span>/</span>
              <span className="font-mono">{formatTime(currentMediaToCast.duration)}</span>
            </div>
          </div>
        </div>

        {/* This Device Banner */}
        <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-surface/40 border border-slate-200/70 dark:border-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="text-muted">{getDeviceIcon(deviceType)}</div>
              <div className="min-w-0">
                <div className="text-[11px] text-muted flex items-center gap-1.5 flex-wrap">
                  <span>{isRtl ? 'هذا الجهاز حالياً:' : 'This Device:'}</span>
                  {currentUser && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-medium flex items-center gap-1">
                      <User size={10} />
                      <span>{currentUser.display_name || currentUser.username}</span>
                    </span>
                  )}
                </div>
                {isEditingName ? (
                  <form onSubmit={handleSaveName} className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={e => setNameInput(e.target.value)}
                      className="px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-surface border border-primaryMovies text-text outline-none w-44 sm:w-56"
                      autoFocus
                    />
                    <button type="submit" className="p-1 rounded-lg bg-primaryMovies text-white hover:brightness-110">
                      <Check size={13} />
                    </button>
                  </form>
                ) : (
                  <div className="text-xs font-bold text-text truncate mt-0.5">{deviceName}</div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isCustomName && (
                <button
                  onClick={() => {
                    resetToUserDeviceName();
                    setIsEditingName(false);
                  }}
                  className="text-[11px] text-muted hover:text-primaryMovies flex items-center gap-1 transition px-2 py-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5"
                  title={isRtl ? 'استعادة التسمية الافتراضية باسم صاحب الحساب' : 'Reset to user account name'}
                >
                  <RotateCcw size={11} />
                  <span className="hidden sm:inline">{isRtl ? 'تسمية باسم الحساب' : 'Reset Name'}</span>
                </button>
              )}
              {!isEditingName && (
                <button
                  onClick={() => {
                    setNameInput(deviceName);
                    setIsEditingName(true);
                  }}
                  className="text-xs text-muted hover:text-primaryMovies flex items-center gap-1 transition p-1"
                  title={isRtl ? 'تعديل اسم هذا الجهاز يدوياً' : 'Rename this device manually'}
                >
                  <Edit2 size={13} />
                  <span className="hidden sm:inline">{isRtl ? 'تسمية' : 'Rename'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Available Online Devices List */}
        <div>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-bold text-muted flex items-center gap-1.5">
              <Radio size={14} className="text-emerald-500 animate-pulse" />
              <span>{isRtl ? `الأجهزة المتصلة على الشبكة (${otherDevices.length})` : `Online Network Devices (${otherDevices.length})`}</span>
            </span>
            <button
              onClick={fetchDevices}
              disabled={isLoadingDevices}
              className="text-xs text-muted hover:text-text flex items-center gap-1 transition disabled:opacity-50"
              title={isRtl ? 'تحديث قائمة الأجهزة' : 'Refresh devices list'}
            >
              <RefreshCw size={12} className={isLoadingDevices ? 'animate-spin text-primaryMovies' : ''} />
              <span>{isRtl ? 'تحديث' : 'Refresh'}</span>
            </button>
          </div>

          {otherDevices.length === 0 ? (
            <div className="text-center py-6 px-4 rounded-2xl bg-slate-50/50 dark:bg-surface/20 border border-dashed border-slate-200 dark:border-white/10 text-muted space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-surfaceHover flex items-center justify-center text-muted">
                <Tv size={24} />
              </div>
              <p className="text-xs">
                {isRtl ? 'لا توجد أجهزة أو شاشات متصلة حالياً.' : 'No devices or smart TVs found right now.'}
              </p>
              <p className="text-[11px] opacity-75">
                {isRtl ? 'تأكد من اتصال الشاشة الذكية أو الهاتف بنفس شبكة الواي فاي المنزلية، أو افتح ARN Stream على أي متصفح آخر لتظهر هنا تلقائياً!' : 'Ensure your Smart TV or phone is on the same home Wi-Fi network, or open ARN Stream in another browser to cast!'}
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-56 overflow-y-auto pe-1">
              {/* Category 1: DLNA Smart TVs */}
              {dlnaDevices.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500 uppercase tracking-wider px-1">
                    <Tv size={13} />
                    <span>{isRtl ? `شاشات التلفزيون الذكية (${dlnaDevices.length})` : `DLNA Smart TVs (${dlnaDevices.length})`}</span>
                  </div>
                  <div className="space-y-2">
                    {dlnaDevices.map(renderDeviceCard)}
                  </div>
                </div>
              )}

              {/* Category 2: Connected ARN Stream Apps */}
              {appDevices.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                    <Smartphone size={13} />
                    <span>{isRtl ? `تطبيقات ARN Stream المتصلة (${appDevices.length})` : `ARN Stream Apps (${appDevices.length})`}</span>
                  </div>
                  <div className="space-y-2">
                    {appDevices.map(renderDeviceCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Options */}
        <div className="flex items-center gap-2 px-1 text-xs text-muted cursor-pointer" onClick={() => setPauseLocal(!pauseLocal)}>
          <input
            type="checkbox"
            checked={pauseLocal}
            onChange={e => setPauseLocal(e.target.checked)}
            className="accent-primaryMovies rounded cursor-pointer"
          />
          <span>{isRtl ? 'إيقاف التشغيل تلقائياً على هذا الجهاز بعد النقل' : 'Pause playback on this device after casting'}</span>
        </div>

        {/* Instant Direct Link / QR Fallback */}
        <div className="border-t border-slate-100 dark:border-white/10 pt-4 space-y-2">
          <div className="text-xs font-semibold text-muted flex items-center gap-1">
            <ExternalLink size={13} className="text-primaryMovies" />
            <span>{isRtl ? 'رابط التشغيل المباشر لأي متصفح آخر:' : 'Direct playback URL for another browser:'}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={directUrl}
              className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-surface border border-slate-200 dark:border-white/10 text-muted font-mono truncate select-all"
            />
            <button
              onClick={handleCopyLink}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition shadow-sm ${
                copied ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-surfaceHover text-text hover:bg-slate-200 dark:hover:bg-surface'
              }`}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ' : 'Copy')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
