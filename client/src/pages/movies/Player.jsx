import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
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
  Shuffle,
  Sun,
  Contrast,
  Droplets,
  Sparkles,
  Clock,
  X,
  Subtitles,
  FastForward,
  Search,
  Download,
  Type,
  Sliders,
  Palette,
  Users,
  Moon,
  Headphones,
  Radio
} from 'lucide-react';
import client, { savePlayback, saveVolumeSettings, fetchVolumeSettings } from '../../api/client';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import { useAuthStore } from '../../store/useAuthStore';
import WatchPartyModal from '../../components/player/WatchPartyModal';
import WatchPartyOverlay from '../../components/player/WatchPartyOverlay';

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

// ── Up Next autoplay: card appears UP_NEXT_WINDOW seconds before the end,
//    the final UP_NEXT_COUNTDOWN seconds are highlighted as a live countdown.
const UP_NEXT_WINDOW = 30;
const UP_NEXT_COUNTDOWN = 5;

// ── Chapter-aware Intro / Outro detection ──
const INTRO_TITLE_RE = /\b(intro|opening|open(ing)? title|theme(song)?|title sequence|begin(ning)?)\b|مقدمة|تتر البداية/i;
const OUTRO_TITLE_RE = /\b(credit|credits|ending|outro|end(ing)? title|closing( title)?)\b|تتر النهاية|النهاية|اعتمادات/i;

function detectSkipMarker(pos, total, chapters, allowHeuristic) {
  if (!total || pos <= 0 || pos >= total - 1) return null;

  if (Array.isArray(chapters) && chapters.length > 0) {
    const first = chapters[0];
    const last = chapters[chapters.length - 1];

    for (const ch of chapters) {
      const start = Number(ch.start) || 0;
      const end = Number(ch.end) || start;
      if (pos < start || pos > end) continue;

      if (INTRO_TITLE_RE.test(ch.title || '')) {
        return { type: 'intro', target: Math.min(end, total), chapter: ch };
      }
      if (OUTRO_TITLE_RE.test(ch.title || '') && end - start >= 15 && start < total - 10) {
        return { type: 'outro', target: Math.max(0, total - 1), chapter: ch };
      }
    }

    // Unnamed chapters: use position heuristics
    const firstLen = (Number(first.end) || 0) - (Number(first.start) || 0);
    if (chapters.length >= 1 && firstLen >= 15 && firstLen <= 180 && pos >= (Number(first.start) || 0) && pos <= (Number(first.end) || 0)) {
      return { type: 'intro', target: Math.min(Number(first.end), total), chapter: first };
    }
    if (chapters.length > 1) {
      const lastStart = Number(last.start) || 0;
      const lastLen = (Number(last.end) || 0) - lastStart;
      if (lastLen >= 20 && lastStart >= total - 180 && lastStart > (Number(first.end) || 0) && pos >= lastStart) {
        return { type: 'outro', target: Math.max(0, total - 1), chapter: last };
      }
    }
    return null;
  }

  // Heuristic fallback when the file carries no chapter data
  if (allowHeuristic && pos >= 10 && pos <= 95 && total > 180) {
    return { type: 'intro', target: 95, chapter: null };
  }
  return null;
}

// ── Subtitle style settings & WebVTT Parser Architecture ──
const DEFAULT_SUBTITLE_SETTINGS = {
  fontFamily: 'Cairo',
  fontSize: '20px',
  color: '#FFFFFF',
  bgColor: '#000000',
  bgOpacity: 0.75,
  textShadow: 'drop',
  position: 'bottom',
  verticalOffset: 8
};

function loadSubtitleSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('arn_player_subtitle_settings') || 'null');
    if (!saved || typeof saved !== 'object') return { ...DEFAULT_SUBTITLE_SETTINGS };
    const next = { ...DEFAULT_SUBTITLE_SETTINGS, ...saved };
    if (typeof next.bgColor === 'string' && next.bgColor.includes('rgba')) {
      const m = next.bgColor.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)/);
      if (m) {
        const hx = n => Number(n).toString(16).padStart(2, '0');
        next.bgColor = `#${hx(m[1])}${hx(m[2])}${hx(m[3])}`;
        if (m[4] !== undefined) next.bgOpacity = Number(m[4]);
      } else {
        next.bgColor = DEFAULT_SUBTITLE_SETTINGS.bgColor;
      }
    }
    next.bgOpacity = Math.max(0, Math.min(1, Number(next.bgOpacity)));
    if (isNaN(next.bgOpacity)) next.bgOpacity = DEFAULT_SUBTITLE_SETTINGS.bgOpacity;
    if (!/^#[0-9a-fA-F]{6}$/.test(next.bgColor)) next.bgColor = DEFAULT_SUBTITLE_SETTINGS.bgColor;
    if (!['none', 'drop', 'outline'].includes(next.textShadow)) next.textShadow = DEFAULT_SUBTITLE_SETTINGS.textShadow;
    if (!['bottom', 'middle', 'top'].includes(next.position)) next.position = DEFAULT_SUBTITLE_SETTINGS.position;
    if (!next.fontFamily) next.fontFamily = DEFAULT_SUBTITLE_SETTINGS.fontFamily;
    if (typeof next.verticalOffset !== 'number' || isNaN(next.verticalOffset)) next.verticalOffset = DEFAULT_SUBTITLE_SETTINGS.verticalOffset;
    next.verticalOffset = Math.max(2, Math.min(40, next.verticalOffset));
    return next;
  } catch {
    return { ...DEFAULT_SUBTITLE_SETTINGS };
  }
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '').replace('#', '');
  if (clean.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildCueTextShadow(mode) {
  if (mode === 'none') return 'none';
  if (mode === 'outline') {
    return '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 2px 4px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.9)';
  }
  return '0 2px 4px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.9)';
}

function parseVttTime(timeStr) {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');
  let h = 0, m = 0, s = 0;
  if (parts.length === 3) {
    h = parseFloat(parts[0]) || 0;
    m = parseFloat(parts[1]) || 0;
    s = parseFloat(parts[2]) || 0;
  } else if (parts.length === 2) {
    m = parseFloat(parts[0]) || 0;
    s = parseFloat(parts[1]) || 0;
  }
  return h * 3600 + m * 60 + s;
}

function parseWebVtt(vttContent) {
  if (!vttContent || typeof vttContent !== 'string') return [];
  const cleanContent = vttContent.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = cleanContent.split('\n');
  const cues = [];
  let start = null;
  let end = null;
  let textLines = [];
  const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[\.,]\d{2,3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[\.,]\d{2,3})/;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    const match = line.match(timeRegex);
    if (match) {
      if (start !== null && end !== null && textLines.length > 0) {
        cues.push({ start, end, text: textLines.join('\n') });
        textLines = [];
      }
      start = parseVttTime(match[1]);
      end = parseVttTime(match[2]);
      continue;
    }

    if (!line) {
      if (start !== null && end !== null && textLines.length > 0) {
        cues.push({ start, end, text: textLines.join('\n') });
        start = null;
        end = null;
        textLines = [];
      }
      continue;
    }

    if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) {
      continue;
    }

    if (start !== null && end !== null) {
      textLines.push(rawLine);
    }
  }

  if (start !== null && end !== null && textLines.length > 0) {
    cues.push({ start, end, text: textLines.join('\n') });
  }

  cues.sort((a, b) => a.start - b.start);
  return cues;
}

function getActiveCuesText(cues, targetTime) {
  if (!cues || cues.length === 0) return '';
  let low = 0;
  let high = cues.length - 1;
  let startIndex = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].end >= targetTime) {
      startIndex = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  if (startIndex === -1) return '';

  const matches = [];
  for (let i = startIndex; i < cues.length; i++) {
    const c = cues[i];
    if (c.start > targetTime) break;
    if (targetTime >= c.start && targetTime <= c.end) {
      matches.push(c.text);
    }
  }
  return matches.join('\n');
}

function formatSubtitleCueHtml(rawText) {
  if (!rawText) return '';
  let s = String(rawText)
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\{[^}]+\}/g, '')
    .replace(/<v[^>]*>/g, '')
    .replace(/<\/v>/g, '')
    .replace(/<\d{2}:\d{2}[^>]*>/g, '')
    .replace(/<c\.([^>]+)>/g, '<span class="$1">')
    .replace(/<\/c>/g, '</span>')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\n/g, '<br />');
  return s;
}

function getSubtitlePositionStyle(settings) {
  const pos = settings?.position || 'bottom';
  const offset = typeof settings?.verticalOffset === 'number' ? settings.verticalOffset : 8;

  if (pos === 'top') {
    return {
      top: `${offset}%`,
      bottom: 'auto',
      transform: 'none'
    };
  }
  if (pos === 'middle') {
    return {
      top: '50%',
      bottom: 'auto',
      transform: 'translateY(-50%)'
    };
  }
  return {
    bottom: `${offset}%`,
    top: 'auto',
    transform: 'none'
  };
}

