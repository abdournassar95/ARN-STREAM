import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  ArrowLeft,
  ArrowRight,
  Tv,
  Check,
  SkipForward,
  SkipBack,
  Scan,
  StretchHorizontal,
  Crop,
  AlertCircle,
  RefreshCw,
  Cast,
  SlidersHorizontal,
  ListVideo,
  Trash2,
  Shuffle
} from 'lucide-react';
import client, { savePlayback, saveVolumeSettings, fetchVolumeSettings } from '../../api/client';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import { useAuthStore } from '../../store/useAuthStore';

const getAuthToken = () => {
  return localStorage.getItem('arn_auth_token') || '';
};

const authFetch = (url, options = {}) => {
  const token = getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
};

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function getItemType(item, fallbackType = 'movie') {
  if (!item) return fallbackType;
  if (item.type === 'episode' || item.media_type === 'episode') return 'episode';
  if (item.type === 'movie' || item.media_type === 'movie') return 'movie';
  if (item.series_id || item.season_id || item.episode_number !== undefined) return 'episode';
  return item.type || item.media_type || fallbackType;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

const ASPECT_OPTIONS = [
  { 
    id: 'contain', 
    labelAr: 'فيت (Fit)', 
    labelEn: 'Fit', 
    icon: Scan, 
    descAr: 'الأبعاد الأصلية للفيديو', 
    descEn: 'Original aspect ratio' 
  },
  { 
    id: 'fill', 
    labelAr: 'استرتش (Stretch)', 
    labelEn: 'Stretch', 
    icon: StretchHorizontal, 
    descAr: 'تمديد لملء كامل الشاشة', 
    descEn: 'Stretch to fill screen' 
  },
  { 
    id: 'cover', 
    labelAr: 'كافر (Cover)', 
    labelEn: 'Cover', 
    icon: Crop, 
    descAr: 'تكبير وقص بدون هوامش سوداء', 
    descEn: 'Crop & fill without bars' 
  },
];

export default function Player() {
  const { type, id } = useParams(); // type: movie | episode
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTimeParam = searchParams.get('t') ? Number(searchParams.get('t')) : null;
  const autoPlayParam = searchParams.get('autoPlay') === 'true';
  const { deviceId, openCastModal, activeRemoteSession, openFullRemote } = useDeviceHandoffStore();
  const canCast = useAuthStore(s => s.canCast);

  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const progressBarRef = useRef(null);
  const hideTimerRef = useRef(null);
  const lastTapTimeRef = useRef(0);

  const { autoPlayNext, skipTime, upNextTime, globalVolume, globalMuted, setGlobalVolume, setGlobalMuted } = useSettingsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  const [duration, setDuration] = useState(0);
  const durationRef = useRef(0);

  const updateDuration = useCallback((newDur) => {
    const val = Math.round(Number(newDur));
    if (!val || isNaN(val) || val <= 0) return;
    // Do not let tiny fragmented MP4 buffer duration (e.g. 4s) overwrite the real duration (> 30s)
    if (durationRef.current > 30 && val < 30) return;
    durationRef.current = val;
    setDuration(val);
  }, []);
  const [volume, setVolume] = useState(() => (typeof globalVolume === 'number' ? globalVolume : 0.8));
  const [isMuted, setIsMuted] = useState(() => !!globalMuted);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(() => {
    try {
      return localStorage.getItem('player_aspect_ratio') || 'contain';
    } catch {
      return 'contain';
    }
  });
  const [showAspectMenu, setShowAspectMenu] = useState(false);
  const [visualSettings, setVisualSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('player_visual_settings');
      return saved ? JSON.parse(saved) : { brightness: 100, contrast: 100, saturation: 100 };
    } catch {
      return { brightness: 100, contrast: 100, saturation: 100 };
    }
  });
  const [showVisualMenu, setShowVisualMenu] = useState(false);

  const updateVisualSetting = useCallback((key, val) => {
    setVisualSettings(prev => {
      const next = { ...prev, [key]: val };
      try { localStorage.setItem('player_visual_settings', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetVisualSettings = useCallback(() => {
    const defaultSettings = { brightness: 100, contrast: 100, saturation: 100 };
    setVisualSettings(defaultSettings);
    try { localStorage.setItem('player_visual_settings', JSON.stringify(defaultSettings)); } catch {}
    setShowVisualMenu(false);
  }, []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [playbackError, setPlaybackError] = useState(false);
  const feedbackTimerRef = useRef(null);

  const [mediaInfo, setMediaInfo] = useState(null);
  const mediaInfoRef = useRef(null);
  useEffect(() => { mediaInfoRef.current = mediaInfo; }, [mediaInfo]);

  const displayTitle = type === 'movie'
    ? (mediaInfo?.title || `Movie #${id}`)
    : (mediaInfo 
        ? `${mediaInfo.series_title ? `${mediaInfo.series_title} - ` : ''}${mediaInfo.season_number ? (isRtl ? `الموسم ${mediaInfo.season_number} ` : `S${mediaInfo.season_number} `) : ''}${mediaInfo.episode_number ? (isRtl ? `حلقة ${mediaInfo.episode_number}` : `E${mediaInfo.episode_number}`) : ''}${mediaInfo.title && !['1','2','3','4','5','6','7','8','9','10'].includes(String(mediaInfo.title).trim()) && !String(mediaInfo.title).toLowerCase().startsWith('episode') && !String(mediaInfo.title).startsWith('الحلقة') ? `: ${mediaInfo.title}` : ''}`
        : `Episode #${id}`);

  const [streamStrategy, setStreamStrategy] = useState(null);
  const streamStrategyRef = useRef(null);
  useEffect(() => { streamStrategyRef.current = streamStrategy; }, [streamStrategy]);

  const [seekOffset, setSeekOffset] = useState(0);
  const seekOffsetRef = useRef(0);
  useEffect(() => { seekOffsetRef.current = seekOffset; }, [seekOffset]);

  // Subtitles & Audio Tracks state for Remote Control and Player
  const [availableSubtitles, setAvailableSubtitles] = useState([]);
  const availableSubtitlesRef = useRef([]);
  useEffect(() => { availableSubtitlesRef.current = availableSubtitles; }, [availableSubtitles]);

  const [selectedSubtitle, setSelectedSubtitle] = useState(null);
  const selectedSubtitleRef = useRef(null);
  useEffect(() => { selectedSubtitleRef.current = selectedSubtitle; }, [selectedSubtitle]);

  const [availableAudioTracks, setAvailableAudioTracks] = useState([]);
  const availableAudioTracksRef = useRef([]);
  useEffect(() => { availableAudioTracksRef.current = availableAudioTracks; }, [availableAudioTracks]);

  const [selectedAudioTrack, setSelectedAudioTrack] = useState(0);
  const selectedAudioTrackRef = useRef(0);
  useEffect(() => { selectedAudioTrackRef.current = selectedAudioTrack; }, [selectedAudioTrack]);

  const upNextTimeRef = useRef(upNextTime);
  useEffect(() => { upNextTimeRef.current = upNextTime; }, [upNextTime]);

  const [nextUp, setNextUp] = useState(null);
  const [countdown, setCountdown] = useState(10);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const { 
    stopMusicForVideo, 
    getNextVideo, 
    getPrevVideo, 
    advanceToNextVideo, 
    advanceToPrevVideo, 
    videoQueue,
    videoQueueIndex,
    setVideoQueueIndex,
    removeVideoFromQueue,
    shuffleVideoQueue,
    clearVideoQueue
  } = usePlayerStore();

  const isCurrentInQueue = Boolean(
    videoQueue &&
    videoQueue.length > 0 &&
    videoQueueIndex >= 0 &&
    videoQueueIndex < videoQueue.length &&
    String(videoQueue[videoQueueIndex]?.id) === String(id) &&
    getItemType(videoQueue[videoQueueIndex]) === type
  );

  // Sync videoQueueIndex with the current route id, or clear stale queue if media does not belong to it
  useEffect(() => {
    if (videoQueue && videoQueue.length > 0) {
      const idx = videoQueue.findIndex(v => String(v.id) === String(id) && getItemType(v) === type);
      if (idx !== -1) {
        if (idx !== videoQueueIndex) {
          setVideoQueueIndex(idx);
        }
      } else {
        // Current media is not in the queue (e.g. switched from series to a movie, or to another series)
        clearVideoQueue();
      }
    }
  }, [id, type, videoQueue, videoQueueIndex, setVideoQueueIndex, clearVideoQueue]);

  const isNavigatingHomeRef = useRef(false);
  useEffect(() => {
    isNavigatingHomeRef.current = false;
  }, [id, type]);

  const showFeedbackBadge = useCallback((text, icon = null) => {
    setFeedback({ text, icon });
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 850);
  }, []);

  const returnToLibraryHome = useCallback(async () => {
    if (isNavigatingHomeRef.current) return;
    isNavigatingHomeRef.current = true;

    showFeedbackBadge(
      isRtl ? 'اكتمل العرض • جاري العودة للمكتبات...' : 'Playback finished • Returning to Home...',
      Check
    );

    setTimeout(async () => {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {}
      }

      clearVideoQueue();

      try {
        await client.delete(`/playback/${type}/${id}`);
      } catch {}

      navigate('/', { replace: true });
    }, 1100);
  }, [isRtl, showFeedbackBadge, type, id, clearVideoQueue, navigate]);

  const returnToLibraryHomeRef = useRef(returnToLibraryHome);
  useEffect(() => {
    returnToLibraryHomeRef.current = returnToLibraryHome;
  }, [returnToLibraryHome]);

  const handleNextVideo = useCallback(() => {
    const nextVid = isCurrentInQueue ? getNextVideo() : null;
    if (nextVid) {
      advanceToNextVideo();
      const targetType = getItemType(nextVid, type);
      navigate(`/watch/${targetType}/${nextVid.id}`, { replace: true });
    } else if (nextUp && nextUp.id) {
      const targetType = getItemType(nextUp, type);
      navigate(`/watch/${targetType}/${nextUp.id}`, { replace: true });
    } else {
      returnToLibraryHomeRef.current?.();
    }
  }, [getNextVideo, advanceToNextVideo, navigate, nextUp, type, isCurrentInQueue]);

  const handleNextVideoRef = useRef(handleNextVideo);
  useEffect(() => { handleNextVideoRef.current = handleNextVideo; }, [handleNextVideo]);
  const autoPlayNextRef = useRef(autoPlayNext);
  useEffect(() => { autoPlayNextRef.current = autoPlayNext; }, [autoPlayNext]);

  const handlePrevVideo = useCallback(() => {
    const prevVid = isCurrentInQueue ? getPrevVideo() : null;
    if (prevVid) {
      advanceToPrevVideo();
      const targetType = getItemType(prevVid, type);
      navigate(`/watch/${targetType}/${prevVid.id}`, { replace: true });
    }
  }, [getPrevVideo, advanceToPrevVideo, navigate, type, isCurrentInQueue]);

  const buildStreamUrl = useCallback((params = {}) => {
    const token = getAuthToken();
    const q = new URLSearchParams();
    if (token) q.set('token', token);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) q.set(k, String(v));
    }
    const qs = q.toString();
    return qs ? `/api/stream/${type}/${id}?${qs}` : `/api/stream/${type}/${id}`;
  }, [type, id]);

  const src = (streamStrategy?.mode === 'transcode' || streamStrategy?.mode === 'remux') && seekOffset > 0
    ? buildStreamUrl({ start: Math.floor(seekOffset) })
    : buildStreamUrl();

  // Controls auto-hide on inactivity (4s, only hides when playing and menus/drawer closed)
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (showSpeedMenu || showAspectMenu || showVisualMenu || showPlaylistDrawer) return;
    hideTimerRef.current = setTimeout(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        setShowControls(false);
        setShowSpeedMenu(false);
        setShowAspectMenu(false);
        setShowVisualMenu(false);
      }
    }, 4000);
  }, [showSpeedMenu, showAspectMenu, showVisualMenu, showPlaylistDrawer]);

  const setAspect = useCallback((mode, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setAspectRatio(mode);
    try {
      localStorage.setItem('player_aspect_ratio', mode);
    } catch {}
    const opt = ASPECT_OPTIONS.find(o => o.id === mode) || ASPECT_OPTIONS[0];
    showFeedbackBadge(isRtl ? opt.labelAr : opt.labelEn, opt.icon);
    setShowAspectMenu(false);
    resetHideTimer();
  }, [isRtl, showFeedbackBadge, resetHideTimer]);

  const cycleAspectRatio = useCallback(() => {
    setAspectRatio(prev => {
      const modes = ['contain', 'fill', 'cover'];
      const nextIdx = (modes.indexOf(prev) + 1) % modes.length;
      const nextMode = modes[nextIdx];
      try {
        localStorage.setItem('player_aspect_ratio', nextMode);
      } catch {}
      const opt = ASPECT_OPTIONS.find(o => o.id === nextMode) || ASPECT_OPTIONS[0];
      showFeedbackBadge(isRtl ? opt.labelAr : opt.labelEn, opt.icon);
      return nextMode;
    });
  }, [isRtl, showFeedbackBadge]);

  // Synchronous play/pause toggle preserving user activation
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        showFeedbackBadge(isRtl ? 'تشغيل' : 'Play', 'play');
      }).catch((err) => {
        console.warn('Playback failed:', err);
      });
    } else {
      video.pause();
      setIsPlaying(false);
      showFeedbackBadge(isRtl ? 'إيقاف مؤقت' : 'Pause', 'pause');
    }
    resetHideTimer();
  }, [isRtl, showFeedbackBadge, resetHideTimer]);

  const performSeek = useCallback((targetSeconds) => {
    const total = durationRef.current || duration || 0;
    const target = total > 0 ? Math.max(0, Math.min(total, targetSeconds)) : Math.max(0, targetSeconds);
    const strategy = streamStrategyRef.current;
    const isTranscoding = strategy?.mode === 'transcode' || strategy?.mode === 'remux';

    if (isTranscoding) {
      setSeekOffset(target);
      setCurrentTime(target);
      const v = videoRef.current;
      if (v) {
        v.src = buildStreamUrl({ start: Math.floor(target), _: Date.now() });
        v.play().catch(() => {});
      }
    } else {
      const v = videoRef.current;
      if (v) {
        v.currentTime = target;
        setCurrentTime(target);
      }
    }
  }, [duration, type, id]);

  const performSeekRef = useRef(performSeek);
  useEffect(() => { performSeekRef.current = performSeek; }, [performSeek]);

  const skipSeconds = useCallback((sec) => {
    const total = durationRef.current || duration || 0;
    const current = currentTimeRef.current;
    const target = Math.max(0, total > 0 ? Math.min(total, current + sec) : current + sec);
    performSeek(target);
    showFeedbackBadge(sec > 0 ? `+${sec}s` : `${sec}s`);
    resetHideTimer();
  }, [duration, performSeek, resetHideTimer, showFeedbackBadge]);

  // Fetch title info and stream strategy
  useEffect(() => {
    setPlaybackError(false);
    setSeekOffset(0);
    seekOffsetRef.current = 0;
    durationRef.current = 0;
    setDuration(0);
    setCurrentTime(0);
    nextUpTriggered.current = false;
    setNextUp(null);

    // Fetch stream strategy info (direct vs remux vs transcode)
    authFetch(`/api/stream/info/${type}/${id}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          if (d.data.strategy) {
            setStreamStrategy(d.data.strategy);
          }
          if (d.data.probe?.duration) {
            updateDuration(d.data.probe.duration);
          }
          if (d.data.subtitles && Array.isArray(d.data.subtitles)) {
            setAvailableSubtitles(d.data.subtitles);
          }
          if (d.data.audioTracks && Array.isArray(d.data.audioTracks)) {
            setAvailableAudioTracks(d.data.audioTracks);
          }
        }
      })
      .catch(() => {});

    // Also check local subtitles
    authFetch(`/api/subtitles/${type}/${id}`)
      .then(r => r.json())
      .then(subRes => {
        if (subRes.data && Array.isArray(subRes.data) && subRes.data.length > 0) {
          setAvailableSubtitles(prev => {
            const existingPaths = new Set(prev.map(p => p.path));
            const newSubs = subRes.data
              .filter(s => !existingPaths.has(s.path))
              .map((s, idx) => ({
                id: `local_sub_${idx}`,
                language: s.language || 'ar',
                title: s.filename,
                path: s.path,
                format: s.format,
                isLocal: true
              }));
            return [...prev, ...newSubs];
          });
        }
      })
      .catch(() => {});

    if (type === 'movie') {
      authFetch(`/api/movies/${id}`)
        .then(r => r.json())
        .then(d => {
          if (d.data) {
            setMediaInfo(d.data);
            if (d.data.duration) updateDuration(d.data.duration);
          }
        })
        .catch(() => {});
    } else if (type === 'episode') {
      authFetch(`/api/series/episodes/${id}`)
        .then(r => r.json())
        .then(d => {
          if (d.data) {
            setMediaInfo(d.data);
            if (d.data.duration) updateDuration(d.data.duration);
            if (d.data.series_id) {
              try {
                const lastWatched = {
                  seriesId: d.data.series_id,
                  episodeId: d.data.id,
                  episodeNumber: d.data.episode_number,
                  seasonNumber: d.data.season_number,
                  seasonId: d.data.season_id,
                  title: d.data.title,
                  poster: d.data.poster,
                  timestamp: Date.now()
                };
                localStorage.setItem(`arn_last_watched_series_${d.data.series_id}`, JSON.stringify(lastWatched));
                localStorage.setItem('arn_last_watched_recent', JSON.stringify(lastWatched));
              } catch {}

              // Auto-populate videoQueue if empty or does not contain current episode
              const state = usePlayerStore.getState();
              const hasCurrent = state.videoQueue?.some(v => String(v.id) === String(id) && getItemType(v, type) === 'episode');
              if (!hasCurrent && d.data.series_id) {
                authFetch(`/api/series/${d.data.series_id}`)
                  .then(res => res.json())
                  .then(seriesRes => {
                    const season = seriesRes.data?.seasons?.find(sn => sn.id === d.data.season_id) || seriesRes.data?.seasons?.[0];
                    if (season?.episodes?.length) {
                      const epPoster = season.posters?.[0]?.thumb || seriesRes.data?.posters?.[0]?.thumb || d.data.poster;
                      const q = season.episodes.map(ep => ({
                        id: ep.id,
                        title: ep.title || (isRtl ? `الحلقة ${ep.episode_number}` : `Episode ${ep.episode_number}`),
                        episode_number: ep.episode_number,
                        season_number: season.season_number,
                        season_id: season.id,
                        series_id: d.data.series_id,
                        series_title: seriesRes.data.title,
                        type: 'episode',
                        media_type: 'episode',
                        poster: epPoster || null,
                        duration: ep.duration || null,
                      }));
                      const curIdx = q.findIndex(ep => String(ep.id) === String(id));
                      state.setVideoQueue(q, curIdx >= 0 ? curIdx : 0);
                    }
                  })
                  .catch(() => {});
              }
            }
          }
        })
        .catch(() => {});
    }
  }, [type, id, updateDuration]);

  // Auto-Cast logic: If playing locally while a remote session is active, bounce to the remote device!
  useEffect(() => {
    const { activeRemoteSession, transferMedia } = useDeviceHandoffStore.getState();
    const remoteFromParam = searchParams.get('remoteFrom');
    
    if (activeRemoteSession && !remoteFromParam && mediaInfo) {
      transferMedia(
        activeRemoteSession.targetDeviceId,
        activeRemoteSession.targetDeviceName,
        {
          type,
          id,
          title: mediaInfo.title || (type === 'movie' ? 'Movie' : 'Episode'),
          poster: mediaInfo.poster || mediaInfo.backdrop || null,
          currentTime: Math.floor(initialTimeParam || 0),
          duration: mediaInfo.runtime ? mediaInfo.runtime * 60 : (mediaInfo.duration || 0),
          isPlaying: true
        },
        true // pauseLocal
      );
      // Go back to browsing so they can select more videos
      navigate(-1, { replace: true });
    }
  }, [type, id, mediaInfo, searchParams, navigate, initialTimeParam]);

  const nextUpTriggered = useRef(false);
  useEffect(() => { nextUpTriggered.current = false; }, [id]);

  // Video initialization & events
  useEffect(() => {
    stopMusicForVideo();
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      const strategy = streamStrategyRef.current;
      const isTranscoding = strategy?.mode === 'transcode' || strategy?.mode === 'remux';
      const effectivePos = isTranscoding && seekOffsetRef.current > 0
        ? seekOffsetRef.current + video.currentTime
        : video.currentTime;

      currentTimeRef.current = effectivePos;
      setCurrentTime(effectivePos);

      // In remux/transcode mode (fragmented MP4 pipe), video.duration only reflects current buffer fragment length!
      // Therefore, only adopt video.duration in direct play mode, and never override a larger probe duration.
      if (!isTranscoding && video.duration && !isNaN(video.duration) && video.duration > 0) {
        updateDuration(video.duration);
      }

      const totalDur = durationRef.current || duration || 0;
      const threshold = upNextTimeRef.current || 10;

      // Only trigger Up Next when:
      // 1. Media is an episode OR a movie with a next item in the playlist
      // 2. We have a legitimate total duration that is longer than threshold + 30s
      // 3. Current playback has passed at least 30 seconds (never trigger at startup)
      // 4. effectivePos has reached within the end threshold window
      // 5. effectivePos < totalDur
      const hasNextMovie = type === 'movie' && isCurrentInQueue && !!getNextVideo();
      if (
        (type === 'episode' || hasNextMovie) &&
        totalDur > threshold + 30 &&
        effectivePos > 30 &&
        effectivePos >= totalDur - threshold &&
        effectivePos < totalDur
      ) {
        if (!nextUpTriggered.current) {
          nextUpTriggered.current = true;
          setCountdown(threshold);
          const nextVid = isCurrentInQueue ? getNextVideo() : null;
          if (nextVid) {
            setNextUp({
              id: nextVid.id,
              title: nextVid.title,
              episode_number: nextVid.episode_number,
              series_title: nextVid.series_title || mediaInfoRef.current?.series_title || (type === 'movie' ? (isRtl ? 'الفيلم التالي في قائمة التشغيل' : 'Next in Playlist') : ''),
              poster: nextVid.poster || nextVid.backdrop || null,
              type: getItemType(nextVid, type)
            });
          } else if (type === 'episode') {
            const currentInfo = mediaInfoRef.current;
            authFetch(`/api/series/episodes/${id}/next-up`)
              .then(r => r.json())
              .then(j => { 
                if (j.data) {
                  setNextUp({ 
                    ...j.data, 
                    series_poster: currentInfo?.poster || currentInfo?.posters?.[0]?.thumb,
                    series_title: currentInfo?.series_title || currentInfo?.title,
                    type: 'episode'
                  });
                }
              })
              .catch(() => { nextUpTriggered.current = false; });
          }
        }
      } else if (nextUpTriggered.current && totalDur > 0 && effectivePos < totalDur - threshold - 3) {
        // If user sought backwards away from the end, dismiss next-up
        nextUpTriggered.current = false;
        setNextUp(null);
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = async () => {
      if (type === 'episode') {
        try {
          const watched = JSON.parse(localStorage.getItem('arn_watched_episodes') || '[]');
          if (!watched.includes(Number(id))) {
            watched.push(Number(id));
            localStorage.setItem('arn_watched_episodes', JSON.stringify(watched));
          }
        } catch {}
      }

      // Check if there is an active next video in the queue
      const nextVid = isCurrentInQueue ? getNextVideo() : null;
      if (nextVid) {
        if (autoPlayNextRef.current) {
          handleNextVideoRef.current?.();
        }
        return;
      }

      // Check if nextUp episode/video was pre-fetched
      if (nextUp && nextUp.id) {
        if (autoPlayNextRef.current) {
          handleNextVideoRef.current?.();
        }
        return;
      }

      // If it is an episode and nothing was in queue/nextUp, query backend for any subsequent episode in the series
      if (type === 'episode') {
        try {
          const res = await authFetch(`/api/series/episodes/${id}/next-up`);
          const j = await res.json();
          if (j?.data?.id) {
            if (autoPlayNextRef.current) {
              const targetType = getItemType(j.data, 'episode');
              navigate(`/watch/${targetType}/${j.data.id}`, { replace: true });
            }
            return;
          }
        } catch {}
      }

      // No upcoming video exists:
      // Movie ended, or series episodes ended, or playlist ended.
      // Automatically return to the Library Home page!
      returnToLibraryHomeRef.current?.();
    };

    const onLoaded = () => {
      const strategy = streamStrategyRef.current;
      const isTranscoding = strategy?.mode === 'transcode' || strategy?.mode === 'remux';
      if (!isTranscoding && video.duration && !isNaN(video.duration) && video.duration > 0) {
        updateDuration(video.duration);
      }
      // If handoff time is provided in URL
      if (initialTimeParam !== null && !isNaN(initialTimeParam) && initialTimeParam > 0) {
        performSeek(initialTimeParam);
        if (autoPlayParam) {
          video.play().catch(() => {});
        }
        return;
      }
      // Resume playback position
      authFetch(`/api/playback/continue`)
        .then(r => r.json())
        .then(j => {
          const found = j.data?.find(p => p.media_type === type && String(p.media_id) === String(id));
          const effectiveDuration = durationRef.current || duration || video.duration;
          if (found && found.position > 5 && effectiveDuration > 30 && found.position < (effectiveDuration - (upNextTimeRef.current || 10))) {
            performSeek(found.position);
          }
        })
        .catch(() => {});
    };

    video.addEventListener('timeupdate', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('loadedmetadata', onLoaded);

    // Initial play attempt
    video.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      // Autoplay blocked by browser policy: keep paused cleanly and show controls
      setIsPlaying(false);
      setShowControls(true);
    });

    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('loadedmetadata', onLoaded);
    };
  }, [id, type, stopMusicForVideo, updateDuration]);

  // Listen to remote commands from another device and local pause requests
  useEffect(() => {
    const handleRemoteCommand = (e) => {
      const { command, value } = e.detail || {};
      const video = videoRef.current;
      if (!video) return;

      switch (command) {
        case 'play':
          video.play().catch(() => {});
          showFeedbackBadge(isRtl ? 'تشغيل عن بُعد' : 'Remote Play', 'play');
          break;
        case 'pause':
          video.pause();
          showFeedbackBadge(isRtl ? 'إيقاف عن بُعد' : 'Remote Pause', 'pause');
          break;
        case 'seek_delta':
          if (typeof value === 'number') {
            performSeekRef.current(currentTimeRef.current + value);
            showFeedbackBadge(value > 0 ? `+${value}s` : `${value}s`);
          }
          break;
        case 'seek':
          if (typeof value === 'number') {
            performSeekRef.current(value);
          }
          break;
        case 'mute':
          video.muted = !!value;
          setIsMuted(!!value);
          break;
        case 'volume':
          if (typeof value === 'number') {
            const v = Math.max(0, Math.min(1, value));
            video.volume = v;
            setVolume(v);
          }
          break;
        case 'stop':
          video.pause();
          navigate(-1);
          break;
        case 'speed':
          if (typeof value === 'number') {
            video.playbackRate = value;
            setPlaybackSpeed(value);
            showFeedbackBadge(`${value}x`);
          }
          break;
        case 'restart':
          performSeekRef.current(0);
          video.play().catch(() => {});
          showFeedbackBadge(isRtl ? 'إعادة التشغيل' : 'Restart');
          break;
        case 'aspect':
        case 'fit':
          if (typeof value === 'string') {
            setAspectRatio(value);
            try { localStorage.setItem('player_aspect_ratio', value); } catch {}
            showFeedbackBadge(value === 'cover' ? (isRtl ? 'ملء الشاشة' : 'Cover') : value === 'fill' ? (isRtl ? 'تمدد' : 'Stretch') : (isRtl ? 'احتواء' : 'Fit'));
          }
          break;
        case 'dpad':
          if (value === 'left') {
            performSeekRef.current(currentTimeRef.current - 10);
            showFeedbackBadge('-10s');
          } else if (value === 'right') {
            performSeekRef.current(currentTimeRef.current + 10);
            showFeedbackBadge('+10s');
          } else if (value === 'up') {
            const v = Math.min(1, (video.volume || 0) + 0.1);
            video.volume = v;
            setVolume(v);
            showFeedbackBadge(`${Math.round(v * 100)}%`);
          } else if (value === 'down') {
            const v = Math.max(0, (video.volume || 0) - 0.1);
            video.volume = v;
            setVolume(v);
            showFeedbackBadge(`${Math.round(v * 100)}%`);
          } else if (value === 'enter') {
            if (video.paused) {
              video.play().catch(() => {});
              showFeedbackBadge(isRtl ? 'تشغيل' : 'Play', 'play');
            } else {
              video.pause();
              showFeedbackBadge(isRtl ? 'إيقاف' : 'Pause', 'pause');
            }
          }
          break;
        case 'set_subtitle_track': {
          const track = value;
          setSelectedSubtitle(track);
          selectedSubtitleRef.current = track;
          const vid = videoRef.current;
          if (vid && vid.textTracks) {
            for (let i = 0; i < vid.textTracks.length; i++) {
              vid.textTracks[i].mode = 'disabled';
            }
          }
          const subTitle = track ? (track.title || track.language || (isRtl ? 'تشغيل الترجمة' : 'Subtitles On')) : (isRtl ? 'إيقاف الترجمة' : 'Subtitles Off');
          showFeedbackBadge(subTitle);
          break;
        }
        case 'set_audio_track': {
          const trackIndex = typeof value === 'number' ? value : value?.trackIndex ?? 0;
          setSelectedAudioTrack(trackIndex);
          selectedAudioTrackRef.current = trackIndex;
          const vid = videoRef.current;
          if (vid && vid.audioTracks) {
            for (let i = 0; i < vid.audioTracks.length; i++) {
              vid.audioTracks[i].enabled = (i === trackIndex);
            }
          }
          const audioTitle = typeof value === 'object' && value?.title ? value.title : `Audio ${trackIndex + 1}`;
          showFeedbackBadge(audioTitle);
          break;
        }
        case 'send_string': {
          const str = typeof value === 'string' ? value : value?.text || '';
          if (str) showFeedbackBadge(str);
          break;
        }
        default:
          break;
      }
    };

    const handlePauseLocal = () => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    };

    window.addEventListener('arn-remote-command', handleRemoteCommand);
    window.addEventListener('arn-pause-local-playback', handlePauseLocal);
    return () => {
      window.removeEventListener('arn-remote-command', handleRemoteCommand);
      window.removeEventListener('arn-pause-local-playback', handlePauseLocal);
    };
  }, [isRtl, navigate, showFeedbackBadge]);

  // Real-time instant synchronization of playback state to controlling devices
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const remoteFromParam = searchParams.get('remoteFrom');
    
    const syncStateImmediate = (override = {}) => {
      const vid = videoRef.current;
      if (!vid) return;
      client.post('/handoff/state', {
        fromDeviceId: deviceId,
        targetDeviceId: remoteFromParam || undefined,
        state: {
          currentTime: vid.currentTime,
          duration: vid.duration || duration || 0,
          isPlaying: !vid.paused,
          volume: vid.volume,
          isMuted: vid.muted,
          speed: vid.playbackRate || 1,
          fit: aspectRatio,
          availableSubtitles: availableSubtitlesRef.current || [],
          selectedSubtitle: selectedSubtitleRef.current || null,
          availableAudioTracks: availableAudioTracksRef.current || [],
          selectedAudioTrack: selectedAudioTrackRef.current || 0,
          media: {
            id,
            type,
            title: mediaInfo?.title || displayTitle,
            poster: mediaInfo?.poster || mediaInfo?.backdrop || null,
            duration: vid.duration || duration || 0
          },
          ...override
        }
      }).catch(() => {});
    };

    // Initial sync
    syncStateImmediate();

    // Event-driven immediate updates
    const onPlay = () => syncStateImmediate({ isPlaying: true });
    const onPause = () => syncStateImmediate({ isPlaying: false });
    const onSeeked = () => syncStateImmediate();
    const onRateChange = () => syncStateImmediate({ speed: video.playbackRate });
    const onVolChange = () => syncStateImmediate({ volume: video.volume, isMuted: video.muted });

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('ratechange', onRateChange);
    video.addEventListener('volumechange', onVolChange);

    // Heartbeat ticker every 1s during playback
    const interval = setInterval(() => {
      if (!video.paused) {
        syncStateImmediate();
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('ratechange', onRateChange);
      video.removeEventListener('volumechange', onVolChange);
    };
  }, [searchParams, aspectRatio, deviceId, id, type, mediaInfo, displayTitle, duration]);

  // Load server volume settings
  useEffect(() => {
    fetchVolumeSettings().then(res => {
      if (res && typeof res.volume === 'number') {
        const v = Math.max(0, Math.min(1, res.volume));
        setVolume(v);
        setIsMuted(!!res.muted);
        setGlobalVolume(v);
        setGlobalMuted(!!res.muted);
      }
    }).catch(() => {});
  }, [setGlobalVolume, setGlobalMuted]);

  // Keep video volume and mute strictly in sync
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = isMuted ? 0 : volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted, id]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Save playback progress every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const v = videoRef.current;
      const totalDur = durationRef.current || duration || (v ? v.duration : 0);
      if (v && !v.paused && totalDur > 0) {
        const strategy = streamStrategyRef.current;
        const isTranscoding = strategy?.mode === 'transcode' || strategy?.mode === 'remux';
        const effectivePos = isTranscoding && seekOffsetRef.current > 0
          ? Math.round(seekOffsetRef.current + v.currentTime)
          : Math.round(v.currentTime);

        savePlayback({
          media_type: type,
          media_id: Number(id),
          position: effectivePos,
          duration: Math.round(totalDur)
        }).catch(() => {});

        if (type === 'episode' && totalDur > 0 && effectivePos / totalDur >= 0.8) {
          try {
            const watched = JSON.parse(localStorage.getItem('arn_watched_episodes') || '[]');
            if (!watched.includes(Number(id))) {
              watched.push(Number(id));
              localStorage.setItem('arn_watched_episodes', JSON.stringify(watched));
            }
          } catch {}
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [id, type, duration]);

  // Next up countdown
  useEffect(() => {
    if (!nextUp) return;
    const iv = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : 0)), 1000);
    if (countdown === 0) {
      setNextUp(null);
      setCountdown(upNextTime);
      if (autoPlayNext) {
        handleNextVideo();
      }
    }
    return () => clearInterval(iv);
  }, [nextUp, countdown, handleNextVideo, autoPlayNext, upNextTime]);

  // Pause hide timer whenever menus or playlist drawer open
  useEffect(() => {
    if (showSpeedMenu || showAspectMenu || showVisualMenu || showPlaylistDrawer) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else if (showControls && isPlaying) {
      resetHideTimer();
    }
  }, [showSpeedMenu, showAspectMenu, showVisualMenu, showPlaylistDrawer, showControls, isPlaying, resetHideTimer]);

  const handleSeek = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const pos = Math.max(0, Math.min(1, offsetX / rect.width));
    performSeek(pos * duration);
    resetHideTimer();
  };

  const handleTouchSeek = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!progressBarRef.current || !e.touches || !e.touches[0] || !duration) return;
    const touch = e.touches[0];
    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const pos = Math.max(0, Math.min(1, offsetX / rect.width));
    performSeek(pos * duration);
    resetHideTimer();
  };

  const handleProgressMouseMove = (e) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const pos = Math.max(0, Math.min(1, offsetX / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * duration);
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
  };

  const handleVolumeChange = (newVol) => {
    const v = Math.max(0, Math.min(1, newVol));
    setVolume(v);
    setIsMuted(v === 0);
    setGlobalVolume(v);
    setGlobalMuted(v === 0);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
    saveVolumeSettings({ volume: v, muted: v === 0 }).catch(() => {});
    resetHideTimer();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      const restored = volume > 0 ? volume : 0.5;
      video.muted = false;
      video.volume = restored;
      setIsMuted(false);
      setVolume(restored);
      setGlobalMuted(false);
      setGlobalVolume(restored);
      saveVolumeSettings({ volume: restored, muted: false }).catch(() => {});
      showFeedbackBadge(`${Math.round(restored * 100)}%`);
    } else {
      video.muted = true;
      setIsMuted(true);
      setGlobalMuted(true);
      saveVolumeSettings({ volume, muted: true }).catch(() => {});
      showFeedbackBadge(isRtl ? 'كتم الصوت' : 'Muted');
    }
    resetHideTimer();
  };

  const handleWheel = useCallback((e) => {
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newVol = Math.max(0, Math.min(1, volume + delta));
    setVolume(newVol);
    setIsMuted(newVol === 0);
    setGlobalVolume(newVol);
    setGlobalMuted(newVol === 0);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
    }
    saveVolumeSettings({ volume: newVol, muted: newVol === 0 }).catch(() => {});
    showFeedbackBadge(`${Math.round(newVol * 100)}%`);
    resetHideTimer();
  }, [volume, showFeedbackBadge, resetHideTimer, setGlobalVolume, setGlobalMuted]);

  const setSpeed = (spd, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setPlaybackSpeed(spd);
    if (videoRef.current) {
      videoRef.current.playbackRate = spd;
    }
    setShowSpeedMenu(false);
    showFeedbackBadge(`${spd}x`);
    resetHideTimer();
  };

  const toggleFullscreen = (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    resetHideTimer();
  };

  const togglePiP = async (e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('PiP error', err);
    }
    resetHideTimer();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName)) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          skipSeconds(-skipTime);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          skipSeconds(skipTime);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          showFeedbackBadge(`${Math.round(Math.min(1, volume + 0.1) * 100)}%`);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          showFeedbackBadge(`${Math.round(Math.max(0, volume - 0.1) * 100)}%`);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'a':
          e.preventDefault();
          cycleAspectRatio();
          break;
        case 'q':
        case 'p':
          e.preventDefault();
          setShowPlaylistDrawer(prev => !prev);
          break;
        default:
          break;
      }
      resetHideTimer();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, skipSeconds, volume, toggleMute, toggleFullscreen, resetHideTimer, showFeedbackBadge, skipTime, cycleAspectRatio, setShowPlaylistDrawer]);

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  const posterSrc = mediaInfo?.poster || mediaInfo?.posters?.[0]?.thumb || mediaInfo?.series_poster;

  // Video area click / tap handling (Double tap skips, single tap toggles controls / play)
  const handleContainerClick = (e) => {
    // If clicked on an interactive button or control, ignore
    if (e.target.closest('button, input, select, a, [role="button"]')) return;

    // If menus were open, close them
    if (showSpeedMenu || showAspectMenu || showVisualMenu) {
      setShowSpeedMenu(false);
        setShowAspectMenu(false);
        setShowVisualMenu(false);
      resetHideTimer();
      return;
    }

    const now = Date.now();
    const isDoubleTap = (now - lastTapTimeRef.current) < 320;
    lastTapTimeRef.current = now;

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && isDoubleTap) {
      const clickX = e.clientX;
      const relX = (clickX - rect.left) / rect.width;
      const isBack = isRtl ? relX > 0.65 : relX < 0.35;
      const isForward = isRtl ? relX < 0.35 : relX > 0.65;

      if (isBack) {
        skipSeconds(-skipTime);
        return;
      } else if (isForward) {
        skipSeconds(skipTime);
        return;
      }
    }

    // Single interaction:
    if (!showControls) {
      // Reveal controls
      setShowControls(true);
      resetHideTimer();
    } else {
      // Direct synchronous toggle
      togglePlay();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen bg-black overflow-hidden select-none flex items-center justify-center ${
        !showControls && isPlaying ? 'cursor-none' : ''
      }`}
      onMouseMove={resetHideTimer}
      onClick={handleContainerClick}
      onWheel={handleWheel}
    >
      {/* Video Element */}
      <video
        key={id}
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        onError={() => setPlaybackError(true)}
        onLoadedMetadata={(e) => {
          e.currentTarget.volume = isMuted ? 0 : volume;
          e.currentTarget.muted = isMuted;
          if (e.currentTarget.duration) updateDuration(e.currentTarget.duration);
        }}
        className={`w-full h-full transition-all duration-300 ${
          aspectRatio === 'fill'
            ? 'object-fill'
            : aspectRatio === 'cover'
              ? 'object-cover'
              : 'object-contain'
        }`}
        style={{
          filter: `brightness(${visualSettings.brightness}%) contrast(${visualSettings.contrast}%) saturate(${visualSettings.saturation}%)`
        }}
      >
        {selectedSubtitle?.path ? (
          <track
            kind="subtitles"
            src={`/api/subtitles/serve?path=${encodeURIComponent(selectedSubtitle.path)}${getAuthToken() ? `&token=${encodeURIComponent(getAuthToken())}` : ''}`}
            srcLang={selectedSubtitle.language || 'ar'}
            label={selectedSubtitle.title || 'العربية'}
            default
          />
        ) : null}
      </video>

      {/* Playback Error Alert Overlay */}
      {playbackError && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-4 border border-red-500/30">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
            {isRtl ? 'تعذر تشغيل هذا الفيديو' : 'Cannot play this video'}
          </h2>
          <p className="text-xs sm:text-sm text-white/70 max-w-md mb-6 leading-relaxed">
            {isRtl
              ? 'قد يكون امتداد الفيديو أو الكوديك (مثل بعض ملفات MKV أو ترميزات الصوت) غير مدعوم مباشرة في هذا المتصفح.'
              : 'The video codec or format might not be supported natively by your browser.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setPlaybackError(false);
                const v = videoRef.current;
                if (v) { v.load(); v.play().catch(() => {}); }
              }}
              className="px-5 py-2.5 rounded-xl bg-primaryMovies text-white text-xs sm:text-sm font-semibold flex items-center gap-2 hover:brightness-110 active:scale-95 transition"
            >
              <RefreshCw size={15} />
              {isRtl ? 'إعادة المحاولة' : 'Retry'}
            </button>
            <button
              onClick={() => navigate(-1)}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-semibold transition"
            >
              {isRtl ? 'رجوع للخلف' : 'Go Back'}
            </button>
          </div>
        </div>
      )}

      {/* Central Feedback Indicator */}
      {feedback && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50">
          <div className="px-6 py-3.5 rounded-2xl bg-black/85 backdrop-blur-md text-white text-base md:text-lg font-bold border border-white/20 shadow-2xl flex items-center gap-3 animate-scaleUp">
            {feedback.icon === 'play' && <Play size={22} className="fill-white" />}
            {feedback.icon === 'pause' && <Pause size={22} className="fill-white" />}
            {feedback.icon && typeof feedback.icon === 'function' && <feedback.icon size={22} className="text-white" />}
            <span>{feedback.text}</span>
          </div>
        </div>
      )}

      {/* Central Big Play / Pause Action Button */}
      <div
        className={`absolute inset-0 flex items-center justify-center z-20 pointer-events-none transition-all duration-300 ${
          !isPlaying ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
        }`}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 hover:bg-black/80 active:scale-90 backdrop-blur-md text-white flex items-center justify-center transition-all shadow-2xl border border-white/20 hover:border-white/40 touch-manipulation ${
            !isPlaying ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
          title={isPlaying ? (isRtl ? 'إيقاف مؤقت' : 'Pause') : (isRtl ? 'تشغيل' : 'Play')}
        >
          {isPlaying ? (
            <Pause size={28} className="fill-white sm:w-8 sm:h-8" />
          ) : (
            <Play size={28} className="fill-white translate-x-0.5 sm:w-8 sm:h-8" />
          )}
        </button>
      </div>

      {/* Up Next Overlay */}
      {nextUp && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-28 sm:bottom-32 ${isRtl ? 'left-4 sm:left-8' : 'right-4 sm:right-8'} w-[calc(100vw-32px)] sm:w-[320px] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-40 flex flex-col pointer-events-auto transition-opacity duration-500 animate-fadeIn`}
        >
          <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
            <span className="text-sm font-semibold text-white/90">
              {isRtl ? 'التالي' : 'Up Next'}
            </span>
            <span className="text-xs font-bold text-primaryMovies bg-primaryMovies/20 px-2 py-0.5 rounded">
              {countdown}s
            </span>
          </div>
          <div className="p-4 flex gap-4">
            <div className="w-16 h-24 rounded bg-white/10 flex-shrink-0 overflow-hidden">
               {nextUp.poster || nextUp.series_poster ? <img src={nextUp.poster || nextUp.series_poster} alt={nextUp.title || "Poster"} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-white/5"><Tv size={20} className="text-white/30" /></div>}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
               <div className="text-xs text-white/60 mb-1">{nextUp.series_title}</div>
               {nextUp.episode_number ? (
                 <>
                   <div className="text-sm font-bold text-white truncate mb-1">
                     {isRtl ? `الحلقة ${nextUp.episode_number}` : `Episode ${nextUp.episode_number}`}
                   </div>
                   <div className="text-xs text-white/80 truncate mb-3">{nextUp.title}</div>
                 </>
               ) : (
                 <div className="text-sm font-bold text-white truncate mb-3">{nextUp.title}</div>
               )}
               
               <button
                 onClick={(e) => {
                   e.stopPropagation();
                   handleNextVideo();
                 }}
                 className="w-full py-1.5 rounded bg-primaryMovies text-white text-xs font-semibold hover:brightness-110 transition flex items-center justify-center gap-2 shadow-lg touch-manipulation"
               >
                 <Play size={12} fill="white" /> {isRtl ? 'تشغيل الآن' : 'Play Now'}
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute top-0 inset-x-0 bg-gradient-to-b from-black/85 via-black/40 to-transparent p-3 sm:p-4 md:p-6 transition-opacity duration-300 pointer-events-auto flex items-center justify-between z-30 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-2.5 sm:gap-4 max-w-[85%]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(-1);
            }}
            aria-label={isRtl ? 'رجوع' : 'Back'}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 flex-shrink-0 touch-manipulation"
            title={isRtl ? 'رجوع' : 'Back'}
          >
            {isRtl ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
          </button>
          <div className="min-w-0">
            <h1 className="text-white text-sm sm:text-base md:text-lg font-bold truncate drop-shadow">
              {displayTitle}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {type === 'movie' && mediaInfo?.year && (
                <span className="text-[11px] sm:text-xs text-white/60">{mediaInfo.year}</span>
              )}
              {streamStrategy && (
                <span
                  className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-md transition ${
                    streamStrategy.mode === 'direct'
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : streamStrategy.mode === 'remux'
                        ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                  }`}
                  title={streamStrategy.reason}
                >
                  {streamStrategy.mode === 'direct'
                    ? (isRtl ? '⚡ بث مباشر' : '⚡ Direct Play')
                    : streamStrategy.mode === 'remux'
                      ? (isRtl ? '📦 تغليف سريع' : '📦 Remux')
                      : (isRtl ? '🔄 تحويل تلقائي' : '🔄 Transcoding')}
                </span>
              )}
            </div>
          </div>
        </div>

        {activeRemoteSession && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openFullRemote();
            }}
            className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-900/40 border border-rose-400/40 transition active:scale-95 animate-pulse"
            title={isRtl ? 'فتح مركز التحكم الكامل' : 'Open Full Remote'}
          >
            <SlidersHorizontal size={14} />
            <span className="hidden sm:inline">
              {isRtl ? `التحكم في ${activeRemoteSession.targetDeviceName}` : `Control ${activeRemoteSession.targetDeviceName}`}
            </span>
            <span className="sm:hidden">{isRtl ? 'التحكم الكامل' : 'Full Remote'}</span>
          </button>
        )}
      </div>

      {/* Bottom Controls Overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 pt-4 sm:pt-6 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:pb-4 px-3 sm:px-6 md:px-8 transition-opacity duration-300 z-30 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Independent Gradient Shadow Layer (avoids stretching with poster) */}
        <div className="absolute bottom-0 inset-x-0 h-28 sm:h-36 bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none -z-10" />

        <div className="flex items-end gap-3 sm:gap-5 md:gap-6 w-full max-w-[1800px] mx-auto relative z-10">
          {/* Poster (hidden on small phones, visible on tablets & desktops) */}
          {posterSrc && (
            <div className="hidden sm:block w-24 sm:w-32 md:w-40 lg:w-44 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.95)] bg-white/5 flex-shrink-0 border-2 border-white/20 ring-1 ring-black/60 mb-2 transition-all duration-300 hover:scale-105 select-none group">
              <img
                src={posterSrc}
                alt={displayTitle}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="eager"
              />
            </div>
          )}
          
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Mobile Timestamp Row */}
            <div className="flex items-center justify-between text-[11px] font-mono text-white/75 px-1 mb-1 sm:hidden select-none">
              <span className="font-semibold text-white">{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Interactive Scrubber Bar (Always LTR from 00:00 to Duration) */}
            <div
              ref={progressBarRef}
              dir="ltr"
              role="slider"
              aria-label={isRtl ? 'شريط التقديم والتأخير' : 'Seek slider'}
              aria-valuemin={0}
              aria-valuemax={duration || 100}
              aria-valuenow={currentTime}
              aria-valuetext={formatTime(currentTime)}
              tabIndex={0}
              onClick={handleSeek}
              onTouchStart={handleTouchSeek}
              onTouchMove={handleTouchSeek}
              onTouchEnd={() => resetHideTimer()}
              onMouseMove={handleProgressMouseMove}
              onMouseLeave={handleProgressMouseLeave}
              className="group relative w-full py-2 -my-2 cursor-pointer flex items-center mb-1 sm:mb-2 touch-none select-none"
            >
              {/* Visible Track Bar */}
              <div className="relative w-full h-1.5 sm:h-2 group-hover:h-2.5 bg-white/25 rounded-full overflow-visible transition-all duration-150">
                {/* Played Red Progress Fill */}
                <div
                  className="absolute top-0 left-0 bottom-0 bg-[#E50914] rounded-full pointer-events-none transition-[width] duration-75 ease-out shadow-[0_0_8px_rgba(229,9,20,0.6)]"
                  style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />

                {/* Scrubber Thumb (Circle Indicator - Always Clearly Visible) */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-white shadow-[0_0_12px_rgba(229,9,20,0.9)] border-2 border-[#E50914] pointer-events-none transform scale-100 group-hover:scale-125 transition-transform duration-150"
                  style={{ left: `${Math.min(100, Math.max(0, progressPercent))}%` }}
                />
              </div>

              {/* Hover timestamp preview */}
              {hoverTime !== null && (
                <div
                  className="absolute -top-8 -translate-x-1/2 px-2.5 py-1 rounded-md bg-black/90 backdrop-blur-md text-[11px] font-mono font-medium text-white border border-white/20 pointer-events-none shadow-xl whitespace-nowrap hidden sm:block z-20"
                  style={{ left: `${hoverPosition}%` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* Action Controls Row */}
            <div className="flex items-center justify-between text-white gap-2">
              {/* Left / Start Controls */}
              <div className="flex items-center gap-1.5 sm:gap-3 md:gap-5 flex-shrink-0">
                {/* Prev button */}
                {videoQueue?.length > 1 && isCurrentInQueue && (
                  <button
                    onClick={handlePrevVideo}
                    disabled={!getPrevVideo()}
                    aria-label={isRtl ? 'السابق' : 'Previous'}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 touch-manipulation"
                    title={isRtl ? 'السابق' : 'Previous'}
                  >
                    <SkipBack size={16} className="fill-white" />
                  </button>
                )}

                {/* Skip -10s */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    skipSeconds(-skipTime);
                  }}
                  aria-label={isRtl ? `تأخير ${skipTime} ثوانٍ` : `Skip backward ${skipTime}s`}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative group flex-shrink-0 touch-manipulation"
                  title={isRtl ? `تأخير ${skipTime} ثوانٍ (Arrow Left)` : `Skip backward ${skipTime}s (Arrow Left)`}
                >
                  <RotateCcw size={15} />
                  <span className="absolute text-[7px] sm:text-[8px] font-bold mt-0.5">{skipTime}</span>
                </button>

                {/* Play / Pause button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  aria-label={isPlaying ? (isRtl ? 'إيقاف مؤقت' : 'Pause') : (isRtl ? 'تشغيل' : 'Play')}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-black hover:bg-white/90 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md flex-shrink-0 touch-manipulation"
                  title={isPlaying ? (isRtl ? 'إيقاف مؤقت (Space)' : 'Pause (Space)') : (isRtl ? 'تشغيل (Space)' : 'Play (Space)')}
                >
                  {isPlaying ? <Pause size={18} className="fill-black" /> : <Play size={18} className="fill-black translate-x-0.5" />}
                </button>

                {/* Skip +10s */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    skipSeconds(skipTime);
                  }}
                  aria-label={isRtl ? `تقديم ${skipTime} ثوانٍ` : `Skip forward ${skipTime}s`}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 relative group flex-shrink-0 touch-manipulation"
                  title={isRtl ? `تقديم ${skipTime} ثوانٍ (Arrow Right)` : `Skip forward ${skipTime}s (Arrow Right)`}
                >
                  <RotateCw size={15} />
                  <span className="absolute text-[7px] sm:text-[8px] font-bold mt-0.5">{skipTime}</span>
                </button>

                {/* Next button */}
                {videoQueue?.length > 1 && isCurrentInQueue && (
                  <button
                    onClick={handleNextVideo}
                    disabled={!getNextVideo()}
                    aria-label={isRtl ? 'التالي' : 'Next'}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur text-white flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 touch-manipulation"
                    title={isRtl ? 'التالي' : 'Next'}
                  >
                    <SkipForward size={16} className="fill-white" />
                  </button>
                )}

                {/* Volume / Mute group (hidden on mobile) */}
                <div className="hidden md:flex items-center gap-2 group/vol relative">
                  <button
                    onClick={toggleMute}
                    aria-label={isRtl ? 'كتم أو تشغيل الصوت' : 'Mute or unmute'}
                    className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition touch-manipulation"
                    title={isRtl ? 'كتم / تشغيل الصوت (M)' : 'Mute / Unmute (M)'}
                  >
                    {isMuted || volume === 0 ? <VolumeX size={19} /> : volume < 0.5 ? <Volume1 size={19} /> : <Volume2 size={19} />}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 md:w-24 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primaryMovies"
                  />
                </div>

                {/* Desktop Time display */}
                <div className="hidden sm:block text-xs md:text-sm font-medium text-white/80 tabular-nums">
                  <span>{formatTime(currentTime)}</span>
                  <span className="mx-1 text-white/40">/</span>
                  <span className="text-white/60">{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right / End Controls */}
              <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4 relative flex-shrink-0">
                {/* Playlist Queue Toggle */}
                {videoQueue?.length > 0 && isCurrentInQueue && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPlaylistDrawer(prev => !prev);
                      setShowSpeedMenu(false);
                      setShowAspectMenu(false);
                      setShowVisualMenu(false);
                    }}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold backdrop-blur transition-all flex items-center gap-1 sm:gap-1.5 touch-manipulation ${
                      showPlaylistDrawer ? 'bg-primaryMovies text-white ring-2 ring-primaryMovies/40 shadow-lg' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isRtl ? 'قائمة تشغيل الفيديوهات المتتالية (Q)' : 'Playback Queue (Q)'}
                  >
                    <ListVideo size={13} className="sm:w-3.5 sm:h-3.5" />
                    <span className="font-mono text-[11px] font-bold">
                      {videoQueueIndex >= 0 ? `${videoQueueIndex + 1}/${videoQueue.length}` : videoQueue.length}
                    </span>
                  </button>
                )}

                {/* Visual Settings Selector */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowVisualMenu(prev => !prev);
                      setShowSpeedMenu(false);
                      setShowAspectMenu(false);
                    }}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold backdrop-blur transition-all flex items-center gap-1 sm:gap-1.5 touch-manipulation ${
                      showVisualMenu ? 'bg-primaryMovies text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isRtl ? 'إعدادات مرئية' : 'Visual Settings'}
                  >
                    <SlidersHorizontal size={13} className="sm:w-3.5 sm:h-3.5" />
                    <span className={isRtl ? 'hidden' : 'hidden sm:inline'}>Colors</span>
                  </button>

                  {/* Visual Settings Menu Popup */}
                  {showVisualMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-12 ${isRtl ? 'left-0 sm:left-0' : 'right-0 sm:right-0'} bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-3 shadow-2xl z-50 w-[240px] max-w-[calc(100vw-24px)] animate-fadeIn flex flex-col gap-3`}
                    >
                      <div className="flex justify-between items-center border-b border-white/20 pb-2">
                        <div className="text-[11px] font-semibold text-white/70">
                          {isRtl ? 'إعدادات الصورة' : 'Visual Settings'}
                        </div>
                        <button onClick={resetVisualSettings} className="text-[10px] text-white/50 hover:text-white transition">
                          {isRtl ? 'إعادة ضبط' : 'Reset'}
                        </button>
                      </div>
                      
                      {[
                        { id: 'brightness', label: isRtl ? 'الإضاءة' : 'Brightness' },
                        { id: 'contrast', label: isRtl ? 'التباين' : 'Contrast' },
                        { id: 'saturation', label: isRtl ? 'التشبع' : 'Saturation' }
                      ].map(ctrl => (
                        <div key={ctrl.id} className="flex flex-col gap-1">
                          <div className="flex justify-between text-[10px] text-white/80">
                            <span>{ctrl.label}</span>
                            <span className="font-mono">{visualSettings[ctrl.id]}%</span>
                          </div>
                          <input
                            type="range"
                            min="50" max="200" step="5"
                            value={visualSettings[ctrl.id]}
                            onChange={(e) => updateVisualSetting(ctrl.id, Number(e.target.value))}
                            className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primaryMovies"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aspect Ratio Selector */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAspectMenu(prev => !prev);
                      setShowSpeedMenu(false);
                    }}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold backdrop-blur transition-all flex items-center gap-1 sm:gap-1.5 touch-manipulation ${
                      showAspectMenu ? 'bg-primaryMovies text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isRtl ? 'أبعاد الفيديو (اختصار A)' : 'Aspect Ratio (Shortcut A)'}
                  >
                    {aspectRatio === 'fill' ? (
                      <StretchHorizontal size={13} className="sm:w-3.5 sm:h-3.5" />
                    ) : aspectRatio === 'cover' ? (
                      <Crop size={13} className="sm:w-3.5 sm:h-3.5" />
                    ) : (
                      <Scan size={13} className="sm:w-3.5 sm:h-3.5" />
                    )}
                    <span>
                      {aspectRatio === 'fill'
                        ? (isRtl ? 'استرتش' : 'Stretch')
                        : aspectRatio === 'cover'
                          ? (isRtl ? 'كافر' : 'Cover')
                          : (isRtl ? 'فيت' : 'Fit')}
                    </span>
                  </button>

                  {/* Aspect Ratio Menu Popup */}
                  {showAspectMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-12 ${isRtl ? 'left-0 sm:left-0' : 'right-0 sm:right-0'} bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-1.5 shadow-2xl z-50 min-w-[165px] max-w-[calc(100vw-24px)] animate-fadeIn`}
                    >
                      <div className="text-[11px] font-semibold text-white/70 px-2.5 py-1.5 border-b border-white/20/40 mb-1 flex items-center justify-between">
                        <span>{isRtl ? 'أبعاد الفيديو' : 'Aspect Ratio'}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-white/10 rounded font-mono text-white/70">A</span>
                      </div>
                      {ASPECT_OPTIONS.map(opt => {
                        const Icon = opt.icon;
                        const isSelected = aspectRatio === opt.id;
                        return (
                          <button
                            key={opt.id}
                            onClick={(e) => setAspect(opt.id, e)}
                            className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition gap-2.5 my-0.5 touch-manipulation ${
                              isSelected
                                ? 'bg-primaryMovies text-white font-bold shadow'
                                : 'text-white/80 hover:bg-white/10'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Icon size={15} className={isSelected ? 'text-white' : 'text-white/60'} />
                              <div className={`flex flex-col ${isRtl ? 'text-right' : 'text-left'}`}>
                                <span className="leading-tight">{isRtl ? opt.labelAr : opt.labelEn}</span>
                                <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-white/50'} leading-tight mt-0.5`}>
                                  {isRtl ? opt.descAr : opt.descEn}
                                </span>
                              </div>
                            </div>
                            {isSelected && <Check size={14} className="flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Speed Selector */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSpeedMenu(prev => !prev);
                      setShowAspectMenu(false);
                    }}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold backdrop-blur transition-all flex items-center gap-1 touch-manipulation ${
                      showSpeedMenu ? 'bg-primaryMovies text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isRtl ? 'سرعة التشغيل' : 'Playback speed'}
                  >
                    {playbackSpeed === 1 ? (isRtl ? 'السرعة' : 'Speed') : `${playbackSpeed}x`}
                  </button>

                  {/* Speed Menu Popup */}
                  {showSpeedMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-12 ${isRtl ? 'left-0 sm:left-0' : 'right-0 sm:right-0'} bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-1.5 shadow-2xl z-50 min-w-[120px] max-w-[calc(100vw-24px)] animate-fadeIn`}
                    >
                      <div className="text-[11px] font-semibold text-white/70 px-2.5 py-1">
                        {isRtl ? 'سرعة التشغيل' : 'Playback speed'}
                      </div>
                      {SPEED_OPTIONS.map(spd => (
                        <button
                          key={spd}
                          onClick={(e) => setSpeed(spd, e)}
                          className={`w-full px-3 py-1.5 rounded-lg text-xs flex items-center justify-between transition touch-manipulation ${
                            playbackSpeed === spd
                              ? 'bg-primaryMovies text-white font-bold'
                              : 'text-white/80 hover:bg-white/10'
                          }`}
                        >
                          <span>{spd}x</span>
                          {playbackSpeed === spd && <Check size={14} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cast / Handoff to Device */}
                {canCast() && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeRemoteSession) {
                        openFullRemote();
                      } else {
                        openCastModal({
                          type,
                          id,
                          title: mediaInfo?.title || (type === 'movie' ? (isRtl ? 'فيلم' : 'Movie') : (isRtl ? 'حلقة' : 'Episode')),
                          poster: mediaInfo?.poster || mediaInfo?.backdrop || null,
                          currentTime,
                          duration,
                          isPlaying
                        });
                      }
                    }}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition touch-manipulation ${
                      activeRemoteSession
                        ? 'bg-primaryMovies text-white ring-2 ring-rose-400/50 shadow-lg'
                        : 'hover:bg-white/10 text-white/80 hover:text-primaryMovies'
                    }`}
                    title={activeRemoteSession ? (isRtl ? 'فتح مركز التحكم الكامل' : 'Open Full Remote Control') : (isRtl ? 'نقل المشاهدة لشاشة أو جهاز آخر' : 'Cast / Handoff to Device')}
                  >
                    <Cast size={17} />
                  </button>
                )}

                {/* Picture-in-Picture */}
                {document.pictureInPictureEnabled && (
                  <button
                    onClick={togglePiP}
                    className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-white/10 items-center justify-center transition text-white/80 hover:text-white touch-manipulation"
                    title={isRtl ? 'صورة داخل صورة' : 'Picture in Picture'}
                  >
                    <PictureInPicture2 size={17} />
                  </button>
                )}

                {/* Fullscreen Toggle */}
                <button
                  onClick={toggleFullscreen}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition text-white/80 hover:text-white touch-manipulation"
                  title={isFullscreen ? (isRtl ? 'خروج من ملء الشاشة (F)' : 'Exit Fullscreen (F)') : (isRtl ? 'ملء الشاشة (F)' : 'Fullscreen (F)')}
                >
                  {isFullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Video Playlist / Queue Drawer (Full screen height overlay) */}
      {showPlaylistDrawer && (
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
          {/* Backdrop - clicking closes drawer on all screens */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              setShowPlaylistDrawer(false);
            }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity animate-fadeIn"
          />

          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-0 bottom-0 ${isRtl ? 'left-0 border-r' : 'right-0 border-l'} w-80 sm:w-96 max-w-[92vw] h-full bg-slate-950/95 backdrop-blur-2xl border-white/15 z-10 flex flex-col shadow-2xl pointer-events-auto transition-transform animate-fadeIn`}
          >
              {/* Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primaryMovies/20 border border-primaryMovies/40 flex items-center justify-center text-primaryMovies shadow-inner">
                    <ListVideo size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {isRtl ? 'قائمة التشغيل المتتالية' : 'Playback Playlist'}
                    </h3>
                    <p className="text-[11px] text-white/60 mt-0.5">
                      {videoQueue.length} {isRtl ? 'عنصر في القائمة' : 'items in queue'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPlaylistDrawer(false)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition"
                  title={isRtl ? 'إغلاق' : 'Close'}
                >
                  ✕
                </button>
              </div>

              {/* Quick Actions Toolbar */}
              <div className="px-4 py-2.5 bg-white/[0.03] border-b border-white/10 flex items-center justify-between gap-2 text-xs flex-shrink-0">
                <button
                  onClick={() => shuffleVideoQueue()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition active:scale-95"
                  title={isRtl ? 'خلط ترتيب القائمة عشوائياً' : 'Shuffle playlist'}
                >
                  <Shuffle size={13} />
                  <span>{isRtl ? 'خلط' : 'Shuffle'}</span>
                </button>

                <button
                  onClick={() => {
                    if (window.confirm(isRtl ? 'هل تريد مسح قائمة التشغيل بالكامل؟' : 'Clear entire playlist queue?')) {
                      clearVideoQueue();
                      setShowPlaylistDrawer(false);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition active:scale-95"
                  title={isRtl ? 'مسح القائمة' : 'Clear queue'}
                >
                  <Trash2 size={13} />
                  <span>{isRtl ? 'مسح القائمة' : 'Clear'}</span>
                </button>
              </div>

              {/* Queue Item List */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {videoQueue.map((item, idx) => {
                  const targetType = getItemType(item, type);
                  const isCurrent = idx === videoQueueIndex || (String(item.id) === String(id) && targetType === type);
                  const poster = item.poster || item.backdrop || item.thumb;

                  return (
                    <div
                      key={`${item.id}-${idx}`}
                      onClick={() => {
                        setVideoQueueIndex(idx);
                        navigate(`/watch/${targetType}/${item.id}`, { replace: true });
                      }}
                      className={`group flex items-center gap-3 p-2.5 rounded-xl transition cursor-pointer border ${
                        isCurrent
                          ? 'bg-primaryMovies/20 border-primaryMovies/60 shadow-lg shadow-primaryMovies/15'
                          : 'bg-white/5 hover:bg-white/10 border-transparent hover:border-white/15'
                      }`}
                    >
                      {/* Index / Status Icon */}
                      <div className="w-5 text-center flex-shrink-0 text-xs font-mono font-bold text-white/50">
                        {isCurrent ? (
                          <div className="w-2.5 h-2.5 rounded-full bg-primaryMovies animate-pulse mx-auto shadow-[0_0_8px_rgba(229,9,20,0.9)]" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      {/* Thumbnail */}
                      <div className="w-12 h-16 rounded-lg bg-surfaceHover overflow-hidden flex-shrink-0 relative shadow-sm">
                        {poster ? (
                          <img src={poster} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-white/40 p-1 text-center">
                            {item.title}
                          </div>
                        )}
                        {isCurrent && (
                          <div className="absolute inset-0 bg-primaryMovies/30 flex items-center justify-center">
                            <Play size={14} className="fill-white text-white animate-pulse" />
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-bold truncate ${isCurrent ? 'text-primaryMovies' : 'text-white'}`}>
                          {item.title}
                        </div>
                        <div className="text-[10px] text-white/60 truncate mt-1 flex items-center gap-2">
                          <span>{targetType === 'movie' ? (isRtl ? 'فيلم' : 'Movie') : (isRtl ? 'حلقة' : 'Episode')}</span>
                          {item.year && <span>• {item.year}</span>}
                          {item.duration && <span>• {formatTime(item.duration)}</span>}
                        </div>
                      </div>

                      {/* Delete button from queue */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeVideoFromQueue(idx);
                        }}
                        className="p-1.5 rounded-lg opacity-60 sm:opacity-0 group-hover:opacity-100 hover:bg-white/20 text-white/70 hover:text-red-400 transition"
                        title={isRtl ? 'إزالة من القائمة' : 'Remove from queue'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
