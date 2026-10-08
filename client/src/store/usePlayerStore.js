import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const usePlayerStore = create(
  persist(
    (set, get) => ({
      // Video
      videoQueue: [],
      currentVideo: null,
      // Music
      musicQueue: [],
      currentTrack: null,
      currentIndex: -1,
      isPlaying: false,
      volume: 0.8,
      shuffle: false,
      repeat: 'off', // off | one | all
      crossfade: false,
      crossfadeDuration: 3,
      toggleCrossfade: () => set(s => ({ crossfade: !s.crossfade })),
      setCrossfadeDuration: (d) => set({ crossfadeDuration: d }),

      playTrack: (track, queue = null) => {
        if (!track) return;
        if (queue && queue.length > 0) {
          const idx = queue.findIndex(t => t.id === track.id);
          set({
            currentTrack: track,
            musicQueue: queue,
            currentIndex: idx >= 0 ? idx : 0,
            isPlaying: true
          });
        } else {
          // If playing a single track not in queue, add it to queue
          const { musicQueue } = get();
          const existingIdx = musicQueue.findIndex(t => t.id === track.id);
          if (existingIdx >= 0) {
            set({ currentTrack: track, currentIndex: existingIdx, isPlaying: true });
          } else {
            set({
              currentTrack: track,
              musicQueue: [...musicQueue, track],
              currentIndex: musicQueue.length,
              isPlaying: true
            });
          }
        }
        if (get().currentVideo) set({ currentVideo: null });
      },

      setQueue: (queue, startIndex = 0) => {
        if (!queue || queue.length === 0) {
          set({ musicQueue: [], currentIndex: -1, currentTrack: null, isPlaying: false });
          return;
        }
        set({
          musicQueue: queue,
          currentIndex: startIndex,
          currentTrack: queue[startIndex] || null,
          isPlaying: true
        });
      },

      // Queue management
      addToQueue: (track) => {
        const { musicQueue } = get();
        // Avoid duplicates in queue
        if (musicQueue.some(t => t.id === track.id)) return;
        set({ musicQueue: [...musicQueue, track] });
      },

      addToQueueNext: (track) => {
        const { musicQueue, currentIndex } = get();
        if (musicQueue.some(t => t.id === track.id)) return;
        const newQueue = [...musicQueue];
        newQueue.splice(currentIndex + 1, 0, track);
        set({ musicQueue: newQueue });
      },

      removeFromQueue: (index) => {
        const { musicQueue, currentIndex, currentTrack } = get();
        if (index < 0 || index >= musicQueue.length) return;
        const newQueue = musicQueue.filter((_, i) => i !== index);
        let newIndex = currentIndex;
        if (index < currentIndex) {
          newIndex = currentIndex - 1;
        } else if (index === currentIndex) {
          // If removing current track, play next
          if (newQueue.length > 0) {
            newIndex = Math.min(currentIndex, newQueue.length - 1);
            set({ musicQueue: newQueue, currentIndex: newIndex, currentTrack: newQueue[newIndex], isPlaying: true });
            return;
          } else {
            set({ musicQueue: [], currentIndex: -1, currentTrack: null, isPlaying: false });
            return;
          }
        }
        set({ musicQueue: newQueue, currentIndex: newIndex });
      },

      moveInQueue: (fromIndex, toIndex) => {
        const { musicQueue, currentIndex } = get();
        if (fromIndex === toIndex) return;
        const newQueue = [...musicQueue];
        const [moved] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, moved);
        
        // Adjust currentIndex based on the move
        let newCurrentIndex = currentIndex;
        if (fromIndex === currentIndex) {
          newCurrentIndex = toIndex;
        } else {
          if (fromIndex < currentIndex && toIndex >= currentIndex) {
            newCurrentIndex = currentIndex - 1;
          } else if (fromIndex > currentIndex && toIndex <= currentIndex) {
            newCurrentIndex = currentIndex + 1;
          }
        }
        set({ musicQueue: newQueue, currentIndex: newCurrentIndex });
      },

      clearQueue: () => set({ musicQueue: [], currentIndex: -1, currentTrack: null, isPlaying: false }),

      nextTrack: () => {
        const { musicQueue, currentIndex, repeat, shuffle } = get();
        if (!musicQueue || !musicQueue.length) return;
        if (shuffle) {
          if (musicQueue.length <= 1) {
            set({ currentIndex: 0, currentTrack: musicQueue[0], isPlaying: true });
            return;
          }
          let rand = currentIndex;
          while (rand === currentIndex) {
            rand = Math.floor(Math.random() * musicQueue.length);
          }
          set({ currentIndex: rand, currentTrack: musicQueue[rand], isPlaying: true });
          return;
        }
        let next = currentIndex + 1;
        if (next >= musicQueue.length) {
          if (repeat === 'all') {
            next = 0;
          } else {
            set({ isPlaying: false });
            return;
          }
        }
        set({ currentIndex: next, currentTrack: musicQueue[next], isPlaying: true });
      },

      prevTrack: () => {
        const { musicQueue, currentIndex, repeat } = get();
        if (!musicQueue || !musicQueue.length) return;
        let prev = currentIndex - 1;
        if (prev < 0) {
          if (repeat === 'all') {
            prev = musicQueue.length - 1;
          } else {
            prev = 0;
          }
        }
        set({ currentIndex: prev, currentTrack: musicQueue[prev], isPlaying: true });
      },

      togglePlay: () => set(s => ({ isPlaying: !s.isPlaying })),
      setPlaying: (v) => set({ isPlaying: v }),
      setVolume: (v) => set({ volume: v }),
      toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
      toggleRepeat: () => set(s => ({ repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off' })),

      // Video player
      videoQueueIndex: -1,
      playVideo: (video) => set({ currentVideo: video, isPlaying: false }),
      setVideoQueue: (queue, startIndex = 0) => set({ 
        videoQueue: Array.isArray(queue) ? queue : [], 
        videoQueueIndex: Math.max(0, Math.min(startIndex, (queue?.length || 1) - 1)) 
      }),
      setVideoQueueIndex: (index) => {
        const { videoQueue } = get();
        if (index >= 0 && index < videoQueue.length) {
          set({ videoQueueIndex: index });
        }
      },
      addVideoToQueue: (videoOrVideos) => {
        const { videoQueue, videoQueueIndex } = get();
        const incoming = Array.isArray(videoOrVideos) ? videoOrVideos : [videoOrVideos];
        if (!incoming.length) return;
        
        // Filter out items already in queue by id and type
        const newItems = incoming.filter(item => 
          item && !videoQueue.some(v => String(v.id) === String(item.id) && (v.type || v.media_type) === (item.type || item.media_type))
        );
        if (!newItems.length) return;

        const updated = [...videoQueue, ...newItems];
        set({ 
          videoQueue: updated,
          videoQueueIndex: videoQueueIndex === -1 ? 0 : videoQueueIndex
        });
      },
      addVideoNext: (video) => {
        if (!video) return;
        const { videoQueue, videoQueueIndex } = get();
        // Remove if already exists so it gets moved to next
        const filtered = videoQueue.filter(v => !(String(v.id) === String(video.id) && (v.type || v.media_type) === (video.type || video.media_type)));
        let insertPos = videoQueueIndex >= 0 ? videoQueueIndex + 1 : 0;
        filtered.splice(insertPos, 0, video);
        set({ videoQueue: filtered });
      },
      removeVideoFromQueue: (index) => {
        const { videoQueue, videoQueueIndex } = get();
        if (index < 0 || index >= videoQueue.length) return;
        const newQueue = videoQueue.filter((_, i) => i !== index);
        let newIndex = videoQueueIndex;
        if (index < videoQueueIndex) {
          newIndex = Math.max(0, videoQueueIndex - 1);
        } else if (index === videoQueueIndex) {
          newIndex = Math.min(videoQueueIndex, Math.max(0, newQueue.length - 1));
        }
        set({
          videoQueue: newQueue,
          videoQueueIndex: newQueue.length === 0 ? -1 : newIndex
        });
      },
      moveInVideoQueue: (fromIndex, toIndex) => {
        const { videoQueue, videoQueueIndex } = get();
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= videoQueue.length || toIndex >= videoQueue.length) return;
        const newQueue = [...videoQueue];
        const [moved] = newQueue.splice(fromIndex, 1);
        newQueue.splice(toIndex, 0, moved);

        let newCurrentIndex = videoQueueIndex;
        if (fromIndex === videoQueueIndex) {
          newCurrentIndex = toIndex;
        } else if (fromIndex < videoQueueIndex && toIndex >= videoQueueIndex) {
          newCurrentIndex = videoQueueIndex - 1;
        } else if (fromIndex > videoQueueIndex && toIndex <= videoQueueIndex) {
          newCurrentIndex = videoQueueIndex + 1;
        }
        set({ videoQueue: newQueue, videoQueueIndex: newCurrentIndex });
      },
      shuffleVideoQueue: () => {
        const { videoQueue, videoQueueIndex } = get();
        if (videoQueue.length <= 1) return;
        // Keep currently playing video at current position, shuffle the rest
        const currentItem = videoQueue[videoQueueIndex];
        const others = videoQueue.filter((_, i) => i !== videoQueueIndex);
        for (let i = others.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [others[i], others[j]] = [others[j], others[i]];
        }
        // Place others after or around current
        const newQueue = currentItem ? [currentItem, ...others] : others;
        set({ videoQueue: newQueue, videoQueueIndex: currentItem ? 0 : 0 });
      },
      getNextVideo: () => {
        const { videoQueue, videoQueueIndex } = get();
        if (!videoQueue.length || videoQueueIndex === -1) return null;
        const nextIdx = videoQueueIndex + 1;
        if (nextIdx < videoQueue.length) return videoQueue[nextIdx];
        return null;
      },
      getPrevVideo: () => {
        const { videoQueue, videoQueueIndex } = get();
        if (!videoQueue.length || videoQueueIndex === -1) return null;
        const prevIdx = videoQueueIndex - 1;
        if (prevIdx >= 0) return videoQueue[prevIdx];
        return null;
      },
      advanceToNextVideo: () => {
        const { videoQueue, videoQueueIndex } = get();
        const nextIdx = videoQueueIndex + 1;
        if (nextIdx < videoQueue.length) set({ videoQueueIndex: nextIdx });
      },
      advanceToPrevVideo: () => {
        const { videoQueue, videoQueueIndex } = get();
        const prevIdx = videoQueueIndex - 1;
        if (prevIdx >= 0) set({ videoQueueIndex: prevIdx });
      },
      clearVideo: () => set({ currentVideo: null, videoQueue: [], videoQueueIndex: -1 }),
      clearVideoQueue: () => set({ videoQueue: [], videoQueueIndex: -1 }),
      stopMusicForVideo: () => set({ isPlaying: false, currentTrack: null }),
    }),
    {
      name: 'personalstream-player-prefs', // localStorage key
      partialize: (state) => ({
        volume: state.volume,
        shuffle: state.shuffle,
        repeat: state.repeat,
        crossfade: state.crossfade,
        crossfadeDuration: state.crossfadeDuration,
        videoQueue: state.videoQueue,
        videoQueueIndex: state.videoQueueIndex,
      }),
    }
  )
);
