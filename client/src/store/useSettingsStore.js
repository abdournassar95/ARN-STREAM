import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set) => ({
      // Display Settings
      theme: 'dark', // dark, light, system
      enableBlur: true,
      defaultLibraryView: 'grid', // grid, list, compact, wide
      cardMinSize: 180, // min card width in pixels (130px - 320px)
      
      // Library view & sort preferences per library id (e.g. { '1': { displayMode: 'grid', sort: 'year', order: 'desc' } })
      libraryPreferences: {},
      libraryGlobalSort: 'added_at',
      libraryGlobalOrder: 'desc',

      // Music Albums Preferences
      albumsSortKey: 'year', // 'year' | 'name' | 'added_at'
      albumsSortOrder: 'desc', // 'asc' | 'desc'
      albumsViewMode: 'grid', // 'grid' | 'list'

      // Music Artists Preferences
      artistsSortKey: 'name', // 'name' | 'year' | 'albums'
      artistsSortOrder: 'asc', // 'asc' | 'desc'
      artistsViewMode: 'grid', // 'grid' | 'list'

      // Artist Detail Albums Sort Preferences
      artistDetailSortKey: 'year', // 'year' | 'name'
      artistDetailSortOrder: 'desc', // 'asc' | 'desc'

      // Volume & Audio Settings (Persists across video, audio, page reload, and server restarts)
      globalVolume: 0.8,
      globalMuted: false,

      // Playback Settings
      autoPlayNext: true,
      skipTime: 10, // 10, 15, 30
      upNextTime: 30, // 10, 15, 30 (30 = roadmap default)

      // Live TV / Drama Live Settings
      liveTvUrl: 'https://web.dramalive.cc',
      liveTvCovers: null,

      // Layout Settings
      homeSectionsOrder: [
        { id: 'continueWatching', enabled: true },
        { id: 'continueListening', enabled: true },
        { id: 'recentlyAdded', enabled: true },
        { id: 'latestAudio', enabled: true },
        { id: 'latestMovies', enabled: true },
        { id: 'latestSeries', enabled: true },
        { id: 'collections', enabled: true }
      ],
      homeLibrariesOrder: [], // array of ids e.g. ['1', '2', 'live_tv', ...]
      homeLibraryCardSize: 'medium', // 'small' | 'medium' | 'large'

      // Actions
      setTheme: (theme) => set({ theme }),
      setEnableBlur: (enableBlur) => set({ enableBlur }),
      setDefaultLibraryView: (view) => set({ defaultLibraryView: view }),
      setCardMinSize: (size) => set({ cardMinSize: Math.max(120, Math.min(340, Number(size) || 180)) }),

      // Library preferences actions
      setLibraryPreferences: (libId, prefs) => set((state) => {
        const current = state.libraryPreferences?.[libId] || {};
        const updated = { ...current, ...prefs };
        return {
          libraryPreferences: {
            ...(state.libraryPreferences || {}),
            [libId]: updated
          },
          ...(prefs.displayMode ? { defaultLibraryView: prefs.displayMode } : {}),
          ...(prefs.sort ? { libraryGlobalSort: prefs.sort } : {}),
          ...(prefs.order ? { libraryGlobalOrder: prefs.order } : {})
        };
      }),

      // Music Albums actions
      setAlbumsSort: (sortKey, sortOrder) => set({ albumsSortKey: sortKey, albumsSortOrder: sortOrder }),
      setAlbumsViewMode: (viewMode) => set({ albumsViewMode: viewMode }),

      // Music Artists actions
      setArtistsSort: (sortKey, sortOrder) => set({ artistsSortKey: sortKey, artistsSortOrder: sortOrder }),
      setArtistsViewMode: (viewMode) => set({ artistsViewMode: viewMode }),

      // Artist Detail actions
      setArtistDetailSort: (sortKey, sortOrder) => set({ artistDetailSortKey: sortKey, artistDetailSortOrder: sortOrder }),

      setGlobalVolume: (vol) => set({ globalVolume: Math.max(0, Math.min(1, vol)) }),
      setGlobalMuted: (muted) => set({ globalMuted: !!muted }),
      setAutoPlayNext: (auto) => set({ autoPlayNext: auto }),
      setSkipTime: (time) => set({ skipTime: time }),
      setUpNextTime: (time) => set({ upNextTime: time }),
      setHomeSectionsOrder: (order) => set({ homeSectionsOrder: order }),
      setLiveTvUrl: (url) => set({ liveTvUrl: url || 'https://web.dramalive.cc' }),
      setLiveTvCovers: (covers) => set({ liveTvCovers: covers }),
      resetLiveTvCovers: () => set({ liveTvCovers: null }),
      setHomeLibrariesOrder: (order) => set({ homeLibrariesOrder: order }),
      setHomeLibraryCardSize: (size) => set({ homeLibraryCardSize: size }),
      resetHomeLibrariesOrder: () => set({ homeLibrariesOrder: [] }),
    }),
    {
      name: 'personal-stream-settings', // unique name
    }
  )
);
