import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const EQ_BANDS = [
  { id: '60', label: '60Hz', desc: 'Sub-Bass', freq: 60, type: 'lowshelf' },
  { id: '170', label: '170Hz', desc: 'Bass', freq: 170, type: 'peaking' },
  { id: '350', label: '350Hz', desc: 'Low-Mid', freq: 350, type: 'peaking' },
  { id: '1000', label: '1kHz', desc: 'Mid', freq: 1000, type: 'peaking' },
  { id: '3000', label: '3kHz', desc: 'High-Mid', freq: 3000, type: 'peaking' },
  { id: '6000', label: '6kHz', desc: 'Treble', freq: 6000, type: 'peaking' },
  { id: '12000', label: '12kHz', desc: 'Air', freq: 12000, type: 'highshelf' },
];

export const EQ_PRESETS = {
  flat: {
    id: 'flat',
    nameAr: 'عادي (Flat)',
    nameEn: 'Flat',
    gains: [0, 0, 0, 0, 0, 0, 0],
    preamp: 0
  },
  bassBoost: {
    id: 'bassBoost',
    nameAr: 'مضخم البيز (Bass Boost)',
    nameEn: 'Bass Boost',
    gains: [7, 5, 2, 0, 0, 0, 0],
    preamp: -2
  },
  bassReducer: {
    id: 'bassReducer',
    nameAr: 'تخفيف البيز (Bass Reducer)',
    nameEn: 'Bass Reducer',
    gains: [-6, -4, -2, 0, 0, 0, 0],
    preamp: 0
  },
  vocal: {
    id: 'vocal',
    nameAr: 'وضوح الصوت (Vocal Boost)',
    nameEn: 'Vocal Boost',
    gains: [-2, -1, 2, 5, 4, 2, 0],
    preamp: 0
  },
  pop: {
    id: 'pop',
    nameAr: 'بوب (Pop)',
    nameEn: 'Pop',
    gains: [-1, 2, 4, 3, 1, -1, 1],
    preamp: 0
  },
  rock: {
    id: 'rock',
    nameAr: 'روك (Rock)',
    nameEn: 'Rock',
    gains: [5, 4, -1, -2, 1, 3, 5],
    preamp: -1
  },
  electronic: {
    id: 'electronic',
    nameAr: 'إلكتروني (Electronic)',
    nameEn: 'Electronic',
    gains: [6, 4, 1, -1, 2, 4, 5],
    preamp: -2
  },
  classical: {
    id: 'classical',
    nameAr: 'كلاسيكي (Classical)',
    nameEn: 'Classical',
    gains: [4, 3, 2, 1, -1, 2, 4],
    preamp: 0
  },
  acoustic: {
    id: 'acoustic',
    nameAr: 'صوت هادئ (Acoustic)',
    nameEn: 'Acoustic',
    gains: [3, 2, 1, 2, 2, 3, 3],
    preamp: 0
  },
  trebleBoost: {
    id: 'trebleBoost',
    nameAr: 'تريبل حاد (Treble Boost)',
    nameEn: 'Treble Boost',
    gains: [0, 0, 0, 0, 2, 5, 7],
    preamp: -1
  },
  custom: {
    id: 'custom',
    nameAr: 'مخصص (Custom)',
    nameEn: 'Custom',
    gains: [0, 0, 0, 0, 0, 0, 0],
    preamp: 0
  }
};

export const useEqualizerStore = create(
  persist(
    (set, get) => ({
      enabled: true,
      currentPreset: 'flat',
      bands: [0, 0, 0, 0, 0, 0, 0],
      preamp: 0,

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

      setBandGain: (index, gain) => {
        const { bands } = get();
        const clampedGain = Math.max(-12, Math.min(12, Math.round(gain * 10) / 10));
        const newBands = [...bands];
        newBands[index] = clampedGain;

        // Check if matches any preset exactly
        let matchedPreset = 'custom';
        for (const [key, preset] of Object.entries(EQ_PRESETS)) {
          if (key === 'custom') continue;
          if (preset.gains.every((g, i) => g === newBands[i])) {
            matchedPreset = key;
            break;
          }
        }

        set({ bands: newBands, currentPreset: matchedPreset });
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
          bands: [0, 0, 0, 0, 0, 0, 0],
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
    }
  )
);
