import React, { useState, useEffect } from 'react';
import {
  Tv,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  X,
  Radio,
  Sliders,
  Maximize2,
  Download,
  Sparkles,
  Cast,
  Power
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RemoteControlBanner() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();

  const {
    activeRemoteSession,
    remotePlaybackState,
    isMirroringActive,
    toggleMirroring,
    sendRemoteCommand,
    stopRemoteSession,
    openFullRemote,
    pullPlaybackToLocalDevice
  } = useDeviceHandoffStore();
  
  // Local optimistic state for immediate UI feedback
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);

  // Sync with remote state when it updates
  useEffect(() => {
    if (remotePlaybackState) {
      if (typeof remotePlaybackState.isPlaying === 'boolean') setIsPlaying(remotePlaybackState.isPlaying);
      if (typeof remotePlaybackState.isMuted === 'boolean') setIsMuted(remotePlaybackState.isMuted);
      if (typeof remotePlaybackState.volume === 'number') setVolume(remotePlaybackState.volume);
      if (typeof remotePlaybackState.currentTime === 'number') setCurrentTime(remotePlaybackState.currentTime);
    } else if (activeRemoteSession?.media) {
      const m = activeRemoteSession.media;
      if (typeof m.currentTime === 'number') setCurrentTime(m.currentTime);
      if (typeof m.isPlaying === 'boolean') setIsPlaying(m.isPlaying);
    }
  }, [remotePlaybackState, activeRemoteSession]);

  // Simulate progress when playing
  useEffect(() => {
    const dur = remotePlaybackState?.duration || activeRemoteSession?.media?.duration || 0;
    if (isPlaying && dur > 0) {
      const interval = setInterval(() => {
        setCurrentTime(prev => Math.min(prev + 1, dur));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isPlaying, remotePlaybackState?.duration, activeRemoteSession?.media?.duration]);

  if (!activeRemoteSession) return null;

  const media = activeRemoteSession.media || {};
  const duration = remotePlaybackState?.duration || media.duration || 0;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleTogglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    sendRemoteCommand(next ? 'play' : 'pause');
  };

  const handleSeekDelta = (delta) => {
    const clamped = Math.max(0, Math.min(currentTime + delta, duration));
    setCurrentTime(clamped);
    sendRemoteCommand('seek_delta', delta);
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = isRtl ? (1 - pos) * duration : pos * duration;
    setCurrentTime(newTime);
    sendRemoteCommand('seek', newTime);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sendRemoteCommand('mute', next);
  };

  const handleVolumeChange = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newVol = Math.max(0, Math.min(1, isRtl ? (1 - pos) : pos));
    setVolume(newVol);
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      sendRemoteCommand('mute', false);
    }
    sendRemoteCommand('volume', newVol);
  };

  const handlePullToLocal = (e) => {
    e.stopPropagation();
    const res = pullPlaybackToLocalDevice();
    if (res && res.media) {
      const { media: m, currentTime: t } = res;
      if (m.type === 'movie' || m.type === 'episode') {
        navigate(`/watch/${m.type}/${m.id}?t=${Math.floor(t)}&autoPlay=true`);
      }
    }
  };

  const hasActiveMedia = Boolean(media.title || duration > 0);

  return (
    <div className="fixed bottom-24 sm:bottom-6 inset-x-3 sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 z-50 flex flex-col gap-2.5 px-4 sm:px-5 py-3.5 rounded-3xl bg-[#0b1120]/95 text-white border border-rose-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-slideInUp min-w-[320px] sm:min-w-[480px] max-w-xl">
      
      {/* Top Row: Device Info & Mirroring Status */}
      <div className="flex items-center justify-between gap-3">
        {/* Target Device Info */}
        <div 
          onClick={openFullRemote}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
          title={isRtl ? 'عرض لوحة الريموت اليدوي' : 'Open Manual Remote'}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-red-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition">
            <Tv size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] mb-0.5">
              {isMirroringActive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-bold">
                    {isRtl ? 'التحكم الكامل • مزامنة لحظية' : 'Full Control • Live Mirror'}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-amber-400 font-bold">
                    {isRtl ? 'المزامنة متوقفة مؤقتاً' : 'Mirroring Paused'}
                  </span>
                </>
              )}
            </div>
            <div className="text-sm font-bold text-white group-hover:text-rose-300 transition truncate">
              {activeRemoteSession.targetDeviceName}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Toggle Live Mirroring */}
          <button
            onClick={toggleMirroring}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm border ${
              isMirroringActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                : 'bg-white/10 text-slate-300 border-white/15 hover:bg-white/20'
            }`}
            title={isMirroringActive ? (isRtl ? 'إيقاف المزامنة مؤقتاً' : 'Pause Mirroring') : (isRtl ? 'استئناف المزامنة' : 'Resume Mirroring')}
          >
            <Cast size={12} className={isMirroringActive ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
            <span className="hidden sm:inline">
              {isMirroringActive ? (isRtl ? 'المزامنة نشطة' : 'Mirroring ON') : (isRtl ? 'استئناف' : 'Resume')}
            </span>
          </button>

          {/* Open Manual Remote Control if user wants D-pad/keypad */}
          <button
            onClick={openFullRemote}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/10"
            title={isRtl ? 'فتح الريموت اليدوي' : 'Manual Remote Keypad'}
          >
            <Sliders size={13} className="text-rose-400" />
            <span className="hidden sm:inline">{isRtl ? 'الريموت' : 'Remote'}</span>
          </button>

          {/* Quick Play/Pause (only if media is active) */}
          {hasActiveMedia && (
            <button 
              onClick={handleTogglePlay} 
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95" 
              title={isPlaying ? (isRtl ? 'إيقاف مؤقت' : 'Pause') : (isRtl ? 'تشغيل' : 'Play')}
            >
              {isPlaying ? <Pause size={17} fill="white" /> : <Play size={17} fill="white" className="ms-0.5" />}
            </button>
          )}

          {/* Stop / End Remote Session */}
          <button 
            onClick={() => stopRemoteSession(false)} 
            className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-400 hover:text-white hover:bg-rose-600 flex items-center justify-center transition ms-1" 
            title={isRtl ? 'إنهاء التحكم الكامل' : 'Disconnect'}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Info Pill when browsing freely without active video */}
      {!hasActiveMedia && (
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 rounded-2xl px-3 py-2 border border-white/5">
          <Sparkles size={14} className="text-rose-400 flex-shrink-0" />
          <span className="truncate">
            {isRtl 
              ? `تصفحك لأي مكتبة أو فيلم أو مسلسل يعرض لحظياً على "${activeRemoteSession.targetDeviceName}".`
              : `Browsing libraries or selecting movies mirrors live to "${activeRemoteSession.targetDeviceName}".`}
          </span>
        </div>
      )}

      {/* Media Title (if available) */}
      {media.title && (
        <div className="flex items-center justify-between text-xs text-slate-300 px-1 -mt-0.5">
          <span className="truncate max-w-[280px] font-medium text-slate-200">
            {media.title}
          </span>
          {/* Pull button */}
          <button
            onClick={handlePullToLocal}
            className="text-[11px] text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1 hover:underline transition"
            title={isRtl ? 'استعادة المشاهدة على هذا الجهاز' : 'Play on this device'}
          >
            <Download size={11} />
            <span>{isRtl ? 'المشاهدة هنا' : 'Play Here'}</span>
          </button>
        </div>
      )}

      {/* Progress Bar & Volume - Shown when media is playing */}
      {hasActiveMedia && (
        <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
          {/* Progress with Seek buttons */}
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <button 
              onClick={() => handleSeekDelta(-10)} 
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="-10s"
            >
              <RotateCcw size={14} />
            </button>

            <span className="text-[11px] min-w-[36px]">{formatTime(currentTime)}</span>
            
            <div 
              className="relative flex-1 h-2 rounded-full bg-white/15 cursor-pointer overflow-hidden group"
              onClick={handleSeek}
            >
              <div 
                className="absolute top-0 bottom-0 bg-gradient-to-r from-red-600 to-rose-500 group-hover:brightness-125 transition-all duration-150 ease-out"
                style={{
                  [isRtl ? 'right' : 'left']: 0,
                  width: `${Math.max(0, Math.min(100, progressPercent))}%`
                }}
              />
            </div>

            <span className="text-[11px] min-w-[36px] text-right">{formatTime(duration)}</span>

            <button 
              onClick={() => handleSeekDelta(10)} 
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
              title="+10s"
            >
              <RotateCw size={14} />
            </button>
          </div>

          {/* Volume & Full Control Link */}
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <button
              onClick={openFullRemote}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition"
            >
              <Maximize2 size={11} />
              <span>{isRtl ? 'تكبير لوحة التحكم' : 'Expand Remote'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button onClick={handleToggleMute} className="p-1 hover:text-white transition rounded-lg hover:bg-white/5">
                {isMuted || volume === 0 ? <VolumeX size={15} className="text-amber-400" /> : <Volume2 size={15} />}
              </button>
              <div 
                className="relative w-20 h-1.5 rounded-full bg-white/15 cursor-pointer overflow-hidden group"
                onClick={handleVolumeChange}
              >
                <div 
                  className="absolute top-0 bottom-0 bg-white/80 group-hover:bg-white transition-all duration-150"
                  style={{
                    [isRtl ? 'right' : 'left']: 0,
                    width: `${(isMuted ? 0 : volume) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
