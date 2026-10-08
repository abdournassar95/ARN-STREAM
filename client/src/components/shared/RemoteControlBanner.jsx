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
  Download
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

  return (
    <div className="fixed bottom-24 sm:bottom-6 inset-x-3 sm:inset-x-auto sm:start-1/2 sm:-translate-x-1/2 z-50 flex flex-col gap-2.5 px-4 sm:px-5 py-3.5 rounded-3xl bg-[#0b1120]/95 text-white border border-rose-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-slideInUp min-w-[320px] sm:min-w-[460px] max-w-xl">
      
      {/* Top Row: Device Info & Full Control CTA */}
      <div className="flex items-center justify-between gap-3">
        {/* Target Device Info (Clicking opens Full Remote) */}
        <div 
          onClick={openFullRemote}
          className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
          title={isRtl ? 'فتح مركز التحكم الكامل' : 'Open Full Remote Control'}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-red-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition">
            <Tv size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold mb-0.5">
              <Radio size={10} className="animate-pulse" />
              <span>{isRtl ? 'يتم العرض الآن على:' : 'Casting to:'}</span>
            </div>
            <div className="text-sm font-bold text-white group-hover:text-rose-300 transition truncate">
              {activeRemoteSession.targetDeviceName}
            </div>
          </div>
        </div>

        {/* Buttons: Full Control & Main Actions */}
        <div className="flex items-center gap-2">
          {/* Full Control Button */}
          <button
            onClick={openFullRemote}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-red-900/40 border border-rose-400/40"
            title={isRtl ? 'التحكم الكامل في الجهاز' : 'Full Remote Control'}
          >
            <Sliders size={13} />
            <span>{isRtl ? 'التحكم الكامل' : 'Full Control'}</span>
          </button>

          {/* Quick Play/Pause */}
          <button 
            onClick={handleTogglePlay} 
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95" 
            title={isPlaying ? (isRtl ? 'إيقاف مؤقت' : 'Pause') : (isRtl ? 'تشغيل' : 'Play')}
          >
            {isPlaying ? <Pause size={17} fill="white" /> : <Play size={17} fill="white" className="ms-0.5" />}
          </button>

          {/* Close session */}
          <button 
            onClick={() => stopRemoteSession(false)} 
            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition ms-1" 
            title={isRtl ? 'إغلاق هذا الشريط' : 'Dismiss'}
          >
            <X size={15} />
          </button>
        </div>
      </div>

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

      {/* Progress Bar & Volume - ALWAYS visible */}
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

    </div>
  );
}
