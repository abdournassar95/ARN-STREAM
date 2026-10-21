import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useEqualizerStore } from '../../store/useEqualizerStore';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import { equalizerEngine } from '../../utils/audioEqualizerEngine';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Shuffle, Repeat, Repeat1, ChevronDown, ListMusic, Heart, Type, GripVertical, X, Star, Sliders, Cast, Activity } from 'lucide-react';
import client, { savePlayback, toggleFavorite, recordPlay, fetchLyrics, rateTrack, saveVolumeSettings, fetchVolumeSettings } from '../../api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import AddToPlaylist from './AddToPlaylist';
import EqualizerModal from './EqualizerModal';
import SynchronizedLyrics from './SynchronizedLyrics';
import AudioVisualizer from './AudioVisualizer';
import { useAuthStore } from '../../store/useAuthStore';

/* ─── Animated Equalizer Bars ─── */
function Equalizer() {
  return (
    <div className="flex items-end gap-[2px] h-3.5 w-4">
      <span className="w-[3px] bg-primaryMusic rounded-full animate-eq-1" />
      <span className="w-[3px] bg-primaryMusic rounded-full animate-eq-2" />
      <span className="w-[3px] bg-primaryMusic rounded-full animate-eq-3" />
    </div>
  );
}

/* ─── fmt helper ─── */
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* ══════════════════════════════════════════════════════
   QueueList — with Drag & Drop support (Memoized for 60fps)
   Rewritten to use Tailwind classes instead of inline styles
   so it properly responds to light/dark theme via design tokens.