export default function Player() {
  const { type, id } = useParams(); // type: movie | episode
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
      return saved
        ? { brightness: 100, contrast: 100, saturation: 100, sharpness: 0, ...JSON.parse(saved) }
        : { brightness: 100, contrast: 100, saturation: 100, sharpness: 0 };
    } catch {
      return { brightness: 100, contrast: 100, saturation: 100, sharpness: 0 };
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
    const defaultSettings = { brightness: 100, contrast: 100, saturation: 100, sharpness: 0 };
    setVisualSettings(defaultSettings);
    try { localStorage.setItem('player_visual_settings', JSON.stringify(defaultSettings)); } catch {}
    setShowVisualMenu(false);
  }, []);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [hoverThumbUrl, setHoverThumbUrl] = useState(null);
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
  const [countdown, setCountdown] = useState(null); // seconds remaining, null until inside UP_NEXT_COUNTDOWN
  const upNextCancelledRef = useRef(false);

  // ── Ambient Glow Mode (Cinematic Dynamic Canvas) ──
  const ambientCanvasRef = useRef(null);
  const [ambientMode, setAmbientMode] = useState(() => {
    try {
      const saved = localStorage.getItem('arn_player_ambient_mode');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });
  const toggleAmbientMode = useCallback(() => {
    setAmbientMode(prev => {
      const next = !prev;
      try { localStorage.setItem('arn_player_ambient_mode', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  // ── Web Audio API (Dialogue Boost & Night Mode) ──
  const audioCtxRef = useRef(null);
  const dialogueFilterRef = useRef(null);
  const compressorRef = useRef(null);
  const masterGainRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const [audioEnhanceMode, setAudioEnhanceMode] = useState(() => {
    try {
      return localStorage.getItem('arn_player_audio_enhance') || 'off';
    } catch {
      return 'off';
    }
  });
  const [showAudioEnhanceMenu, setShowAudioEnhanceMenu] = useState(false);

  const initAudioContext = useCallback(() => {
    if (!videoRef.current) return;
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const source = ctx.createMediaElementSource(videoRef.current);

      // Peaking EQ filter centered around 1.5kHz for human voice clarity
      const filter = ctx.createBiquadFilter();
      filter.type = 'peaking';
      filter.frequency.setValueAtTime(1500, ctx.currentTime);
      filter.Q.setValueAtTime(1.0, ctx.currentTime);
      filter.gain.setValueAtTime(0, ctx.currentTime);

      // Dynamics Compressor for night-time level balancing
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.setValueAtTime(-24, ctx.currentTime);
      comp.knee.setValueAtTime(30, ctx.currentTime);
      comp.ratio.setValueAtTime(12, ctx.currentTime);
      comp.attack.setValueAtTime(0.003, ctx.currentTime);
      comp.release.setValueAtTime(0.25, ctx.currentTime);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1.0, ctx.currentTime);

      source.connect(filter);
      filter.connect(comp);
      comp.connect(masterGain);
      masterGain.connect(ctx.destination);

      audioCtxRef.current = ctx;
      dialogueFilterRef.current = filter;
      compressorRef.current = comp;
      masterGainRef.current = masterGain;
      sourceNodeRef.current = source;

      const savedMode = localStorage.getItem('arn_player_audio_enhance') || 'off';
      if (savedMode === 'dialogue') {
        filter.gain.setValueAtTime(6.0, ctx.currentTime);
      } else if (savedMode === 'night') {
        filter.gain.setValueAtTime(3.5, ctx.currentTime);
        comp.threshold.setValueAtTime(-30, ctx.currentTime);
      }
    } catch (err) {
      console.warn('[Web Audio Init Warning]:', err?.message);
    }
  }, []);

  // ── Smart Sleep Timer ──
  const [sleepTimer, setSleepTimer] = useState(null);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(0);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const sleepTimerIntervalRef = useRef(null);

  // ── ARN SyncPlay (Watch Party) ──
  const initialRoomId = searchParams.get('roomId') ? searchParams.get('roomId').toUpperCase() : null;
  const [syncRoomId, setSyncRoomId] = useState(initialRoomId);
  const [syncIsHost, setSyncIsHost] = useState(false);
  const [syncMembers, setSyncMembers] = useState([]);
  const [syncMessages, setSyncMessages] = useState([]);
  const [floatingEmojis, setFloatingEmojis] = useState([]);
  const [showWatchPartyModal, setShowWatchPartyModal] = useState(false);
  const syncWsRef = useRef(null);
  const myConnectionIdRef = useRef(null);
  const tabSessionIdRef = useRef('tab_' + Math.random().toString(36).substring(2, 9));
  const isApplyingRemoteSyncRef = useRef(false);
  const authUser = useAuthStore(s => s.user);
  const [showPlaylistDrawer, setShowPlaylistDrawer] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [subtitleTab, setSubtitleTab] = useState('tracks'); // 'tracks' | 'style' | 'search'
  const [subtitleOffset, setSubtitleOffset] = useState(() => {
    try {
      return Number(localStorage.getItem('arn_player_subtitle_offset')) || 0;
    } catch { return 0; }
  });
  const subtitleOffsetRef = useRef(subtitleOffset);
  useEffect(() => { subtitleOffsetRef.current = subtitleOffset; }, [subtitleOffset]);

  const [subtitleSettings, setSubtitleSettings] = useState(loadSubtitleSettings);

  const updateSubtitleSetting = useCallback((key, value) => {
    setSubtitleSettings(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem('arn_player_subtitle_settings', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const [parsedCues, setParsedCues] = useState([]);
  const parsedCuesRef = useRef([]);
  useEffect(() => { parsedCuesRef.current = parsedCues; }, [parsedCues]);

  const [activeCueText, setActiveCueText] = useState('');
  const activeCueTextRef = useRef('');
  useEffect(() => { activeCueTextRef.current = activeCueText; }, [activeCueText]);

  const [onlineSubtitles, setOnlineSubtitles] = useState([]);
  const [searchingOnlineSubs, setSearchingOnlineSubs] = useState(false);
  const [downloadingSubId, setDownloadingSubId] = useState(null);

  // Derive the active subtitle WebVTT URL cleanly (handling embedded, local files, and downloaded tracks)
  const getSubtitleUrl = useCallback((sub, offset = subtitleOffset) => {
    if (!sub) return null;
    const token = getAuthToken();
    const tokenParam = token ? `&token=${encodeURIComponent(token)}` : '';
    const offsetParam = offset ? `&offset=${offset}` : '';

    if (sub.isEmbedded || sub.streamIndex !== undefined || (sub.index !== undefined && !sub.path)) {
      const sIndex = sub.streamIndex ?? sub.index ?? 0;
      return `/api/subtitles/serve?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}&streamIndex=${sIndex}${offsetParam}${tokenParam}`;
    }

    if (sub.path) {
      return `/api/subtitles/serve?path=${encodeURIComponent(sub.path)}${offsetParam}${tokenParam}`;
    }

    if (sub.url) {
      return sub.url;
    }

    return null;
  }, [type, id, subtitleOffset]);

  const currentSubtitleUrl = useMemo(() => {
    return getSubtitleUrl(selectedSubtitle, subtitleOffset);
  }, [getSubtitleUrl, selectedSubtitle, subtitleOffset]);

  // Fetch and parse WebVTT file whenever subtitle selection or URL changes
  useEffect(() => {
    if (!currentSubtitleUrl || !selectedSubtitle) {
      setParsedCues([]);
      setActiveCueText('');
      return;
    }

    let active = true;
    authFetch(currentSubtitleUrl)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(vttText => {
        if (!active) return;
        const cues = parseWebVtt(vttText);
        setParsedCues(cues);
      })
      .catch(err => {
        console.warn('[Subtitles] Failed to fetch or parse VTT subtitles:', err);
        setParsedCues([]);
      });

    return () => {
      active = false;
    };
  }, [currentSubtitleUrl, selectedSubtitle]);

  // Frame-accurate subtitle synchronizer during active playback (RAF loop)
  useEffect(() => {
    if (!selectedSubtitle || !isPlaying) return;
    let rafId;
    const tick = () => {
      const v = videoRef.current;
      if (v && !v.paused) {
        const strategy = streamStrategyRef.current;
        const isTranscoding = strategy?.mode === 'transcode' || strategy?.mode === 'remux';
        const effectivePos = isTranscoding && seekOffsetRef.current > 0
          ? seekOffsetRef.current + v.currentTime
          : v.currentTime;
        const adjustedTime = effectivePos + (subtitleOffsetRef.current || 0);
        const text = getActiveCuesText(parsedCuesRef.current, adjustedTime);
        if (text !== activeCueTextRef.current) {
          activeCueTextRef.current = text;
          setActiveCueText(text);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [selectedSubtitle, isPlaying, subtitleOffset]);

  // Synchronize and force HTML5 video textTracks to showing whenever subtitle changes
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const syncTracks = () => {
      if (!vid.textTracks) return;
      for (let i = 0; i < vid.textTracks.length; i++) {
        const t = vid.textTracks[i];
        if (selectedSubtitle && currentSubtitleUrl) {
          t.mode = 'hidden';
        } else {
          t.mode = 'disabled';
        }
      }
    };

    syncTracks();
    const t1 = setTimeout(syncTracks, 150);
    const t2 = setTimeout(syncTracks, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [selectedSubtitle, currentSubtitleUrl]);

  // Intro / Outro Skip detection state (chapter-aware, driven by refs inside timeupdate)
  const [skipMarker, setSkipMarker] = useState(null); // { type: 'intro' | 'outro', target, chapter }
  const skipMarkerRef = useRef(null);
  const skipMarkerKeyRef = useRef(null);
  const dismissedMarkerKeyRef = useRef(null);
  const chaptersRef = useRef([]);

  // Chapters are probed server-side (-show_chapters) and returned by /api/stream/info

  // Touch Gestures state
  const touchStartRef = useRef(null);
  const touchSeekRef = useRef(null); // pending seek target for horizontal swipes
  const [touchIndicator, setTouchIndicator] = useState(null); // { type: 'volume' | 'brightness' | 'seek', value: number, text: string }
  const touchIndicatorTimerRef = useRef(null);

  const videoQueue = usePlayerStore(s => s.videoQueue);
  const videoQueueIndex = usePlayerStore(s => s.videoQueueIndex);
  const setVideoQueueIndex = usePlayerStore(s => s.setVideoQueueIndex);
  const clearVideoQueue = usePlayerStore(s => s.clearVideoQueue);
  const getNextVideo = usePlayerStore(s => s.getNextVideo);
  const getPrevVideo = usePlayerStore(s => s.getPrevVideo);
  const stopMusicForVideo = usePlayerStore(s => s.stopMusicForVideo);
  const removeVideoFromQueue = usePlayerStore(s => s.removeVideoFromQueue);
  const shuffleVideoQueue = usePlayerStore(s => s.shuffleVideoQueue);

  const isCurrentInQueue = Boolean(
    videoQueue &&
    videoQueue.length > 0 &&
    videoQueueIndex >= 0 &&
    videoQueueIndex < videoQueue.length &&
    String(videoQueue[videoQueueIndex]?.id) === String(id) &&
    getItemType(videoQueue[videoQueueIndex]) === type
  );

  const isCurrentInQueueRef = useRef(isCurrentInQueue);
  useEffect(() => { isCurrentInQueueRef.current = isCurrentInQueue; }, [isCurrentInQueue]);

  const nextUpRef = useRef(nextUp);
  useEffect(() => { nextUpRef.current = nextUp; }, [nextUp]);

  const isTransitioningRef = useRef(false);
  useEffect(() => {
    isTransitioningRef.current = false;
  }, [id, type]);

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

  const applyVisualPreset = useCallback((preset) => {
    const next = {
      brightness: preset.brightness,
      contrast: preset.contrast,
      saturation: preset.saturation,
      sharpness: preset.sharpness,
    };
    setVisualSettings(next);
    try { localStorage.setItem('player_visual_settings', JSON.stringify(next)); } catch {}
    showFeedbackBadge(isRtl ? preset.labelAr : preset.labelEn, Sparkles);
  }, [isRtl, showFeedbackBadge]);

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
    if (isTransitioningRef.current) return;

    const nextVid = isCurrentInQueue ? getNextVideo() : null;
    if (nextVid) {
      isTransitioningRef.current = true;
      const targetType = getItemType(nextVid, type);
      navigate(`/watch/${targetType}/${nextVid.id}`, { replace: true });
    } else if (nextUp && nextUp.id) {
      isTransitioningRef.current = true;
      const targetType = getItemType(nextUp, type);
      navigate(`/watch/${targetType}/${nextUp.id}`, { replace: true });
    } else {
      returnToLibraryHomeRef.current?.();
    }
  }, [getNextVideo, navigate, nextUp, type, isCurrentInQueue]);

  const handleNextVideoRef = useRef(handleNextVideo);
  useEffect(() => { handleNextVideoRef.current = handleNextVideo; }, [handleNextVideo]);
  const autoPlayNextRef = useRef(autoPlayNext);
  useEffect(() => { autoPlayNextRef.current = autoPlayNext; }, [autoPlayNext]);

  const handlePrevVideo = useCallback(() => {
    if (isTransitioningRef.current) return;

    const prevVid = isCurrentInQueue ? getPrevVideo() : null;
    if (prevVid) {
      isTransitioningRef.current = true;
      const targetType = getItemType(prevVid, type);
      navigate(`/watch/${targetType}/${prevVid.id}`, { replace: true });
    }
  }, [getPrevVideo, navigate, type, isCurrentInQueue]);

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

  const setAudioMode = useCallback((mode) => {
    initAudioContext();
    setAudioEnhanceMode(mode);
    try { localStorage.setItem('arn_player_audio_enhance', mode); } catch {}

    const ctx = audioCtxRef.current;
    const filter = dialogueFilterRef.current;
    const comp = compressorRef.current;

    if (ctx && filter && comp) {
      if (mode === 'dialogue') {
        filter.gain.setTargetAtTime(6.0, ctx.currentTime, 0.05);
        comp.threshold.setTargetAtTime(-18, ctx.currentTime, 0.05);
        showFeedbackBadge(isRtl ? 'تم تفعيل تعزيز الحوار 🗣️' : 'Dialogue Boost Active 🗣️', Headphones);
      } else if (mode === 'night') {
        filter.gain.setTargetAtTime(3.5, ctx.currentTime, 0.05);
        comp.threshold.setTargetAtTime(-32, ctx.currentTime, 0.05);
        showFeedbackBadge(isRtl ? 'تم تفعيل الوضع الليلي 🌙' : 'Night Mode Active 🌙', Moon);
      } else {
        filter.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        comp.threshold.setTargetAtTime(-12, ctx.currentTime, 0.05);
        showFeedbackBadge(isRtl ? 'وضع الصوت الافتراضي' : 'Normal Audio Mode', Volume2);
      }
    }
    setShowAudioEnhanceMenu(false);
  }, [initAudioContext, isRtl, showFeedbackBadge]);

  const setSleepTimerOption = useCallback((option) => {
    if (sleepTimerIntervalRef.current) {
      clearInterval(sleepTimerIntervalRef.current);
      sleepTimerIntervalRef.current = null;
    }

    if (option === 'off' || !option) {
      setSleepTimer(null);
      setSleepTimeRemaining(0);
      showFeedbackBadge(isRtl ? 'تم إلغاء مؤقت النوم' : 'Sleep Timer Disabled', Clock);
      setShowSleepMenu(false);
      return;
    }

    if (option === 'end_of_episode') {
      const rem = durationRef.current > currentTimeRef.current ? (durationRef.current - currentTimeRef.current) : 1800;
      setSleepTimer({ mode: 'end_of_episode', targetTime: Date.now() + (rem * 1000) });
      setSleepTimeRemaining(Math.round(rem));
      showFeedbackBadge(isRtl ? 'إيقاف عند نهاية العمل 🎬' : 'Sleep at End of Video 🎬', Moon);
    } else {
      const minutes = parseInt(option, 10);
      const ms = minutes * 60 * 1000;
      setSleepTimer({ mode: option, targetTime: Date.now() + ms });
      setSleepTimeRemaining(minutes * 60);
      showFeedbackBadge(isRtl ? `مؤقت النوم: ${minutes} دقيقة 🌙` : `Sleep in ${minutes}m 🌙`, Moon);
    }
    setShowSleepMenu(false);
  }, [isRtl, showFeedbackBadge]);

  useEffect(() => {
    if (!sleepTimer) return;

    sleepTimerIntervalRef.current = setInterval(() => {
      const remainingSec = Math.max(0, Math.round((sleepTimer.targetTime - Date.now()) / 1000));
      setSleepTimeRemaining(remainingSec);

      if (remainingSec <= 20 && remainingSec > 0 && masterGainRef.current && audioCtxRef.current) {
        const targetGain = Math.max(0.05, remainingSec / 20);
        masterGainRef.current.gain.setTargetAtTime(targetGain, audioCtxRef.current.currentTime, 0.2);
      }

      if (remainingSec <= 0) {
        clearInterval(sleepTimerIntervalRef.current);
        setSleepTimer(null);
        if (videoRef.current) {
          videoRef.current.pause();
          setIsPlaying(false);
        }
        showFeedbackBadge(isRtl ? 'تم إيقاف التشغيل بواسطة مؤقت النوم 🌙' : 'Playback stopped by Sleep Timer 🌙', Moon);
      }
    }, 1000);

    return () => {
      if (sleepTimerIntervalRef.current) clearInterval(sleepTimerIntervalRef.current);
    };
  }, [sleepTimer, isRtl, showFeedbackBadge]);

  // ARN SyncPlay WebSocket Connection Effect
  useEffect(() => {
    if (!syncRoomId) {
      if (syncWsRef.current) {
        syncWsRef.current.close();
        syncWsRef.current = null;
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running in dev on 5173, point directly to backend port 8096, else use current host
    const wsHost = window.location.port === '5173'
      ? `${window.location.hostname}:8096`
      : window.location.host;

    const uId = authUser?.id || `anon-${Date.now()}`;
    const devId = deviceId || `dev-${Math.random().toString(36).substring(2, 8)}`;
    const connId = tabSessionIdRef.current;
    const uName = encodeURIComponent(authUser?.display_name || authUser?.username || 'ضيف ARN');
    const uAvatar = authUser?.avatar ? encodeURIComponent(authUser.avatar) : '';

    const wsUrl = `${protocol}//${wsHost}/ws/syncplay?roomId=${syncRoomId}&userId=${uId}&deviceId=${devId}&connectionId=${connId}&username=${uName}&avatar=${uAvatar}`;
    console.log('[SyncPlay] Connecting to:', wsUrl);
    const ws = new WebSocket(wsUrl);
    syncWsRef.current = ws;

    ws.onopen = () => {
      console.log('[SyncPlay] Connected to room:', syncRoomId);
      showFeedbackBadge(isRtl ? `متصل بالغرفة: ${syncRoomId}` : `Connected to: ${syncRoomId}`, Users);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'INIT_ROOM_STATE': {
            if (msg.connectionId) {
              myConnectionIdRef.current = msg.connectionId;
            }
            setSyncIsHost(Boolean(msg.isHost));
            setSyncMembers(msg.members || []);
            if (msg.recentMessages) setSyncMessages(msg.recentMessages);

            if (msg.playbackState && typeof msg.playbackState.currentTime === 'number') {
              isApplyingRemoteSyncRef.current = true;
              if (videoRef.current) {
                videoRef.current.currentTime = msg.playbackState.currentTime;
                if (msg.playbackState.isPlaying) {
                  videoRef.current.play().catch(() => {});
                  setIsPlaying(true);
                } else {
                  videoRef.current.pause();
                  setIsPlaying(false);
                }
              }
              setTimeout(() => { isApplyingRemoteSyncRef.current = false; }, 800);
            }
            break;
          }

          case 'MEMBER_JOINED': {
            setSyncMembers(msg.members || []);
            if (msg.user?.username) {
              showFeedbackBadge(isRtl ? `انضم ${msg.user.username} للمشاهدة 🎉` : `${msg.user.username} joined 🎉`, Users);
            }
            break;
          }

          case 'MEMBER_LEFT': {
            setSyncMembers(msg.members || []);
            break;
          }

          case 'HOST_CHANGED': {
            const isMe = (msg.newHostConnectionId && (msg.newHostConnectionId === myConnectionIdRef.current || msg.newHostConnectionId === connId))
              || (msg.newHostDeviceId === devId && !msg.newHostConnectionId);
            if (isMe) {
              setSyncIsHost(true);
              showFeedbackBadge(isRtl ? 'أصبحت أنت المضيف (Host) للغرفة 👑' : 'You are now Host 👑', Users);
            }
            break;
          }

          case 'SYNC_PLAY': {
            isApplyingRemoteSyncRef.current = true;
            if (videoRef.current) {
              if (typeof msg.currentTime === 'number' && Math.abs(videoRef.current.currentTime - msg.currentTime) > 1.2) {
                videoRef.current.currentTime = msg.currentTime;
              }
              videoRef.current.play().catch(() => {});
              setIsPlaying(true);
            }
            setTimeout(() => { isApplyingRemoteSyncRef.current = false; }, 600);
            break;
          }

          case 'SYNC_PAUSE': {
            isApplyingRemoteSyncRef.current = true;
            if (videoRef.current) {
              if (typeof msg.currentTime === 'number' && Math.abs(videoRef.current.currentTime - msg.currentTime) > 1.2) {
                videoRef.current.currentTime = msg.currentTime;
              }
              videoRef.current.pause();
              setIsPlaying(false);
            }
            setTimeout(() => { isApplyingRemoteSyncRef.current = false; }, 600);
            break;
          }

          case 'SYNC_SEEK': {
            isApplyingRemoteSyncRef.current = true;
            if (videoRef.current && typeof msg.currentTime === 'number') {
              videoRef.current.currentTime = msg.currentTime;
              if (msg.isPlaying) videoRef.current.play().catch(() => {});
              else videoRef.current.pause();
            }
            setTimeout(() => { isApplyingRemoteSyncRef.current = false; }, 600);
            break;
          }

          case 'SYNC_HEARTBEAT': {
            if (!syncIsHost && videoRef.current && typeof msg.currentTime === 'number') {
              const drift = Math.abs(videoRef.current.currentTime - msg.currentTime);
              if (drift > 2.0) {
                videoRef.current.currentTime = msg.currentTime;
              }
            }
            break;
          }

          case 'NEW_CHAT_MESSAGE': {
            if (msg.message) {
              setSyncMessages(prev => [...prev.slice(-49), msg.message]);
            }
            break;
          }

          case 'EMOJI_BURST': {
            const newEmoji = {
              id: 'emoji-' + Date.now() + '-' + Math.random(),
              emoji: msg.emoji,
              left: Math.floor(Math.random() * 40) + 50,
              duration: 2.2 + Math.random() * 0.8
            };
            setFloatingEmojis(prev => [...prev.slice(-12), newEmoji]);
            setTimeout(() => {
              setFloatingEmojis(prev => prev.filter(e => e.id !== newEmoji.id));
            }, 3000);
            break;
          }

          default:
            break;
        }
      } catch (e) {
        console.warn('[SyncPlay ws parse error]:', e);
      }
    };

    ws.onclose = () => {
      console.log('[SyncPlay] WebSocket closed');
    };

    return () => {
      ws.close();
    };
  }, [syncRoomId, authUser, deviceId, isRtl, showFeedbackBadge]);

  const sendSyncPlayEvent = useCallback((eventType, data = {}) => {
    if (!syncWsRef.current || syncWsRef.current.readyState !== WebSocket.OPEN) return;
    if (isApplyingRemoteSyncRef.current) return;

    syncWsRef.current.send(JSON.stringify({
      type: eventType,
      currentTime: videoRef.current ? videoRef.current.currentTime : currentTimeRef.current,
      isPlaying: videoRef.current ? !videoRef.current.paused : false,
      speed: playbackSpeed,
      ...data
    }));
  }, [playbackSpeed]);

  // Host Heartbeat
  useEffect(() => {
    if (!syncRoomId || !syncIsHost) return;
    const hbInterval = setInterval(() => {
      sendSyncPlayEvent('HEARTBEAT');
    }, 4000);
    return () => clearInterval(hbInterval);
  }, [syncRoomId, syncIsHost, sendSyncPlayEvent]);

  // Ambient Canvas animation loop
  useEffect(() => {
    if (!ambientMode) return;
    const canvas = ambientCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: false });
    let animId = null;
    let isRunning = true;

    const renderFrame = () => {
      if (!isRunning) return;
      if (video && !video.paused && !video.ended && video.readyState >= 2) {
        try {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } catch (e) {}
      }
      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(renderFrame);
      } else {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    if ('requestVideoFrameCallback' in video) {
      video.requestVideoFrameCallback(renderFrame);
    } else {
      animId = requestAnimationFrame(renderFrame);
    }

    return () => {
      isRunning = false;
      if (animId) cancelAnimationFrame(animId);
    };
  }, [ambientMode, isPlaying]);

  // Synchronous play/pause toggle preserving user activation
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    initAudioContext();
    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true);
        if (!isApplyingRemoteSyncRef.current && syncRoomId) {
          sendSyncPlayEvent('PLAY', { currentTime: video.currentTime });
        }
        showFeedbackBadge(isRtl ? 'تشغيل' : 'Play', 'play');
      }).catch((err) => {
        console.warn('Playback failed:', err);
      });
    } else {
      video.pause();
      setIsPlaying(false);
      if (!isApplyingRemoteSyncRef.current && syncRoomId) {
        sendSyncPlayEvent('PAUSE', { currentTime: video.currentTime });
      }
      saveCurrentPlaybackRef.current?.();
      showFeedbackBadge(isRtl ? 'إيقاف مؤقت' : 'Pause', 'pause');
    }
    resetHideTimer();
  }, [isRtl, showFeedbackBadge, resetHideTimer, initAudioContext, syncRoomId, sendSyncPlayEvent]);

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

    if (!isApplyingRemoteSyncRef.current && syncRoomId) {
      sendSyncPlayEvent('SEEK', { currentTime: target });
    }
  }, [duration, type, id, syncRoomId, sendSyncPlayEvent]);

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
    chaptersRef.current = [];

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
          if (Array.isArray(d.data.probe?.chapters)) {
            chaptersRef.current = d.data.probe.chapters;
          }
          if (d.data.subtitles && Array.isArray(d.data.subtitles)) {
            setAvailableSubtitles(d.data.subtitles.map((s, idx) => ({
              ...s,
              id: s.id || (s.isEmbedded ? `embedded_sub_${s.trackIndex ?? s.index ?? idx}` : `stream_sub_${idx}`),
              streamIndex: s.streamIndex ?? s.index,
              mediaType: type,
              mediaId: id
            })));
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
            const existingPaths = new Set(prev.map(p => p.path).filter(Boolean));
            const existingIds = new Set(prev.map(p => p.id).filter(Boolean));
            const newSubs = subRes.data
              .filter(s => (!s.path || !existingPaths.has(s.path)) && (!s.id || !existingIds.has(s.id)))
              .map((s, idx) => ({
                id: s.id || `local_sub_${idx}`,
                language: s.language || 'ar',
                title: s.filename || s.title,
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
  useEffect(() => {
    nextUpTriggered.current = false;
    upNextCancelledRef.current = false;
    setNextUp(null);
    setCountdown(null);
    chaptersRef.current = [];
    skipMarkerRef.current = null;
    skipMarkerKeyRef.current = null;
    dismissedMarkerKeyRef.current = null;
    setSkipMarker(null);
  }, [id, type]);

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
      const threshold = upNextTimeRef.current || UP_NEXT_WINDOW;

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
          upNextCancelledRef.current = false;
          setCountdown(null);
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
        upNextCancelledRef.current = false;
        setNextUp(null);
      }

      // Chapter-aware Intro / Outro skip detection
      const marker = detectSkipMarker(effectivePos, totalDur, chaptersRef.current, type === 'episode');
      const markerKey = marker ? `${marker.type}:${Math.round(marker.target)}` : null;

      if (markerKey !== skipMarkerKeyRef.current) {
        skipMarkerKeyRef.current = markerKey;
        dismissedMarkerKeyRef.current = null;
      }

      const isDismissed = !!markerKey && dismissedMarkerKeyRef.current === markerKey;
      const shouldShow = !!marker && !isDismissed;
      const currentMarker = skipMarkerRef.current;

      if (shouldShow) {
        if (!currentMarker || currentMarker.type !== marker.type || Math.abs((currentMarker.target || 0) - marker.target) > 1) {
          skipMarkerRef.current = marker;
          setSkipMarker(marker);
        }
      } else if (currentMarker) {
        skipMarkerRef.current = null;
        setSkipMarker(null);
      }

      // Real-time subtitle cue update for video scrubbing and paused frame sync
      if (selectedSubtitleRef.current) {
        const adjustedTime = effectivePos + (subtitleOffsetRef.current || 0);
        const activeText = getActiveCuesText(parsedCuesRef.current, adjustedTime);
        if (activeText !== activeCueTextRef.current) {
          activeCueTextRef.current = activeText;
          setActiveCueText(activeText);
        }
      } else if (activeCueTextRef.current) {
        activeCueTextRef.current = '';
        setActiveCueText('');
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      saveCurrentPlaybackRef.current?.();
    };
    const onEnded = async () => {
      if (isTransitioningRef.current) return;

      // The user dismissed the "Up Next" card: never continue to the next episode
      if (upNextCancelledRef.current) {
        upNextCancelledRef.current = false;
        returnToLibraryHomeRef.current?.();
        return;
      }

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
      const nextVid = isCurrentInQueueRef.current ? getNextVideo() : null;
      if (nextVid) {
        if (autoPlayNextRef.current) {
          handleNextVideoRef.current?.();
        }
        return;
      }

      // Check if nextUp episode/video was pre-fetched
      const curNextUp = nextUpRef.current;
      if (curNextUp && curNextUp.id) {
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
            if (autoPlayNextRef.current && !isTransitioningRef.current) {
              isTransitioningRef.current = true;
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

  const saveCurrentPlayback = useCallback((overridePos = null) => {
    const v = videoRef.current;
    const totalDur = durationRef.current || duration || (v ? v.duration : 0);
    if (!totalDur || isNaN(totalDur) || totalDur <= 0) return;

    let effectivePos;
    if (typeof overridePos === 'number') {
      effectivePos = Math.round(overridePos);
    } else if (v) {
      const strategy = streamStrategyRef.current;
      const isTranscoding = strategy?.mode === 'transcode' || strategy?.mode === 'remux';
      effectivePos = isTranscoding && seekOffsetRef.current > 0
        ? Math.round(seekOffsetRef.current + v.currentTime)
        : Math.round(v.currentTime);
    } else {
      effectivePos = Math.round(currentTimeRef.current || 0);
    }

    if (effectivePos < 0) effectivePos = 0;

    savePlayback({
      media_type: type,
      media_id: Number(id),
      position: effectivePos,
      duration: Math.round(totalDur)
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ['landing'] });
      queryClient.invalidateQueries({ queryKey: ['movies-home'] });
      queryClient.invalidateQueries({ queryKey: ['continue'] });
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
  }, [type, id, duration, queryClient]);

  const saveCurrentPlaybackRef = useRef(saveCurrentPlayback);
  useEffect(() => {
    saveCurrentPlaybackRef.current = saveCurrentPlayback;
  }, [saveCurrentPlayback]);

  // Save playback progress every 5 seconds, and on unmount
  useEffect(() => {
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused) {
        saveCurrentPlaybackRef.current?.();
      }
    }, 5000);
    return () => {
      clearInterval(interval);
      saveCurrentPlaybackRef.current?.();
    };
  }, []);

  // Save playback on window close / page hide (beacon fallback)
  useEffect(() => {
    const onLeave = () => {
      const v = videoRef.current;
      const totalDur = durationRef.current || duration || (v ? v.duration : 0);
      if (totalDur > 0 && v) {
        const strategy = streamStrategyRef.current;
        const isTranscoding = strategy?.mode === 'transcode' || strategy?.mode === 'remux';
        const effectivePos = isTranscoding && seekOffsetRef.current > 0
          ? Math.round(seekOffsetRef.current + v.currentTime)
          : Math.round(v.currentTime);
        const token = getAuthToken();
        const payload = JSON.stringify({
          media_type: type,
          media_id: Number(id),
          position: effectivePos,
          duration: Math.round(totalDur)
        });
        if (navigator.sendBeacon) {
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(`/api/playback?token=${encodeURIComponent(token)}`, blob);
        }
      }
    };
    window.addEventListener('beforeunload', onLeave);
    window.addEventListener('pagehide', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      window.removeEventListener('pagehide', onLeave);
    };
  }, [type, id, duration]);

  // Up Next live countdown: the card shows the remaining time, and the final
  // UP_NEXT_COUNTDOWN seconds are highlighted before auto-playing the next item.
  useEffect(() => {
    if (!nextUp) {
      setCountdown(null);
      return;
    }

    let fired = false;
    const tick = () => {
      const total = durationRef.current || 0;
      if (total <= 0) return;
      const remaining = total - currentTimeRef.current;

      if (remaining <= 0.2) {
        if (fired) return;
        fired = true;
        setCountdown(0);
        setNextUp(null);
        if (autoPlayNextRef.current && !isTransitioningRef.current) {
          handleNextVideoRef.current?.();
        }
        return;
      }

      const value = Math.min(999, Math.ceil(remaining));
      setCountdown(prev => (prev === value ? prev : value));
    };

    tick();
    const iv = setInterval(tick, 250);
    return () => clearInterval(iv);
  }, [nextUp]);

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
    // Thumbnail preview: quantize to 10s buckets server-side so rapid moves reuse the same frame
    if (duration > 0) {
      setHoverThumbUrl(`/api/stream/thumb/${type}/${id}?t=${Math.floor(pos * duration)}`);
    }
  };

  const handleProgressMouseLeave = () => {
    setHoverTime(null);
    setHoverThumbUrl(null);
  };

  const handleVolumeChange = (newVol, persist = true) => {
    const v = Math.max(0, Math.min(1, newVol));
    setVolume(v);
    setIsMuted(v === 0);
    setGlobalVolume(v);
    setGlobalMuted(v === 0);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
    if (persist) {
      saveVolumeSettings({ volume: v, muted: v === 0 }).catch(() => {});
    }
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

  const toggleFullscreen = useCallback((e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (e && e.preventDefault) e.preventDefault();
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => {
        showFeedbackBadge(isRtl ? 'ملء الشاشة' : 'Fullscreen', Maximize);
      }).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => {
        showFeedbackBadge(isRtl ? 'إلغاء ملء الشاشة' : 'Exit Fullscreen', Minimize);
      }).catch(() => {});
    }
    resetHideTimer();
  }, [isRtl, showFeedbackBadge, resetHideTimer]);

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

  // Middle mouse click (clicking the mouse wheel) toggles fullscreen mode
  const handleContainerMouseDown = (e) => {
    if (e.button === 1) {
      if (e.target.closest('button, input, select, a, [role="button"]')) return;
      e.preventDefault();
      e.stopPropagation();
      toggleFullscreen(e);
    }
  };

  const handleContainerAuxClick = (e) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const sharpnessVal = Number(visualSettings.sharpness || 0);
  // Calculate 3x3 unsharp mask convolution kernel for crisp video sharpness enhancement
  const sharpnessK = Number(((sharpnessVal / 100) * 0.9).toFixed(2));
  const sharpenCenter = Number((1 + 4 * sharpnessK).toFixed(2));
  const sharpenNegK = -sharpnessK;
  const sharpenKernelMatrix = `0 ${sharpenNegK} 0 ${sharpenNegK} ${sharpenCenter} ${sharpenNegK} 0 ${sharpenNegK} 0`;
  const isVisualModified = (
    visualSettings.brightness !== 100 ||
    visualSettings.contrast !== 100 ||
    visualSettings.saturation !== 100 ||
    sharpnessVal !== 0
  );

  // Touch gesture handlers for mobile/tablet screens
  const handleTouchStart = (e) => {
    if (e.target.closest('button, input, select, a, [role="button"]')) return;
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const width = window.innerWidth;
    const isRightSide = t.clientX > width / 2;
    touchSeekRef.current = null;
    touchStartRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      isRightSide,
      startVolume: volume,
      startBrightness: visualSettings.brightness || 100,
      startTime: currentTimeRef.current,
      moved: false
    };
  };

  const handleTouchMove = (e) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - touchStartRef.current.startX;
    const dy = touchStartRef.current.startY - t.clientY; // upwards is positive

    if (Math.abs(dx) > 15 || Math.abs(dy) > 15) {
      touchStartRef.current.moved = true;
    }

    if (!touchStartRef.current.moved) return;

    // Vertical drag: Volume (Right side) or Brightness (Left side)
    if (Math.abs(dy) > Math.abs(dx)) {
      const deltaPercent = (dy / (window.innerHeight * 0.4)) * 100;
      if (touchStartRef.current.isRightSide) {
        // Adjust Volume (persisted once at gesture end to avoid spamming the API)
        const newVol = Math.min(1, Math.max(0, touchStartRef.current.startVolume + (dy / (window.innerHeight * 0.4))));
        handleVolumeChange(newVol, false);
        setTouchIndicator({
          type: 'volume',
          value: newVol * 100,
          text: isRtl ? 'مستوى الصوت' : 'Volume'
        });
      } else {
        // Adjust Brightness
        const newBri = Math.min(200, Math.max(50, Math.round(touchStartRef.current.startBrightness + deltaPercent)));
        updateVisualSetting('brightness', newBri);
        setTouchIndicator({
          type: 'brightness',
          value: newBri,
          text: isRtl ? 'إضاءة الشاشة' : 'Brightness'
        });
      }
    } else {
      // Horizontal drag: Fast seek preview
      const deltaSec = Math.round((dx / window.innerWidth) * 60);
      const targetSec = Math.min(durationRef.current || 1000, Math.max(0, touchStartRef.current.startTime + deltaSec));
      touchSeekRef.current = targetSec;
      setTouchIndicator({
        type: 'seek',
        text: `${deltaSec >= 0 ? '+' : ''}${deltaSec}s (${formatTime(targetSec)})`
      });
    }

    if (touchIndicatorTimerRef.current) clearTimeout(touchIndicatorTimerRef.current);
  };

  const handleTouchEnd = () => {
    const start = touchStartRef.current;
    if (start?.moved) {
      if (touchSeekRef.current !== null) {
        performSeek(touchSeekRef.current);
      } else if (start.isRightSide) {
        // Commit the volume once when the gesture finishes
        const v = videoRef.current ? videoRef.current.volume : volume;
        saveVolumeSettings({ volume: v, muted: v === 0 }).catch(() => {});
      }
    }
    touchStartRef.current = null;
    touchSeekRef.current = null;
    if (touchIndicatorTimerRef.current) clearTimeout(touchIndicatorTimerRef.current);
    touchIndicatorTimerRef.current = setTimeout(() => {
      setTouchIndicator(null);
    }, 800);
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-screen h-screen bg-black overflow-hidden select-none flex items-center justify-center ${
        !showControls && isPlaying ? 'cursor-none' : ''
      }`}
      style={{ overscrollBehavior: 'none' }}
      onMouseMove={resetHideTimer}
      onClick={handleContainerClick}
      onMouseDown={handleContainerMouseDown}
      onAuxClick={handleContainerAuxClick}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* SVG Convolution Filter for Video Sharpness (Edge-Preserving Detail Enhancement) */}
      <svg
        className="absolute w-0 h-0 pointer-events-none opacity-0 select-none"
        aria-hidden="true"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
      >
        <defs>
          <filter id="arn-video-sharpen" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
            <feConvolveMatrix
              order="3"
              preserveAlpha="true"
              edgeMode="duplicate"
              divisor="1"
              kernelMatrix={sharpenKernelMatrix}
            />
          </filter>
        </defs>
      </svg>

      {/* Dynamic Subtitle Style Injection */}
      <style>{`
        #arn-subtitle-text, #arn-subtitle-preview {
          font-family: '${subtitleSettings.fontFamily || 'Cairo'}', 'Alexandria', 'Tajawal', 'Inter', system-ui, sans-serif !important;
        }
        ::cue {
          display: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
          font-size: 0px !important;
          line-height: 0 !important;
          height: 0px !important;
          width: 0px !important;
          color: transparent !important;
          background: transparent !important;
        }
      `}</style>

      {/* Ambient Glow Mode Canvas — replicates cinematic projection behind the video */}
      {ambientMode && (
        <canvas
          ref={ambientCanvasRef}
          width={64}
          height={36}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-700"
          style={{
            filter: 'blur(55px) saturate(160%) brightness(1.15)',
            transform: 'scale(1.14)',
            opacity: isPlaying ? 0.85 : 0.35,
            zIndex: 0
          }}
        />
      )}

      {/* Video Element */}
      <video
        key={id}
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        crossOrigin="anonymous"
        onPlay={initAudioContext}
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
          filter: `${sharpnessVal > 0 ? 'url(#arn-video-sharpen) ' : ''}brightness(${visualSettings.brightness}%) contrast(${visualSettings.contrast}%) saturate(${visualSettings.saturation}%)`
        }}
      >
        {currentSubtitleUrl ? (
          <track
            key={`${selectedSubtitle?.id || selectedSubtitle?.path || selectedSubtitle?.streamIndex || selectedSubtitle?.index || 'sub'}_offset_${subtitleOffset}`}
            kind="subtitles"
            src={currentSubtitleUrl}
            srcLang={selectedSubtitle?.language || 'ar'}
            label={selectedSubtitle?.title || 'العربية'}
            default
            onLoad={(e) => {
              try {
                if (e?.target?.track) {
                  e.target.track.mode = 'hidden';
                }
              } catch (err) {
                console.warn('[Subtitles] Failed to set track mode:', err);
              }
            }}
          />
        ) : null}
      </video>



      {/* Custom Subtitle Overlay Layer (Netflix/Jellyfin Architecture) */}
      {activeCueText && selectedSubtitle && (
        <div
          id="arn-custom-subtitle-overlay"
          className="absolute left-0 right-0 z-20 pointer-events-none flex justify-center px-4 sm:px-8 transition-all duration-150 select-none"
          style={getSubtitlePositionStyle(subtitleSettings)}
        >
          <div
            id="arn-subtitle-text"
            dir="auto"
            className="inline-block text-center select-none max-w-[92%] sm:max-w-[85%] transition-all duration-150 leading-relaxed font-bold tracking-wide"
            style={{
              fontFamily: `'${subtitleSettings.fontFamily || 'Cairo'}', 'Alexandria', 'Tajawal', 'Inter', sans-serif`,
              fontSize: subtitleSettings.fontSize || '20px',
              color: subtitleSettings.color || '#FFFFFF',
              backgroundColor: hexToRgba(subtitleSettings.bgColor, subtitleSettings.bgOpacity),
              textShadow: buildCueTextShadow(subtitleSettings.textShadow),
              padding: subtitleSettings.bgOpacity > 0 ? '4px 14px' : '2px 6px',
              borderRadius: subtitleSettings.bgOpacity > 0 ? '8px' : '0px',
            }}
            dangerouslySetInnerHTML={{ __html: formatSubtitleCueHtml(activeCueText) }}
          />
        </div>
      )}

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

      {/* Up Next Overlay - Premium Card with Large Poster */}
      {nextUp && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-24 sm:bottom-28 md:bottom-32 ${isRtl ? 'left-3 sm:left-6 md:left-8' : 'right-3 sm:right-6 md:right-8'} w-[calc(100vw-24px)] sm:w-[480px] md:w-[520px] bg-[#070b14]/95 text-white border border-white/15 rounded-3xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl z-40 p-4 sm:p-5 flex flex-col pointer-events-auto transition-all duration-500 animate-slideInUp`}
        >
          {/* Header Row: Next Episode Notification & Countdown Badge */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide text-white/90">
                {isRtl ? 'الحلقة التالية' : 'Up Next'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Countdown Badge (live remaining time, urgent in the final seconds) */}
              {countdown !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold shadow-inner transition-all duration-300 ${
                  countdown <= UP_NEXT_COUNTDOWN
                    ? 'bg-red-600/30 border-red-500/60 text-red-300 animate-pulse'
                    : 'bg-red-600/20 border-red-500/40 text-red-400'
                }`}>
                  <Clock size={12} className={countdown <= UP_NEXT_COUNTDOWN ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
                  <span>{isRtl ? `خلال ${countdown} ث` : `in ${countdown}s`}</span>
                </div>
              )}

              {/* Dismiss button (cancels autoplay for this episode) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  upNextCancelledRef.current = true;
                  nextUpTriggered.current = true;
                  setNextUp(null);
                  setCountdown(null);
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition"
                title={isRtl ? 'إلغاء التشغيل التلقائي' : 'Cancel autoplay'}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Body Row: Large Poster + Episode Details */}
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Large Poster matching the player bottom bar style */}
            <div className="w-24 sm:w-28 md:w-32 aspect-[2/3] rounded-2xl overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.9)] bg-white/5 flex-shrink-0 border-2 border-white/20 ring-1 ring-black/60 relative group select-none">
              {(nextUp.poster || nextUp.series_poster || posterSrc) ? (
                <img
                  src={nextUp.poster || nextUp.series_poster || posterSrc}
                  alt={nextUp.title || "Next Episode"}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/30">
                  <Tv size={28} />
                </div>
              )}
              {nextUp.episode_number ? (
                <div className="absolute top-2 rtl:right-2 ltr:left-2 px-2 py-0.5 rounded-lg bg-black/85 backdrop-blur-md border border-white/20 text-[10px] font-extrabold text-white shadow-md">
                  {isRtl ? `حلقة ${nextUp.episode_number}` : `Ep ${nextUp.episode_number}`}
                </div>
              ) : null}
            </div>

            {/* Info and Action Column */}
            <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
              <div className="min-w-0">
                {/* Series Title */}
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 mb-1">
                  <Sparkles size={12} className="text-amber-400 flex-shrink-0" />
                  <span className="truncate">{nextUp.series_title || displayTitle}</span>
                </div>

                {/* Episode Number and Title */}
                <div className="text-sm sm:text-base font-black text-white line-clamp-2 leading-snug">
                  {nextUp.episode_number
                    ? (isRtl ? `الحلقة ${nextUp.episode_number}` : `Episode ${nextUp.episode_number}`)
                    : (nextUp.title || '')}
                  {nextUp.title && !['1','2','3','4','5','6','7','8','9','10'].includes(String(nextUp.title).trim()) && !String(nextUp.title).toLowerCase().startsWith('episode') && !String(nextUp.title).startsWith('الحلقة')
                    ? ` : ${nextUp.title}`
                    : ''}
                </div>

                {/* Subtext info */}
                <div className="text-[11px] text-slate-300/80 mt-1 line-clamp-1">
                  {isRtl ? 'سيبدأ التشغيل التلقائي فور انتهاء الوقت' : 'Will play automatically once the timer ends'}
                </div>
              </div>

              {/* Play Now Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextVideo();
                }}
                className="mt-3 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:brightness-110 active:scale-95 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-red-950/60 border border-rose-400/30 transition-all duration-200 touch-manipulation cursor-pointer group/btn"
              >
                <Play size={15} fill="white" className="transition-transform duration-200 group-hover/btn:scale-110" />
                <span>{isRtl ? 'تشغيل الآن' : 'Play Now'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Intro / Outro Floating Button (Netflix-Style, chapter-aware) */}
      {skipMarker && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-24 sm:bottom-28 ${isRtl ? 'left-4 sm:left-8' : 'right-4 sm:right-8'} z-40 animate-slideInUp`}
        >
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur">
            <button
              onClick={() => {
                const markerNow = skipMarker;
                if (!markerNow) return;
                performSeek(markerNow.target);
                dismissedMarkerKeyRef.current = skipMarkerKeyRef.current;
                skipMarkerRef.current = null;
                setSkipMarker(null);
                showFeedbackBadge(
                  markerNow.type === 'outro'
                    ? (isRtl ? 'تم تخطي التتر والنهاية' : 'Outro Skipped')
                    : (isRtl ? 'تم تخطي المقدمة' : 'Intro Skipped'),
                  FastForward
                );
              }}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/25 active:scale-95 text-white text-xs sm:text-sm font-bold flex items-center gap-2 transition duration-200 group touch-manipulation cursor-pointer"
            >
              <FastForward size={16} className="text-amber-400 group-hover:translate-x-0.5 transition-transform rtl:-scale-x-100" />
              <span>
                {skipMarker.type === 'outro'
                  ? (isRtl ? 'تخطي التتر' : 'Skip Outro')
                  : (isRtl ? 'تخطي المقدمة' : 'Skip Intro')}
              </span>
            </button>
            <button
              onClick={() => {
                dismissedMarkerKeyRef.current = skipMarkerKeyRef.current;
                skipMarkerRef.current = null;
                setSkipMarker(null);
              }}
              className="p-2 rounded-xl hover:bg-white/15 text-white/60 hover:text-white transition"
              title={isRtl ? 'إغلاق' : 'Dismiss'}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Touch Gesture OSD Overlay */}
      {touchIndicator && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-50 animate-fadeIn">
          <div className="px-5 py-3 rounded-2xl bg-black/90 backdrop-blur-xl text-white font-extrabold border border-white/20 shadow-2xl flex items-center gap-3">
            {touchIndicator.type === 'volume' && (
              touchIndicator.value === 0 ? <VolumeX size={24} className="text-red-400" /> : <Volume2 size={24} className="text-blue-400" />
            )}
            {touchIndicator.type === 'brightness' && <Sun size={24} className="text-amber-400" />}
            {touchIndicator.type === 'seek' && <FastForward size={24} className="text-rose-500" />}
            <div className="flex flex-col">
              <span className="text-xs text-white/70">{touchIndicator.text}</span>
              {touchIndicator.value !== undefined && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, touchIndicator.value))}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs">{Math.round(touchIndicator.value)}%</span>
                </div>
              )}
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

        {/* Top-Right Control Buttons (Watch Party, Sleep Timer, Remote Control) */}
        <div className="flex items-center gap-2">
          {/* Watch Party button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowWatchPartyModal(true);
            }}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-all shadow-md active:scale-95 ${
              syncRoomId
                ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white ring-2 ring-sky-400/40'
                : 'bg-white/10 hover:bg-white/20 text-white/90 hover:text-white border border-white/15'
            }`}
            title={isRtl ? 'المشاهدة الجماعية (Watch Party)' : 'Watch Party'}
          >
            <Users size={14} className={syncRoomId ? 'text-white' : 'text-sky-400'} />
            <span className="hidden sm:inline">
              {syncRoomId ? `${syncRoomId} (${syncMembers.length})` : (isRtl ? 'مشاهدة جماعية' : 'Watch Party')}
            </span>
          </button>

          {/* Smart Sleep Timer Button & Dropdown */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSleepMenu(prev => !prev);
              }}
              className={`px-2.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 backdrop-blur-md transition-all shadow-md active:scale-95 ${
                sleepTimer
                  ? 'bg-amber-500/25 border border-amber-400/50 text-amber-300 ring-2 ring-amber-400/20'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/15'
              }`}
              title={isRtl ? 'مؤقت النوم الذكي' : 'Smart Sleep Timer'}
            >
              <Moon size={14} className={sleepTimer ? 'text-amber-300' : 'text-white/80'} />
              {sleepTimer ? (
                <span className="font-mono text-[11px] font-bold">
                  {Math.floor(sleepTimeRemaining / 60)}:{String(sleepTimeRemaining % 60).padStart(2, '0')}
                </span>
              ) : (
                <span className="hidden md:inline">{isRtl ? 'مؤقت النوم' : 'Sleep'}</span>
              )}
            </button>

            {/* Sleep Timer Menu */}
            {showSleepMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute top-10 ${isRtl ? 'left-0' : 'right-0'} bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-1.5 shadow-2xl z-50 min-w-[155px] animate-fadeIn text-white`}
              >
                <div className="text-[11px] font-semibold text-white/70 px-2.5 py-1 border-b border-white/10 mb-1 flex items-center gap-1.5">
                  <Moon size={12} className="text-amber-400" />
                  <span>{isRtl ? 'مؤقت النوم الذكي' : 'Sleep Timer'}</span>
                </div>
                {[
                  { id: '15', labelAr: '⏱️ 15 دقيقة', labelEn: '15 minutes' },
                  { id: '30', labelAr: '⏱️ 30 دقيقة', labelEn: '30 minutes' },
                  { id: '45', labelAr: '⏱️ 45 دقيقة', labelEn: '45 minutes' },
                  { id: '60', labelAr: '⏱️ 60 دقيقة', labelEn: '60 minutes' },
                  { id: 'end_of_episode', labelAr: '🎬 عند نهاية العمل', labelEn: 'End of Video' },
                  { id: 'off', labelAr: '❌ إيقاف المؤقت', labelEn: 'Turn off timer' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setSleepTimerOption(opt.id)}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                      sleepTimer?.mode === opt.id
                        ? 'bg-amber-500/30 text-amber-300 font-bold'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <span>{isRtl ? opt.labelAr : opt.labelEn}</span>
                    {sleepTimer?.mode === opt.id && <Check size={13} className="text-amber-400" />}
                  </button>
                ))}
              </div>
            )}
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

              {/* Hover thumbnail + timestamp preview */}
              {hoverTime !== null && (
                <div
                  className="absolute -top-[86px] -translate-x-1/2 hidden sm:flex flex-col items-center gap-1 pointer-events-none z-20"
                  style={{ left: `${Math.min(92, Math.max(8, hoverPosition))}%` }}
                >
                  {hoverThumbUrl ? (
                    <div className="rounded-lg overflow-hidden border border-white/25 bg-black shadow-[0_8px_24px_rgba(0,0,0,0.7)] w-[144px] h-[81px] flex items-center justify-center">
                      <img
                        src={hoverThumbUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    </div>
                  ) : (
                    <div className="rounded-lg border border-white/15 bg-black/70 w-[144px] h-[81px] flex items-center justify-center">
                      <span className="text-[10px] text-white/40 font-mono">{formatTime(hoverTime)}</span>
                    </div>
                  )}
                  <div className="px-2.5 py-1 rounded-md bg-black/90 backdrop-blur-md text-[11px] font-mono font-medium text-white border border-white/20 shadow-xl whitespace-nowrap">
                    {formatTime(hoverTime)}
                  </div>
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
                    className={`relative px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold backdrop-blur transition-all flex items-center gap-1 sm:gap-1.5 touch-manipulation ${
                      showVisualMenu ? 'bg-primaryMovies text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isRtl ? 'إعدادات الصورة والحدة' : 'Visual & Sharpness Settings'}
                  >
                    <SlidersHorizontal size={13} className="sm:w-3.5 sm:h-3.5" />
                    <span className={isRtl ? 'hidden sm:inline' : 'hidden sm:inline'}>
                      {isRtl ? 'الصورة' : 'Visuals'}
                    </span>
                    {isVisualModified && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primaryMovies shadow-[0_0_8px_rgba(239,68,68,0.8)] ring-1 ring-white/50" />
                    )}
                  </button>

                  {/* Visual Settings Menu Popup */}
                  {showVisualMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-12 ${isRtl ? 'left-0 sm:left-0' : 'right-0 sm:right-0'} bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-3 shadow-2xl z-50 w-[270px] max-w-[calc(100vw-24px)] animate-fadeIn flex flex-col gap-3`}
                    >
                      <div className="flex justify-between items-center border-b border-white/20 pb-2">
                        <div className="text-[11px] font-semibold text-white/80 flex items-center gap-1.5">
                          <SlidersHorizontal size={12} className="text-primaryMovies" />
                          <span>{isRtl ? 'إعدادات الصورة والحدة' : 'Visual & Sharpness'}</span>
                        </div>
                        {isVisualModified && (
                          <button
                            onClick={resetVisualSettings}
                            className="text-[10px] text-white/50 hover:text-rose-400 transition flex items-center gap-1"
                            title={isRtl ? 'إعادة ضبط كافة الإعدادات' : 'Reset all settings'}
                          >
                            <RotateCcw size={10} />
                            <span>{isRtl ? 'إعادة ضبط' : 'Reset'}</span>
                          </button>
                        )}
                      </div>

                      {/* Quick Presets */}
                      <div className="grid grid-cols-4 gap-1 pb-1">
                        {[
                          { id: 'default', labelAr: 'افتراضي', labelEn: 'Default', brightness: 100, contrast: 100, saturation: 100, sharpness: 0 },
                          { id: 'vivid', labelAr: 'حيوي', labelEn: 'Vivid', brightness: 105, contrast: 110, saturation: 120, sharpness: 25 },
                          { id: 'cinema', labelAr: 'سينما', labelEn: 'Cinema', brightness: 95, contrast: 115, saturation: 105, sharpness: 15 },
                          { id: 'crisp', labelAr: 'فائق الحدة', labelEn: 'Crisp', brightness: 100, contrast: 105, saturation: 100, sharpness: 50 },
                        ].map(preset => {
                          const isPresetActive = (
                            visualSettings.brightness === preset.brightness &&
                            visualSettings.contrast === preset.contrast &&
                            visualSettings.saturation === preset.saturation &&
                            (visualSettings.sharpness || 0) === preset.sharpness
                          );
                          return (
                            <button
                              key={preset.id}
                              onClick={() => applyVisualPreset(preset)}
                              className={`py-1 px-1 rounded-md text-[9px] sm:text-[10px] font-medium transition text-center truncate ${
                                isPresetActive
                                  ? 'bg-primaryMovies text-white font-bold shadow-sm'
                                  : 'bg-white/5 hover:bg-white/15 text-white/70 hover:text-white'
                              }`}
                            >
                              {isRtl ? preset.labelAr : preset.labelEn}
                            </button>
                          );
                        })}
                      </div>
                      
                      {[
                        { id: 'brightness', label: isRtl ? 'الإضاءة' : 'Brightness', icon: Sun, min: 50, max: 200, step: 5, defaultVal: 100 },
                        { id: 'contrast', label: isRtl ? 'التباين' : 'Contrast', icon: Contrast, min: 50, max: 200, step: 5, defaultVal: 100 },
                        { id: 'saturation', label: isRtl ? 'التشبع' : 'Saturation', icon: Droplets, min: 50, max: 200, step: 5, defaultVal: 100 },
                        { id: 'sharpness', label: isRtl ? 'الحدة' : 'Sharpness', icon: Sparkles, min: 0, max: 100, step: 5, defaultVal: 0 }
                      ].map(ctrl => {
                        const Icon = ctrl.icon;
                        const currentVal = visualSettings[ctrl.id] ?? ctrl.defaultVal;
                        const isCtrlModified = currentVal !== ctrl.defaultVal;

                        return (
                          <div key={ctrl.id} className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[10px] text-white/80">
                              <span className="flex items-center gap-1.5">
                                <Icon size={11} className={isCtrlModified ? 'text-primaryMovies' : 'text-white/60'} />
                                <span>{ctrl.label}</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={`font-mono text-[10px] ${isCtrlModified ? 'text-primaryMovies font-bold' : 'text-white/70'}`}>
                                  {currentVal}%
                                </span>
                                {isCtrlModified && (
                                  <button
                                    onClick={() => updateVisualSetting(ctrl.id, ctrl.defaultVal)}
                                    className="text-white/40 hover:text-white transition"
                                    title={isRtl ? 'إرجاع للقيمة الأصلية' : 'Reset to default'}
                                  >
                                    <RotateCcw size={9} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <input
                              type="range"
                              min={ctrl.min}
                              max={ctrl.max}
                              step={ctrl.step}
                              value={currentVal}
                              onChange={(e) => updateVisualSetting(ctrl.id, Number(e.target.value))}
                              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primaryMovies"
                            />
                          </div>
                        );
                      })}

                      {/* Ambient Glow Mode Toggle */}
                      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[11px] font-semibold text-white/90">
                            {isRtl ? 'إضاءة التوهج السينمائي' : 'Ambient Glow'}
                          </span>
                          <span className="text-[9px] text-white/50">
                            {isRtl ? 'عكس ألوان المشهد كإضاءة محيطية' : 'Dynamic ambient lighting'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={toggleAmbientMode}
                          className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out flex items-center ${
                            ambientMode ? 'bg-primaryMovies justify-end' : 'bg-white/20 justify-start'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-md transform" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Audio Enhancement (Dialogue Boost & Night Mode) */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAudioEnhanceMenu(prev => !prev);
                      setShowSpeedMenu(false);
                      setShowAspectMenu(false);
                      setShowVisualMenu(false);
                    }}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold backdrop-blur transition-all flex items-center gap-1 sm:gap-1.5 touch-manipulation ${
                      audioEnhanceMode !== 'off' ? 'bg-primaryMovies text-white ring-2 ring-primaryMovies/40' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isRtl ? 'محرك الصوت المتقدم وتعزيز الحوار' : 'Audio Enhancements'}
                  >
                    <Headphones size={13} className="sm:w-3.5 sm:h-3.5" />
                    <span className="hidden sm:inline">
                      {audioEnhanceMode === 'dialogue'
                        ? (isRtl ? 'حوار' : 'Dialogue')
                        : audioEnhanceMode === 'night'
                          ? (isRtl ? 'ليلي' : 'Night')
                          : (isRtl ? 'الصوت' : 'Audio')}
                    </span>
                    {audioEnhanceMode !== 'off' && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    )}
                  </button>

                  {/* Audio Enhancement Popup */}
                  {showAudioEnhanceMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-12 ${isRtl ? 'left-0 sm:left-0' : 'right-0 sm:right-0'} bg-slate-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-2.5 shadow-2xl z-50 w-[240px] max-w-[calc(100vw-24px)] animate-fadeIn flex flex-col gap-1.5 text-white`}
                    >
                      <div className="text-[11px] font-semibold text-white/70 px-1.5 py-1 border-b border-white/15 mb-1 flex items-center gap-1.5">
                        <Headphones size={13} className="text-primaryMovies" />
                        <span>{isRtl ? 'محرك تحسين الصوت الذكي' : 'Audio Enhancement'}</span>
                      </div>

                      {[
                        { id: 'off', labelAr: '🔊 عادي (افتراضي)', labelEn: 'Normal (Default)', descAr: 'الصوت الأصلي دون معالجة' },
                        { id: 'dialogue', labelAr: '🗣️ تعزيز حوار الشخصيات', labelEn: 'Dialogue Boost', descAr: 'تضخيم نبرات الكلام البشري لعزل الحوار' },
                        { id: 'night', labelAr: '🌙 الوضع الليلي (Night Mode)', labelEn: 'Night Mode', descAr: 'موازنة الانفجارات وخفض الأصوات المفاجئة' }
                      ].map(item => (
                        <button
                          key={item.id}
                          onClick={() => setAudioMode(item.id)}
                          className={`w-full p-2 rounded-lg text-start flex items-start justify-between transition ${
                            audioEnhanceMode === item.id
                              ? 'bg-primaryMovies text-white font-bold shadow'
                              : 'hover:bg-white/10 text-white/80'
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-xs">{item.labelAr}</span>
                            <span className="text-[10px] text-white/60 mt-0.5">{item.descAr}</span>
                          </div>
                          {audioEnhanceMode === item.id && <Check size={14} className="mt-0.5 flex-shrink-0" />}
                        </button>
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

                {/* Advanced Subtitles Hub Button & Modal */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSubtitleMenu(prev => !prev);
                      setShowSpeedMenu(false);
                      setShowAspectMenu(false);
                      setShowVisualMenu(false);
                    }}
                    className={`px-2 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold backdrop-blur transition-all flex items-center gap-1 sm:gap-1.5 touch-manipulation ${
                      showSubtitleMenu || selectedSubtitle ? 'bg-primaryMovies text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                    title={isRtl ? 'إعدادات والبحث عن الترجمة (C)' : 'Subtitles & Customization (C)'}
                  >
                    <Subtitles size={13} className="sm:w-3.5 sm:h-3.5" />
                    <span>{isRtl ? 'الترجمة' : 'Subtitles'}</span>
                    {selectedSubtitle && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm ring-1 ring-white/50" />
                    )}
                  </button>

                  {/* Subtitles Glassmorphic Drawer / Popup */}
                  {showSubtitleMenu && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute bottom-12 ${isRtl ? 'left-0 sm:left-0' : 'right-0 sm:right-0'} bg-slate-900/95 backdrop-blur-2xl border border-white/20 rounded-2xl p-3 shadow-2xl z-50 w-[300px] sm:w-[360px] max-w-[calc(100vw-24px)] flex flex-col gap-2.5 animate-fadeIn text-white`}
                    >
                      {/* Header with Tabs */}
                      <div className="flex items-center justify-between border-b border-white/15 pb-2">
                        <div className="flex items-center gap-1 bg-white/5 p-0.5 rounded-lg border border-white/10">
                          <button
                            onClick={() => setSubtitleTab('tracks')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                              subtitleTab === 'tracks' ? 'bg-primaryMovies text-white' : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {isRtl ? 'الملفات' : 'Tracks'}
                          </button>
                          <button
                            onClick={() => setSubtitleTab('style')}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                              subtitleTab === 'style' ? 'bg-primaryMovies text-white' : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {isRtl ? 'المظهر' : 'Style'}
                          </button>
                          <button
                            onClick={() => {
                              setSubtitleTab('search');
                              if (onlineSubtitles.length === 0 && !searchingOnlineSubs) {
                                setSearchingOnlineSubs(true);
                                authFetch(`/api/subtitles/${type}/${id}/search?language=ar`)
                                  .then(r => r.json())
                                  .then(res => {
                                    setOnlineSubtitles(res.data || []);
                                    setSearchingOnlineSubs(false);
                                  })
                                  .catch(() => setSearchingOnlineSubs(false));
                              }
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                              subtitleTab === 'search' ? 'bg-primaryMovies text-white' : 'text-white/60 hover:text-white'
                            }`}
                          >
                            {isRtl ? 'بحث أونلاين' : 'Search'}
                          </button>
                        </div>

                        <button
                          onClick={() => setShowSubtitleMenu(false)}
                          className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      {/* Tab 1: Subtitle Tracks */}
                      {subtitleTab === 'tracks' && (
                        <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1">
                          {/* Disable Subtitles Option */}
                          <button
                            onClick={() => {
                              setSelectedSubtitle(null);
                              const vid = videoRef.current;
                              if (vid && vid.textTracks) {
                                for (let i = 0; i < vid.textTracks.length; i++) {
                                  vid.textTracks[i].mode = 'disabled';
                                }
                              }
                              showFeedbackBadge(isRtl ? 'تم إيقاف الترجمة' : 'Subtitles Off', Subtitles);
                            }}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between transition ${
                              !selectedSubtitle ? 'bg-primaryMovies text-white font-bold' : 'hover:bg-white/10 text-white/70'
                            }`}
                          >
                            <span>{isRtl ? 'إيقاف الترجمة' : 'Turn Off Subtitles'}</span>
                            {!selectedSubtitle && <Check size={14} />}
                          </button>

                          {availableSubtitles.length === 0 ? (
                            <div className="text-center py-4 text-xs text-white/50">
                              {isRtl ? 'لا توجد ترجمات متاحة حالياً' : 'No available subtitles found'}
                            </div>
                          ) : (
                            availableSubtitles.map((sub, idx) => {
                              const isSelected = !!selectedSubtitle && (
                                (sub.id && selectedSubtitle.id === sub.id) ||
                                (sub.path && selectedSubtitle.path === sub.path) ||
                                (sub.streamIndex !== undefined && (selectedSubtitle.streamIndex === sub.streamIndex || selectedSubtitle.index === sub.streamIndex)) ||
                                (sub.index !== undefined && (selectedSubtitle.index === sub.index || selectedSubtitle.streamIndex === sub.index))
                              );
                              return (
                                <button
                                  key={sub.id || sub.path || sub.streamIndex || idx}
                                  onClick={() => {
                                    setSelectedSubtitle(sub);
                                    showFeedbackBadge(sub.title || sub.language || (isRtl ? 'العربية' : 'Arabic'), Subtitles);
                                  }}
                                  className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition gap-2 ${
                                    isSelected ? 'bg-primaryMovies text-white font-bold shadow' : 'hover:bg-white/10 text-white/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <Subtitles size={13} className={isSelected ? 'text-white' : 'text-white/50'} />
                                    <span className="truncate">{sub.title || sub.filename || sub.language || (isRtl ? `ترجمة #${idx + 1}` : `Track #${idx + 1}`)}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {sub.language && (
                                      <span className="text-[10px] uppercase font-mono px-1 py-0.5 rounded bg-white/10 text-white/70">
                                        {sub.language}
                                      </span>
                                    )}
                                    {isSelected && <Check size={14} />}
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}

                      {/* Tab 2: Style & Offset Synchronization */}
                      {subtitleTab === 'style' && (
                        <div className="flex flex-col gap-3 py-1 max-h-[340px] sm:max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                          {/* Subtitle Offset / Delay Sync */}
                          <div className="flex flex-col gap-1.5 bg-white/5 p-2 rounded-xl border border-white/10">
                            <div className="flex justify-between items-center text-xs text-white/80">
                              <span className="font-semibold">{isRtl ? 'مزامنة الترجمة (تأخير / تقديم)' : 'Subtitle Sync / Delay'}</span>
                              <span className="font-mono text-primaryMovies font-bold">
                                {subtitleOffset > 0 ? `+${subtitleOffset.toFixed(1)}s` : `${subtitleOffset.toFixed(1)}s`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const newOffset = Number(Math.max(-10, Math.min(10, subtitleOffset - 0.1)).toFixed(1));
                                  setSubtitleOffset(newOffset);
                                  try { localStorage.setItem('arn_player_subtitle_offset', String(newOffset)); } catch {}
                                }}
                                className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-xs font-mono font-bold"
                                title={isRtl ? 'تأخير 0.1 ثانية' : 'Delay 0.1s'}
                              >
                                -0.1s
                              </button>
                              <input
                                type="range"
                                min="-10"
                                max="10"
                                step="0.1"
                                value={subtitleOffset}
                                onChange={(e) => {
                                  const val = Number(Number(e.target.value).toFixed(1));
                                  setSubtitleOffset(val);
                                  try { localStorage.setItem('arn_player_subtitle_offset', String(val)); } catch {}
                                }}
                                className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primaryMovies"
                              />
                              <button
                                onClick={() => {
                                  const newOffset = Number(Math.max(-10, Math.min(10, subtitleOffset + 0.1)).toFixed(1));
                                  setSubtitleOffset(newOffset);
                                  try { localStorage.setItem('arn_player_subtitle_offset', String(newOffset)); } catch {}
                                }}
                                className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-xs font-mono font-bold"
                                title={isRtl ? 'تقديم 0.1 ثانية' : 'Advance 0.1s'}
                              >
                                +0.1s
                              </button>
                              <button
                                onClick={() => {
                                  setSubtitleOffset(0);
                                  try { localStorage.setItem('arn_player_subtitle_offset', '0'); } catch {}
                                }}
                                className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[10px] text-white/60 hover:text-white"
                                title={isRtl ? 'تصفير' : 'Reset'}
                              >
                                0
                              </button>
                            </div>
                          </div>

                          {/* Font Family Selector */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-white/70">{isRtl ? 'نوع خط الترجمة' : 'Font Family'}</span>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { id: 'Cairo', labelAr: 'كايرو', labelEn: 'Cairo', family: 'Cairo' },
                                { id: 'Alexandria', labelAr: 'الإسكندرية', labelEn: 'Alexandria', family: 'Alexandria' },
                                { id: 'Tajawal', labelAr: 'تجوال', labelEn: 'Tajawal', family: 'Tajawal' },
                                { id: 'Inter', labelAr: 'إنتر', labelEn: 'Inter', family: 'Inter' },
                                { id: 'Arial', labelAr: 'أريال', labelEn: 'Arial', family: 'Arial' }
                              ].map(f => (
                                <button
                                  key={f.id}
                                  onClick={() => updateSubtitleSetting('fontFamily', f.id)}
                                  style={{ fontFamily: f.family }}
                                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center truncate ${
                                    (subtitleSettings.fontFamily || 'Cairo') === f.id
                                      ? 'bg-primaryMovies text-white shadow-md'
                                      : 'bg-white/5 hover:bg-white/15 text-white/70 hover:text-white'
                                  }`}
                                >
                                  {isRtl ? f.labelAr : f.labelEn}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Subtitle Position & Vertical Offset */}
                          <div className="flex flex-col gap-1.5 bg-white/5 p-2 rounded-xl border border-white/10">
                            <div className="flex justify-between items-center text-[11px] font-semibold text-white/70">
                              <span>{isRtl ? 'مكان ظهور الترجمة' : 'Subtitle Placement'}</span>
                              <span className="text-primaryMovies font-mono text-[10px] font-bold">
                                {subtitleSettings.position === 'top'
                                  ? (isRtl ? `أعلى (${subtitleSettings.verticalOffset || 8}%)` : `Top (${subtitleSettings.verticalOffset || 8}%)`)
                                  : subtitleSettings.position === 'middle'
                                    ? (isRtl ? 'وسط الشاشة' : 'Center')
                                    : (isRtl ? `أسفل (${subtitleSettings.verticalOffset || 8}%)` : `Bottom (${subtitleSettings.verticalOffset || 8}%)`)}
                              </span>
                            </div>

                            {/* Position buttons */}
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { id: 'bottom', labelAr: 'أسفل الشاشة', labelEn: 'Bottom' },
                                { id: 'middle', labelAr: 'وسط الشاشة', labelEn: 'Center' },
                                { id: 'top', labelAr: 'أعلى الشاشة', labelEn: 'Top' }
                              ].map(pos => (
                                <button
                                  key={pos.id}
                                  onClick={() => updateSubtitleSetting('position', pos.id)}
                                  className={`py-1 rounded-md text-[10px] font-bold transition ${
                                    (subtitleSettings.position || 'bottom') === pos.id
                                      ? 'bg-primaryMovies text-white shadow'
                                      : 'bg-white/5 hover:bg-white/15 text-white/70'
                                  }`}
                                >
                                  {isRtl ? pos.labelAr : pos.labelEn}
                                </button>
                              ))}
                            </div>

                            {/* Vertical offset slider (only active when not centered) */}
                            {subtitleSettings.position !== 'middle' && (
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex justify-between text-[10px] text-white/60">
                                  <span>{subtitleSettings.position === 'top' ? (isRtl ? 'المسافة من أعلى' : 'Top Offset') : (isRtl ? 'المسافة من أسفل' : 'Bottom Offset')}</span>
                                  <span className="font-mono text-white/80">{subtitleSettings.verticalOffset || 8}%</span>
                                </div>
                                <input
                                  type="range"
                                  min="2"
                                  max="35"
                                  step="1"
                                  value={subtitleSettings.verticalOffset || 8}
                                  onChange={(e) => updateSubtitleSetting('verticalOffset', Number(e.target.value))}
                                  className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primaryMovies"
                                />
                              </div>
                            )}
                          </div>

                          {/* Font Size Preset */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-white/70">{isRtl ? 'حجم خط الترجمة' : 'Font Size'}</span>
                            <div className="grid grid-cols-4 gap-1">
                              {[
                                { id: '16px', labelAr: 'صغير', labelEn: 'Small' },
                                { id: '20px', labelAr: 'متوسط', labelEn: 'Medium' },
                                { id: '26px', labelAr: 'كبير', labelEn: 'Large' },
                                { id: '32px', labelAr: 'ضخم', labelEn: 'Huge' }
                              ].map(f => (
                                <button
                                  key={f.id}
                                  onClick={() => updateSubtitleSetting('fontSize', f.id)}
                                  className={`py-1 rounded-md text-[10px] font-bold transition ${
                                    (subtitleSettings.fontSize || '20px') === f.id
                                      ? 'bg-primaryMovies text-white shadow'
                                      : 'bg-white/5 hover:bg-white/15 text-white/70'
                                  }`}
                                >
                                  {isRtl ? f.labelAr : f.labelEn}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Text Color */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-white/70">{isRtl ? 'لون النص' : 'Text Color'}</span>
                            <div className="flex items-center gap-2">
                              {['#FFFFFF', '#FEF08A', '#38BDF8', '#4ADE80', '#FBBF24', '#F472B6'].map(color => (
                                <button
                                  key={color}
                                  onClick={() => updateSubtitleSetting('color', color)}
                                  style={{ backgroundColor: color }}
                                  className={`w-7 h-7 rounded-full border-2 transition ${
                                    subtitleSettings.color === color ? 'border-white scale-110 shadow-md ring-2 ring-primaryMovies/60' : 'border-black/50 opacity-80 hover:opacity-100'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Background Color */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-white/70">{isRtl ? 'لون خلفية النص' : 'Background Color'}</span>
                            <div className="flex items-center gap-2">
                              {['#000000', '#1E293B', '#0F172A', '#450A0A', '#052E16', '#00000000'].map(color => {
                                const isTransparent = color === '#00000000';
                                const active = isTransparent
                                  ? subtitleSettings.bgOpacity === 0
                                  : subtitleSettings.bgColor === color && subtitleSettings.bgOpacity > 0;
                                return (
                                  <button
                                    key={color}
                                    onClick={() => {
                                      if (isTransparent) {
                                        updateSubtitleSetting('bgOpacity', 0);
                                      } else {
                                        setSubtitleSettings(prev => {
                                          const next = { ...prev, bgColor: color, bgOpacity: prev.bgOpacity > 0 ? prev.bgOpacity : 0.75 };
                                          try { localStorage.setItem('arn_player_subtitle_settings', JSON.stringify(next)); } catch {}
                                          return next;
                                        });
                                      }
                                    }}
                                    style={isTransparent
                                      ? { background: 'repeating-conic-gradient(#94a3b8 0% 25%, #1e293b 0% 50%) 50%/12px 12px' }
                                      : { backgroundColor: color }}
                                    className={`w-7 h-7 rounded-full border-2 transition ${
                                      active ? 'border-white scale-110 shadow-md ring-2 ring-primaryMovies/60' : 'border-black/50 opacity-80 hover:opacity-100'
                                    }`}
                                    title={isTransparent ? (isRtl ? 'بدون خلفية' : 'No background') : color}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          {/* Background Opacity */}
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center text-[11px] font-semibold text-white/70">
                              <span>{isRtl ? 'شفافية الخلفية' : 'Background Opacity'}</span>
                              <span className="font-mono text-primaryMovies font-bold">{Math.round(subtitleSettings.bgOpacity * 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={subtitleSettings.bgOpacity}
                              onChange={(e) => updateSubtitleSetting('bgOpacity', Number(e.target.value))}
                              className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-primaryMovies"
                            />
                          </div>

                          {/* Text Shadow / Outline */}
                          <div className="flex flex-col gap-1">
                            <span className="text-[11px] font-semibold text-white/70">{isRtl ? 'ظل وتحديد النص' : 'Text Shadow'}</span>
                            <div className="grid grid-cols-3 gap-1">
                              {[
                                { id: 'drop', labelAr: 'ظل ناعم', labelEn: 'Shadow' },
                                { id: 'outline', labelAr: 'حد محيطي بارز', labelEn: 'Outline' },
                                { id: 'none', labelAr: 'بدون', labelEn: 'None' }
                              ].map(sh => (
                                <button
                                  key={sh.id}
                                  onClick={() => updateSubtitleSetting('textShadow', sh.id)}
                                  className={`py-1 rounded-md text-[10px] font-bold transition ${
                                    subtitleSettings.textShadow === sh.id
                                      ? 'bg-primaryMovies text-white shadow'
                                      : 'bg-white/5 hover:bg-white/15 text-white/70'
                                  }`}
                                >
                                  {isRtl ? sh.labelAr : sh.labelEn}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Live preview */}
                          <div className="flex items-center justify-center py-3 rounded-xl bg-black/70 border border-white/10 overflow-hidden">
                            <span
                              id="arn-subtitle-preview"
                              className="px-3 py-1.5 leading-snug text-center max-w-[90%] font-bold tracking-wide transition-all select-none"
                              style={{
                                fontFamily: `'${subtitleSettings.fontFamily || 'Cairo'}', 'Alexandria', 'Tajawal', 'Inter', sans-serif`,
                                fontSize: subtitleSettings.fontSize || '20px',
                                color: subtitleSettings.color || '#FFFFFF',
                                backgroundColor: hexToRgba(subtitleSettings.bgColor, subtitleSettings.bgOpacity),
                                textShadow: buildCueTextShadow(subtitleSettings.textShadow),
                                borderRadius: subtitleSettings.bgOpacity > 0 ? '8px' : '0px'
                              }}
                            >
                              {isRtl ? 'نموذج على الترجمة المخصصة' : 'Custom Subtitle Preview'}
                            </span>
                          </div>

                          {/* Reset all style settings */}
                          <button
                            onClick={() => {
                              setSubtitleSettings({ ...DEFAULT_SUBTITLE_SETTINGS });
                              try { localStorage.setItem('arn_player_subtitle_settings', JSON.stringify(DEFAULT_SUBTITLE_SETTINGS)); } catch {}
                            }}
                            className="py-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-[10px] font-bold text-white/60 hover:text-white transition"
                          >
                            {isRtl ? 'استعادة المظهر الافتراضي' : 'Reset style'}
                          </button>
                        </div>
                      )}

                      {/* Tab 3: Online Subtitles Search */}
                      {subtitleTab === 'search' && (
                        <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto">
                          {searchingOnlineSubs ? (
                            <div className="flex items-center justify-center py-6 gap-2 text-xs text-white/60">
                              <RefreshCw size={14} className="animate-spin text-primaryMovies" />
                              <span>{isRtl ? 'جاري البحث في قاعدة البيانات...' : 'Searching subtitles...'}</span>
                            </div>
                          ) : onlineSubtitles.length === 0 ? (
                            <div className="text-center py-6 text-xs text-white/50 flex flex-col items-center gap-2">
                              <Search size={20} className="text-white/30" />
                              <span>{isRtl ? 'لم يتم العثور على ترجمات مطابقة أونلاين' : 'No online subtitles found'}</span>
                              <button
                                onClick={() => {
                                  setSearchingOnlineSubs(true);
                                  authFetch(`/api/subtitles/${type}/${id}/search?language=ar`)
                                    .then(r => r.json())
                                    .then(res => {
                                      setOnlineSubtitles(res.data || []);
                                      setSearchingOnlineSubs(false);
                                    })
                                    .catch(() => setSearchingOnlineSubs(false));
                                }}
                                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white"
                              >
                                {isRtl ? 'إعادة المحاولة' : 'Retry Search'}
                              </button>
                            </div>
                          ) : (
                            onlineSubtitles.map((sub, idx) => (
                              <div
                                key={sub.id || idx}
                                className="flex items-center justify-between p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition gap-2"
                              >
                                <div className="flex flex-col min-w-0">
                                  <span className="text-xs font-semibold truncate text-white/90">
                                    {sub.file_name || sub.release || (isRtl ? 'ملف ترجمة عربي' : 'Arabic Subtitle')}
                                  </span>
                                  <span className="text-[10px] text-white/50">
                                    {isRtl ? `التحميلات: ${sub.download_count || 0}` : `Downloads: ${sub.download_count || 0}`}
                                  </span>
                                </div>
                                <button
                                  disabled={downloadingSubId === (sub.file_id || sub.id)}
                                  onClick={async () => {
                                    const fid = sub.file_id || sub.id;
                                    setDownloadingSubId(fid);
                                    try {
                                      const res = await authFetch(`/api/subtitles/${type}/${id}/download`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          file_id: fid,
                                          language: sub.language || 'ar',
                                          file_name: sub.file_name
                                        })
                                      });
                                      const json = await res.json();
                                      if (json.data && json.data.path) {
                                        setAvailableSubtitles(prev => [...prev, json.data]);
                                        setSelectedSubtitle(json.data);
                                        setSubtitleTab('tracks');
                                        showFeedbackBadge(isRtl ? 'تم تحميل وتفعيل الترجمة' : 'Subtitle Downloaded & Activated', Download);
                                      }
                                    } catch (err) {
                                      console.error(err);
                                    } finally {
                                      setDownloadingSubId(null);
                                    }
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-primaryMovies hover:brightness-110 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 flex-shrink-0 disabled:opacity-50"
                                >
                                  {downloadingSubId === (sub.file_id || sub.id) ? (
                                    <RefreshCw size={12} className="animate-spin" />
                                  ) : (
                                    <Download size={12} />
                                  )}
                                  <span>{isRtl ? 'تحميل' : 'Get'}</span>
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
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

        {/* Watch Party Overlay (Live Chat, floating emojis, room bar) - Top Layer */}
        {syncRoomId && (
          <WatchPartyOverlay
            roomId={syncRoomId}
            isHost={syncIsHost}
            members={syncMembers}
            messages={syncMessages}
            floatingEmojis={floatingEmojis}
            onSendMessage={(text) => {
              if (syncWsRef.current?.readyState === WebSocket.OPEN) {
                syncWsRef.current.send(JSON.stringify({ type: 'CHAT', text }));
              }
            }}
            onSendEmoji={(emoji) => {
              if (syncWsRef.current?.readyState === WebSocket.OPEN) {
                syncWsRef.current.send(JSON.stringify({ type: 'EMOJI_BURST', emoji }));
              }
            }}
            onLeaveParty={() => {
              setSyncRoomId(null);
              if (syncWsRef.current) {
                syncWsRef.current.close();
                syncWsRef.current = null;
              }
            }}
          />
        )}

        {/* Watch Party Modal (Create or Join) */}
        <WatchPartyModal
          isOpen={showWatchPartyModal}
          onClose={() => setShowWatchPartyModal(false)}
          mediaType={type}
          mediaId={id}
          mediaTitle={displayTitle}
          currentTime={currentTime}
          isPlaying={isPlaying}
          onJoinRoom={(code) => {
            setSyncRoomId(code);
            const url = new URL(window.location);
            url.searchParams.set('roomId', code);
            window.history.replaceState({}, '', url);
          }}
        />
      </div>
    );
  }
