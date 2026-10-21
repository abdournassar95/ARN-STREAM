/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ARN Stream - Full PlayTo & Remote Control Center (Luxury Remote UI)
 * مركز التحكم الفاخر عن بُعد والبث المباشر للشاشات الذكية (مستوحى من معمارية Jellyfin)
 * 
 * تطوير وبرمجة: عبده رجب نصار (ARN Technology)
 * حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Tv,
  Smartphone,
  Tablet,
  Monitor,
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Radio,
  Sliders,
  Crop,
  Scan,
  StretchHorizontal,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  Music,
  Power,
  Search,
  Compass,
  Library,
  Sparkles,
  Subtitles,
  Headphones,
  Keyboard,
  Send,
  Eye,
  Trash2,
  CornerDownLeft,
  Check,
  Disc
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import client from '../../api/client';

function getDeviceIcon(type, isDlna = false) {
  if (isDlna) return <Tv size={22} className="text-emerald-400" />;
  switch (type) {
    case 'tv':
      return <Tv size={22} className="text-emerald-400" />;
    case 'mobile':
      return <Smartphone size={22} className="text-cyan-400" />;
    case 'tablet':
      return <Tablet size={22} className="text-purple-400" />;
    default:
      return <Monitor size={22} className="text-blue-400" />;
  }
}

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function FullRemoteControlModal() {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const navigate = useNavigate();

  const {
    activeRemoteSession,
    remotePlaybackState,
    isFullRemoteOpen,
    closeFullRemote,
    sendRemoteCommand,
    stopRemoteSession,
    pullPlaybackToLocalDevice,
    playMediaOnTarget,
    navigateTarget,
    displayContent,
    sendString,
    setSubtitleTrack,
    setAudioTrack,
    fetchTargetState
  } = useDeviceHandoffStore();

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(1);
  const [currentFit, setCurrentFit] = useState('contain');
  
  // Tabs: 'playback' | 'tracks' | 'keyboard' | 'library' | 'smart_tv'
  const [activeTab, setActiveTab] = useState('playback');

  // Virtual Keyboard state
  const [keyboardText, setKeyboardText] = useState('');

  // Library / Search Tab states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentMedia, setRecentMedia] = useState([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);
  const [navNotification, setNavNotification] = useState(null);

  // Sync with remote state or media initial state
  useEffect(() => {
    if (remotePlaybackState) {
      if (typeof remotePlaybackState.isPlaying === 'boolean') setIsPlaying(remotePlaybackState.isPlaying);
      if (typeof remotePlaybackState.isMuted === 'boolean') setIsMuted(remotePlaybackState.isMuted);
      if (typeof remotePlaybackState.volume === 'number') setVolume(remotePlaybackState.volume);
      if (typeof remotePlaybackState.currentTime === 'number') setCurrentTime(remotePlaybackState.currentTime);
      if (remotePlaybackState.speed) setCurrentSpeed(remotePlaybackState.speed);
      if (remotePlaybackState.fit) setCurrentFit(remotePlaybackState.fit);
    } else if (activeRemoteSession?.media) {
      const m = activeRemoteSession.media;
      if (typeof m.currentTime === 'number') setCurrentTime(m.currentTime);
      if (typeof m.isPlaying === 'boolean') setIsPlaying(m.isPlaying);
    }
  }, [remotePlaybackState, activeRemoteSession]);

  // Periodic polling for status when modal is open (especially for DLNA TVs)
  useEffect(() => {
    if (isFullRemoteOpen && activeRemoteSession?.targetDeviceId) {
      fetchTargetState(activeRemoteSession.targetDeviceId);
      const pollTimer = setInterval(() => {
        fetchTargetState(activeRemoteSession.targetDeviceId);
      }, 3000);
      return () => clearInterval(pollTimer);
    }
  }, [isFullRemoteOpen, activeRemoteSession?.targetDeviceId, fetchTargetState]);

  // Smooth local tick if playing
  useEffect(() => {
    if (isPlaying) {
      const dur = remotePlaybackState?.duration || activeRemoteSession?.media?.duration || 0;
      if (dur > 0) {
        const interval = setInterval(() => {
          setCurrentTime(prev => Math.min(prev + 1, dur));
        }, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [isPlaying, remotePlaybackState?.duration, activeRemoteSession?.media?.duration]);

  // Load recent media when library tab is opened
  useEffect(() => {
    if (isFullRemoteOpen && activeTab === 'library' && recentMedia.length === 0) {
      setIsLoadingRecent(true);
      client.get('/library/movies-home')
        .then(res => {
          const movies = res.data?.latestMovies || res.data?.recentlyAdded || [];
          setRecentMedia(movies.slice(0, 12));
          setIsLoadingRecent(false);
        })
        .catch(() => setIsLoadingRecent(false));
    }
  }, [isFullRemoteOpen, activeTab, recentMedia.length]);

  // Debounced search for library tab
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setIsSearching(true);
      client.get('/search', { params: { q: searchQuery.trim(), limit: 12 } })
        .then(res => {
          setSearchResults(res.data?.data || []);
          setIsSearching(false);
        })
        .catch(() => setIsSearching(false));
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  if (!isFullRemoteOpen || !activeRemoteSession) return null;

  const media = activeRemoteSession.media || {};
  const duration = remotePlaybackState?.duration || media.duration || 0;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const remainingTime = Math.max(0, duration - currentTime);

  const availableSubtitles = remotePlaybackState?.availableSubtitles || [];
  const selectedSubtitle = remotePlaybackState?.selectedSubtitle || null;
  const availableAudioTracks = remotePlaybackState?.availableAudioTracks || [];
  const selectedAudioTrack = remotePlaybackState?.selectedAudioTrack ?? 0;

  // Playback Control Commands
  const handleTogglePlay = () => {
    const next = !isPlaying;
    setIsPlaying(next);
    sendRemoteCommand(next ? 'play' : 'pause');
  };

  const handleSeek = (newTime) => {
    const clamped = Math.max(0, Math.min(newTime, duration));
    setCurrentTime(clamped);
    sendRemoteCommand('seek', clamped);
  };

  const handleSeekDelta = (delta) => {
    handleSeek(currentTime + delta);
    sendRemoteCommand('seek_delta', delta);
  };

  const handleTimelineClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const target = isRtl ? (1 - pos) * duration : pos * duration;
    handleSeek(target);
  };

  const handleVolumeChange = (newVol) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (clamped > 0 && isMuted) {
      setIsMuted(false);
      sendRemoteCommand('mute', false);
    }
    sendRemoteCommand('volume', clamped);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sendRemoteCommand('mute', next);
  };

  const handleSetSpeed = (speed) => {
    setCurrentSpeed(speed);
    sendRemoteCommand('speed', speed);
  };

  const handleSetFit = (fit) => {
    setCurrentFit(fit);
    sendRemoteCommand('fit', fit);
  };

  const handleRestart = () => {
    setCurrentTime(0);
    setIsPlaying(true);
    sendRemoteCommand('restart');
  };

  const handleDpad = (direction) => {
    sendRemoteCommand('dpad', direction);
  };

  const handlePullToLocal = () => {
    const result = pullPlaybackToLocalDevice();
    if (result && result.media) {
      const { media: m, currentTime: t } = result;
      if (m.type === 'movie' || m.type === 'episode') {
        navigate(`/watch/${m.type}/${m.id}?t=${Math.floor(t)}&autoPlay=true`);
      }
    }
  };

  const handleRemoteNavigate = (path, labelAr, labelEn) => {
    navigateTarget(path);
    setNavNotification(isRtl ? `تم توجيه الجهاز إلى: ${labelAr}` : `Navigated device to: ${labelEn}`);
    setTimeout(() => setNavNotification(null), 3500);
  };

  const handlePlayMediaOnRemote = async (item) => {
    const mediaPayload = {
      type: item.type || (item.series_id ? 'episode' : 'movie'),
      id: item.id,
      title: item.title,
      poster: item.poster || item.poster_path || item.thumbnail_path || null,
      currentTime: 0,
      duration: item.duration || 0,
      isPlaying: true
    };
    await playMediaOnTarget(mediaPayload);
    setActiveTab('playback');
    setNavNotification(isRtl ? `جاري تشغيل "${item.title}" على الجهاز...` : `Playing "${item.title}" on target...`);
    setTimeout(() => setNavNotification(null), 3500);
  };

  const handleDisplayContentOnRemote = async (item) => {
    const mediaType = item.type || (item.series_id ? 'episode' : 'movie');
    await displayContent(mediaType, item.id);
    setNavNotification(isRtl ? `تم إرسال بطاقة "${item.title}" للعرض على الشاشة` : `Displaying "${item.title}" on screen`);
    setTimeout(() => setNavNotification(null), 3500);
  };

  const handleSendVirtualKeyboard = (e) => {
    e?.preventDefault();
    if (keyboardText.trim()) {
      sendString(keyboardText.trim());
      setNavNotification(isRtl ? `تم إرسال: "${keyboardText}" للشاشة` : `Sent "${keyboardText}" to screen`);
      setTimeout(() => setNavNotification(null), 3500);
    }
  };

  const handleSelectSubtitle = (sub) => {
    setSubtitleTrack(sub);
    setNavNotification(
      sub
        ? (isRtl ? `تم تفعيل الترجمة: ${sub.title || sub.language}` : `Enabled subtitle: ${sub.title || sub.language}`)
        : (isRtl ? 'تم إيقاف الترجمة' : 'Subtitles turned off')
    );
    setTimeout(() => setNavNotification(null), 3500);
  };

  const handleSelectAudioTrack = (track) => {
    setAudioTrack(track.trackIndex ?? track);
    setNavNotification(
      isRtl ? `تم تبديل المسار الصوتي: ${track.title || track.language}` : `Switched audio track: ${track.title || track.language}`
    );
    setTimeout(() => setNavNotification(null), 3500);
  };

  const handleStopAndClose = () => {
    stopRemoteSession(true);
    closeFullRemote();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
      <div 
        className="relative w-full max-w-xl max-h-[95vh] overflow-y-auto rounded-3xl bg-[#0b1120]/95 border border-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] backdrop-blur-2xl text-white flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="sticky top-0 z-20 flex items-center justify-between px-5 py-4 bg-[#0b1120]/90 border-b border-white/10 backdrop-blur-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 shadow-inner">
              {getDeviceIcon(activeRemoteSession.targetDeviceType || 'tv', activeRemoteSession.isDlna)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <Radio size={12} className="animate-pulse" />
                <span>
                  {activeRemoteSession.isDlna
                    ? (isRtl ? 'بث مباشر DLNA (شاشة ذكية)' : 'DLNA Direct PlayTo')
                    : (isRtl ? 'بث مباشر وتحكم لحظي' : 'Live Real-time Cast')}
                </span>
              </div>
              <h3 className="text-base font-bold text-white truncate">
                {activeRemoteSession.targetDeviceName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Pull playback to local device */}
            <button
              onClick={handlePullToLocal}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white/90 hover:text-white flex items-center gap-1.5 transition active:scale-95 border border-white/10"
              title={isRtl ? 'استعادة المشاهدة على هذا الجهاز' : 'Pull playback to this device'}
            >
              <Download size={14} className="text-primaryMovies" />
              <span className="hidden sm:inline">{isRtl ? 'المشاهدة هنا' : 'Play Here'}</span>
            </button>

            {/* Close Modal button */}
            <button
              onClick={closeFullRemote}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/15 flex items-center justify-center text-slate-300 hover:text-white transition active:scale-95"
              title={isRtl ? 'تصغير الريموت' : 'Minimize'}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Floating Notification Banner */}
        {navNotification && (
          <div className="bg-emerald-500/20 border-b border-emerald-500/30 px-4 py-2 text-xs text-emerald-300 font-semibold flex items-center justify-center gap-2 animate-fadeIn">
            <Sparkles size={14} />
            <span>{navNotification}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 flex flex-col gap-6">

          {/* Active Media Card Header */}
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/10 shadow-inner">
            {media.poster ? (
              <img
                src={media.poster}
                alt={media.title || 'Media Poster'}
                className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl object-cover shadow-lg border border-white/10 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-24 sm:w-20 sm:h-28 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 flex-shrink-0">
                {media.type === 'track' ? <Music size={28} /> : <Film size={28} />}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primaryMovies/20 text-primaryMovies border border-primaryMovies/30 mb-1.5 uppercase">
                {media.type === 'movie' ? (isRtl ? 'فيلم' : 'Movie') : media.type === 'episode' ? (isRtl ? 'حلقة' : 'Episode') : (isRtl ? 'موسيقى' : 'Audio')}
              </span>
              <h4 className="text-base sm:text-lg font-bold text-white truncate leading-snug">
                {media.title || (isRtl ? 'محتوى معروض' : 'Playing Media')}
              </h4>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 font-mono">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>

          {/* Navigation Control Tabs (5 Modules) */}
          <div className="grid grid-cols-5 gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 overflow-x-auto">
            <button
              onClick={() => setActiveTab('playback')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'playback'
                  ? 'bg-primaryMovies text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Sliders size={13} />
              <span className="truncate">{isRtl ? 'التحكم' : 'Play'}</span>
            </button>
            <button
              onClick={() => setActiveTab('tracks')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'tracks'
                  ? 'bg-primaryMovies text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Subtitles size={13} />
              <span className="truncate">{isRtl ? 'الترجمة واللغات' : 'Tracks'}</span>
            </button>
            <button
              onClick={() => setActiveTab('keyboard')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'keyboard'
                  ? 'bg-primaryMovies text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Keyboard size={13} />
              <span className="truncate">{isRtl ? 'كيبورد' : 'Keyboard'}</span>
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'library'
                  ? 'bg-primaryMovies text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Library size={13} />
              <span className="truncate">{isRtl ? 'المكتبة' : 'Browse'}</span>
            </button>
            <button
              onClick={() => setActiveTab('smart_tv')}
              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                activeTab === 'smart_tv'
                  ? 'bg-primaryMovies text-white shadow-lg'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Tv size={13} />
              <span className="truncate">{isRtl ? 'D-Pad' : 'D-Pad'}</span>
            </button>
          </div>

          {/* TAB 1: Playback Console */}
          {activeTab === 'playback' && (
            <>
              {/* Timeline Scrubber */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span className="text-white font-bold">{formatTime(currentTime)}</span>
                  <span>{duration > 0 ? `-${formatTime(remainingTime)}` : formatTime(duration)}</span>
                </div>

                <div
                  role="slider"
                  tabIndex={0}
                  aria-label={isRtl ? 'مؤشر وقت التشغيل' : 'Playback scrubber'}
                  aria-valuenow={Math.round(currentTime)}
                  aria-valuemin={0}
                  aria-valuemax={Math.round(duration || 100)}
                  aria-valuetext={formatTime(currentTime)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowLeft') {
                      e.preventDefault();
                      handleSeekDelta(isRtl ? 10 : -10);
                    } else if (e.key === 'ArrowRight') {
                      e.preventDefault();
                      handleSeekDelta(isRtl ? -10 : 10);
                    }
                  }}
                  className="relative h-4 rounded-full bg-white/10 cursor-pointer overflow-hidden group border border-white/5 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  onClick={handleTimelineClick}
                >
                  <div
                    className="absolute top-0 bottom-0 bg-gradient-to-r from-red-600 to-rose-500 group-hover:brightness-125 transition-all duration-150"
                    style={{
                      [isRtl ? 'right' : 'left']: 0,
                      width: `${Math.max(0, Math.min(100, progressPercent))}%`
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_10px_white]"
                    style={{
                      [isRtl ? 'right' : 'left']: `${Math.max(0, Math.min(100, progressPercent))}%`
                    }}
                  />
                </div>

                {/* Quick Skip Buttons */}
                <div className="flex items-center justify-center gap-2 mt-1">
                  <button
                    onClick={() => handleSeekDelta(-30)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition active:scale-95"
                    title="-30s"
                  >
                    -30s
                  </button>
                  <button
                    onClick={() => handleSeekDelta(-10)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-1 transition active:scale-95"
                    title="-10s"
                  >
                    <RotateCcw size={14} />
                    <span>10s</span>
                  </button>
                  <button
                    onClick={() => handleSeekDelta(10)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white flex items-center gap-1 transition active:scale-95"
                    title="+10s"
                  >
                    <RotateCw size={14} />
                    <span>10s</span>
                  </button>
                  <button
                    onClick={() => handleSeekDelta(30)}
                    className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-slate-300 hover:text-white transition active:scale-95"
                    title="+30s"
                  >
                    +30s
                  </button>
                </div>
              </div>

              {/* Central Playback Controller */}
              <div className="flex items-center justify-center gap-5 sm:gap-6 py-2">
                {/* Restart from 0 */}
                <button
                  onClick={handleRestart}
                  className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white border border-white/10 transition active:scale-95 shadow-md"
                  title={isRtl ? 'إعادة التشغيل من البداية' : 'Restart from start'}
                >
                  <RotateCcw size={20} />
                </button>

                {/* Huge Play/Pause Button */}
                <button
                  onClick={handleTogglePlay}
                  className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-red-600 to-rose-500 hover:brightness-110 text-white flex items-center justify-center shadow-[0_10px_30px_rgba(225,29,72,0.45)] border border-rose-400/40 active:scale-95 transition"
                  title={isPlaying ? (isRtl ? 'إيقاف مؤقت' : 'Pause') : (isRtl ? 'تشغيل' : 'Play')}
                >
                  {isPlaying ? (
                    <Pause size={36} fill="white" />
                  ) : (
                    <Play size={36} fill="white" className="ms-1.5" />
                  )}
                </button>

                {/* Stop Playback completely */}
                <button
                  onClick={handleStopAndClose}
                  className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-white/10 hover:border-red-500/30 flex items-center justify-center transition active:scale-95 shadow-md"
                  title={isRtl ? 'إيقاف التشغيل وإنهاء الجلسة' : 'Stop and Disconnect'}
                >
                  <Power size={20} />
                </button>
              </div>

              {/* Volume Master Panel */}
              <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleMute}
                      className="p-1 rounded-lg hover:bg-white/10 transition"
                      title={isMuted ? 'إلغاء الكتم' : 'كتم'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX size={18} className="text-rose-400" />
                      ) : volume < 0.5 ? (
                        <Volume1 size={18} />
                      ) : (
                        <Volume2 size={18} />
                      )}
                    </button>
                    <span>{isRtl ? 'مستوى الصوت للجهاز' : 'Device Volume'}</span>
                  </div>
                  <span className="font-mono text-white font-bold">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleVolumeChange(volume - 0.1)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center transition"
                  >
                    -
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-white/15 rounded-lg appearance-none cursor-pointer accent-primaryMovies"
                  />

                  <button
                    onClick={() => handleVolumeChange(volume + 0.1)}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white flex items-center justify-center transition"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Speed & Aspect Ratio Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Playback Speed */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
                  <div className="text-xs font-semibold text-slate-300">
                    {isRtl ? 'سرعة التشغيل' : 'Playback Speed'}
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {[0.75, 1, 1.25, 1.5, 2].map((spd) => (
                      <button
                        key={spd}
                        onClick={() => handleSetSpeed(spd)}
                        className={`py-1.5 rounded-lg text-xs font-mono font-bold transition active:scale-95 ${
                          currentSpeed === spd
                            ? 'bg-primaryMovies text-white shadow-md'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
                  <div className="text-xs font-semibold text-slate-300">
                    {isRtl ? 'أبعاد الشاشة' : 'Aspect Ratio'}
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'contain', label: isRtl ? 'احتواء' : 'Fit', icon: Scan },
                      { id: 'cover', label: isRtl ? 'ملء' : 'Fill', icon: Crop },
                      { id: 'fill', label: isRtl ? 'تمدد' : 'Stretch', icon: StretchHorizontal }
                    ].map((opt) => {
                      const Icon = opt.icon;
                      const isSel = currentFit === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSetFit(opt.id)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95 ${
                            isSel
                              ? 'bg-primaryMovies text-white shadow-md'
                              : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <Icon size={13} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: Subtitles & Audio Tracks Control */}
          {activeTab === 'tracks' && (
            <div className="flex flex-col gap-5 animate-fadeIn">
              {/* Subtitles Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <Subtitles size={16} className="text-emerald-400" />
                    <span>{isRtl ? 'الترجمات المتاحة للشاشة البعيدة' : 'Remote Subtitles'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">({availableSubtitles.length + 1})</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {/* Turn off subtitles option */}
                  <button
                    onClick={() => handleSelectSubtitle(null)}
                    className={`w-full p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                      !selectedSubtitle
                        ? 'bg-primaryMovies/20 border-primaryMovies text-white'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span>{isRtl ? 'إيقاف الترجمة (بدون ترجمة)' : 'Subtitles Off'}</span>
                    {!selectedSubtitle && <Check size={14} className="text-emerald-400" />}
                  </button>

                  {/* List subtitles */}
                  {availableSubtitles.map((sub, idx) => {
                    const isSelected = !!selectedSubtitle && (
                      (sub.path && selectedSubtitle.path === sub.path) ||
                      (sub.id && selectedSubtitle.id === sub.id)
                    );
                    return (
                      <button
                        key={sub.id || idx}
                        onClick={() => handleSelectSubtitle(sub)}
                        className={`w-full p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                          isSelected
                            ? 'bg-primaryMovies/20 border-primaryMovies text-white'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{sub.title || sub.filename || `الترجمة ${idx + 1}`}</span>
                          {sub.language && (
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                              {sub.language}
                            </span>
                          )}
                        </div>
                        {isSelected && <Check size={14} className="text-emerald-400 flex-shrink-0 ms-2" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Audio Tracks Section */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <div className="flex items-center gap-2">
                    <Headphones size={16} className="text-cyan-400" />
                    <span>{isRtl ? 'مسارات الصوت والدبلجة' : 'Audio Tracks & Dubbing'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400">({availableAudioTracks.length || 1})</span>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                  {availableAudioTracks.length === 0 ? (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 flex items-center justify-between">
                      <span>{isRtl ? 'المسار الصوتي الافتراضي (Default Audio)' : 'Default Audio Stream'}</span>
                      <Check size={14} className="text-emerald-400" />
                    </div>
                  ) : (
                    availableAudioTracks.map((tr, idx) => {
                      const isSelected = selectedAudioTrack === (tr.trackIndex ?? idx);
                      return (
                        <button
                          key={tr.index || idx}
                          onClick={() => handleSelectAudioTrack(tr)}
                          className={`w-full p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition ${
                            isSelected
                              ? 'bg-cyan-500/20 border-cyan-500 text-white'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Disc size={13} className="text-cyan-400 flex-shrink-0" />
                            <span className="truncate">{tr.title || tr.language || `المسار ${idx + 1}`}</span>
                            {tr.codec && (
                              <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                                {tr.codec} {tr.channels ? `(${tr.channels}ch)` : ''}
                              </span>
                            )}
                          </div>
                          {isSelected && <Check size={14} className="text-cyan-400 flex-shrink-0 ms-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Virtual Keyboard & Search */}
          {activeTab === 'keyboard' && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="text-xs text-slate-300 leading-relaxed">
                {isRtl
                  ? 'اكتب أي نص أو عنوان بحث من كيبورد هاتفك ليتم إرساله وتعبئته فوراً على شاشة التلفاز الذكي دون الحاجة للريموت البطيء!'
                  : 'Type from your mobile keyboard to instantly send and fill text on the TV screen!'}
              </div>

              <form onSubmit={handleSendVirtualKeyboard} className="flex flex-col gap-3">
                <div className="relative">
                  <input
                    type="text"
                    value={keyboardText}
                    onChange={(e) => {
                      setKeyboardText(e.target.value);
                      // Live typing stream
                      sendString(e.target.value);
                    }}
                    placeholder={isRtl ? 'اكتب اسم الفيلم أو كلمة البحث هنا...' : 'Type search query or text here...'}
                    className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/15 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-primaryMovies transition"
                    autoFocus
                  />
                  {keyboardText && (
                    <button
                      type="button"
                      onClick={() => {
                        setKeyboardText('');
                        sendString('');
                      }}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-primaryMovies hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition"
                  >
                    <Send size={14} />
                    <span>{isRtl ? 'إرسال والبحث على التلفاز' : 'Send & Search on TV'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      sendRemoteCommand('dpad', 'enter');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                    title={isRtl ? 'زر موافق / إدخال' : 'Enter / OK'}
                  >
                    <CornerDownLeft size={14} />
                    <span>OK</span>
                  </button>
                </div>
              </form>

              {/* Quick Suggestion Chips */}
              <div className="space-y-2 pt-2">
                <div className="text-[11px] font-semibold text-slate-400">
                  {isRtl ? 'كلمات بحث سريعة بنقرة واحدة:' : 'Quick search chips:'}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['أفلام 2026', 'أكشن', 'كوميدي', 'دراما', 'خيال علمي', 'أنمي', 'مسلسلات جديدة', 'موسيقى'].map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setKeyboardText(tag);
                        sendString(tag);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-xs text-slate-300 hover:text-white transition active:scale-95"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Remote Library Browser & Display Content */}
          {activeTab === 'library' && (
            <div className="flex flex-col gap-5 animate-fadeIn">
              {/* Quick Remote Navigation Buttons */}
              <div className="flex flex-col gap-2">
                <div className="text-xs font-semibold text-slate-400">
                  {isRtl ? 'توجيه شاشة الجهاز المستهدف إلى:' : 'Navigate Device Screen To:'}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    onClick={() => handleRemoteNavigate('/movies', 'مكتبة الأفلام', 'Movies Library')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <Film size={15} className="text-rose-400" />
                    <span>{isRtl ? 'الأفلام' : 'Movies'}</span>
                  </button>
                  <button
                    onClick={() => handleRemoteNavigate('/series', 'مكتبة المسلسلات', 'Series Library')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <Tv size={15} className="text-cyan-400" />
                    <span>{isRtl ? 'المسلسلات' : 'Series'}</span>
                  </button>
                  <button
                    onClick={() => handleRemoteNavigate('/music', 'الموسيقى والأغاني', 'Music Library')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <Music size={15} className="text-emerald-400" />
                    <span>{isRtl ? 'الموسيقى' : 'Music'}</span>
                  </button>
                  <button
                    onClick={() => handleRemoteNavigate('/', 'الصفحة الرئيسية', 'Home')}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95"
                  >
                    <Compass size={15} className="text-amber-400" />
                    <span>{isRtl ? 'الرئيسية' : 'Home'}</span>
                  </button>
                </div>
              </div>

              {/* Instant Search Box */}
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search size={16} className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'right-3' : 'left-3'} text-slate-400 pointer-events-none`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? 'ابحث عن أي فيلم أو حلقة لتشغيلها أو عرضها عن بُعد...' : 'Search media to play or display on device...'}
                    className={`w-full py-2.5 rounded-xl bg-white/5 border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-primaryMovies transition ${
                      isRtl ? 'pr-9 pl-4' : 'pl-9 pr-4'
                    }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'left-3' : 'right-3'} text-slate-400 hover:text-white`}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results / Recent Media Grid */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>
                    {searchQuery.trim()
                      ? (isRtl ? `نتائج البحث (${searchResults.length})` : `Search Results (${searchResults.length})`)
                      : (isRtl ? 'أحدث الوسائط بالمكتبة' : 'Latest Library Media')}
                  </span>
                  {isSearching && <span className="text-rose-400 animate-pulse text-[11px]">{isRtl ? 'جاري البحث...' : 'Searching...'}</span>}
                </div>

                <div className="max-h-[300px] overflow-y-auto space-y-1.5 pe-1 custom-scrollbar">
                  {(searchQuery.trim() ? searchResults : recentMedia).map((item) => {
                    const isTrack = item.type === 'track';
                    const isMovie = item.type === 'movie' || (!item.type && !item.series_id);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {item.poster || item.poster_path ? (
                            <img
                              src={item.poster || item.poster_path}
                              alt={item.title || 'Poster'}
                              className="w-9 h-12 rounded-lg object-cover flex-shrink-0 border border-white/10"
                            />
                          ) : (
                            <div className="w-9 h-12 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 flex-shrink-0">
                              {isTrack ? <Music size={16} /> : <Film size={16} />}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h5 className="text-xs font-bold text-white truncate group-hover:text-rose-300 transition">
                              {item.title}
                            </h5>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                              <span className="uppercase">{isTrack ? 'موسيقى' : isMovie ? 'فيلم' : 'مسلسل'}</span>
                              {item.year && <span>• {item.year}</span>}
                              {item.duration && <span>• {formatTime(item.duration)}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Dual Actions: Display on TV vs Play Now */}
                        <div className="flex items-center gap-1.5 flex-shrink-0 ms-2">
                          <button
                            onClick={() => handleDisplayContentOnRemote(item)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 text-xs font-bold flex items-center gap-1 transition"
                            title={isRtl ? 'عرض بطاقة الفيلم على الشاشة دون مقاطعة التشغيل' : 'Display info on screen'}
                          >
                            <Eye size={12} className="text-cyan-400" />
                            <span className="hidden sm:inline">{isRtl ? 'عرض' : 'View'}</span>
                          </button>

                          <button
                            onClick={() => handlePlayMediaOnRemote(item)}
                            className="px-3 py-1.5 rounded-lg bg-primaryMovies hover:brightness-110 active:scale-95 text-white text-xs font-bold flex items-center gap-1 transition shadow"
                            title={isRtl ? 'تشغيل فوري على الجهاز' : 'Play on target'}
                          >
                            <Play size={12} fill="white" />
                            <span>{isRtl ? 'تشغيل' : 'Play'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {(searchQuery.trim() ? searchResults : recentMedia).length === 0 && (
                    <div className="text-center py-8 text-xs text-slate-400">
                      {isSearching
                        ? (isRtl ? 'جاري البحث في كافة المكتبات...' : 'Searching...')
                        : (isRtl ? 'لا توجد نتائج مطابقة، جرّب البحث بكلمة أخرى.' : 'No items found.')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Smart TV D-Pad Remote Controller */}
          {activeTab === 'smart_tv' && (
            <div className="flex flex-col items-center justify-center py-4 gap-6 animate-fadeIn">
              <div className="text-xs text-slate-400 text-center max-w-xs">
                {isRtl
                  ? 'استخدم لوحة الأسهم للتنقل داخل واجهة الشاشة الذكية أو التقديم والتأخير ومستوى الصوت.'
                  : 'Use the D-pad to navigate on Smart TV, seek video, and control volume.'}
              </div>

              {/* Circular D-Pad */}
              <div className="relative w-56 h-56 rounded-full bg-slate-900/90 border-2 border-white/20 shadow-2xl flex items-center justify-center p-3">
                {/* UP */}
                <button
                  onClick={() => handleDpad('up')}
                  className="absolute top-2 left-1/2 -translate-x-1/2 w-14 h-12 rounded-t-full bg-white/5 hover:bg-white/20 active:bg-primaryMovies flex items-center justify-center text-slate-200 transition"
                  title={isRtl ? 'أعلى (رفع الصوت)' : 'Up / Vol Up'}
                >
                  <ChevronUp size={24} />
                </button>

                {/* DOWN */}
                <button
                  onClick={() => handleDpad('down')}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2 w-14 h-12 rounded-b-full bg-white/5 hover:bg-white/20 active:bg-primaryMovies flex items-center justify-center text-slate-200 transition"
                  title={isRtl ? 'أسفل (خفض الصوت)' : 'Down / Vol Down'}
                >
                  <ChevronDown size={24} />
                </button>

                {/* LEFT */}
                <button
                  onClick={() => handleDpad('left')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-14 rounded-s-full bg-white/5 hover:bg-white/20 active:bg-primaryMovies flex items-center justify-center text-slate-200 transition"
                  title={isRtl ? 'يسار (-10 ثوانٍ)' : 'Left / Seek -10s'}
                >
                  <ChevronLeft size={24} />
                </button>

                {/* RIGHT */}
                <button
                  onClick={() => handleDpad('right')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-14 rounded-e-full bg-white/5 hover:bg-white/20 active:bg-primaryMovies flex items-center justify-center text-slate-200 transition"
                  title={isRtl ? 'يمين (+10 ثوانٍ)' : 'Right / Seek +10s'}
                >
                  <ChevronRight size={24} />
                </button>

                {/* OK / ENTER */}
                <button
                  onClick={() => handleDpad('enter')}
                  className="w-20 h-20 rounded-full bg-primaryMovies hover:brightness-110 active:scale-95 text-white font-bold text-sm flex items-center justify-center shadow-lg transition border border-rose-400/40"
                  title="OK / Play / Pause"
                >
                  OK
                </button>
              </div>

              {/* Extra TV Navigation Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDpad('back')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 hover:text-white transition active:scale-95"
                >
                  {isRtl ? 'رجوع (Back)' : 'Back'}
                </button>
                <button
                  onClick={() => handleRemoteNavigate('/', 'الصفحة الرئيسية', 'Home')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 hover:text-white transition active:scale-95"
                >
                  {isRtl ? 'الرئيسية (Home)' : 'Home'}
                </button>
              </div>
            </div>
          )}

          {/* Bottom Action Footer */}
          <div className="pt-4 border-t border-white/10 flex items-center justify-between">
            <button
              onClick={handleStopAndClose}
              className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-2 transition active:scale-95 border border-red-500/20"
            >
              <Power size={14} />
              <span>{isRtl ? 'إنهاء البث وإيقاف التشغيل' : 'Stop & End Session'}</span>
            </button>

            <button
              onClick={closeFullRemote}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition active:scale-95"
            >
              {isRtl ? 'إغلاق النافذة' : 'Close'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
