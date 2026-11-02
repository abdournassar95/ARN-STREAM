import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Server,
  Sliders,
  Maximize2,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  SkipForward,
  SkipBack,
  EyeOff,
  Radio,
  X,
  Search,
  ListPlus,
  Tv,
  PictureInPicture2,
  Headphones,
} from 'lucide-react';
import { getChannelFallbackLogo } from '../../utils/iptvIcons';
import { normalizeProxyUrl } from '../../utils/catalogStorage';
import { useEqualizerStore } from '../../store/useEqualizerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { equalizerEngine } from '../../utils/audioEqualizerEngine';
import EqualizerModal from '../music/EqualizerModal';
import RadioStudioVisualizer from './RadioStudioVisualizer';

export const HlsVideoPlayer = ({
  channel,
  onChannelWatched,
  onServersLoaded,
  categoryChannels = [],
  categoryTitle = 'قنوات التصنيف',
  activeSection = 'live',
  onToggleSection,
  onSelectChannel,
  onOpenPlaylistModal,
}) => {
  const theme = useSettingsStore(s => s.theme);
  const isDark = theme !== 'light';

  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // Web Audio API refs for 200% volume amplification
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);
  const connectedVideoRef = useRef(null);

  // Servers state (dynamically fetched from Drama Live getLiveById)
  const [dynamicServers, setDynamicServers] = useState([]);
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  const [serverIndex, setServerIndex] = useState(0);

  // Playback & volume state (persisted across sessions)
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(() => {
    try {
      const saved = Number(localStorage.getItem('arn_iptv_volume_pref'));
      return Number.isFinite(saved) && saved >= 0 && saved <= 200 ? saved : 100;
    } catch {
      return 100;
    }
  }); // 0 to 200%
  const [showVolOverlay, setShowVolOverlay] = useState(false);
  const volOverlayTimerRef = useRef(null);
  const [showEqualizer, setShowEqualizer] = useState(false);
  const eqEnabled = useEqualizerStore((s) => s.enabled);
  const eqPreset = useEqualizerStore((s) => s.currentPreset);

  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = Auto
  const [audioTracks, setAudioTracks] = useState([]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(() => {
    try {
      const saved = localStorage.getItem('arn_iptv_aspect_pref');
      return saved && ['default', '16:9', '4:3', 'fill', 'cover'].includes(saved) ? saved : 'default';
    } catch {
      return 'default';
    }
  });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Auto-hide controls in fullscreen mode
  const [showControls, setShowControls] = useState(true);
  const controlsTimerRef = useRef(null);

  // Fullscreen Left Edge Channel Drawer
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const leftDrawerTimerRef = useRef(null);
  const drawerListRef = useRef(null);
  const isLeftDrawerOpenRef = useRef(isLeftDrawerOpen);
  useEffect(() => {
    isLeftDrawerOpenRef.current = isLeftDrawerOpen;
  }, [isLeftDrawerOpen]);

  // Rotating Live Broadcast Watermark GIF (Rotates corner every 2 minutes / 120,000 ms)
  const [watermarkCorner, setWatermarkCorner] = useState(0); // 0: Top-Right, 1: Bottom-Right, 2: Bottom-Left, 3: Top-Left
  const [watermarkVisible, setWatermarkVisible] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('جار فك التشفير...');
  const [failoverNotice, setFailoverNotice] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Determine active servers list
  const effectiveServers = useMemo(() => {
    const rawList = dynamicServers.length > 0 ? dynamicServers : (channel?.sources || []);
    return rawList.map((s) => ({
      ...s,
      url: normalizeProxyUrl(s.url),
    }));
  }, [dynamicServers, channel?.sources]);

  const activeSource = effectiveServers[serverIndex] || effectiveServers[0];

  // Filter channels for the fullscreen left drawer
  const filteredDrawerChannels = useMemo(() => {
    if (!categoryChannels || categoryChannels.length === 0) return [];
    if (!drawerSearch.trim()) return categoryChannels;
    const q = drawerSearch.trim().toLowerCase();
    return categoryChannels.filter((c) => c.name.toLowerCase().includes(q));
  }, [categoryChannels, drawerSearch]);

  // Fetch full server candidates from Drama Live API when channel has fgLiveId
  useEffect(() => {
    if (!channel) {
      setDynamicServers([]);
      return;
    }

    setDynamicServers(channel.sources || []);

    if (channel.fgLiveId) {
      let active = true;
      setIsLoadingServers(true);
      fetch(
        `/api/live/fg/channel-servers/${encodeURIComponent(channel.fgLiveId)}?code=${encodeURIComponent(
          channel.fgCode || '232425'
        )}`
      )
        .then((r) => r.json())
        .then((data) => {
          if (!active) return;
          if (data.success && Array.isArray(data.servers) && data.servers.length > 0) {
            const normalized = data.servers.map((s) => ({
              ...s,
              url: normalizeProxyUrl(s.url),
            }));
            setDynamicServers(normalized);
            onServersLoaded?.(channel.id, normalized);
          }
        })
        .catch((srvErr) => {
          console.warn('[HlsPlayer] Failed to fetch dynamic servers for channel:', srvErr);
        })
        .finally(() => {
          if (active) setIsLoadingServers(false);
        });

      return () => {
        active = false;
      };
    }
  }, [channel?.id, channel?.fgLiveId, channel?.fgCode]);

  // Ensure the video element is routed through the shared ARN audio engine
  // (10-band EQ + FX + per-element gain for >100% volume boost)
  const ensureAudioBoostGraph = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    try {
      const ctx = equalizerEngine.initContext();
      if (!ctx) return;
      audioCtxRef.current = ctx;
      equalizerEngine.resume();

      if (connectedVideoRef.current === videoEl && equalizerEngine.isAttached(videoEl)) return;

      if (connectedVideoRef.current && connectedVideoRef.current !== videoEl) {
        equalizerEngine.detach(connectedVideoRef.current);
      }

      const route = equalizerEngine.attach(videoEl, undefined, { primary: false });
      if (!route) return;
      gainNodeRef.current = route.gain;
      connectedVideoRef.current = videoEl;

      const vol = volumeRef.current;
      const isM = isMuted || vol === 0;
      route.gain.gain.value = isM ? 0 : vol / 100;
    } catch (audioErr) {
      console.warn('[WebAudio] Audio engine setup failed, falling back to standard HTML5 audio:', audioErr);
    }
  }, []);

  // Volume ref to decouple high-frequency volume updates from event listener rebinding
  const volumeRef = useRef(100);

  // Detach from the shared audio engine & clear timers on component unmount
  useEffect(() => {
    return () => {
      if (connectedVideoRef.current) {
        equalizerEngine.detach(connectedVideoRef.current);
        connectedVideoRef.current = null;
        gainNodeRef.current = null;
      }
      if (volOverlayTimerRef.current) {
        window.clearTimeout(volOverlayTimerRef.current);
      }
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
      if (leftDrawerTimerRef.current) {
        window.clearTimeout(leftDrawerTimerRef.current);
      }
      
    };
  }, []);

  // Apply volume (0 - 200%) with OSD overlay
  const applyVolume = useCallback(
    (newVol, triggerOverlay = true) => {
      const clamped = Math.max(0, Math.min(200, Math.round(newVol)));
      volumeRef.current = clamped;
      setVolumeState(clamped);
      try {
        localStorage.setItem('arn_iptv_volume_pref', String(clamped));
      } catch {}

      const videoEl = videoRef.current;
      if (videoEl) {
        if (clamped === 0) {
          videoEl.muted = true;
          setIsMuted(true);
        } else {
          videoEl.muted = false;
          setIsMuted(false);
        }

        const isM = clamped === 0;
        const targetGain = isM ? 0 : clamped / 100;
        videoEl.volume = Math.min(1.0, clamped / 100);
        ensureAudioBoostGraph();
        if (gainNodeRef.current) {
          gainNodeRef.current.gain.value = targetGain;
        }
      }

      if (triggerOverlay) {
        setShowVolOverlay(true);
        if (volOverlayTimerRef.current) {
          window.clearTimeout(volOverlayTimerRef.current);
        }
        volOverlayTimerRef.current = window.setTimeout(() => {
          setShowVolOverlay(false);
        }, 1200);
      }
    },
    [ensureAudioBoostGraph]
  );

  // Auto-hide controls timer in fullscreen mode
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }
    if (isFullscreen) {
      controlsTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  }, [isFullscreen]);

  useEffect(() => {
    if (isFullscreen) {
      resetControlsTimer();
    } else {
      setShowControls(true);
      setIsLeftDrawerOpen(false);
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    }
  }, [isFullscreen, resetControlsTimer]);

  // Handle mouse move across player: resets auto-hide & checks for left-edge trigger in fullscreen
  const handlePlayerMouseMove = (e) => {
    resetControlsTimer();
    if (isFullscreen) {
      if (e.clientX <= 45) {
        if (leftDrawerTimerRef.current) {
          window.clearTimeout(leftDrawerTimerRef.current);
          leftDrawerTimerRef.current = null;
        }
        setIsLeftDrawerOpen(true);
      } else if (e.clientX > 380 && isLeftDrawerOpen) {
        if (!leftDrawerTimerRef.current) {
          leftDrawerTimerRef.current = window.setTimeout(() => {
            setIsLeftDrawerOpen(false);
            leftDrawerTimerRef.current = null;
          }, 350);
        }
      }
    }
  };

  // Reset server index when channel changes and ensure background music is stopped
  useEffect(() => {
    usePlayerStore.getState().stopMusicForVideo();
    setServerIndex(0);
    setFailoverNotice(null);
    setErrorMsg(null);
    if (channel && onChannelWatched) {
      onChannelWatched(channel);
    }
  }, [channel?.id]);

  // Load and play stream via Hls.js with Auto-Failover & Multi-Quality extraction
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !channel) return;

    if (!activeSource) return;

    setIsLoading(true);
    setErrorMsg(null);
    setLoadingMessage(
      channel.section === 'radio'
        ? 'جاري الاتصال بالإذاعة...'
        : 'جار فك التشفير...'
    );
    setQualities([]);
    setCurrentQuality(-1);
    setAudioTracks([]);
    setCurrentAudioTrack(0);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const handleAutoFailover = (reason) => {
      if (serverIndex + 1 < effectiveServers.length) {
        const nextIdx = serverIndex + 1;
        const nextServer = effectiveServers[nextIdx];
        if (channel.section !== 'radio') {
          setFailoverNotice(`تعذر الاتصال بالسيرفر الحالي (${reason}) — تم التحويل تلقائياً إلى ${nextServer.name}`);
        }
        setServerIndex(nextIdx);
      } else {
        setIsLoading(false);
        setErrorMsg('تعذر تشغيل البث من جميع السيرفرات المتاحة لهذه القناة. جرب التحديث أو اختيار سيرفر آخر.');
      }
    };

    const sourceUrl = normalizeProxyUrl(activeSource.url);

    const isDirectAudio =
      channel.section === 'radio' &&
      !sourceUrl.toLowerCase().includes('.m3u8');

    if (isDirectAudio) {
      videoEl.src = sourceUrl;
      videoEl.load();

      const onCanPlay = () => {
        setIsLoading(false);
        videoEl
          .play()
          .then(() => {
            setIsPlaying(true);
            applyVolume(volume, false);
          })
          .catch(() => {
            setIsPlaying(false);
          });
      };

      const onError = () => {
        handleAutoFailover('تعذر تشغيل تدفق الراديو الصوتي');
      };

      videoEl.addEventListener('canplay', onCanPlay, { once: true });
      videoEl.addEventListener('error', onError, { once: true });

      return () => {
        videoEl.removeEventListener('canplay', onCanPlay);
        videoEl.removeEventListener('error', onError);
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 60,
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 1,
        levelLoadingTimeOut: 12000,
      });
      hlsRef.current = hls;

      hls.loadSource(sourceUrl);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsLoading(false);
        const extractedLevels = data.levels.map((lvl, index) => {
          const height = lvl.height || 0;
          const bitrateKbps = Math.round((lvl.bitrate || 0) / 1000);
          let label = height ? `${height}p (${bitrateKbps} kbps)` : `مستوى ${index + 1} (${bitrateKbps} kbps)`;
          if (height >= 2160) label = `4K UHD (${height}p · ${bitrateKbps} kbps)`;
          else if (height >= 1080) label = `FHD 1080p (${bitrateKbps} kbps)`;
          else if (height >= 720) label = `HD 720p (${bitrateKbps} kbps)`;
          else if (height >= 480) label = `SD 480p (${bitrateKbps} kbps)`;
          else if (height > 0) label = `LD ${height}p (${bitrateKbps} kbps)`;

          return {
            index,
            height,
            width: lvl.width || 0,
            bitrate: bitrateKbps,
            label,
          };
        });

        setQualities(extractedLevels);
        if (Array.isArray(data.audioTracks) && data.audioTracks.length > 1) {
          setAudioTracks(
            data.audioTracks.map((t, idx) => ({
              id: idx,
              name: t.name || t.lang || `مسار صوتي ${idx + 1}`,
              lang: t.lang,
            }))
          );
        }
        videoEl
          .play()
          .then(() => {
            setIsPlaying(true);
            applyVolume(volume, false);
          })
          .catch(() => {
            setIsPlaying(false);
          });
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
        if (Array.isArray(data.audioTracks) && data.audioTracks.length > 1) {
          setAudioTracks(
            data.audioTracks.map((t, idx) => ({
              id: idx,
              name: t.name || t.lang || `مسار صوتي ${idx + 1}`,
              lang: t.lang,
            }))
          );
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.destroy();
              handleAutoFailover('خطأ في شبكة البث');
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              handleAutoFailover('خطأ غير متوقع في محرك HLS');
              break;
          }
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = sourceUrl;
      videoEl
        .play()
        .then(() => {
          setIsLoading(false);
          setIsPlaying(true);
        })
        .catch(() => {
          setIsLoading(false);
          setIsPlaying(false);
        });
    } else {
      setIsLoading(false);
      setErrorMsg('متصفحك الحالي لا يدعم تقنية تشغيل دفق HLS.');
    }

    // Audio-only watchdog: If a TV channel plays audio but has 0 video dimensions, failover to next video server
    let audioOnlyCheckTimer = null;
    const onTimeUpdateAudioOnlyCheck = () => {
      if (channel.section !== 'radio' && videoEl.currentTime >= 2) {
        if (videoEl.videoWidth === 0 && videoEl.videoHeight === 0) {
          videoEl.removeEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
          if (audioOnlyCheckTimer) window.clearTimeout(audioOnlyCheckTimer);
          console.warn('[HlsVideoPlayer] Audio-only stream detected on TV channel, auto-failing over:', channel.name);
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          handleAutoFailover('تم اكتشاف بث صوتي فقط بدون صورة — جاري التحويل التلقائي لسيرفر الفيديو المباشر');
        } else if (videoEl.videoWidth > 0) {
          videoEl.removeEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
          if (audioOnlyCheckTimer) window.clearTimeout(audioOnlyCheckTimer);
        }
      }
    };

    if (channel.section !== 'radio') {
      videoEl.addEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
      audioOnlyCheckTimer = window.setTimeout(() => {
        if (
          videoEl &&
          !videoEl.paused &&
          videoEl.currentTime > 0.5 &&
          videoEl.videoWidth === 0 &&
          videoEl.videoHeight === 0
        ) {
          videoEl.removeEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
          console.warn('[HlsVideoPlayer] Watchdog: Audio-only stream detected on TV channel, auto-failing over:', channel.name);
          if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
          }
          handleAutoFailover('تم اكتشاف بث صوتي فقط بدون صورة — جاري التحويل التلقائي لسيرفر الفيديو المباشر');
        }
      }, 3200);
    }

    return () => {
      videoEl.removeEventListener('timeupdate', onTimeUpdateAudioOnlyCheck);
      if (audioOnlyCheckTimer) {
        window.clearTimeout(audioOnlyCheckTimer);
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel?.id, activeSource?.url, serverIndex, effectiveServers.length]);

  // Toggle Play / Pause
  const togglePlayPause = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    if (videoEl.paused) {
      ensureAudioBoostGraph();
      videoEl
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      videoEl.pause();
      setIsPlaying(false);
    }
  }, [ensureAudioBoostGraph]);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const nextMuted = !videoEl.muted;
    videoEl.muted = nextMuted;
    setIsMuted(nextMuted);
  }, []);

  // Seek relative seconds
  const seekRelative = useCallback((deltaSeconds) => {
    const videoEl = videoRef.current;
    if (!videoEl || !Number.isFinite(videoEl.duration)) return;
    videoEl.currentTime = Math.max(0, Math.min(videoEl.duration, videoEl.currentTime + deltaSeconds));
  }, []);

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;
    if (!document.fullscreenElement) {
      wrapperEl.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Toggle Picture-in-Picture (PiP)
  const togglePiP = useCallback(async () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoEl.requestPictureInPicture();
      }
    } catch (pipErr) {
      console.warn('[HlsPlayer] Picture-in-Picture toggle failed:', pipErr);
    }
  }, []);

  // Listen to fullscreenchange
  useEffect(() => {
    const onFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
      if (isFs) {
        resetControlsTimer();
      } else {
        setShowControls(true);
        setIsLeftDrawerOpen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [resetControlsTimer]);

  // Rotating Live Broadcast Watermark GIF: switches corner every 2 minutes (120,000 ms)
  useEffect(() => {
    if (!channel) return;
    setWatermarkVisible(true);

    const interval = window.setInterval(() => {
      // Smooth fade-out before corner switch
      setWatermarkVisible(false);
      window.setTimeout(() => {
        setWatermarkCorner((prev) => (prev + 1) % 4);
        setWatermarkVisible(true);
      }, 700);
    }, 2 * 60 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [channel?.id]);

  // Mouse wheel gesture over video container for 0-200% volume control
  useEffect(() => {
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;

    const handleWheel = (e) => {
      // Don't intercept wheel if scrolling inside the channel drawer or any scrollable container,
      // or while the side channel drawer is open
      const target = e.target;
      if (
        isLeftDrawerOpenRef.current ||
        (target && (
          target.closest('.player-left-drawer') ||
          target.closest('[role="dialog"]') ||
          target.closest('.overflow-y-auto') ||
          target.closest('.overflow-x-auto') ||
          target.closest('select')
        ))
      ) {
        return;
      }

      e.preventDefault();
      resetControlsTimer();
      ensureAudioBoostGraph();
      const step = 5;
      const currentVol = volumeRef.current;
      if (e.deltaY < 0) {
        applyVolume(currentVol + step, true);
      } else {
        applyVolume(currentVol - step, true);
      }
    };

    wrapperEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapperEl.removeEventListener('wheel', handleWheel);
  }, [applyVolume, ensureAudioBoostGraph, resetControlsTimer]);

  // Mouse Wheel Click (Middle Click / Button 1) on Live TV player to toggle fullscreen
  useEffect(() => {
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return;

    const handleWheelClick = (e) => {
      if (e.button === 1) { // 1 = middle mouse wheel button
        e.preventDefault();
        e.stopPropagation();
        const target = e.target;
        if (
          target && (
            target.closest('.player-left-drawer') ||
            target.closest('button') ||
            target.closest('select') ||
            target.closest('input') ||
            target.closest('[role="dialog"]')
          )
        ) {
          return;
        }
        toggleFullscreen();
      }
    };

    const handleMouseDown = (e) => {
      // Prevent browser default autoscroll icon when clicking mouse wheel
      if (e.button === 1) {
        e.preventDefault();
      }
    };

    wrapperEl.addEventListener('auxclick', handleWheelClick);
    wrapperEl.addEventListener('mousedown', handleMouseDown);

    return () => {
      wrapperEl.removeEventListener('auxclick', handleWheelClick);
      wrapperEl.removeEventListener('mousedown', handleMouseDown);
    };
  }, [toggleFullscreen]);

  // Global keyboard shortcuts (when not typing in an input)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }

      resetControlsTimer();

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'f' || e.key === 'F' || e.key === 'ب') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M' || e.key === 'ة') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'h' || e.key === 'H' || e.key === 'ا') {
        e.preventDefault();
        setShowControls((prev) => !prev);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        ensureAudioBoostGraph();
        applyVolume(volumeRef.current + 5, true);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        ensureAudioBoostGraph();
        applyVolume(volumeRef.current - 5, true);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlayPause,
    toggleFullscreen,
    toggleMute,
    applyVolume,
    seekRelative,
    ensureAudioBoostGraph,
    resetControlsTimer,
  ]);

  // Handle Quality Change
  const handleQualityChange = (levelIdx) => {
    setCurrentQuality(levelIdx);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx;
    }
  };

  // Handle Audio Track Change
  const handleAudioTrackChange = (trackIdx) => {
    setCurrentAudioTrack(trackIdx);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackIdx;
    }
  };

  // Handle Aspect Ratio Change with Persistence
  const handleAspectRatioChange = (mode) => {
    setAspectRatio(mode);
    try {
      localStorage.setItem('arn_iptv_aspect_pref', mode);
    } catch {}
  };

  // Compute video aspect ratio CSS
  const getVideoAspectStyle = () => {
    switch (aspectRatio) {
      case 'cover':
        return { width: '100%', height: '100%', objectFit: 'cover' };
      case 'fill':
        return { width: '100%', height: '100%', objectFit: 'fill' };
      case '16:9':
        return { aspectRatio: '16 / 9', width: '100%', height: '100%', objectFit: 'contain' };
      case '4:3':
        return { aspectRatio: '4 / 3', width: '100%', height: '100%', objectFit: 'contain' };
      default:
        return { width: '100%', height: '100%', objectFit: 'contain' };
    }
  };

  const formatSeconds = (sec) => {
    if (!Number.isFinite(sec) || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Render Apple TV / B&O Segmented Glass Server Track: [1 SD | 2 HD | 3 4K | 4 DLW ...]
  const renderDramaServerStrip = (isOverlay = false) => {
    if (!effectiveServers || effectiveServers.length === 0) return null;

    return (
      <div
        className={`player-drama-strip flex items-center gap-2.5 overflow-x-auto no-scrollbar select-none py-1.5 px-3.5 transition-colors duration-200 ${
          isOverlay
            ? (isDark
              ? 'player-drama-overlay bg-[#070b14]/85 backdrop-blur-xl rounded-xl border border-white/[0.08] mt-2 max-w-full shadow-xl'
              : 'player-drama-overlay bg-white/90 backdrop-blur-xl rounded-xl border border-slate-200 mt-2 max-w-full shadow-xl')
            : (isDark
              ? 'bg-[#070b14]/90 border-b border-white/[0.06] shrink-0'
              : 'bg-slate-100/90 border-b border-slate-200 shrink-0')
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setFailoverNotice(null);
            if (hlsRef.current && activeSource) {
              setIsLoading(true);
              hlsRef.current.loadSource(normalizeProxyUrl(activeSource.url));
            }
          }}
          className={`player-drama-refresh p-1.5 rounded-lg transition-colors shrink-0 cursor-pointer ${
            isDark
              ? 'bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white'
              : 'bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 shadow-xs'
          }`}
          title="تحديث وإعادة تحميل السيرفر الحالي"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-violet-400' : ''}`} />
        </button>

        <span className={`player-drama-label text-[11px] font-semibold whitespace-nowrap shrink-0 ${
          isDark ? 'text-slate-400' : 'text-slate-500'
        }`}>
          الخوادم
        </span>

        {/* Unified Segmented Control Track */}
        <div className={`player-drama-track inline-flex items-center gap-1 p-1 rounded-xl border overflow-x-auto no-scrollbar ${
          isDark ? 'bg-black/45 border-white/[0.06]' : 'bg-slate-200/70 border-slate-300/60'
        }`}>
          {effectiveServers.map((src, idx) => {
            const isActive = serverIndex === idx;
            const serverNum = src.serverNumber || idx + 1;
            const badge = src.badge;

            return (
              <button
                key={src.id || idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFailoverNotice(null);
                  setServerIndex(idx);
                }}
                title={src.name}
                className={`player-drama-btn flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all duration-150 shrink-0 cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'player-drama-btn-active bg-violet-600/30 text-white border border-violet-500/45 shadow-sm shadow-violet-600/20'
                    : isDark
                    ? 'player-drama-btn-inactive text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                    : 'player-drama-btn-inactive text-slate-600 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                }`}
              >
                <span className="player-drama-btn-num text-xs font-semibold font-mono tabular-nums leading-none">
                  {serverNum}
                </span>
                {badge && (
                  <span
                    className={`player-drama-btn-badge text-[10px] font-mono tabular-nums uppercase tracking-wide leading-none ${
                      isActive ? 'text-violet-300 font-semibold' : (isDark ? 'text-slate-500' : 'text-slate-500')
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {isLoadingServers && (
          <span className={`player-drama-loading text-[10px] whitespace-nowrap shrink-0 mr-1 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}>
            جاري فحص الخوادم...
          </span>
        )}
      </div>
    );
  };

  // If app is completely clean and no channel is chosen yet
  if (!channel) {
    return (
      <section
        ref={wrapperRef}
        className={`flex flex-col flex-1 h-full backdrop-blur-xl border rounded-2xl overflow-hidden select-none items-center justify-center p-6 text-center transition-colors duration-200 ${
          isDark
            ? 'bg-[#090e1a]/80 border-white/[0.06]'
            : 'bg-white/85 border-slate-200 shadow-xl'
        }`}
      >
        <div className={`max-w-md w-full border rounded-2xl p-8 shadow-2xl space-y-5 ${
          isDark
            ? 'bg-[#0f172a]/70 border-white/[0.08]'
            : 'bg-slate-50/90 border-slate-200 shadow-slate-200/50'
        }`}>
          <div className="w-16 h-16 mx-auto rounded-2xl p-2 bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Tv className="w-8 h-8 text-violet-400" />
          </div>

          <div className="space-y-2">
            <h2 className={`text-base font-bold leading-normal ${isDark ? 'text-white' : 'text-slate-900'}`}>
              مرحباً بك في مشغل البث المباشر المتكامل
            </h2>
            <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              اختر قناة من القائمة الجانبية، أو قم بإدخال كود التفعيل (FG Code) / إضافة رابط قائمة M3U / Xtream.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPlaylistModal}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-bold text-xs transition-colors cursor-pointer shadow-lg shadow-violet-600/30"
          >
            <ListPlus className="w-4 h-4" />
            <span>إدارة القوائم وأكواد التفعيل</span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={wrapperRef}
      onMouseMove={handlePlayerMouseMove}
      onTouchStart={resetControlsTimer}
      className={`relative flex flex-col flex-1 h-full select-none transition-colors duration-200 ${
        isFullscreen
          ? 'fixed inset-0 z-[99999] w-screen h-screen bg-black border-0 rounded-none p-0 m-0 overflow-hidden'
          : isDark
          ? 'bg-[#090e1a]/90 border border-white/[0.08] rounded-2xl overflow-hidden'
          : 'bg-white/95 border border-slate-200 rounded-2xl overflow-hidden shadow-xl'
      } ${isFullscreen && !showControls && !isLeftDrawerOpen ? 'cursor-none' : 'cursor-default'}`}
    >
      {/* Invisible Hover Zone on the Left Edge to slide in Channels in Fullscreen */}
      {isFullscreen && (
        <div
          className="absolute top-0 bottom-0 left-0 w-8 z-40 pointer-events-auto"
          onMouseEnter={() => {
            if (leftDrawerTimerRef.current) window.clearTimeout(leftDrawerTimerRef.current);
            setIsLeftDrawerOpen(true);
          }}
        />
      )}

      {/* =========================================================================
          FULLSCREEN LEFT EDGE CHANNEL DRAWER
          ========================================================================= */}
      {isFullscreen && (
        <div
          onMouseEnter={() => {
            if (leftDrawerTimerRef.current) window.clearTimeout(leftDrawerTimerRef.current);
          }}
          onMouseLeave={() => {
            leftDrawerTimerRef.current = window.setTimeout(() => {
              setIsLeftDrawerOpen(false);
              leftDrawerTimerRef.current = null;
            }, 350);
          }}
          onWheel={(e) => {
            e.stopPropagation();
            if (drawerListRef.current && !e.target.closest('.overflow-y-auto')) {
              drawerListRef.current.scrollTop += e.deltaY;
            }
          }}
          className={`player-left-drawer fixed top-0 bottom-0 left-0 w-80 sm:w-[22rem] bg-[#070b14]/95 backdrop-blur-2xl border-r border-white/[0.12] z-50 shadow-2xl flex flex-col transition-transform duration-300 select-none ${
            isLeftDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#0a101f]/95 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-violet-400 shrink-0" />
                <h3 className="text-sm font-bold text-white truncate">
                  {categoryTitle || 'قنوات التصنيف'}
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filteredDrawerChannels.length} قناة متاحة
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsLeftDrawerOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="إغلاق قائمة القنوات"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Search */}
          <div className="p-3 border-b border-white/[0.08] shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={drawerSearch}
                onChange={(e) => setDrawerSearch(e.target.value)}
                placeholder="بحث في قنوات هذا التصنيف..."
                className="w-full bg-[#0f172a] border border-white/10 rounded-xl pr-9 pl-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50"
              />
            </div>
          </div>

          {/* Channels List */}
          <div ref={drawerListRef} className="flex-1 overflow-y-auto p-2 space-y-1 overscroll-contain">
            {filteredDrawerChannels.length === 0 ? (
              <p className="text-xs text-slate-400 text-center p-4">لا توجد قنوات مطابقة للبحث</p>
            ) : (
              filteredDrawerChannels.map((ch, idx) => {
                const isCurrent = channel?.id === ch.id;
                return (
                  <button
                    key={ch.id || idx}
                    type="button"
                    onClick={() => {
                      onSelectChannel?.(ch);
                    }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-violet-600/25 border border-violet-500/50 text-white shadow-lg'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-xs text-slate-400 w-5 text-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center p-1 overflow-hidden shrink-0">
                        {ch.section === 'radio' || activeSection === 'radio' ? (
                          <img
                            src="/ARN-logo.png"
                            alt=""
                            className="w-full h-full object-contain"
                          />
                        ) : ch.logo ? (
                          <img
                            src={ch.logo}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <Tv className="w-3.5 h-3.5 text-violet-400/70" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{ch.name}</p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {ch.resolution || 'Adaptive'}
                        </span>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-400 shadow-[0_0_8px_#8b5cf6] animate-pulse shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          NORMAL MODE: Top Header Bar
          ========================================================================= */}
      {!isFullscreen && (
        <div className={`player-header flex items-center justify-between gap-4 px-4 py-2.5 border-b shrink-0 transition-colors duration-200 ${
          isDark ? 'bg-[#0f172a]/90 border-white/[0.08]' : 'bg-white/90 border-slate-200 shadow-xs'
        }`}>
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isPlaying ? 'bg-violet-400 shadow-[0_0_10px_#8b5cf6]' : 'bg-amber-400'
              }`}
              title={isPlaying ? 'البث نشط ومستقر' : 'البث متوقف مؤقتاً'}
            />
            {channel && (() => {
              const isRadioChannel = channel.section === 'radio' || activeSection === 'radio';
              const fallback = isRadioChannel ? '/ARN-logo.png' : getChannelFallbackLogo(channel.name);
              const logoSrc = isRadioChannel
                ? '/ARN-logo.png'
                : (channel.logo && !channel.logo.includes('upload.wikimedia.org'))
                  ? channel.logo
                  : fallback;
              return (
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center p-1 overflow-hidden shrink-0 shadow-md ${
                  isDark ? 'bg-black/50 border-white/15' : 'bg-white border-slate-200'
                }`}>
                  <img
                    src={logoSrc}
                    alt={channel.name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.src !== fallback) {
                        img.src = fallback;
                      }
                    }}
                  />
                </div>
              );
            })()}
            <div className="min-w-0">
              <h2 className={`text-sm font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {channel ? channel.name : '— لم يتم تحديد قناة —'}
              </h2>
              <div className={`flex items-center gap-2 text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span>{channel?.groupTitle || 'بث مباشر'}</span>
                {channel?.resolution && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-sky-400 tabular-nums">{channel.resolution}</span>
                  </>
                )}
                {activeSource?.hasK9xSwap && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-violet-400 font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      k9x_ Decrypted
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="text-violet-400 font-mono tabular-nums">
                  {effectiveServers.length} خوادم
                </span>
              </div>
            </div>
          </div>

          {/* Top Header Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            {onToggleSection && (
              <div className={`inline-flex items-center gap-1 p-1 rounded-xl border ${
                isDark ? 'bg-[#070b14] border-white/10' : 'bg-slate-100 border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => onToggleSection('live')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    activeSection !== 'radio'
                      ? 'bg-[#7c3aed] text-white shadow-sm shadow-violet-600/30'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="مشاهدة البث التلفزيوني المباشر"
                >
                  <Tv className="w-3.5 h-3.5" />
                  <span>التلفاز</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleSection('radio')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    activeSection === 'radio'
                      ? 'bg-[#7c3aed] text-white shadow-sm shadow-violet-600/30'
                      : isDark
                      ? 'text-slate-400 hover:text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="الاستماع لإذاعات الراديو والقرآن الكريم"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>الراديو</span>
                </button>
              </div>
            )}

            {effectiveServers.length > 0 && (
              <div className={`player-header-select-box hidden sm:flex items-center gap-2 border rounded-lg px-2.5 py-1.5 ${
                isDark ? 'bg-[#070b14]/90 border-white/10' : 'bg-slate-100/90 border-slate-200'
              }`}>
                <Server className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <label htmlFor="serverSelect" className={`text-xs whitespace-nowrap ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  السيرفر:
                </label>
                <select
                  id="serverSelect"
                  value={serverIndex}
                  onChange={(e) => {
                    setFailoverNotice(null);
                    setServerIndex(Number(e.target.value));
                  }}
                  className={`bg-transparent text-xs font-semibold focus:outline-none cursor-pointer max-w-[190px] truncate ${
                    isDark ? 'text-slate-100' : 'text-slate-800'
                  }`}
                >
                  {effectiveServers.map((src, idx) => (
                    <option key={src.id || idx} value={idx} className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                      {src.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setFailoverNotice(null);
                if (hlsRef.current && activeSource) {
                  setIsLoading(true);
                  setLoadingMessage(
                    channel?.section === 'radio'
                      ? 'جاري الاتصال بالإذاعة...'
                      : 'جار فك التشفير...'
                  );
                  hlsRef.current.loadSource(normalizeProxyUrl(activeSource.url));
                }
              }}
              className={`player-header-btn p-2 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="إعادة تحميل البث"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={togglePiP}
              className={`player-header-btn p-2 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900'
              }`}
              title="وضع صورة داخل صورة العائم (Picture-in-Picture)"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            <button
              id="btnFullscreen"
              type="button"
              onClick={toggleFullscreen}
              className="player-header-btn player-header-btn-fullscreen p-2 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/35 transition-colors cursor-pointer"
              title="ملء الشاشة الفعلي (F أو نقر مزدوج أو الضغط على عجلة الماوس)"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          NORMAL MODE: Drama Live Horizontal Servers Strip
          ========================================================================= */}
      {!isFullscreen && renderDramaServerStrip(false)}

      {/* Auto-Failover Notification Banner */}
      {failoverNotice && !isFullscreen && (
        <div className="failover-alert-banner flex items-center justify-between gap-3 px-4 py-2 border-b border-amber-500/25 bg-amber-500/10 text-amber-200 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span className="font-semibold">{failoverNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setFailoverNotice(null)}
            className="font-bold underline whitespace-nowrap cursor-pointer hover:opacity-80"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* =========================================================================
          MAIN VIDEO VIEWPORT (Supports Double-Click / Mouse Wheel Click Fullscreen & Wheel Volume)
          ========================================================================= */}
      <div
        id="videoWrapper"
        onMouseDown={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target;
            if (target.closest('.osd-bar') || target.closest('.player-header') || target.closest('button')) return;
            toggleFullscreen();
          }
        }}
        onDoubleClick={(e) => {
          const target = e.target;
          if (target.closest('.osd-bar') || target.closest('.player-header') || target.closest('button')) return;
          toggleFullscreen();
        }}
        onClick={(e) => {
          if (e.button !== 0) return;
          const target = e.target;
          if (target.closest('button') || target.closest('select') || target.closest('input')) return;
          togglePlayPause();
        }}
        className={`relative ${
          channel?.section === 'radio' && !isDark ? 'bg-[#f1f5f9]' : 'bg-black'
        } flex items-center justify-center overflow-hidden cursor-pointer ${
          isFullscreen ? 'absolute inset-0 w-full h-full' : 'flex-1 min-h-[280px]'
        }`}
      >
        <video
          ref={videoRef}
          id="videoPlayer"
          playsInline
          crossOrigin="anonymous"
          style={getVideoAspectStyle()}
          onPlay={() => {
            setIsPlaying(true);
            ensureAudioBoostGraph();
          }}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          className="transition-all duration-150"
        />

        {/* Acoustic Radio Studio with live audio-reactive blurred background & precision spectrum pill */}
        {channel?.section === 'radio' && (
          <RadioStudioVisualizer
            channel={channel}
            isPlaying={isPlaying}
            volume={isMuted ? 0 : volume}
            togglePlayPause={togglePlayPause}
            onOpenEqualizer={() => {
              ensureAudioBoostGraph();
              setShowEqualizer(true);
            }}
            eqEnabled={eqEnabled}
            eqPreset={eqPreset}
          />
        )}

        {/* Floating Mouse Wheel Volume & 200% Boost OSD Overlay */}
        {showVolOverlay && (
          <div
            id="volumeOverlay"
            className="pointer-events-none absolute inset-0 flex items-center justify-center z-30"
          >
            <div className="flex flex-col items-center gap-2.5 px-6 py-4 rounded-2xl bg-[#070b14]/90 backdrop-blur-md border border-white/15 shadow-2xl min-w-[190px]">
              <div className="flex items-center gap-2.5">
                {volume === 0 || isMuted ? (
                  <VolumeX className="w-6 h-6 text-rose-400" />
                ) : (
                  <Volume2 className={`w-6 h-6 ${volume > 100 ? 'text-sky-400' : 'text-violet-400'}`} />
                )}
                <span className="text-xl font-bold font-mono tabular-nums text-white">
                  {isMuted ? '0%' : `${volume}%`}
                </span>
                {volume > 100 && !isMuted && (
                  <span className="text-xs font-mono font-semibold text-sky-400">BOOST 200%</span>
                )}
              </div>
              <div className="w-36 h-2 bg-white/15 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-75 ${
                    volume > 100 ? 'bg-gradient-to-r from-violet-500 to-sky-400' : 'bg-[#7c3aed]'
                  }`}
                  style={{ width: `${(volume / 200) * 100}%` }}
                />
              </div>
              <span className="text-[11px] text-slate-400">
                {volume > 100 ? 'مضخم صوتي متطور (WebAudio Gain)' : 'مستوى الصوت القياسي'}
              </span>
            </div>
          </div>
        )}

        {/* Loading Spinner Overlay */}
        {isLoading && (
          <div
            id="loadingSpinner"
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#070b14]/75 backdrop-blur-sm z-20"
          >
            <div className="w-12 h-12 rounded-full border-[3px] border-violet-500/25 border-t-violet-400 animate-spin" />
            <p className="text-xs font-semibold text-slate-200">{loadingMessage}</p>
          </div>
        )}

        {/* Error Overlay with Immediate Server Switch */}
        {errorMsg && !isLoading && (
          <div className="player-error-overlay absolute inset-0 flex flex-col items-center justify-center p-6 z-30 text-center bg-black/75 backdrop-blur-sm">
            <div className="player-error-card flex flex-col items-center justify-center gap-4 p-6 sm:p-8 rounded-2xl max-w-lg w-full shadow-2xl border border-white/10 bg-[#0f172a]/90 backdrop-blur-xl">
              <AlertTriangle className="w-12 h-12 text-rose-500 shrink-0" />
              <p className="player-error-text text-sm font-semibold text-white max-w-md leading-relaxed">{errorMsg}</p>
              {effectiveServers.length > 1 && (
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl pt-2">
                  {effectiveServers.map((src, idx) => (
                    <button
                      key={src.id || idx}
                      type="button"
                      onClick={() => setServerIndex(idx)}
                      className={`player-error-srv-btn px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        serverIndex === idx
                          ? 'player-error-srv-btn-active bg-[#7c3aed] text-white shadow-lg shadow-violet-600/30'
                          : 'player-error-srv-btn-inactive bg-white/10 text-slate-200 hover:bg-white/20'
                      }`}
                    >
                      تجربة {src.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rotating Live Broadcast Watermark GIF (Corner rotates every 2 minutes) */}
        {channel && (
          <div
            aria-hidden="true"
            className={`pointer-events-none select-none absolute z-25 transition-all duration-700 ease-in-out ${
              [
                'top-4 sm:top-6 right-4 sm:right-6',          // 0: Top-Right
                'bottom-10 sm:bottom-14 right-4 sm:right-6',  // 1: Bottom-Right
                'bottom-10 sm:bottom-14 left-4 sm:left-6',    // 2: Bottom-Left
                'top-4 sm:top-6 left-4 sm:left-6',            // 3: Top-Left
              ][watermarkCorner]
            } ${
              watermarkVisible ? 'opacity-95 scale-100' : 'opacity-0 scale-90'
            }`}
          >
            <img
              src="/ARN_live_tv_broadcast.gif"
              alt="ARN Live TV Broadcast"
              className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 lg:w-36 lg:h-36 object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
            />
          </div>
        )}

        {/* Subtle EPG & Gesture Hint Bar at Bottom of Video (in normal mode) */}
        {!isFullscreen && channel?.epgCurrent && !isLoading && !errorMsg && (
          <div className="player-video-epg-bar pointer-events-none absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pt-8 pb-2.5 flex items-center justify-between text-xs text-slate-100">
            <div className="truncate">
              <span className="player-video-epg-label text-violet-400 font-semibold ml-1.5">يعرض الآن:</span>
              <span className="player-video-epg-text text-white/95">{channel.epgCurrent}</span>
            </div>
            <div className="player-video-epg-hints hidden xl:flex items-center gap-3 text-[11px] text-slate-300 shrink-0">
              <span>نقر مزدوج: ملء الشاشة</span>
              <span>·</span>
              <span>عجلة الماوس: الصوت حتى 200%</span>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          FULLSCREEN FLOATING OVERLAYS: Auto-hides on inactivity
          ========================================================================= */}
      {isFullscreen && (
        <>
          {/* Top Floating Header & Drama Live Server Strip */}
          <div
            className={`player-floating-header absolute top-0 inset-x-0 z-40 bg-gradient-to-b from-black/95 via-black/75 to-transparent px-6 pt-5 pb-8 transition-all duration-300 ${
              showControls
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 -translate-y-4 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`w-3 h-3 rounded-full shrink-0 ${
                    isPlaying ? 'bg-violet-400 shadow-[0_0_12px_#8b5cf6]' : 'bg-amber-400'
                  }`}
                />
                <div className="min-w-0">
                  <h2 className="player-floating-title text-lg font-bold text-white truncate drop-shadow-md">
                    {channel ? channel.name : '— بث مباشر —'}
                  </h2>
                  <div className="player-floating-sub flex items-center gap-2 text-xs text-slate-300">
                    <span>{channel?.groupTitle || 'بث فضائي'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-violet-400">{channel?.resolution || 'FHD / HD'}</span>
                    <span aria-hidden="true">·</span>
                    <span className="player-floating-hint text-sky-300">مرر الفأرة لليسار لعرض قائمة القنوات</span>
                  </div>
                </div>
              </div>

              {/* Quick Fullscreen Controls */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowControls(false)}
                  className="player-btn-tool flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/60 hover:bg-black/90 text-slate-200 hover:text-white border border-white/15 transition-colors cursor-pointer text-xs"
                  title="إخفاء الأدوات فوراً (أو اضغط H)"
                >
                  <EyeOff className="w-4 h-4 text-violet-400" />
                  <span className="hidden sm:inline">إخفاء الأدوات (H)</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="player-btn-minimize p-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/35 text-violet-300 border border-violet-500/40 transition-colors cursor-pointer"
                  title="الخروج من ملء الشاشة (Esc أو F)"
                >
                  <Minimize className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drama Live Servers in Fullscreen */}
            {renderDramaServerStrip(true)}
          </div>

          {/* Bottom Floating OSD Controls Overlay */}
          <div
            className={`player-floating-footer absolute bottom-0 inset-x-0 z-40 bg-gradient-to-t from-black/95 via-black/75 to-transparent px-6 pb-5 pt-10 transition-all duration-300 ${
              showControls
                ? 'opacity-100 translate-y-0 pointer-events-auto'
                : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Playback Controls & Volume */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="player-btn-play w-10 h-10 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] text-white flex items-center justify-center transition-colors shadow-lg shadow-violet-600/30 cursor-pointer shrink-0"
                  title="تشغيل / إيقاف مؤقت (Space)"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => seekRelative(-10)}
                  className="player-btn-control p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                  title="إرجاع 10 ثوانٍ"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => seekRelative(10)}
                  className="player-btn-control p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                  title="تقديم 10 ثوانٍ"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  className="player-btn-control p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer shrink-0"
                  title="كتم / تشغيل الصوت (M)"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className={`w-4 h-4 ${volume > 100 ? 'text-sky-400' : 'text-violet-400'}`} />
                  )}
                </button>

                <div className="flex items-center gap-2" dir="ltr">
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={5}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      ensureAudioBoostGraph();
                      applyVolume(Number(e.target.value), true);
                    }}
                    dir="ltr"
                    className="arn-slider w-28 sm:w-36"
                    title="التحكم بالصوت حتى 200%"
                  />
                  <span
                    className={`player-vol-label text-xs font-mono font-semibold tabular-nums w-12 text-left ${
                      volume > 100 ? 'text-sky-400' : 'text-slate-200'
                    }`}
                  >
                    {isMuted ? '0%' : `${volume}%`}
                  </span>
                </div>
              </div>

              {/* Quality & Aspect Ratio in Fullscreen */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    ensureAudioBoostGraph();
                    setShowEqualizer(true);
                  }}
                  className={`player-btn-control flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                    eqEnabled && eqPreset !== 'flat'
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-md shadow-emerald-600/20'
                      : 'bg-[#070b14]/90 border-white/15 hover:bg-white/15 text-slate-200'
                  }`}
                  title="المعادل الصوتي الاستوديو (Equalizer)"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="hidden sm:inline">المعادل الصوتي</span>
                </button>

                <div className="player-select-box flex items-center gap-1.5 bg-[#070b14]/90 border border-white/15 rounded-xl px-3 py-1.5">
                  <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <select
                    value={currentQuality}
                    onChange={(e) => handleQualityChange(Number(e.target.value))}
                    className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                  >
                    <option value={-1} className="bg-[#0f172a] text-slate-100">
                      الجودة: تلقائي
                    </option>
                    {qualities.map((q) => (
                      <option key={q.index} value={q.index} className="bg-[#0f172a] text-slate-100">
                        {q.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="player-select-box flex items-center gap-1.5 bg-[#070b14]/90 border border-white/15 rounded-xl px-3 py-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                  <select
                    value={aspectRatio}
                    onChange={(e) => handleAspectRatioChange(e.target.value)}
                    className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                    title="نسبة أبعاد الشاشة وملاءمتها"
                  >
                    <option value="default" className="bg-[#0f172a] text-slate-100">
                      أبعاد تلقائية (Contain)
                    </option>
                    <option value="cover" className="bg-[#0f172a] text-slate-100">
                      ملء كامل بدون حواف (Cover) ⭐
                    </option>
                    <option value="fill" className="bg-[#0f172a] text-slate-100">
                      تمديد كامل للشاشة (Fill)
                    </option>
                    <option value="16:9" className="bg-[#0f172a] text-slate-100">
                      16:9 (شاشة عريضة)
                    </option>
                    <option value="4:3" className="bg-[#0f172a] text-slate-100">
                      4:3 (كلاسيكي)
                    </option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="player-btn-control p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 transition-colors cursor-pointer"
                  title="الخروج من ملء الشاشة (F أو Esc)"
                >
                  <Minimize className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          NORMAL MODE: Bottom Professional OSD Control Bar
          ========================================================================= */}
      {!isFullscreen && (
        <div className={`osd-bar flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t shrink-0 transition-colors duration-200 ${
          isDark
            ? 'bg-[#0f172a] border-white/[0.08]'
            : 'bg-white/95 border-slate-200 shadow-sm'
        }`}>
          <div className="flex items-center gap-2.5">
            <button
              id="btnPlayPause"
              type="button"
              onClick={togglePlayPause}
              className="w-9 h-9 rounded-lg bg-[#7c3aed] hover:bg-[#8b5cf6] text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer shadow-md shadow-violet-600/30"
              title="تشغيل / إيقاف مؤقت (Space)"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              type="button"
              onClick={() => seekRelative(-10)}
              className={`osd-btn p-2 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200'
              }`}
              title="إرجاع 10 ثوانٍ (السهم الأيسر)"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => seekRelative(10)}
              className={`osd-btn p-2 rounded-lg transition-colors cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200'
              }`}
              title="تقديم 10 ثوانٍ (السهم الأيمن)"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>

            <button
              id="btnMute"
              type="button"
              onClick={toggleMute}
              className={`osd-btn p-2 rounded-lg transition-colors shrink-0 cursor-pointer ${
                isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
              title="كتم / تشغيل الصوت (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className={`w-4 h-4 ${volume > 100 ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-violet-400' : 'text-violet-600')}`} />
              )}
            </button>

            <div className="flex items-center gap-2" dir="ltr">
              <input
                id="volSlider"
                type="range"
                dir="ltr"
                min={0}
                max={200}
                step={5}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  ensureAudioBoostGraph();
                  applyVolume(Number(e.target.value), true);
                }}
                className="arn-slider w-24 sm:w-28"
                title="التحكم بالصوت وتضخيمه حتى 200% (عجلة الماوس)"
              />
              <span
                id="volLabel"
                className={`osd-vol-label text-xs font-mono font-semibold tabular-nums w-11 text-left ${
                  volume > 100
                    ? (isDark ? 'text-sky-400' : 'text-sky-600')
                    : (isDark ? 'text-slate-200' : 'text-slate-700')
                }`}
              >
                {isMuted ? '0%' : `${volume}%`}
              </span>
            </div>

            {duration > 0 && Number.isFinite(duration) && (
              <span className={`hidden md:inline-block text-xs font-mono tabular-nums mr-1 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}>
                {formatSeconds(currentTime)} / {formatSeconds(duration)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                ensureAudioBoostGraph();
                setShowEqualizer(true);
              }}
              className={`osd-btn flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                eqEnabled && eqPreset !== 'flat'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-600/20'
                  : isDark
                  ? 'bg-[#070b14] border-white/10 hover:bg-white/10 text-slate-200'
                  : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
              }`}
              title="المعادل الصوتي الاستوديو (Equalizer)"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline">المعادل</span>
            </button>

            {audioTracks.length > 1 && (
              <div className={`osd-select-box flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${
                isDark ? 'bg-[#070b14] border-white/10' : 'bg-slate-100 border-slate-200'
              }`}>
                <Headphones className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <select
                  value={currentAudioTrack}
                  onChange={(e) => handleAudioTrackChange(Number(e.target.value))}
                  className={`bg-transparent text-xs font-semibold focus:outline-none cursor-pointer whitespace-nowrap ${
                    isDark ? 'text-slate-200' : 'text-slate-800'
                  }`}
                  title="اختيار المسار الصوتي / المعلق"
                >
                  {audioTracks.map((t) => (
                    <option key={t.id} value={t.id} className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={`osd-select-box flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${
              isDark ? 'bg-[#070b14] border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <select
                id="qualitySelect"
                value={currentQuality}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                className={`bg-transparent text-xs font-semibold focus:outline-none cursor-pointer whitespace-nowrap ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}
                title="اختيار دقة البث (Adaptive HLS Levels)"
              >
                <option value={-1} className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                  الجودة: تلقائي (Auto)
                </option>
                {qualities.map((q) => (
                  <option key={q.index} value={q.index} className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                    {q.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`osd-select-box flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 ${
              isDark ? 'bg-[#070b14] border-white/10' : 'bg-slate-100 border-slate-200'
            }`}>
              <Maximize2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <select
                id="aspectRatioSelect"
                value={aspectRatio}
                onChange={(e) => handleAspectRatioChange(e.target.value)}
                className={`bg-transparent text-xs font-semibold focus:outline-none cursor-pointer whitespace-nowrap ${
                  isDark ? 'text-slate-200' : 'text-slate-800'
                }`}
                title="نسبة أبعاد الشاشة وملاءمتها"
              >
                <option value="default" className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                  أبعاد تلقائية
                </option>
                <option value="cover" className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                  ملء كامل بدون حواف (Cover) ⭐
                </option>
                <option value="fill" className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                  ملاءمة كاملة (Fill)
                </option>
                <option value="16:9" className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                  16:9 (شاشة عريضة)
                </option>
                <option value="4:3" className={isDark ? 'bg-[#0f172a] text-slate-100' : 'bg-white text-slate-800'}>
                  4:3 (كلاسيكي)
                </option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Studio Equalizer Modal (10-band EQ + FX) for Live TV & Radio */}
      <EqualizerModal
        isOpen={showEqualizer}
        onClose={() => setShowEqualizer(false)}
        volumePercent={isMuted ? 0 : volume}
        volumeMax={200}
        onVolumeChange={(val) => {
          ensureAudioBoostGraph();
          applyVolume(val, false);
        }}
        isPlaying={isPlaying}
        presetGroup={channel?.section === 'radio' ? 'radio' : 'tv'}
        contextLabel={
          channel?.section === 'radio'
            ? 'معادل صوت الإذاعة والراديو المباشر'
            : 'معادل صوت البث التليفزيوني الحي'
        }
      />
    </section>
  );
};
export default HlsVideoPlayer;
