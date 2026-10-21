/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ARN Stream - Device Handoff & Remote Control Store
 * متجر زوستاند لإدارة الجلسات اللحظية وشبكة الأجهزة والريموت كنترول الفائق
 * 
 * تطوير وبرمجة: عبده رجب نصار (ARN Technology)
 * حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { create } from 'zustand';
import client from '../api/client';
import { useAuthStore } from './useAuthStore';

// Helper to generate a unique random device ID
function getOrCreateDeviceId() {
  const key = 'arn_ps_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    localStorage.setItem(key, id);
  }
  return id;
}

// Helper to detect device hardware/OS type
export function detectDeviceType() {
  const ua = navigator.userAgent || '';
  if (/smart-?tv|tizen|webos|netcast|appletv|android tv|googletv/i.test(ua)) {
    return 'tv';
  } else if (/ipad|tablet/i.test(ua)) {
    return 'tablet';
  } else if (/mobile|iphone|ipod|android/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

// Generate friendly default device name based on device type and user
export function generateDefaultDeviceName(type, user = null) {
  const isEn = typeof window !== 'undefined' && Boolean(localStorage.getItem('i18nextLng')?.startsWith('en'));
  const userName = user?.display_name || user?.username;
  if (userName) {
    if (isEn) {
      switch (type) {
        case 'tv':
          return `${userName}'s Smart TV`;
        case 'mobile':
          return `${userName}'s Phone`;
        case 'tablet':
          return `${userName}'s Tablet`;
        default:
          return `${userName}'s PC`;
      }
    }
    switch (type) {
      case 'tv':
        return `شاشة ${userName} (Smart TV)`;
      case 'mobile':
        return `هاتف ${userName}`;
      case 'tablet':
        return `تابلت ${userName}`;
      default:
        return `كمبيوتر ${userName}`;
    }
  }

  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (isEn) {
    switch (type) {
      case 'tv':
        return 'Smart TV';
      case 'tablet':
        return 'Tablet';
      case 'mobile':
        return /iphone/i.test(ua) ? 'iPhone' : 'Mobile Phone';
      default:
        if (/macintosh|mac os/i.test(ua)) return 'Mac Computer';
        if (/windows/i.test(ua)) return 'Windows PC';
        return 'Personal Computer (PC)';
    }
  }

  switch (type) {
    case 'tv':
      return 'شاشة ذكية (Smart TV)';
    case 'tablet':
      return 'جهاز لوحي (Tablet)';
    case 'mobile':
      return /iphone/i.test(ua) ? 'هاتف آيفون (iPhone)' : 'هاتف محمول (Mobile)';
    default:
      if (/macintosh|mac os/i.test(ua)) return 'جهاز ماك (Mac)';
      if (/windows/i.test(ua)) return 'كمبيوتر ويندوز (Windows PC)';
      return 'كمبيوتر شخصي (PC)';
  }
}

// WebSocket Connection Reference
let activeWs = null;
let wsPingInterval = null;
let wsReconnectTimer = null;

export const useDeviceHandoffStore = create((set, get) => {
  const deviceId = getOrCreateDeviceId();
  const deviceType = detectDeviceType();
  const isCustomName = localStorage.getItem('arn_ps_device_is_custom') === 'true';
  const savedName = localStorage.getItem('arn_ps_device_name');
  
  const initialUser = useAuthStore.getState?.()?.user || null;
  const initialName = (isCustomName && savedName) ? savedName : generateDefaultDeviceName(deviceType, initialUser);
  let initialRemoteSession = null;
  try {
    const saved = localStorage.getItem('arn_ps_active_remote_session');
    if (saved) initialRemoteSession = JSON.parse(saved);
  } catch (e) {}

  return {
    deviceId,
    deviceName: initialName,
    deviceType,
    isCustomName,
    onlineDevices: [],
    isLoadingDevices: false,
    isWsConnected: false,
    activeRemoteSession: initialRemoteSession, // { targetDeviceId, targetDeviceName, targetDeviceType, isDlna, media }
    remotePlaybackState: null, // { currentTime, duration, isPlaying, volume, isMuted, speed, fit, availableSubtitles, selectedSubtitle, availableAudioTracks, selectedAudioTrack }
    incomingHandoff: null, // latest received handoff payload
    isModalOpen: false,
    isFullRemoteOpen: false,
    currentMediaToCast: null, // { type: 'movie'|'episode'|'track', id, title, poster, currentTime, duration, isPlaying }

    setRemotePlaybackState: (state) => set((s) => ({
      remotePlaybackState: state,
      activeRemoteSession: s.activeRemoteSession && state?.media ? {
        ...s.activeRemoteSession,
        media: state.media
      } : s.activeRemoteSession
    })),
    openFullRemote: () => set({ isFullRemoteOpen: true }),
    closeFullRemote: () => set({ isFullRemoteOpen: false }),
    toggleFullRemote: () => set(s => ({ isFullRemoteOpen: !s.isFullRemoteOpen })),

    // Initialize ultra-fast real-time WebSocket connection (< 5ms response time)
    initWebSocket: () => {
      if (typeof window === 'undefined') return;
      if (activeWs && (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CONNECTING)) {
        return;
      }

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws/handoff?deviceId=${encodeURIComponent(deviceId)}`;

        activeWs = new WebSocket(wsUrl);

        activeWs.onopen = () => {
          set({ isWsConnected: true });
          if (wsPingInterval) clearInterval(wsPingInterval);
          wsPingInterval = setInterval(() => {
            if (activeWs && activeWs.readyState === WebSocket.OPEN) {
              activeWs.send(JSON.stringify({ type: 'ping' }));
            }
          }, 15000);
        };

        activeWs.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            const { event: eventType, data } = parsed;

            if (eventType === 'remote_state') {
              get().setRemotePlaybackState(data);
            } else if (eventType === 'remote_command') {
              window.dispatchEvent(new CustomEvent('arn-remote-command', { detail: data }));
            } else if (eventType === 'handoff') {
              window.dispatchEvent(new CustomEvent('arn-handoff-received', { detail: data }));
            } else if (eventType === 'library_updated') {
              window.dispatchEvent(new CustomEvent('arn-library-updated', { detail: data }));
            } else if (eventType === 'scan_progress') {
              window.dispatchEvent(new CustomEvent('arn-scan-progress', { detail: data }));
            } else if (eventType === 'scan_completed') {
              window.dispatchEvent(new CustomEvent('arn-scan-completed', { detail: data }));
            }
          } catch (err) {
            console.warn('[Handoff-Store] WS parse error:', err.message);
          }
        };

        activeWs.onclose = () => {
          set({ isWsConnected: false });
          if (wsPingInterval) {
            clearInterval(wsPingInterval);
            wsPingInterval = null;
          }
          activeWs = null;
          // Reconnect with 3s backoff
          if (!wsReconnectTimer) {
            wsReconnectTimer = setTimeout(() => {
              wsReconnectTimer = null;
              get().initWebSocket();
            }, 3000);
          }
        };

        activeWs.onerror = () => {
          // Fallback gracefully to SSE handled by DeviceHandoffListener
        };
      } catch (err) {
        console.warn('[Handoff-Store] WS init error:', err.message);
      }
    },

    disconnectWebSocket: () => {
      if (wsReconnectTimer) {
        clearTimeout(wsReconnectTimer);
        wsReconnectTimer = null;
      }
      if (wsPingInterval) {
        clearInterval(wsPingInterval);
        wsPingInterval = null;
      }
      if (activeWs) {
        try {
          activeWs.onclose = null;
          activeWs.onerror = null;
          activeWs.close();
        } catch (e) {}
        activeWs = null;
      }
      set({ isWsConnected: false });
    },

    // Sync device name when user logs in / out / switches
    syncUser: (user) => {
      const { isCustomName, deviceType, deviceName } = get();
      if (!isCustomName) {
        const newDefault = generateDefaultDeviceName(deviceType, user);
        if (newDefault !== deviceName) {
          localStorage.setItem('arn_ps_device_name', newDefault);
          set({ deviceName: newDefault });
        }
      }
      get().registerDevice();
    },

    setDeviceName: (newName, isManual = true) => {
      const trimmed = newName.trim();
      if (!trimmed) return;
      localStorage.setItem('arn_ps_device_name', trimmed);
      if (isManual) {
        localStorage.setItem('arn_ps_device_is_custom', 'true');
        set({ deviceName: trimmed, isCustomName: true });
      } else {
        localStorage.removeItem('arn_ps_device_is_custom');
        set({ deviceName: trimmed, isCustomName: false });
      }
      get().registerDevice();
    },

    resetToUserDeviceName: () => {
      const { deviceType } = get();
      const currentUser = useAuthStore.getState?.()?.user || null;
      const defaultName = generateDefaultDeviceName(deviceType, currentUser);
      localStorage.removeItem('arn_ps_device_is_custom');
      localStorage.setItem('arn_ps_device_name', defaultName);
      set({ deviceName: defaultName, isCustomName: false });
      get().registerDevice();
    },

    setDeviceType: (newType) => {
      set({ deviceType: newType });
      const { isCustomName } = get();
      if (!isCustomName) {
        const currentUser = useAuthStore.getState?.()?.user || null;
        const newName = generateDefaultDeviceName(newType, currentUser);
        localStorage.setItem('arn_ps_device_name', newName);
        set({ deviceName: newName });
      }
      get().registerDevice();
    },

    openCastModal: (media) => {
      set({ isModalOpen: true, currentMediaToCast: media });
      get().fetchDevices();
    },

    closeCastModal: () => {
      set({ isModalOpen: false, currentMediaToCast: null });
    },

    clearIncomingHandoff: () => {
      set({ incomingHandoff: null });
    },

    // Register heartbeat
    registerDevice: async (currentMedia = null) => {
      const { deviceId, deviceName, deviceType } = get();
      const user = useAuthStore.getState?.()?.user || null;
      try {
        await client.post('/handoff/register', {
          deviceId,
          name: deviceName,
          type: deviceType,
          userId: user?.id || 'guest',
          userName: user?.username || null,
          userDisplayName: user?.display_name || user?.username || null,
          currentMedia
        });
      } catch (err) {
        // silent fail on registration error
      }
    },

    // Fetch active devices from server (includes active apps and DLNA smart TVs)
    fetchDevices: async () => {
      const { deviceId } = get();
      set({ isLoadingDevices: true });
      try {
        const res = await client.get('/handoff/devices', {
          params: { currentDeviceId: deviceId }
        });
        const devices = res.data?.data || [];
        set({ onlineDevices: devices, isLoadingDevices: false });
      } catch (err) {
        set({ isLoadingDevices: false });
      }
    },

    // Transfer media to target device
    transferMedia: async (targetDeviceId, targetDeviceName, media, pauseLocal = true, isDlna = false) => {
      const { deviceId, deviceName } = get();
      try {
        await client.post('/handoff/transfer', {
          targetDeviceId,
          fromDeviceId: deviceId,
          fromDeviceName: deviceName,
          media
        });

        // Set active remote control session with optimistic initial state
        const session = {
          targetDeviceId,
          targetDeviceName,
          isDlna: Boolean(isDlna),
          media
        };
        try {
          localStorage.setItem('arn_ps_active_remote_session', JSON.stringify(session));
        } catch (e) {}

        set({
          activeRemoteSession: session,
          remotePlaybackState: {
            currentTime: media.currentTime || 0,
            duration: media.duration || 0,
            isPlaying: media.isPlaying !== false,
            volume: 1,
            isMuted: false
          },
          isModalOpen: false
        });

        if (pauseLocal) {
          window.dispatchEvent(new CustomEvent('arn-pause-local-playback'));
        }

        return true;
      } catch (err) {
        console.error('Failed to transfer media:', err);
        return false;
      }
    },

    // Connect to a device directly in remote control mode
    connectToDevice: (targetDevice) => {
      const session = {
        targetDeviceId: targetDevice.id,
        targetDeviceName: targetDevice.name,
        targetDeviceType: targetDevice.type,
        isDlna: Boolean(targetDevice.isDlna),
        media: targetDevice.currentMedia || null
      };
      try {
        localStorage.setItem('arn_ps_active_remote_session', JSON.stringify(session));
      } catch (e) {}

      set({
        activeRemoteSession: session,
        remotePlaybackState: targetDevice.currentPlaybackState || null,
        isFullRemoteOpen: true
      });
      get().fetchTargetState(targetDevice.id);
    },

    // Fetch live playback state from server for a specific device
    fetchTargetState: async (targetDeviceId) => {
      try {
        const res = await client.get(`/handoff/state/${targetDeviceId}`);
        if (res.data?.data) {
          const { currentMedia, playbackState } = res.data.data;
          if (playbackState) {
            set((s) => ({
              remotePlaybackState: playbackState,
              activeRemoteSession: s.activeRemoteSession ? {
                ...s.activeRemoteSession,
                media: currentMedia || playbackState.media || s.activeRemoteSession.media
              } : s.activeRemoteSession
            }));
          }
        }
      } catch (err) {}
    },

    // Play any media item on the connected target device
    playMediaOnTarget: async (media) => {
      const { activeRemoteSession, transferMedia } = get();
      if (!activeRemoteSession?.targetDeviceId) return false;
      return await transferMedia(
        activeRemoteSession.targetDeviceId,
        activeRemoteSession.targetDeviceName,
        media,
        true,
        activeRemoteSession.isDlna
      );
    },

    // Navigate remote device to a specific route
    navigateTarget: async (path) => {
      const { sendRemoteCommand } = get();
      await sendRemoteCommand('navigate', { path });
    },

    // Display content card on remote device screen without interrupting playback
    displayContent: async (type, id) => {
      const { sendRemoteCommand } = get();
      await sendRemoteCommand('display_content', { type, id });
    },

    // Virtual Keyboard: send string from phone to remote screen search/input
    sendString: async (text) => {
      const { sendRemoteCommand } = get();
      await sendRemoteCommand('send_string', text);
    },

    // Set Subtitle track on remote screen
    setSubtitleTrack: async (track) => {
      const { sendRemoteCommand } = get();
      await sendRemoteCommand('set_subtitle_track', track);
    },

    // Set Audio track / dubbing language on remote screen
    setAudioTrack: async (track) => {
      const { sendRemoteCommand } = get();
      await sendRemoteCommand('set_audio_track', track);
    },

    // Send remote command via ultra-fast WebSocket (< 5ms) with HTTP POST fallback
    sendRemoteCommand: async (command, value = null) => {
      const { deviceId, activeRemoteSession } = get();
      if (!activeRemoteSession?.targetDeviceId) return;

      const payload = {
        targetDeviceId: activeRemoteSession.targetDeviceId,
        fromDeviceId: deviceId,
        command,
        value
      };

      // 1. Try WebSocket first for instantaneous delivery (< 5ms)
      let sentViaWs = false;
      if (activeWs && activeWs.readyState === WebSocket.OPEN) {
        try {
          activeWs.send(JSON.stringify({
            type: 'command',
            action: 'command',
            data: payload
          }));
          sentViaWs = true;
        } catch {}
      }

      // 2. Also send via HTTP POST if WS was unavailable or target is DLNA
      if (!sentViaWs || activeRemoteSession.isDlna) {
        try {
          await client.post('/handoff/command', payload);
        } catch (err) {
          console.warn('Failed to send remote command:', err);
        }
      }
    },

    // Pull playback back to this local device
    pullPlaybackToLocalDevice: () => {
      const { activeRemoteSession, remotePlaybackState, stopRemoteSession } = get();
      if (!activeRemoteSession) return null;
      const media = activeRemoteSession.media;
      const currentTime = remotePlaybackState?.currentTime ?? media?.currentTime ?? 0;
      // Stop target playback remotely
      stopRemoteSession(true);
      set({ isFullRemoteOpen: false });
      return { media, currentTime };
    },

    // Stop remote control session
    stopRemoteSession: (stopTargetPlayback = false) => {
      if (stopTargetPlayback) {
        get().sendRemoteCommand('stop');
      }
      try {
        localStorage.removeItem('arn_ps_active_remote_session');
      } catch (e) {}
      set({ activeRemoteSession: null, isFullRemoteOpen: false });
    }
  };
});
