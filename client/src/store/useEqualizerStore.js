import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const EQ_BANDS = [
  { id: '31', label: '31Hz', shortLabel: '31', desc: 'Sub-Bass', freq: 31, type: 'lowshelf' },
  { id: '62', label: '62Hz', shortLabel: '62', desc: 'Bass', freq: 62, type: 'peaking' },
  { id: '125', label: '125Hz', shortLabel: '125', desc: 'Warmth', freq: 125, type: 'peaking' },
  { id: '250', label: '250Hz', shortLabel: '250', desc: 'Low-Mid', freq: 250, type: 'peaking' },
  { id: '500', label: '500Hz', shortLabel: '500', desc: 'Mid', freq: 500, type: 'peaking' },
  { id: '1000', label: '1kHz', shortLabel: '1k', desc: 'Presence', freq: 1000, type: 'peaking' },
  { id: '2000', label: '2kHz', shortLabel: '2k', desc: 'Upper-Mid', freq: 2000, type: 'peaking' },
  { id: '4000', label: '4kHz', shortLabel: '4k', desc: 'High-Mid', freq: 4000, type: 'peaking' },
  { id: '8000', label: '8kHz', shortLabel: '8k', desc: 'Treble', freq: 8000, type: 'peaking' },
  { id: '16000', label: '16kHz', shortLabel: '16k', desc: 'Air', freq: 16000, type: 'highshelf' },
];

export const EQ_PRESETS = {
  flat: {
    id: 'flat',
    nameAr: 'عادي (Flat)',
    nameEn: 'Flat',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0
  },
  bassBoost: {
    id: 'bassBoost',
    nameAr: 'مضخم البيز (Bass Boost)',
    nameEn: 'Bass Boost',
    gains: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0],
    preamp: -2
  },
  bassReducer: {
    id: 'bassReducer',
    nameAr: 'تخفيف البيز (Bass Reducer)',
    nameEn: 'Bass Reducer',
    gains: [-7, -6, -4, -2, 0, 0, 0, 0, 0, 0],
    preamp: 0
  },
  vocal: {
    id: 'vocal',
    nameAr: 'وضوح الصوت (Vocal Boost)',
    nameEn: 'Vocal Boost',
    gains: [-2, -1, 0, 2, 4, 5, 4, 2, 1, 0],
    preamp: 0
  },
  pop: {
    id: 'pop',
    nameAr: 'بوب (Pop)',
    nameEn: 'Pop',
    gains: [-1, 1, 2, 3, 4, 3, 2, 1, 0, 1],
    preamp: 0
  },
  rock: {
    id: 'rock',
    nameAr: 'روك (Rock)',
    nameEn: 'Rock',
    gains: [5, 4, 3, -1, -2, 0, 2, 4, 5, 5],
    preamp: -1
  },
  electronic: {
    id: 'electronic',
    nameAr: 'إلكتروني (Electronic)',
    nameEn: 'Electronic',
    gains: [6, 5, 4, 1, -1, 1, 2, 4, 5, 5],
    preamp: -2
  },
  classical: {
    id: 'classical',
    nameAr: 'كلاسيكي (Classical)',
    nameEn: 'Classical',
    gains: [4, 3, 3, 2, 1, 0, 1, 2, 3, 4],
    preamp: 0
  },
  acoustic: {
    id: 'acoustic',
    nameAr: 'صوت هادئ (Acoustic)',
    nameEn: 'Acoustic',
    gains: [3, 3, 2, 1, 2, 2, 3, 3, 3, 2],
    preamp: 0
  },
  trebleBoost: {
    id: 'trebleBoost',
    nameAr: 'تريبل حاد (Treble Boost)',
    nameEn: 'Treble Boost',
    gains: [0, 0, 0, 0, 0, 1, 2, 4, 6, 7],
    preamp: -1
  },
  // ── أوضاع مخصصة للفيديو والبث التليفزيوني والراديو ──
  cinema: {
    id: 'cinema',
    nameAr: 'سينما (Cinema)',
    shortAr: 'سينما',
    nameEn: 'Cinema',
    gains: [6, 5, 3, 0, -1, 0, 1, 2, 3, 4],
    preamp: -3
  },
  dialogue: {
    id: 'dialogue',
    nameAr: 'تعزيز الحوار (Dialogue)',
    shortAr: 'الحوار',
    nameEn: 'Dialogue',
    gains: [-4, -3, -2, 0, 2, 5, 6, 4, 1, -1],
    preamp: -2
  },
  night: {
    id: 'night',
    nameAr: 'الوضع الليلي (Night)',
    shortAr: 'ليلي',
    nameEn: 'Night',
    gains: [-6, -5, -3, -1, 1, 3, 3, 1, -2, -4],
    preamp: 0
  },
  radio: {
    id: 'radio',
    nameAr: 'إذاعة وقرآن (Radio & Quran)',
    shortAr: 'إذاعة',
    nameEn: 'Radio',
    gains: [-2, -1, 1, 2, 3, 4, 3, 1, -1, -3],
    preamp: -1
  },
  sports: {
    id: 'sports',
    nameAr: 'رياضة ومباريات (Sports)',
    shortAr: 'رياضة',
    nameEn: 'Sports',
    gains: [3, 2, 1, 0, 1, 3, 4, 3, 2, 2],
    preamp: -2
  },
  custom: {
    id: 'custom',
    nameAr: 'مخصص (Custom)',
    nameEn: 'Custom',
    gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    preamp: 0
  }
};

