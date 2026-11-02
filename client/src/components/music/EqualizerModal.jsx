import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  X,
  RotateCcw,
  Layers
} from 'lucide-react';
import { useEqualizerStore, EQ_PRESETS, EQ_PRESET_GROUPS } from '../../store/useEqualizerStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { equalizerEngine } from '../../utils/audioEqualizerEngine';
import StudioKnob from './StudioKnob';
import StudioVisualizer from './StudioVisualizer';
import StudioEqSliders from './StudioEqSliders';
import AudioFxRack from './AudioFxRack';
import './StudioEqualizer.css';

// منع تسرب أحداث المؤشر واللمس من النافذة إلى المشغل الموجود خلفها (تشغيل/إيقاف، إيماءات السحب...)
const stopEvent = (e) => e.stopPropagation();
const ISOLATION_HANDLERS = {
  onMouseDown: stopEvent,
  onMouseUp: stopEvent,
  onDoubleClick: stopEvent,
  onPointerDown: stopEvent,
  onPointerUp: stopEvent,
  onTouchStart: stopEvent,
  onTouchMove: stopEvent,
  onTouchEnd: stopEvent,
  onContextMenu: stopEvent,
};

/**
 * نافذة المعادل الصوتي الاستوديو — مكون عام يخدم كافة المشغلات.
 *
 * @param {boolean}  isOpen
 * @param {Function} onClose
 * @param {number}   [volumePercent]   مستوى صوت المشغل الحالي (افتراضياً: مشغل الموسيقى)
 * @param {number}   [volumeMax=100]   أقصى مستوى للمقبض (مثلاً 200 للبث المباشر)
 * @param {Function} [onVolumeChange]  يستقبل النسبة المئوية الجديدة
 * @param {boolean}  [isPlaying]       حالة التشغيل لشاشة الطيف
 * @param {'music'|'video'|'tv'|'radio'} [presetGroup='music']
 * @param {string}   [contextLabel]    وصف المشغل المفتوح حالياً
 */
