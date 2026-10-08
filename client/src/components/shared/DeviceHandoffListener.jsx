/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ARN Stream - Device Handoff & Real-Time Listener
 * مستمع الأحداث الفورية لنقل المشاهدة والتحكم عن بُعد (WebSocket & SSE Dual Channel)
 * 
 * تطوير وبرمجة: عبده رجب نصار (ARN Technology)
 * حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeviceHandoffStore } from '../../store/useDeviceHandoffStore';
import { usePlayerStore } from '../../store/usePlayerStore';
import { useAuthStore } from '../../store/useAuthStore';
import { Tv, Sparkles, X, Keyboard } from 'lucide-react';

export default function DeviceHandoffListener() {
  const navigate = useNavigate();
  const deviceId = useDeviceHandoffStore(s => s.deviceId);
  const registerDevice = useDeviceHandoffStore(s => s.registerDevice);
  const syncUser = useDeviceHandoffStore(s => s.syncUser);
  const initWebSocket = useDeviceHandoffStore(s => s.initWebSocket);
  const disconnectWebSocket = useDeviceHandoffStore(s => s.disconnectWebSocket);
  const user = useAuthStore(state => state.user);
  const playTrack = usePlayerStore(s => s.playTrack);
  const [toast, setToast] = useState(null);

  // Sync device name & registration when user logs in/out
  useEffect(() => {
    syncUser(user);
  }, [user, syncUser]);

  // Handle incoming media handoff
  const processIncomingHandoff = useCallback((data) => {
    const { fromDeviceName, media } = data;
    if (!media) return;

    // Show Toast notification
    setToast({
      title: 'تم استلام البث',
      desc: `من "${fromDeviceName}": ${media.title || 'مقطع وسائط'}`
    });

    setTimeout(() => setToast(null), 6000);

    // Video Handoff
    if (media.type === 'movie' || media.type === 'episode') {
      const timeParam = Math.floor(media.currentTime || media.position || 0);
      navigate(`/watch/${media.type}/${media.id}?t=${timeParam}&autoPlay=true&remoteFrom=${data.fromDeviceId || ''}`);
    } else if (media.type === 'track') {
      // Music Handoff
      const trackToPlay = media.track || {
        id: media.id,
        title: media.title,
        duration: media.duration,
        cover: media.poster
      };
      playTrack(trackToPlay);
    }
  }, [navigate, playTrack]);

  // Handle incoming remote commands
  const processRemoteCommand = useCallback((data) => {
    if (!data) return;
    const { command, value } = data;

    if (command === 'navigate') {
      const targetPath = typeof value === 'string' ? value : value?.path;
      if (targetPath) navigate(targetPath);
    } else if (command === 'display_content') {
      const { type, id } = value || {};
      if (type === 'movie') {
        navigate(`/movies?highlight=${id}`);
      } else if (type === 'series') {
        navigate(`/series?highlight=${id}`);
      } else if (type === 'track') {
        navigate(`/music?highlight=${id}`);
      }
    } else if (command === 'send_string') {
      const text = typeof value === 'string' ? value : value?.text || '';
      window.dispatchEvent(new CustomEvent('arn-virtual-keyboard-input', { detail: { text } }));
      
      // Auto-focus any active search input and set value
      const searchInput = document.querySelector('input[type="search"], input[placeholder*="بحث"], input[placeholder*="Search"]');
      if (searchInput) {
        searchInput.value = text;
        searchInput.focus();
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // Forward to media players
    window.dispatchEvent(new CustomEvent('arn-remote-command', { detail: data }));
  }, [navigate]);

  useEffect(() => {
    // 1. Initial registration
    registerDevice();

    // 2. Initialize ultra-fast WebSocket channel
    initWebSocket();

    // 3. Heartbeat interval every 30s
    const heartbeatId = setInterval(() => {
      registerDevice();
    }, 30000);

    // 4. Listen to WebSocket custom events
    const handleWsHandoff = (e) => processIncomingHandoff(e.detail);
    const handleWsLibraryUpdate = (e) => {
      const data = e.detail;
      setToast({
        title: 'تحديث المكتبة',
        desc: data.message + ` (${data.count || 0} عناصر جديدة)`,
        type: 'scan'
      });
      setTimeout(() => setToast(null), 8000);
    };

    window.addEventListener('arn-handoff-received', handleWsHandoff);
    window.addEventListener('arn-library-updated', handleWsLibraryUpdate);

    // 5. Connect Server-Sent Events (SSE) as redundant fallback
    let eventSource = null;
    try {
      eventSource = new EventSource(`/api/handoff/events?deviceId=${encodeURIComponent(deviceId)}`);

      eventSource.addEventListener('handoff', (e) => {
        try {
          const data = JSON.parse(e.data);
          processIncomingHandoff(data);
        } catch (err) {}
      });

      eventSource.addEventListener('remote_state', (e) => {
        try {
          const data = JSON.parse(e.data);
          useDeviceHandoffStore.getState().setRemotePlaybackState?.(data);
        } catch (err) {}
      });

      eventSource.addEventListener('remote_command', (e) => {
        try {
          const data = JSON.parse(e.data);
          processRemoteCommand(data);
        } catch (err) {}
      });

      eventSource.addEventListener('library_updated', (e) => {
        try {
          const data = JSON.parse(e.data);
          setToast({
            title: 'تحديث المكتبة',
            desc: data.message + ` (${data.count} عناصر جديدة)`,
            type: 'scan'
          });
          setTimeout(() => setToast(null), 8000);
        } catch (err) {}
      });
    } catch (err) {
      console.warn('EventSource initialization notice:', err.message);
    }

    // Cleanup on unmount
    return () => {
      clearInterval(heartbeatId);
      window.removeEventListener('arn-handoff-received', handleWsHandoff);
      window.removeEventListener('arn-library-updated', handleWsLibraryUpdate);
      if (eventSource) {
        eventSource.close();
      }
      disconnectWebSocket();
    };
  }, [deviceId, registerDevice, initWebSocket, disconnectWebSocket, processIncomingHandoff, processRemoteCommand]);

  if (!toast) return null;

  const isScan = toast.type === 'scan';

  return (
    <div className="fixed top-5 end-5 z-[100] max-w-sm w-full animate-slideInRight">
      <div className={`flex items-center gap-3.5 p-4 rounded-2xl bg-[#0f172a]/95 text-white border shadow-2xl backdrop-blur-xl ${isScan ? 'border-amber-500/40' : 'border-emerald-500/40'}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-sm ${isScan ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
          {isScan ? <Sparkles size={20} /> : <Tv size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`flex items-center gap-1.5 text-xs font-bold ${isScan ? 'text-amber-400' : 'text-emerald-400'}`}>
            <Sparkles size={12} />
            <span>{toast.title}</span>
          </div>
          <div className="text-xs text-slate-200 truncate mt-0.5 font-medium">
            {toast.desc}
          </div>
        </div>
        <button
          onClick={() => setToast(null)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