// مجموعات الأوضاع الجاهزة المعروضة حسب نوع المشغل
export const EQ_PRESET_GROUPS = {
  music: ['flat', 'bassBoost', 'vocal', 'pop', 'rock', 'electronic'],
  video: ['flat', 'cinema', 'dialogue', 'night', 'bassBoost', 'vocal'],
  tv: ['flat', 'dialogue', 'sports', 'cinema', 'night', 'vocal'],
  radio: ['flat', 'radio', 'dialogue', 'vocal', 'bassReducer', 'acoustic'],
};

// تحويل حالة المخزن إلى إعدادات محرك الصوت
export const selectEngineSettings = (state) => ({
  bands: state.bands,
  preamp: state.preamp,
  enabled: state.enabled,
  delay: {
    enabled: state.delayEnabled,
    time: state.delayTime,
    feedback: state.delayFeedback,
    wet: state.delayWet
  },
  echo: {
    enabled: state.echoEnabled,
    time: state.echoTime,
    feedback: state.echoFeedback,
    wet: state.echoWet
  }
});

const DEFAULT_BANDS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export const useEqualizerStore = create(
  persist(
    (set, get) => ({
      enabled: true,
      currentPreset: 'flat',
      bands: [...DEFAULT_BANDS],
      preamp: 0,
      eqTheme: 'theme-default', // theme-default | theme-sunset | theme-forest

      // Delay FX
      delayEnabled: false,
      delayTime: 0.25,      // 250ms
      delayFeedback: 0.35,  // 35% repeats
      delayWet: 0.30,       // 30% mix

      // Echo / Reverb FX
      echoEnabled: false,
      echoTime: 0.18,       // 180ms reflection
      echoFeedback: 0.40,   // 40% decay
      echoWet: 0.25,        // 25% space mix

      toggleEnabled: () => set(s => ({ enabled: !s.enabled })),
      setEnabled: (enabled) => set({ enabled }),
      setEqTheme: (theme) => set({ eqTheme: theme }),

      setBandGain: (index, gain) => {
        const bands = get().bands && get().bands.length === 10 ? [...get().bands] : [...DEFAULT_BANDS];
        const clampedGain = Math.max(-12, Math.min(12, Math.round(gain * 10) / 10));
        bands[index] = clampedGain;

        // Check if matches any preset exactly
        let matchedPreset = 'custom';
        for (const [key, preset] of Object.entries(EQ_PRESETS)) {
          if (key === 'custom') continue;
          if (preset.gains.every((g, i) => g === bands[i])) {
            matchedPreset = key;
            break;
          }
        }

        set({ bands, currentPreset: matchedPreset });
      },

      setBassGain: (percent) => {
        // percent: 0 to 100, where 50 is neutral (0dB)
        const pct = Math.max(0, Math.min(100, percent));
        const delta = (pct - 50) / 50; // -1 to +1
        const bands = get().bands && get().bands.length === 10 ? [...get().bands] : [...DEFAULT_BANDS];
        // Affect bands: 31Hz (idx 0), 62Hz (idx 1), 125Hz (idx 2)
        bands[0] = Math.max(-12, Math.min(12, Math.round(delta * 10 * 10) / 10));
        bands[1] = Math.max(-12, Math.min(12, Math.round(delta * 8 * 10) / 10));
        bands[2] = Math.max(-12, Math.min(12, Math.round(delta * 5 * 10) / 10));
        set({ bands, currentPreset: 'custom' });
      },

      setTrebleGain: (percent) => {
        // percent: 0 to 100, where 50 is neutral (0dB)
        const pct = Math.max(0, Math.min(100, percent));
        const delta = (pct - 50) / 50; // -1 to +1
        const bands = get().bands && get().bands.length === 10 ? [...get().bands] : [...DEFAULT_BANDS];
        // Affect bands: 4kHz (idx 7), 8kHz (idx 8), 16kHz (idx 9)
        bands[7] = Math.max(-12, Math.min(12, Math.round(delta * 5 * 10) / 10));
        bands[8] = Math.max(-12, Math.min(12, Math.round(delta * 8 * 10) / 10));
        bands[9] = Math.max(-12, Math.min(12, Math.round(delta * 10 * 10) / 10));
        set({ bands, currentPreset: 'custom' });
      },

      setPreset: (presetId) => {
        const preset = EQ_PRESETS[presetId];
        if (!preset) return;
        set({
          currentPreset: presetId,
          bands: [...preset.gains],
          preamp: preset.preamp || 0
        });
      },

      setPreamp: (preamp) => {
        const clamped = Math.max(-10, Math.min(10, Math.round(preamp * 10) / 10));
        set({ preamp: clamped });
      },

      // Delay Setters
      toggleDelay: () => set(s => ({ delayEnabled: !s.delayEnabled })),
      setDelayEnabled: (v) => set({ delayEnabled: !!v }),
      setDelayTime: (t) => set({ delayTime: Math.max(0.05, Math.min(1.0, Math.round(t * 100) / 100)) }),
      setDelayFeedback: (f) => set({ delayFeedback: Math.max(0, Math.min(0.85, Math.round(f * 100) / 100)) }),
      setDelayWet: (w) => set({ delayWet: Math.max(0, Math.min(0.7, Math.round(w * 100) / 100)) }),

      // Echo Setters
      toggleEcho: () => set(s => ({ echoEnabled: !s.echoEnabled })),
      setEchoEnabled: (v) => set({ echoEnabled: !!v }),
      setEchoTime: (t) => set({ echoTime: Math.max(0.08, Math.min(0.6, Math.round(t * 100) / 100)) }),
      setEchoFeedback: (f) => set({ echoFeedback: Math.max(0, Math.min(0.75, Math.round(f * 100) / 100)) }),
      setEchoWet: (w) => set({ echoWet: Math.max(0, Math.min(0.7, Math.round(w * 100) / 100)) }),

      reset: () => {
        set({
          currentPreset: 'flat',
          bands: [...DEFAULT_BANDS],
          preamp: 0,
          delayEnabled: false,
          delayTime: 0.25,
          delayFeedback: 0.35,
          delayWet: 0.30,
          echoEnabled: false,
          echoTime: 0.18,
          echoFeedback: 0.40,
          echoWet: 0.25
        });
      }
    }),
    {
      name: 'arn-stream-equalizer-settings',
      migrate: (persistedState) => {
        if (persistedState) {
          if (!Array.isArray(persistedState.bands) || persistedState.bands.length !== 10) {
            persistedState.bands = [...DEFAULT_BANDS];
          }
          if (!persistedState.eqTheme) {
            persistedState.eqTheme = 'theme-default';
          }
        }
        return persistedState;
      }
    }
  )
);