export default function EqualizerModal({
  isOpen,
  onClose,
  volumePercent: volumePercentProp,
  volumeMax = 100,
  onVolumeChange,
  isPlaying: isPlayingProp,
  presetGroup = 'music',
  contextLabel
}) {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const panelRef = useRef(null);

  const {
    enabled,
    toggleEnabled,
    currentPreset,
    setPreset,
    bands,
    setBandGain,
    setBassGain,
    setTrebleGain,
    preamp,
    setPreamp,
    eqTheme,
    setEqTheme,
    reset,
    delayEnabled,
    delayTime,
    delayFeedback,
    delayWet,
    echoEnabled,
    echoTime,
    echoFeedback,
    echoWet
  } = useEqualizerStore();

  const musicVolume = usePlayerStore(s => s.volume);
  const setMusicVolume = usePlayerStore(s => s.setVolume);
  const musicIsPlaying = usePlayerStore(s => s.isPlaying);

  const isPlaying = typeof isPlayingProp === 'boolean' ? isPlayingProp : musicIsPlaying;

  const [showFxDrawer, setShowFxDrawer] = useState(false);

  // Sync Web Audio Engine on any EQ, Preamp, Delay, or Echo change
  useEffect(() => {
    equalizerEngine.applySettings({
      bands,
      preamp,
      enabled,
      delay: { enabled: delayEnabled, time: delayTime, feedback: delayFeedback, wet: delayWet },
      echo: { enabled: echoEnabled, time: echoTime, feedback: echoFeedback, wet: echoWet }
    });
  }, [bands, preamp, enabled, delayEnabled, delayTime, delayFeedback, delayWet, echoEnabled, echoTime, echoFeedback, echoWet]);

  // التركيز على النافذة عند فتحها + عزل اختصارات لوحة المفاتيح وعجلة الماوس عن المشغل
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const el = panelRef.current;
    if (!el) return undefined;
    try { el.focus({ preventScroll: true }); } catch {}

    const handleKey = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current?.();
      }
    };
    const handleWheel = (e) => e.stopPropagation();

    el.addEventListener('keydown', handleKey);
    el.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      el.removeEventListener('keydown', handleKey);
      el.removeEventListener('wheel', handleWheel);
    };
  }, [isOpen]);

  // Compute Volume percentage for main knob
  const hasExternalVolume = typeof volumePercentProp === 'number' && typeof onVolumeChange === 'function';
  const volumePercent = hasExternalVolume
    ? Math.round(Math.max(0, Math.min(volumeMax, volumePercentProp)))
    : Math.round((musicVolume ?? 0.75) * 100);
  const knobMax = hasExternalVolume ? volumeMax : 100;

  const handleVolumeKnob = (newVal) => {
    if (hasExternalVolume) {
      onVolumeChange(Math.max(0, Math.min(volumeMax, newVal)));
      return;
    }
    const v = Math.max(0, Math.min(1, newVal / 100));
    setMusicVolume(v);
    const audioEl = document.querySelector('audio');
    if (audioEl) audioEl.volume = v;
  };

  const presetKeys = useMemo(() => {
    const group = EQ_PRESET_GROUPS[presetGroup] || EQ_PRESET_GROUPS.music;
    return group.filter((key) => EQ_PRESETS[key]);
  }, [presetGroup]);

  // Dynamically compute Bass and Treble percentages from current 10-band gains
  const bassPercent = useMemo(() => {
    if (!bands || bands.length < 3) return 50;
    // Average of 31Hz, 62Hz, 125Hz
    const avg = ((bands[0] || 0) + (bands[1] || 0) + (bands[2] || 0)) / 3;
    return Math.max(0, Math.min(100, Math.round(50 + (avg / 12) * 50)));
  }, [bands]);

  const treblePercent = useMemo(() => {
    if (!bands || bands.length < 10) return 50;
    // Average of 4kHz, 8kHz, 16kHz
    const avg = ((bands[7] || 0) + (bands[8] || 0) + (bands[9] || 0)) / 3;
    return Math.max(0, Math.min(100, Math.round(50 + (avg / 12) * 50)));
  }, [bands]);

  if (!isOpen) return null;

  // في وضع ملء الشاشة يجب عرض النافذة داخل العنصر المعروض بملء الشاشة وإلا لن تظهر
  const portalTarget = typeof document !== 'undefined'
    ? (document.fullscreenElement || document.webkitFullscreenElement || document.body)
    : null;

  const content = (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-2xl animate-fadeIn overflow-y-auto"
      onClick={(e) => {
        e.stopPropagation();
        onClose?.();
      }}
      {...ISOLATION_HANDLERS}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`studio-eq-container ${eqTheme || 'theme-default'} my-auto outline-none`}
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-panel">
          
          {/* ─── أزرار تغيير الثيم ─── */}
          <div className="theme-switcher">
            <button
              className={`theme-btn default ${(eqTheme || 'theme-default') === 'theme-default' ? 'active' : ''}`}
              onClick={() => setEqTheme('theme-default')}
              title={isRtl ? 'ثيم أزرق سماوي' : 'Default Blue'}
            />
            <button
              className={`theme-btn sunset ${eqTheme === 'theme-sunset' ? 'active' : ''}`}
              onClick={() => setEqTheme('theme-sunset')}
              title={isRtl ? 'ثيم غروب' : 'Sunset'}
            />
            <button
              className={`theme-btn forest ${eqTheme === 'theme-forest' ? 'active' : ''}`}
              onClick={() => setEqTheme('theme-forest')}
              title={isRtl ? 'ثيم غابة' : 'Forest'}
            />
          </div>

          {/* ─── العنوان وزر الإغلاق ─── */}
          <div className="header">
            <div>
              <h1>STUDIO PRO</h1>
              <span>10-BAND SPATIAL EQUALIZER</span>
            </div>
            <div className="flex items-center gap-3">
              <div style={{ fontSize: '0.9rem', color: 'var(--text-sub)' }}>
                {contextLabel || (isRtl ? 'معادل صوتي متقدم' : 'Advanced Audio Equalizer')}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="close-btn"
                title={isRtl ? 'إغلاق' : 'Close'}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ─── القسم الأيسر (المقابض الدوارة) ─── */}
          <div className="left-panel">
            
            {/* المقبض الرئيسي (مستوى الصوت) */}
            <StudioKnob
              size="main"
              value={volumePercent}
              min={0}
              max={knobMax}
              step={1}
              defaultValue={knobMax > 100 ? 100 : 75}
              onChange={handleVolumeKnob}
              label={isRtl ? 'مستوى الصوت' : 'VOLUME'}
              displayValue={`${volumePercent}%`}
              disabled={!enabled}
              isRtl={isRtl}
            />

            {/* مقابض البيز والتربل التفاعلية */}
            <div className="small-knobs-row">
              <StudioKnob
                size="small"
                value={bassPercent}
                min={0}
                max={100}
                step={1}
                defaultValue={50}
                onChange={setBassGain}
                label="BASS"
                displayValue={`${bassPercent}%`}
                disabled={!enabled}
                isRtl={isRtl}
              />

              <StudioKnob
                size="small"
                value={treblePercent}
                min={0}
                max={100}
                step={1}
                defaultValue={50}
                onChange={setTrebleGain}
                label="TREBLE"
                displayValue={`${treblePercent}%`}
                disabled={!enabled}
                isRtl={isRtl}
              />
            </div>
          </div>

          {/* ─── القسم الأيمن (الرسم البياني + أزرار التحكم + المنزلقات) ─── */}
          <div className="right-panel">
            
            {/* شاشة الرسم البياني (Canvas Spectrum Visualizer) */}
            <StudioVisualizer
              enabled={enabled}
              isPlaying={isPlaying}
              isRtl={isRtl}
              theme={eqTheme}
            />

            {/* أزرار التحكم */}
            <div className="controls">
              <button
                type="button"
                className={`btn ${enabled ? 'active' : ''}`}
                onClick={toggleEnabled}
              >
                <span>{enabled ? '▶' : '⏸'}</span>
                <span>{enabled ? (isRtl ? 'تشغيل' : 'Active') : (isRtl ? 'معطل' : 'Bypass')}</span>
              </button>

              {/* أوضاع الصوت الجاهزة (Presets Chips) */}
              <div className="flex flex-wrap items-center gap-1.5 max-w-[480px]">
                {presetKeys.map((key) => {
                  const p = EQ_PRESETS[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPreset(key)}
                      className={`preset-chip ${currentPreset === key ? 'active' : ''}`}
                      title={isRtl ? p.nameAr : p.nameEn}
                    >
                      {isRtl ? (p.shortAr || p.nameAr.split(' ')[0]) : p.nameEn}
                    </button>
                  );
                })}
              </div>

              {/* أزرار الخدمات السريعة (تصفير + مؤثرات) */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn"
                  style={{ padding: '8px 12px' }}
                  onClick={reset}
                  title={isRtl ? 'تصفير المعادل' : 'Reset Equalizer'}
                >
                  <RotateCcw size={15} />
                </button>
                <button
                  type="button"
                  className={`btn ${showFxDrawer ? 'active' : ''}`}
                  style={{ padding: '8px 12px' }}
                  onClick={() => setShowFxDrawer(!showFxDrawer)}
                  title={isRtl ? 'مؤثرات إضافية (Delay & Echo)' : 'More FX (Delay & Echo)'}
                >
                  <Layers size={15} />
                  <span className="text-xs hidden sm:inline">{isRtl ? 'المؤثرات' : 'FX'}</span>
                </button>
              </div>
            </div>

            {/* شرائح التحكم (10 منزلقات ترددية 31Hz .. 16kHz) */}
            <StudioEqSliders
              bands={bands}
              onBandChange={setBandGain}
              disabled={!enabled}
              isRtl={isRtl}
            />
          </div>

          {/* ─── درج المؤثرات الصوتية الإضافية (Studio FX Drawer) ─── */}
          {showFxDrawer && (
            <div className="col-span-1 md:col-span-2 pt-4 border-t border-white/10 animate-fadeIn">
              <AudioFxRack isRtl={isRtl} enabled={enabled} isDark={true} />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return portalTarget ? createPortal(content, portalTarget) : content;
}