══════════════════════════════════════════════════════ */
const QueueList = memo(function QueueList({ queue, currentIndex, isPlaying, onTrackClick, onRemove, onDragEnd, queueRef, isMobile }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const handleDragStart = (e, idx) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    setOverIdx(idx);
  };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      onDragEnd(dragIdx, idx);
    }
    setDragIdx(null);
    setOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null); };
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-shrink-0 px-1">
        <ListMusic size={16} className="text-primaryMusic" />
        <h3 className="text-sm font-semibold text-muted">{isRtl ? `قائمة التشغيل • ${queue.length} أغنية` : `Queue • ${queue.length} tracks`}</h3>
      </div>

      {/* Scrollable list */}
      <div
        ref={queueRef}
        className="overflow-y-auto scrollbar-none"
        style={{
          maxHeight: isMobile ? 'calc(100vh - 230px)' : 'calc(100vh - 170px)',
          paddingBottom: '24px',
        }}
      >
        {queue.map((track, idx) => {
          const isActive = idx === currentIndex;
          const trackCover = track.cover || null;
          const isDragging = dragIdx === idx;
          const isHovered = overIdx === idx && !isDragging;
          return (
            <button
              key={track.id || idx}
              data-active={isActive}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              onClick={() => onTrackClick(track, idx)}
              className={`
                flex items-center gap-2.5 w-full text-start p-2 rounded-xl mb-1 border transition-colors duration-150 cursor-grab
                ${isActive
                  ? 'bg-primaryMusic/10 border-primaryMusic/30'
                  : isHovered
                  ? 'border-primaryMusic/40'
                  : isDragging
                  ? 'bg-white/5 opacity-50'
                  : 'border-transparent'
                }
              `}
            >
              {/* Drag handle */}
              <div className="w-4 flex-shrink-0 cursor-grab text-muted">
                <GripVertical size={14} />
              </div>

              {/* Number / Equalizer */}
              <div className="w-6 flex-shrink-0 flex items-center justify-center">
                {isActive && isPlaying ? (
                  <Equalizer />
                ) : isActive ? (
                  <Pause size={14} className="text-primaryMusic" />
                ) : (
                  <span className="text-[11px] text-muted">{idx + 1}</span>
                )}
              </div>

              {/* Cover */}
              <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-surfaceHover border border-white/10 flex items-center justify-center">
                {trackCover
                  ? <img src={trackCover} alt="" className="w-full h-full object-cover" />
                  : <span className="text-[11px] text-muted">♪</span>
                }
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-medium truncate ${isActive ? 'text-primaryMusic' : 'text-text'}`}>
                  {track.title}
                </div>
                <div className="text-[11px] text-muted truncate">
                  {track.artistName}{track.albumTitle ? ` • ${track.albumTitle}` : ''}
                </div>
              </div>

              {/* Duration */}
              {track.duration ? (
                <span className="text-[11px] text-muted flex-shrink-0 tabular-nums">
                  {fmt(track.duration)}
                </span>
              ) : null}

              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(idx); }}
                className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center text-muted/50 hover:text-muted hover:bg-white/5 transition-colors"
              >
                <X size={14} />
              </button>
            </button>
          );
        })}

        {queue.length === 0 && (
          <div className="text-center py-12 text-muted">
            <ListMusic size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">{isRtl ? 'لا توجد أغاني في قائمة التشغيل' : 'Queue is empty'}</p>
          </div>
        )}
      </div>
    </div>
  );
});

/* ══════════════════════════════════════════════════════
   MiniPlayer
══════════════════════════════════════════════════════ */
export default function MiniPlayer() {
  // Granular store selectors to prevent re-renders when non-music state changes
  const currentTrack = usePlayerStore(s => s.currentTrack);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const togglePlay = usePlayerStore(s => s.togglePlay);
  const nextTrack = usePlayerStore(s => s.nextTrack);
  const prevTrack = usePlayerStore(s => s.prevTrack);
  const volume = usePlayerStore(s => s.volume);
  const setVolume = usePlayerStore(s => s.setVolume);
  const musicQueue = usePlayerStore(s => s.musicQueue);
  const currentIndex = usePlayerStore(s => s.currentIndex);
  const repeat = usePlayerStore(s => s.repeat);
  const toggleRepeat = usePlayerStore(s => s.toggleRepeat);
  const shuffle = usePlayerStore(s => s.shuffle);
  const toggleShuffle = usePlayerStore(s => s.toggleShuffle);
  const playTrack = usePlayerStore(s => s.playTrack);
  const removeFromQueue = usePlayerStore(s => s.removeFromQueue);
  const moveInQueue = usePlayerStore(s => s.moveInQueue);
  const crossfade = usePlayerStore(s => s.crossfade);
  const crossfadeDuration = usePlayerStore(s => s.crossfadeDuration);

  const audioRef = useRef(null);
  const consecutiveErrorsRef = useRef(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const [expanded, setExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [trackRating, setTrackRating] = useState(0);
  const queueRef = useRef(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const playRecordedRef = useRef(null);

  const { globalVolume, setGlobalVolume } = useSettingsStore();
  const {
    enabled: eqEnabled,
    bands: eqBands,
    preamp: eqPreamp,
    delayEnabled,
    delayTime,
    delayFeedback,
    delayWet,
    echoEnabled,
    echoTime,
    echoFeedback,
    echoWet
  } = useEqualizerStore();
  const { deviceId, openCastModal, activeRemoteSession, openFullRemote } = useDeviceHandoffStore();
  const canCast = useAuthStore(s => s.canCast);

  const handleVolumeChange = useCallback((newVal) => {
    const v = Math.max(0, Math.min(1, newVal));
    setVolume(v);
    setGlobalVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    saveVolumeSettings({ volume: v, muted: v === 0 }).catch(() => {});
  }, [setVolume, setGlobalVolume]);

  // Listen to remote commands from another device and local pause requests
  useEffect(() => {
    const handleRemoteCommand = (e) => {
      const { command, value } = e.detail || {};
      const audio = audioRef.current;
      if (!audio) return;

      switch (command) {
        case 'play':
          togglePlay();
          break;
        case 'pause':
          usePlayerStore.getState().setPlaying(false);
          break;
        case 'stop':
          usePlayerStore.getState().setPlaying(false);
          break;
        case 'next_track':
          nextTrack();
          break;
        case 'prev_track':
          prevTrack();
          break;
        case 'seek_delta':
          if (typeof value === 'number') {
            audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + value));
          }
          break;
        case 'seek':
          if (typeof value === 'number') {
            audio.currentTime = value;
          }
          break;
        case 'volume':
          if (typeof value === 'number') {
            handleVolumeChange(value);
          }
          break;
        case 'mute':
          if (value) handleVolumeChange(0);
          else handleVolumeChange(globalVolume || 0.8);
          break;
        default:
          break;
      }
    };

    const handlePauseLocal = () => {
      usePlayerStore.getState().setPlaying(false);
    };

    window.addEventListener('arn-remote-command', handleRemoteCommand);
    window.addEventListener('arn-pause-local-playback', handlePauseLocal);
    return () => {
      window.removeEventListener('arn-remote-command', handleRemoteCommand);
      window.removeEventListener('arn-pause-local-playback', handlePauseLocal);
    };
  }, [togglePlay, globalVolume, handleVolumeChange]);

  // Real-time synchronization of music playback state to controlling devices
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;

    const syncMusicState = (override = {}) => {
      const aud = audioRef.current;
      if (!aud || !currentTrack) return;
      client.post('/handoff/state', {
        fromDeviceId: deviceId,
        state: {
          currentTime: aud.currentTime || 0,
          duration: aud.duration || currentTrack.duration || 0,
          isPlaying: !aud.paused,
          volume: aud.volume,
          isMuted: aud.muted,
          speed: aud.playbackRate || 1,
          media: {
            id: currentTrack.id,
            type: 'track',
            title: currentTrack.title,
            artist: currentTrack.artist || currentTrack.artistName || null,
            poster: currentTrack.cover || currentTrack.poster || null,
            duration: aud.duration || currentTrack.duration || 0
          },
          ...override
        }
      }).catch(() => {});
    };

    syncMusicState();

    const onPlay = () => syncMusicState({ isPlaying: true });
    const onPause = () => syncMusicState({ isPlaying: false });
    const onSeeked = () => syncMusicState();
    const onVolChange = () => syncMusicState({ volume: audio.volume, isMuted: audio.muted });

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('seeked', onSeeked);
    audio.addEventListener('volumechange', onVolChange);

    const interval = setInterval(() => {
      if (!audio.paused) {
        syncMusicState();
      }
    }, 1500);

    return () => {
      clearInterval(interval);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('seeked', onSeeked);
      audio.removeEventListener('volumechange', onVolChange);
    };
  }, [currentTrack, deviceId]);

  // Attach & sync equalizer engine with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      equalizerEngine.attach(audio, {
        bands: eqBands,
        preamp: eqPreamp,
        enabled: eqEnabled,
        delay: {
          enabled: delayEnabled,
          time: delayTime,
          feedback: delayFeedback,
          wet: delayWet
        },
        echo: {
          enabled: echoEnabled,
          time: echoTime,
          feedback: echoFeedback,
          wet: echoWet
        }
      });
    }
  }, [
    currentTrack?.id,
    eqBands,
    eqPreamp,
    eqEnabled,
    delayEnabled,
    delayTime,
    delayFeedback,
    delayWet,
    echoEnabled,
    echoTime,
    echoFeedback,
    echoWet
  ]);

  // Media Session API for background playback and OS controls
  useEffect(() => {
    if (currentTrack && 'mediaSession' in navigator) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title || 'Unknown Title',
        artist: currentTrack.artistName || 'Unknown Artist',
        album: currentTrack.albumTitle || '',
        artwork: currentTrack.cover ? [
          { src: currentTrack.cover, sizes: '512x512', type: 'image/jpeg' },
          { src: currentTrack.cover, sizes: '192x192', type: 'image/jpeg' }
        ] : []
      });

      try {
        navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().setPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().setPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().prevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => usePlayerStore.getState().nextTrack());
      } catch (e) {
        console.warn('Media Session API action handlers error:', e);
      }
    }
  }, [currentTrack]);

  // Resume Web Audio Context on play
  useEffect(() => {
    if (isPlaying) {
      equalizerEngine.resume();
    }
  }, [isPlaying]);

  // Load server volume settings on initial audio mount
  useEffect(() => {
    fetchVolumeSettings().then(res => {
      if (res && typeof res.volume === 'number') {
        const v = Math.max(0, Math.min(1, res.volume));
        setVolume(v);
        setGlobalVolume(v);
        if (audioRef.current) audioRef.current.volume = v;
      }
    }).catch(() => {});
  }, [setVolume, setGlobalVolume]);

  // Keep audio element strictly locked to chosen volume on track changes and replays
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = volume;
    }
  }, [volume, currentTrack?.id]);

  // Fetch lyrics
  const { data: lyricsData } = useQuery({
    queryKey: ['lyrics', currentTrack?.id],
    queryFn: () => fetchLyrics(currentTrack.id),
    enabled: !!currentTrack && showLyrics,
  });

  // Update fav/rating state when track changes
  useEffect(() => {
    if (currentTrack) {
      setIsFav(!!currentTrack.is_favorite);
      setTrackRating(currentTrack.rating || 0);
    }
  }, [currentTrack?.id]);

  const favMut = useMutation({
    mutationFn: () => toggleFavorite(currentTrack.id),
    onSuccess: (data) => {
      setIsFav(!!data.is_favorite);
      qc.invalidateQueries({ queryKey: ['favorites'] });
    }
  });

  const rateMut = useMutation({
    mutationFn: (r) => rateTrack(currentTrack.id, r),
    onSuccess: (data) => setTrackRating(data.rating)
  });

  const crossfadeTriggeredRef = useRef(false);

  useEffect(() => {
    if (currentTrack) {
      crossfadeTriggeredRef.current = false;
      if (crossfade) equalizerEngine.fadeIn(500);
    }
  }, [currentTrack?.id, crossfade]);

  useEffect(() => {
    if (!crossfade || duration <= 0 || !isPlaying || crossfadeTriggeredRef.current) return;
    const remaining = duration - currentTime;
    if (remaining > 0 && remaining <= crossfadeDuration) {
      crossfadeTriggeredRef.current = true;
      equalizerEngine.fadeOut(crossfadeDuration * 1000);
      const timer = setTimeout(() => {
        usePlayerStore.getState().nextTrack();
      }, remaining * 1000);
      return () => clearTimeout(timer);
    }
  }, [currentTime, duration, crossfade, crossfadeDuration, isPlaying]);

  // Handle track ending and auto-advancing seamlessly
  const handleEnded = useCallback(() => {
    const { repeat, musicQueue, nextTrack } = usePlayerStore.getState();
    if (repeat === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else if (musicQueue && musicQueue.length > 0) {
      if (crossfade && crossfadeDuration > 0) {
        equalizerEngine.fadeOut(crossfadeDuration * 1000);
        setTimeout(() => {
          nextTrack();
        }, crossfadeDuration * 1000);
      } else {
        nextTrack();
      }
    }
  }, [crossfade, crossfadeDuration]);

  // Sync play/pause state with audio element
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      const p = audio.play();
      if (p !== undefined) {
        p.catch((err) => {
          if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
            console.warn('Audio play error:', err);
          }
          if (err.name === 'NotAllowedError') {
            usePlayerStore.getState().setPlaying(false);
          }
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack?.id]);

  const handleTimeUpdate = (e) => {
    const cur = e.currentTarget.currentTime;
    const dur = e.currentTarget.duration || currentTrack?.duration || 0;
    setCurrentTime(cur);
    if (dur > 0 && dur !== duration) setDuration(dur);
  };

  const handleLoadedMetadata = (e) => {
    const dur = e.currentTarget.duration || currentTrack?.duration || 0;
    setDuration(dur);
    e.currentTarget.volume = volume;
    equalizerEngine.attach(e.currentTarget, {
      bands: eqBands,
      preamp: eqPreamp,
      enabled: eqEnabled,
      delay: {
        enabled: delayEnabled,
        time: delayTime,
        feedback: delayFeedback,
        wet: delayWet
      },
      echo: {
        enabled: echoEnabled,
        time: echoTime,
        feedback: echoFeedback,
        wet: echoWet
      }
    });
  };

  const handleCanPlay = (e) => {
    if (isPlaying && e.currentTarget.paused) {
      e.currentTarget.play().catch((err) => {
        if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
          console.warn('Playback error on canplay:', err);
        }
      });
    }
  };

  // Record play count when a track starts playing
  useEffect(() => {
    if (!currentTrack || !isPlaying) return;
    if (playRecordedRef.current === currentTrack.id) return;
    playRecordedRef.current = currentTrack.id;
    recordPlay(currentTrack.id).catch(() => {});
  }, [currentTrack?.id, isPlaying]);

  // Scroll to active track
  useEffect(() => {
    if ((expanded || showQueue) && queueRef.current) {
      const activeEl = queueRef.current.querySelector('[data-active="true"]');
      if (activeEl) activeEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [expanded, showQueue, currentIndex]);

  // Lock body scroll when expanded
  useEffect(() => {
    document.body.style.overflow = expanded ? 'hidden' : '';
    if (!expanded) { setShowQueue(false); setShowLyrics(false); }
    return () => { document.body.style.overflow = ''; };
  }, [expanded]);

  // Save playback position every 5s
  useEffect(() => {
    if (!currentTrack) return;
    const id = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        savePlayback({ media_type: 'track', media_id: currentTrack.id, position: Math.round(audioRef.current.currentTime), duration: Math.round(audioRef.current.duration || currentTrack.duration || 0) }).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(id);
  }, [currentTrack]);

  const handleSeek = (e) => {
    const val = Number(e.target.value);
    if (audioRef.current && audioRef.current.duration) {
      const targetTime = (val / 100) * audioRef.current.duration;
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleProgressClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const isRtl = document.documentElement.dir === 'rtl';
    const offsetX = isRtl ? (rect.right - e.clientX) : (e.clientX - rect.left);
    const pct = Math.max(0, Math.min(100, (offsetX / rect.width) * 100));
    if (audioRef.current && audioRef.current.duration) {
      const targetTime = (pct / 100) * audioRef.current.duration;
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const handleDirectSeek = useCallback((targetSeconds) => {
    if (audioRef.current && isFinite(targetSeconds)) {
      audioRef.current.currentTime = targetSeconds;
      setCurrentTime(targetSeconds);
    }
  }, []);

  const handleArtistClick = (e) => {
    e.stopPropagation();
    if (currentTrack?.artistId) { navigate(`/music/artist/${currentTrack.artistId}`); setExpanded(false); }
  };

  const handleQueueTrackClick = useCallback((track) => playTrack(track, musicQueue), [playTrack, musicQueue]);
  const handleRemoveFromQueue = useCallback((idx) => removeFromQueue(idx), [removeFromQueue]);
  const handleDragEnd = useCallback((fromIdx, toIdx) => moveInQueue(fromIdx, toIdx), [moveInQueue]);

  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const repeatIcon = repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />;
  const repeatColor = repeat === 'off' ? 'text-muted' : 'text-primaryMusic';
  const repeatTitle = isRtl
    ? (repeat === 'off' ? 'لا تكرار' : repeat === 'one' ? 'تكرار أغنية واحدة' : 'تكرار الكل')
    : (repeat === 'off' ? 'No Repeat' : repeat === 'one' ? 'Repeat One' : 'Repeat All');

  if (!currentTrack) return null;
  const imgSrc = currentTrack.cover || null;

  return (
    <>
      {/* ═══════════ EXPANDED PLAYER ═══════════ */}
      {expanded && (
        <div className="fixed inset-0 z-[100] bg-bgr/98 backdrop-blur-2xl flex flex-col animate-slideUpFullscreen">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
            <button onClick={() => setExpanded(false)} aria-label="Collapse player" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-surfaceHover transition">
              <ChevronDown size={18} />
            </button>
            <div className="text-[11px] sm:text-xs text-muted uppercase tracking-widest font-medium">
              {musicQueue.length > 0 ? `${currentIndex + 1} / ${musicQueue.length}` : ''}
            </div>
            <div className="flex items-center gap-2">
              {/* Equalizer button */}
              <button 
                onClick={() => setShowEqualizer(true)} 
                aria-label={isRtl ? "موازن الصوت (Equalizer)" : "Audio Equalizer"}
                className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition ${
                  eqEnabled ? 'bg-primaryMusic/20 border-primaryMusic/40 text-primaryMusic' : 'bg-surface border-border text-muted hover:text-text'
                }`}
                title={isRtl ? "موازن الصوت (Equalizer)" : "Audio Equalizer"}
              >
                <Sliders size={18} />
                {eqEnabled && <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-primaryMusic animate-pulse" />}
              </button>
              {/* Visualizer button */}
              <button 
                onClick={() => setShowVisualizer(!showVisualizer)} 
                aria-label={isRtl ? "محلل الترددات البصري (Visualizer)" : "Audio Visualizer"}
                className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition ${
                  showVisualizer ? 'bg-primaryMusic/20 border-primaryMusic/40 text-primaryMusic' : 'bg-surface border-border text-muted hover:text-text'
                }`}
                title={isRtl ? "محلل الترددات البصري (Visualizer)" : "Audio Visualizer"}
              >
                <Activity size={18} />
                {showVisualizer && <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-primaryMusic animate-pulse" />}
              </button>
              {/* Favorite button */}
              <button onClick={() => favMut.mutate()} aria-label="Toggle favorite" className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition ${isFav ? 'bg-pink-500/20 border-pink-500/30 text-pink-500' : 'bg-surface border-border text-muted hover:text-pink-400'}`}>
                <Heart size={18} fill={isFav ? 'currentColor' : 'none'} />
              </button>
              {/* Lyrics button */}
              <button onClick={() => { setShowLyrics(!showLyrics); setShowQueue(false); }} aria-label="Toggle lyrics" className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition ${showLyrics ? 'bg-primaryMusic/20 border-primaryMusic/30 text-primaryMusic' : 'bg-surface border-border text-muted hover:text-text'}`}>
                <Type size={18} />
              </button>
              <AddToPlaylist trackId={currentTrack.id} iconSize={18} />
              {/* Cast / Handoff button */}
              {canCast() && (
                <button 
                  onClick={() => {
                    if (activeRemoteSession) {
                      openFullRemote();
                    } else {
                      openCastModal({
                        type: 'track',
                        id: currentTrack.id,
                        title: currentTrack.title,
                        poster: currentTrack.cover || null,
                        currentTime,
                        duration,
                        isPlaying,
                        track: currentTrack
                      });
                    }
                  }}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center transition ${
                    activeRemoteSession 
                      ? 'bg-primaryMusic/20 border-primaryMusic/40 text-primaryMusic' 
                      : 'border-border bg-surface text-muted hover:text-primaryMusic'
                  }`}
                  title={activeRemoteSession 
                    ? (isRtl ? `التحكم بـ ${activeRemoteSession.targetDeviceName}` : `Control ${activeRemoteSession.targetDeviceName}`)
                    : (isRtl ? "نقل الاستماع لشاشة أو جهاز آخر (Cast)" : "Cast audio to another device")
                  }
                >
                  <Cast size={18} />
                </button>
              )}
            </div>
          </div>

          {/* ══ MOBILE (< md) ══ */}
          <div className="flex-1 flex flex-col md:hidden" style={{ overflow: 'hidden' }}>
            {/* Tabs */}
            <div className="flex items-center gap-1 px-4 mb-3 flex-shrink-0">
              <button onClick={() => setShowQueue(false)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition ${!showQueue ? 'bg-primaryMusic/15 text-primaryMusic border border-primaryMusic/30' : 'bg-surface/50 text-muted border border-transparent'}`}>
                {isRtl ? 'الأغنية الحالية' : 'Now Playing'}
              </button>
              <button onClick={() => setShowQueue(true)} className={`flex-1 py-2 rounded-xl text-xs font-medium transition flex items-center justify-center gap-1.5 ${showQueue ? 'bg-primaryMusic/15 text-primaryMusic border border-primaryMusic/30' : 'bg-surface/50 text-muted border border-transparent'}`}>
                <ListMusic size={13} />
                {isRtl ? `القائمة (${musicQueue.length})` : `Queue (${musicQueue.length})`}
              </button>
            </div>

            {!showQueue ? (
              /* Now Playing or Lyrics */
              <div className="flex-1 flex flex-col items-center justify-center px-6 pb-4 overflow-y-auto">
                {showLyrics ? (
                  <div className="w-full flex-1 flex flex-col h-full overflow-hidden">
                    <SynchronizedLyrics
                      trackId={currentTrack.id}
                      currentTime={currentTime}
                      duration={duration}
                      isPlaying={isPlaying}
                      onSeek={handleDirectSeek}
                      trackTitle={currentTrack.title}
                      artistName={currentTrack.artistName}
                      albumTitle={currentTrack.albumTitle}
                    />
                  </div>
                ) : (
                  <>
                    <div className="w-[220px] h-[220px] xs:w-[260px] xs:h-[260px] sm:w-[300px] sm:h-[300px] rounded-2xl sm:rounded-3xl overflow-hidden bg-surface border border-tx/10 shadow-[0_0_40px_rgba(255,255,255,0.06)] flex-shrink-0 relative">
                      {showVisualizer ? (
                        <AudioVisualizer isPlaying={isPlaying} coverSrc={imgSrc} trackTitle={currentTrack.title} />
                      ) : imgSrc ? (
                        <img src={imgSrc} alt={currentTrack.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-surfaceHover"><ListMusic size={48} className="text-muted/30" /></div>
                      )}
                      <div className="absolute inset-0 rounded-2xl sm:rounded-3xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>
                    </div>
                    <div className="mt-5 text-center w-full max-w-[320px]">
                      <h2 className="text-lg sm:text-xl font-bold truncate">{currentTrack.title}</h2>
                      {currentTrack.artistName && <button onClick={handleArtistClick} className="text-sm text-primaryMusic hover:underline mt-1 transition">{currentTrack.artistName}</button>}
                      {currentTrack.albumTitle && <div className="text-[11px] text-muted mt-0.5 truncate">{currentTrack.albumTitle}</div>}
                    </div>
                    <div className="w-full max-w-[320px] mt-5">
                      <div className="h-1.5 bg-border rounded-full cursor-pointer" onClick={handleProgressClick}>
                        <div className="h-full bg-primaryMusic rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <div className="flex justify-between mt-1.5 text-[10px] text-muted tabular-nums">
                        <span>{fmt(currentTime)}</span><span>{duration ? fmt(duration) : '--:--'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                      <button onClick={toggleShuffle} className={`w-10 h-10 rounded-full hover:bg-tx/10 flex items-center justify-center transition ${shuffle ? 'text-primaryMusic' : 'text-muted'}`}><Shuffle size={18} /></button>
                      <button onClick={prevTrack} className="w-11 h-11 rounded-full hover:bg-tx/10 flex items-center justify-center"><SkipBack size={22} /></button>
                      <button onClick={togglePlay} className="w-16 h-16 rounded-full bg-primaryMusic text-black flex items-center justify-center hover:scale-105 shadow-lg shadow-primaryMusic/30 transition">
                        {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ms-1" />}
                      </button>
                      <button onClick={nextTrack} className="w-11 h-11 rounded-full hover:bg-tx/10 flex items-center justify-center"><SkipForward size={22} /></button>
                      <button onClick={toggleRepeat} className={`w-10 h-10 rounded-full hover:bg-tx/10 flex items-center justify-center transition ${repeatColor}`} title={repeatTitle}>{repeatIcon}</button>
                    </div>
                    <div className="flex items-center gap-2 mt-4 w-full max-w-[220px]">
                      <button onClick={() => handleVolumeChange(volume > 0 ? 0 : (globalVolume || 0.8))} className="text-muted hover:text-text transition">
                        {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      </button>
                      <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => handleVolumeChange(Number(e.target.value))} className="flex-1 accent-primaryMusic" />
                      <span className="text-[10px] text-muted w-6 text-end">{Math.round(volume * 100)}%</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Queue (mobile) */
              <div className="px-4">
                <QueueList
                  queue={musicQueue}
                  currentIndex={currentIndex}
                  isPlaying={isPlaying}
                  onTrackClick={handleQueueTrackClick}
                  onRemove={handleRemoveFromQueue}
                  onDragEnd={handleDragEnd}
                  queueRef={queueRef}
                  isMobile={true}
                />
              </div>
            )}
          </div>

          {/* ══ DESKTOP (≥ md) ══ */}
          <div className="flex-1 hidden md:flex gap-6 lg:gap-8 overflow-hidden px-6 lg:px-10 pb-6">
            {/* LEFT: Album Art or Visualizer */}
            <div className="flex flex-col items-center justify-center w-[45%] lg:w-[40%] xl:w-[38%] flex-shrink-0">
              <div className="w-[280px] h-[280px] lg:w-[340px] lg:h-[340px] xl:w-[400px] xl:h-[400px] rounded-3xl overflow-hidden bg-surface border border-tx/10 shadow-[0_0_50px_rgba(255,255,255,0.06)] flex-shrink-0 relative">
                {showVisualizer ? (
                  <AudioVisualizer isPlaying={isPlaying} coverSrc={imgSrc} trackTitle={currentTrack.title} />
                ) : imgSrc ? (
                  <img src={imgSrc} alt={currentTrack.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-surfaceHover"><ListMusic size={64} className="text-muted/30" /></div>
                )}
                {/* Subtle inner highlight */}
                <div className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>
              </div>
              <div className="mt-6 text-center max-w-[400px] w-full">
                <h2 className="text-xl lg:text-2xl xl:text-3xl font-bold truncate">{currentTrack.title}</h2>
                {currentTrack.artistName && <button onClick={handleArtistClick} className="text-sm lg:text-base text-primaryMusic hover:underline mt-1 transition">{currentTrack.artistName}</button>}
                {currentTrack.albumTitle && <div className="text-xs text-muted mt-1 truncate">{currentTrack.albumTitle}</div>}
              </div>
              <div className="w-full max-w-[400px] mt-6">
                <div className="h-1.5 bg-border rounded-full cursor-pointer relative group" onClick={handleProgressClick}>
                  <div className="h-full bg-primaryMusic rounded-full transition-all relative" style={{ width: `${progress}%` }}>
                    <div className="absolute end-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition" />
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-[11px] text-muted tabular-nums">
                  <span>{fmt(currentTime)}</span><span>{duration ? fmt(duration) : '--:--'}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-5">
                <button onClick={toggleShuffle} aria-label="Shuffle" className={`w-10 h-10 rounded-full hover:bg-tx/10 flex items-center justify-center transition ${shuffle ? 'text-primaryMusic' : 'text-muted'}`}><Shuffle size={17} /></button>
                <button onClick={prevTrack} aria-label="Previous track" className="w-11 h-11 rounded-full hover:bg-tx/10 flex items-center justify-center"><SkipBack size={22} /></button>
                <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-primaryMusic text-black flex items-center justify-center hover:scale-105 shadow-lg shadow-primaryMusic/30 transition">
                  {isPlaying ? <Pause size={26} fill="black" /> : <Play size={26} fill="black" className="ms-1" />}
                </button>
                <button onClick={nextTrack} aria-label="Next track" className="w-11 h-11 rounded-full hover:bg-tx/10 flex items-center justify-center"><SkipForward size={22} /></button>
                <button onClick={toggleRepeat} aria-label={repeatTitle} className={`w-10 h-10 rounded-full hover:bg-tx/10 flex items-center justify-center transition ${repeatColor}`} title={repeatTitle}>{repeatIcon}</button>
              </div>
              <div className="flex items-center gap-2 mt-4 w-full max-w-[220px]">
                <button onClick={() => handleVolumeChange(volume > 0 ? 0 : (globalVolume || 0.8))} aria-label="Volume mute toggle" className="text-muted hover:text-text transition">
                  {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => handleVolumeChange(Number(e.target.value))} className="flex-1 accent-primaryMusic" />
                <span className="text-[10px] text-muted w-6 text-end">{Math.round(volume * 100)}%</span>
              </div>
            </div>

            {/* RIGHT: Queue or Lyrics */}
            <div className="flex-1 border-s border-border ps-6 lg:ps-8 relative">
              {showLyrics ? (
                <div className="absolute inset-0 flex flex-col overflow-hidden">
                  <SynchronizedLyrics
                    trackId={currentTrack.id}
                    currentTime={currentTime}
                    duration={duration}
                    isPlaying={isPlaying}
                    onSeek={handleDirectSeek}
                    trackTitle={currentTrack.title}
                    artistName={currentTrack.artistName}
                    albumTitle={currentTrack.albumTitle}
                  />
                </div>
              ) : (
                <QueueList
                  queue={musicQueue}
                  currentIndex={currentIndex}
                  isPlaying={isPlaying}
                  onTrackClick={handleQueueTrackClick}
                  onRemove={handleRemoveFromQueue}
                  onDragEnd={handleDragEnd}
                  queueRef={queueRef}
                  isMobile={false}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ MINI PLAYER BAR ═══════════ */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-surface/70 backdrop-blur-xl border-t border-border shadow-xl">
        <div className="h-1 bg-border relative cursor-pointer" onClick={handleProgressClick}>
          <div className="h-full bg-primaryMusic transition-all" style={{ width: `${progress}%` }} />
        </div>

        {/* Mobile Bar (< sm) */}
        <div className="sm:hidden px-3 h-[64px] flex items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(true)}>
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-surfaceHover flex-shrink-0 border border-border/50">
              {imgSrc ? <img src={imgSrc} alt={currentTrack.title || "Cover"} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-muted">♪</div>}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold truncate">{currentTrack.title}</div>
              <div className="text-[10px] text-muted truncate">{currentTrack.artistName || ''}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={prevTrack} aria-label="Previous track" className="w-8 h-8 rounded-full hover:bg-tx/10 flex items-center justify-center"><SkipBack size={16} /></button>
            <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="w-10 h-10 rounded-full bg-primaryMusic text-black flex items-center justify-center shadow">
              {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ms-0.5" />}
            </button>
            <button onClick={nextTrack} aria-label="Next track" className="w-8 h-8 rounded-full hover:bg-tx/10 flex items-center justify-center"><SkipForward size={16} /></button>
          </div>
        </div>

        {/* Tablet/Desktop Bar (≥ sm) */}
        <div className="hidden sm:flex max-w-[1600px] mx-auto px-4 h-[72px] items-center gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setExpanded(true)}>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-surfaceHover flex-shrink-0 shadow border border-border/50 hover:border-primaryMusic/50 transition">
              {imgSrc ? <img src={imgSrc} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-muted">♪</div>}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{currentTrack.title}</div>
              {currentTrack.artistName ? (
                <button onClick={handleArtistClick} className="text-xs text-muted truncate hover:text-primaryMusic hover:underline transition-colors text-start max-w-full block" title={currentTrack.artistName}>
                  {currentTrack.artistName}
                </button>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={toggleShuffle} aria-label="Shuffle" className={`hidden md:flex w-8 h-8 rounded-full hover:bg-tx/10 items-center justify-center transition ${shuffle ? 'text-primaryMusic' : 'text-muted'}`}><Shuffle size={15} /></button>
            <button onClick={prevTrack} aria-label="Previous track" className="w-8 h-8 rounded-full hover:bg-tx/10 flex items-center justify-center"><SkipBack size={18} /></button>
            <button onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"} className="w-10 h-10 rounded-full bg-primaryMusic text-black flex items-center justify-center hover:brightness-110 shadow-md">
              {isPlaying ? <Pause size={18} fill="black" /> : <Play size={18} fill="black" className="ms-0.5" />}
            </button>
            <button onClick={nextTrack} aria-label="Next track" className="w-8 h-8 rounded-full hover:bg-tx/10 flex items-center justify-center"><SkipForward size={18} /></button>
            <button onClick={toggleRepeat} aria-label={repeatTitle} className={`hidden md:flex w-8 h-8 rounded-full hover:bg-tx/10 items-center justify-center transition ${repeatColor}`} title={repeatTitle}>{repeatIcon}</button>
            <AddToPlaylist trackId={currentTrack.id} iconSize={15} className="hidden md:flex" />
            <button onClick={(e) => { e.stopPropagation(); favMut.mutate(); }} aria-label={isRtl ? 'المفضلة' : 'Favorite'} className={`hidden md:flex w-8 h-8 rounded-full hover:bg-tx/10 items-center justify-center transition ${isFav ? 'text-pink-500' : 'text-muted hover:text-pink-400'}`} title={isRtl ? 'المفضلة' : 'Favorite'}>
              <Heart size={15} fill={isFav ? 'currentColor' : 'none'} />
            </button>
            {/* Equalizer button */}
            <button 
              onClick={(e) => { e.stopPropagation(); setShowEqualizer(true); }}
              className={`relative hidden sm:flex w-8 h-8 rounded-full hover:bg-tx/10 items-center justify-center transition ${
                eqEnabled ? 'text-primaryMusic' : 'text-muted hover:text-text'
              }`} 
              title={isRtl ? "موازن الصوت (Equalizer)" : "Audio Equalizer"}
            >
              <Sliders size={15} />
              {eqEnabled && <span className="absolute top-1.5 end-1.5 w-1.5 h-1.5 rounded-full bg-primaryMusic animate-pulse" />}
            </button>
            {/* Cast / Handoff button */}
            {canCast() && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeRemoteSession) {
                    openFullRemote();
                  } else {
                    openCastModal({
                      type: 'track',
                      id: currentTrack.id,
                      title: currentTrack.title,
                      poster: currentTrack.cover || null,
                      currentTime,
                      duration,
                      isPlaying,
                      track: currentTrack
                    });
                  }
                }}
                className={`hidden sm:flex w-8 h-8 rounded-full items-center justify-center transition ${
                  activeRemoteSession
                    ? 'bg-primaryMusic/20 text-primaryMusic'
                    : 'hover:bg-tx/10 text-muted hover:text-primaryMusic'
                }`}
                title={activeRemoteSession 
                  ? (isRtl ? `التحكم بـ ${activeRemoteSession.targetDeviceName}` : `Control ${activeRemoteSession.targetDeviceName}`)
                  : (isRtl ? "نقل الاستماع لشاشة أو جهاز آخر (Cast)" : "Cast audio to another device")
                }
              >
                <Cast size={15} />
              </button>
            )}
            <button onClick={() => setExpanded(true)} className="w-8 h-8 rounded-full hover:bg-tx/10 flex items-center justify-center text-muted hover:text-primaryMusic transition" title={isRtl ? "قائمة التشغيل" : "Queue"}>
              <ListMusic size={15} />
            </button>
          </div>
          <div className="hidden lg:flex items-center gap-3 flex-1 justify-end max-w-[400px]">
            <span className="text-xs text-muted tabular-nums whitespace-nowrap flex-shrink-0">
              {fmt(currentTime)} / {duration ? fmt(duration) : '--:--'}
            </span>
            <input type="range" min={0} max={100} value={progress} onChange={handleSeek} className="flex-1 accent-primaryMusic min-w-[80px]" />
            <div className="flex items-center gap-2 ms-4">
              <button onClick={() => handleVolumeChange(volume > 0 ? 0 : (globalVolume || 0.8))} className="text-muted hover:text-text transition">
                {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={volume} onChange={e => handleVolumeChange(Number(e.target.value))} className="w-20 accent-primaryMusic" />
              <span className="text-[10px] text-muted w-6 text-end">{Math.round(volume * 100)}%</span>
            </div>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={currentTrack ? `/api/stream/track/${currentTrack.id}${localStorage.getItem('arn_auth_token') ? `?token=${encodeURIComponent(localStorage.getItem('arn_auth_token'))}` : ''}` : undefined}
        preload="auto"
        crossOrigin="anonymous"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        onError={(e) => {
          console.error('Audio playback error:', e.currentTarget.error);
          consecutiveErrorsRef.current += 1;
          if (consecutiveErrorsRef.current >= 3) {
            console.warn('Playback paused: 3 consecutive audio errors encountered.');
            usePlayerStore.getState().setPlaying(false);
            consecutiveErrorsRef.current = 0;
          } else {
            usePlayerStore.getState().nextTrack();
          }
        }}
        onPlay={(e) => {
          consecutiveErrorsRef.current = 0;
          e.currentTarget.volume = volume;
          equalizerEngine.resume();
          if (!isPlaying) {
            usePlayerStore.getState().setPlaying(true);
          }
        }}
      />

      <EqualizerModal
        isOpen={showEqualizer}
        onClose={() => setShowEqualizer(false)}
      />
    </>
  );
}
