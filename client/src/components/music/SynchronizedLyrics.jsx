import { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchLyrics } from '../../api/client';
import client from '../../api/client';
import { 
  Type, 
  RotateCcw, 
  Search, 
  Edit3, 
  Upload, 
  BookOpen, 
  Music, 
  Sliders, 
  Plus, 
  Minus, 
  Check, 
  X,
  Volume2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Robust LRC Parser
 * Parses [mm:ss.xx] and [mm:ss.xxx] formatted timestamp lines
 */
function parseLrc(rawText) {
  if (!rawText || typeof rawText !== 'string') return { isSynced: false, lines: [] };

  const lines = [];
  const rawLines = rawText.split(/\r?\n/);
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  let hasTimestamp = false;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();
    if (!rawLine) continue;

    // Check for ID3/LRC metadata headers e.g. [ti:Song], [ar:Artist], [al:Album]
    if (/^\[(ti|ar|al|by|offset|length):/i.test(rawLine)) {
      continue;
    }

    const matches = [...rawLine.matchAll(timeRegex)];
    if (matches.length > 0) {
      hasTimestamp = true;
      const cleanText = rawLine.replace(timeRegex, '').trim();
      for (const match of matches) {
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const msRaw = match[3] || '0';
        const ms = parseInt(msRaw, 10);
        const msFactor = msRaw.length === 3 ? 1000 : 100;
        const time = min * 60 + sec + ms / msFactor;

        lines.push({
          time,
          text: cleanText || '♪'
        });
      }
    } else {
      // Plain text line without timestamp
      lines.push({
        time: null,
        text: rawLine
      });
    }
  }

  // Sort timed lines ascending
  if (hasTimestamp) {
    lines.sort((a, b) => {
      if (a.time === null) return 1;
      if (b.time === null) return -1;
      return a.time - b.time;
    });
  }

  return { isSynced: hasTimestamp, lines };
}

const SynchronizedLyrics = memo(function SynchronizedLyrics({
  trackId,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onSeek,
  trackTitle = '',
  artistName = '',
  albumTitle = '',
  className = ''
}) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const queryClient = useQueryClient();

  const containerRef = useRef(null);
  const lineRefs = useRef([]);
  const userScrollTimeoutRef = useRef(null);
  const prevActiveIdxRef = useRef(-1);

  // User scrolling override state
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // Search filter inside lyrics
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Edit / Upload lyrics modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');

  // Font size state (default: 22px)
  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('arn_lyrics_fontsize') || '22', 10);
  });

  // Detect Quran recitation automatically
  const isAutoQuran = useMemo(() => {
    const combined = `${trackTitle} ${artistName} ${albumTitle}`.toLowerCase();
    return /قرآن|سورة|مصحف|تلاوة|quran|surah|recitation|عبد الباسط|الحصري|المنشاوي|العفاسي|المعيقلي|الشريم|السديس|الغامدي/i.test(combined);
  }, [trackTitle, artistName, albumTitle]);

  const [quranMode, setQuranMode] = useState(isAutoQuran);

  // Ayah Loop / Memorization: 0 = off, 1 = 1x, 3 = 3x, 5 = 5x, -1 = infinite
  const [ayahRepeatCount, setAyahRepeatCount] = useState(0);
  const [currentAyahLoopsDone, setCurrentAyahLoopsDone] = useState(0);

  // Fetch lyrics from server (which checks DB -> local .lrc -> LRCLIB)
  const { data: lyricsResponse, isLoading } = useQuery({
    queryKey: ['trackLyrics', trackId],
    queryFn: () => fetchLyrics(trackId),
    enabled: !!trackId,
    staleTime: 1000 * 60 * 30
  });

  const rawLyrics = lyricsResponse?.lyrics || '';

  // Parse LRC lines
  const { isSynced, lines } = useMemo(() => {
    return parseLrc(rawLyrics);
  }, [rawLyrics]);

  // Find active line index based on currentTime
  const activeIndex = useMemo(() => {
    if (!isSynced || lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].time !== null && lines[i].time <= currentTime + 0.15) {
        idx = i;
      } else if (lines[i].time !== null && lines[i].time > currentTime + 0.15) {
        break;
      }
    }
    return idx;
  }, [isSynced, lines, currentTime]);

  // Ayah repetition logic for Quran memorization
  useEffect(() => {
    if (!quranMode || ayahRepeatCount === 0 || activeIndex === -1 || !isSynced || !isPlaying) return;

    const currentLine = lines[activeIndex];
    const nextLine = lines[activeIndex + 1];

    if (currentLine && nextLine && nextLine.time !== null) {
      // If we are reaching the end of this ayah/line
      if (currentTime >= nextLine.time - 0.25) {
        const maxLoops = ayahRepeatCount === -1 ? 999999 : ayahRepeatCount;
        if (currentAyahLoopsDone + 1 < maxLoops) {
          // Loop back to start of current line
          setCurrentAyahLoopsDone(prev => prev + 1);
          if (onSeek) onSeek(currentLine.time);
        } else {
          // Completed repetitions for this ayah, reset for next
          setCurrentAyahLoopsDone(0);
        }
      }
    }
  }, [quranMode, ayahRepeatCount, activeIndex, currentTime, isSynced, isPlaying, lines, currentAyahLoopsDone, onSeek]);

  // Auto-scroll to active line when activeIndex changes
  useEffect(() => {
    if (!isSynced || activeIndex === -1 || isUserScrolling) return;

    if (activeIndex !== prevActiveIdxRef.current) {
      prevActiveIdxRef.current = activeIndex;
      const el = lineRefs.current[activeIndex];
      if (el) {
        el.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [isSynced, activeIndex, isUserScrolling]);

  // Detect user manual scroll to prevent fighting
  const handleScroll = useCallback(() => {
    setIsUserScrolling(true);
    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 4500);
  }, []);

  // Jump to specific line time
  const handleLineClick = (lineTime) => {
    if (lineTime !== null && onSeek) {
      onSeek(lineTime);
      setIsUserScrolling(false);
    }
  };

  // Re-sync button handler
  const handleReturnToSync = () => {
    setIsUserScrolling(false);
    if (activeIndex !== -1 && lineRefs.current[activeIndex]) {
      lineRefs.current[activeIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  // Save edited lyrics mutation
  const saveMut = useMutation({
    mutationFn: (newLyrics) => client.put(`/tracks/${trackId}/lyrics`, { lyrics: newLyrics }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trackLyrics', trackId] });
      setIsEditing(false);
    }
  });

  const handleOpenEdit = () => {
    setEditedText(rawLyrics);
    setIsEditing(true);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setEditedText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleFontSizeChange = (delta) => {
    const next = Math.max(14, Math.min(36, fontSize + delta));
    setFontSize(next);
    localStorage.setItem('arn_lyrics_fontsize', next.toString());
  };

  return (
    <div className={`relative flex flex-col h-full w-full select-none ${className}`}>
      {/* ─── Top Controls Bar ─── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-black/20 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          {/* Mode Badge / Toggle */}
          <button
            onClick={() => setQuranMode(!quranMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
              quranMode
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-surface border-border text-muted hover:text-white'
            }`}
            title={isRtl ? 'التبديل بين وضع المصحف ووضع الموسيقى' : 'Toggle Quran / Music Mode'}
          >
            {quranMode ? <BookOpen size={13} /> : <Music size={13} />}
            <span>{quranMode ? (isRtl ? 'وضع المصحف' : 'Quran') : (isRtl ? 'الكلمات' : 'Lyrics')}</span>
          </button>

          {/* Ayah Repeat Pill (in Quran Mode) */}
          {quranMode && isSynced && (
            <div className="flex items-center gap-1 bg-surface border border-border rounded-lg px-1.5 py-0.5 text-xs">
              <span className="text-[10px] text-muted">{isRtl ? 'تكرار الآية:' : 'Repeat:'}</span>
              {[0, 1, 3, 5].map((count) => (
                <button
                  key={count}
                  onClick={() => {
                    setAyahRepeatCount(count);
                    setCurrentAyahLoopsDone(0);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-semibold transition ${
                    ayahRepeatCount === count ? 'bg-emerald-500 text-black' : 'text-muted hover:text-white'
                  }`}
                >
                  {count === 0 ? (isRtl ? 'إيقاف' : 'Off') : `${count}x`}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Tools: Font Size, Search, Edit */}
        <div className="flex items-center gap-1.5">
          {/* Font Controls */}
          <div className="flex items-center bg-surface border border-border rounded-lg px-1 py-0.5">
            <button
              onClick={() => handleFontSizeChange(-2)}
              className="w-6 h-6 flex items-center justify-center text-muted hover:text-white rounded"
              title="A-"
            >
              <Minus size={12} />
            </button>
            <span className="text-[11px] font-mono px-1 text-muted">{fontSize}</span>
            <button
              onClick={() => handleFontSizeChange(2)}
              className="w-6 h-6 flex items-center justify-center text-muted hover:text-white rounded"
              title="A+"
            >
              <Plus size={12} />
            </button>
          </div>

          {/* Edit / Upload Button */}
          <button
            onClick={handleOpenEdit}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-surface border border-border text-muted hover:text-primaryMusic transition"
            title={isRtl ? 'تعديل أو استيراد ملف الكلمات LRC' : 'Edit / Import LRC Lyrics'}
          >
            <Edit3 size={13} />
          </button>
        </div>
      </div>

      {/* ─── Main Scrollable Lyrics Container ─── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-12 scrollbar-none text-center relative"
        style={{
          fontFamily: quranMode
            ? "'Amiri', 'Traditional Arabic', 'Scheherazade New', serif"
            : 'inherit',
          direction: isRtl ? 'rtl' : 'ltr'
        }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full opacity-60">
            <div className="w-8 h-8 rounded-full border-2 border-primaryMusic border-t-transparent animate-spin mb-3" />
            <p className="text-sm text-muted">{isRtl ? 'جاري جلب الكلمات والتزامن...' : 'Loading lyrics...'}</p>
          </div>
        ) : !rawLyrics ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50 mt-12">
            <Type size={42} className="mb-3 text-muted/60" />
            <p className="text-base font-medium">{isRtl ? 'لا توجد كلمات أو آيات متزامنة متاحة' : 'No lyrics available'}</p>
            <p className="text-xs text-muted mt-1 max-w-xs">{isRtl ? 'يمكنك الضغط على زر التعديل بالأعلى لإضافة نص الكلمات أو رفع ملف .lrc' : 'You can click edit above to paste text or upload an .lrc file'}</p>
            <button
              onClick={handleOpenEdit}
              className="mt-4 px-4 py-1.5 rounded-xl bg-primaryMusic/20 border border-primaryMusic/40 text-primaryMusic text-xs font-semibold hover:bg-primaryMusic/30 transition"
            >
              {isRtl ? '+ إضافة كلمات / ملف LRC' : '+ Add Lyrics / LRC File'}
            </button>
          </div>
        ) : isSynced ? (
          /* Synchronized Karaoke / Apple Music Style */
          <div className="max-w-2xl mx-auto space-y-5 pb-24">
            {lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = activeIndex !== -1 && idx < activeIndex;

              return (
                <div
                  key={idx}
                  ref={(el) => (lineRefs.current[idx] = el)}
                  onClick={() => handleLineClick(line.time)}
                  className={`cursor-pointer transition-all duration-300 py-1.5 px-4 rounded-2xl group ${
                    isActive
                      ? quranMode
                        ? 'text-emerald-300 scale-105 font-bold drop-shadow-[0_0_16px_rgba(52,211,153,0.5)] bg-emerald-500/10'
                        : 'text-primaryMusic scale-105 font-bold drop-shadow-[0_0_14px_rgba(6,182,212,0.45)] bg-primaryMusic/10'
                      : isPast
                      ? 'text-muted/60 hover:text-white/80'
                      : 'text-muted/40 hover:text-white/80'
                  }`}
                  style={{ fontSize: `${isActive ? fontSize + 2 : fontSize}px`, lineHeight: quranMode ? '2.4' : '1.8' }}
                >
                  <span className="inline-block transition-transform duration-200 group-hover:scale-[1.02]">
                    {line.text}
                    {quranMode && (
                      <span className="ms-2 inline-block text-xs font-sans opacity-70 px-1.5 py-0.5 rounded-full border border-current">
                        {idx + 1}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          /* Plain Unsynchronized Lyrics */
          <div className="max-w-xl mx-auto py-6">
            <p
              className="leading-loose text-tx/90 whitespace-pre-wrap select-text"
              style={{ fontSize: `${fontSize}px` }}
            >
              {rawLyrics}
            </p>
          </div>
        )}
      </div>

      {/* ─── Floating Return-to-Sync Button ─── */}
      {isSynced && isUserScrolling && activeIndex !== -1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-bounce">
          <button
            onClick={handleReturnToSync}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primaryMusic text-black text-xs font-bold shadow-xl hover:brightness-110 transition"
          >
            <RotateCcw size={13} />
            <span>{isRtl ? 'العودة للتزامن' : 'Sync to Audio'}</span>
          </button>
        </div>
      )}

      {/* ─── Edit / Upload Modal ─── */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-surface border border-border w-full max-w-xl rounded-2xl p-5 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <h3 className="text-base font-bold text-text flex items-center gap-2">
                <Edit3 size={16} className="text-primaryMusic" />
                <span>{isRtl ? 'تعديل أو استيراد ملف الكلمات (LRC)' : 'Edit or Import Lyrics (LRC)'}</span>
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-muted"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="text-xs text-muted">
                {isRtl
                  ? 'يمكنك لصق نصوص عادية أو بتنسيق LRC بطوابع زمنية مثل [01:23.45].'
                  : 'You can paste plain text or synchronized LRC with timestamps.'}
              </p>
              <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium cursor-pointer hover:bg-white/10 transition flex-shrink-0">
                <Upload size={13} />
                <span>{isRtl ? 'رفع ملف .lrc' : 'Upload .lrc'}</span>
                <input
                  type="file"
                  accept=".lrc,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>

            <textarea
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              placeholder="[00:15.30] Example lyric line..."
              className="flex-1 w-full bg-black/40 border border-border rounded-xl p-3 text-sm font-mono text-text resize-none focus:outline-none focus:border-primaryMusic/50 min-h-[260px] scrollbar-thin"
              dir="auto"
            />

            <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-border">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-white/10 transition"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                onClick={() => saveMut.mutate(editedText)}
                disabled={saveMut.isPending}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primaryMusic text-black text-xs font-bold hover:brightness-110 transition disabled:opacity-50"
              >
                <Check size={14} />
                <span>{saveMut.isPending ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'حفظ الكلمات' : 'Save Lyrics')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default SynchronizedLyrics;
