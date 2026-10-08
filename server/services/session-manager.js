/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ARN Stream - Session & Capabilities Manager
 * نظام إدارة الجلسات وقدرات الأجهزة والاتصال اللحظي الفائق (Dual-channel WebSocket & SSE)
 * 
 * تطوير وبرمجة: عبده رجب نصار (ARN Technology)
 * حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { WebSocket } from 'ws';

export const STANDARD_CAPABILITIES = {
  PlayableMediaTypes: ['video', 'audio'],
  SupportedCommands: [
    'play',
    'pause',
    'seek',
    'seek_delta',
    'volume',
    'mute',
    'speed',
    'aspect',
    'fit',
    'subtitle',
    'set_subtitle_track',
    'audio_track',
    'set_audio_track',
    'display_content',
    'send_string',
    'dpad',
    'next_track',
    'prev_track',
    'stop',
    'restart',
    'transfer'
  ],
  SupportsRemoteControl: true
};

export class SessionManager {
  constructor() {
    /**
     * Map of deviceId -> Session Object
     * Session: {
     *   id: string,
     *   deviceId: string,
     *   name: string,
     *   type: 'tv' | 'mobile' | 'tablet' | 'desktop' | 'dlna_renderer',
     *   isDlna: boolean,
     *   dlnaControlUrl?: string,
     *   userId: string,
     *   userName?: string,
     *   userDisplayName?: string,
     *   ip: string,
     *   userAgent: string,
     *   lastSeen: number,
     *   capabilities: object,
     *   wsClient: WebSocket | null,
     *   sseRes: Response | null,
     *   currentMedia: object | null,
     *   currentPlaybackState: object | null,
     *   controllers: Set<string>
     * }
     */
    this.sessions = new Map();

    // Run cleanup for inactive sessions every 20 seconds
    this.cleanupTimer = setInterval(() => this.cleanupStaleSessions(), 20000);
  }

  /**
   * Register or update an active device session
   */
  registerSession(data) {
    const {
      deviceId,
      name,
      type = 'desktop',
      userId = 'guest',
      userName = null,
      userDisplayName = null,
      ip = '',
      userAgent = '',
      isDlna = false,
      dlnaControlUrl = null,
      currentMedia = null,
      currentPlaybackState = null,
      capabilities = STANDARD_CAPABILITIES
    } = data;

    if (!deviceId) return null;

    const cleanId = String(deviceId).slice(0, 100);
    const existing = this.sessions.get(cleanId);
    const session = {
      id: cleanId,
      deviceId: cleanId,
      name: String(name || existing?.name || (isDlna ? 'شاشة ذكية DLNA' : 'جهاز متصل')).slice(0, 100),
      type: String(type || existing?.type || (isDlna ? 'tv' : 'desktop')).slice(0, 30),
      isDlna: Boolean(isDlna || existing?.isDlna),
      dlnaControlUrl: dlnaControlUrl || existing?.dlnaControlUrl || null,
      userId: String(userId || existing?.userId || 'guest').slice(0, 50),
      userName: userName ? String(userName).slice(0, 60) : (existing?.userName || null),
      userDisplayName: userDisplayName ? String(userDisplayName).slice(0, 60) : (existing?.userDisplayName || null),
      ip: String(ip || existing?.ip || '').slice(0, 60),
      userAgent: String(userAgent || existing?.userAgent || '').slice(0, 300),
      lastSeen: Date.now(),
      capabilities: capabilities || existing?.capabilities || STANDARD_CAPABILITIES,
      wsClient: existing?.wsClient || null,
      sseRes: existing?.sseRes || null,
      currentMedia: currentMedia || existing?.currentMedia || null,
      currentPlaybackState: currentPlaybackState || existing?.currentPlaybackState || null,
      controllers: existing?.controllers || new Set()
    };

    this.sessions.set(cleanId, session);
    return session;
  }

  /**
   * Remove a session
   */
  unregisterSession(deviceId) {
    const session = this.sessions.get(deviceId);
    if (!session) return false;

    if (session.sseRes && !session.sseRes.writableEnded) {
      try { session.sseRes.end(); } catch {}
    }
    if (session.wsClient && session.wsClient.readyState === WebSocket.OPEN) {
      try { session.wsClient.close(); } catch {}
    }

    this.sessions.delete(deviceId);
    return true;
  }

  /**
   * Attach a WebSocket connection to a device session
   */
  attachWebSocket(deviceId, ws, metadata = {}) {
    let session = this.sessions.get(deviceId);
    if (!session) {
      session = this.registerSession({
        deviceId,
        ...metadata
      });
    }

    session.wsClient = ws;
    session.lastSeen = Date.now();

    // Setup WS message handler
    ws.on('message', (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        this.handleIncomingWsMessage(deviceId, payload);
      } catch (err) {
        console.warn(`[WS] Invalid JSON from ${deviceId}:`, err.message);
      }
    });

    ws.on('close', () => {
      if (session.wsClient === ws) {
        session.wsClient = null;
      }
    });

    ws.on('error', (err) => {
      console.warn(`[WS] Socket error for ${deviceId}:`, err.message);
      if (session.wsClient === ws) {
        session.wsClient = null;
      }
    });

    // Send immediate acknowledgment with session capabilities
    this.sendToDevice(deviceId, 'connected', {
      deviceId,
      serverTime: Date.now(),
      capabilities: session.capabilities
    });

    return session;
  }

  /**
   * Attach SSE response to a device session
   */
  attachSse(deviceId, res, metadata = {}) {
    let session = this.sessions.get(deviceId);
    if (!session) {
      session = this.registerSession({
        deviceId,
        ...metadata
      });
    }

    session.sseRes = res;
    session.lastSeen = Date.now();
    return session;
  }

  /**
   * Handle incoming WebSocket messages from client devices
   */
  handleIncomingWsMessage(deviceId, msg) {
    const session = this.sessions.get(deviceId);
    if (session) {
      session.lastSeen = Date.now();
    }

    const { type, action, data } = msg;

    // Heartbeat ping
    if (type === 'ping' || action === 'ping') {
      this.sendToDevice(deviceId, 'pong', { timestamp: Date.now() });
      return;
    }

    // Playback state update
    if (type === 'state' || action === 'state') {
      this.updatePlaybackState(deviceId, data?.state || data);
      return;
    }

    // Remote command routing
    if (type === 'command' || action === 'command') {
      const { targetDeviceId, command, value } = data || {};
      if (targetDeviceId && command) {
        this.dispatchRemoteCommand(deviceId, targetDeviceId, command, value);
      }
    }
  }

  /**
   * Update playback state for a device and broadcast to its controllers immediately (< 5ms)
   */
  updatePlaybackState(deviceId, state) {
    if (!state || typeof state !== 'object') return;
    const session = this.sessions.get(deviceId);
    if (!session) return;

    // Whitelist allowed playback state keys
    const allowedKeys = [
      'currentTime', 'duration', 'isPlaying', 'volume', 'isMuted', 'speed',
      'fit', 'aspectRatio', 'availableSubtitles', 'selectedSubtitle',
      'availableAudioTracks', 'selectedAudioTrack'
    ];
    const sanitizedState = {};
    for (const key of allowedKeys) {
      if (state[key] !== undefined) {
        sanitizedState[key] = state[key];
      }
    }

    session.lastSeen = Date.now();
    session.currentPlaybackState = {
      ...(session.currentPlaybackState || {}),
      ...sanitizedState,
      timestamp: Date.now()
    };

    if (state.media && typeof state.media === 'object') {
      session.currentMedia = {
        id: state.media.id,
        title: String(state.media.title || '').slice(0, 200),
        type: String(state.media.type || 'movie').slice(0, 30),
        poster: state.media.poster || null,
        duration: state.media.duration || 0
      };
    }

    // Broadcast to all active controllers of this device
    if (session.controllers && session.controllers.size > 0) {
      const statePayload = {
        deviceId,
        ...session.currentPlaybackState
      };

      for (const ctrlId of session.controllers) {
        if (ctrlId !== deviceId) {
          this.sendToDevice(ctrlId, 'remote_state', statePayload);
        }
      }
    }
  }

  /**
   * Dispatch remote command from a controller to a target device
   */
  dispatchRemoteCommand(fromDeviceId, targetDeviceId, command, value = null) {
    const targetSession = this.sessions.get(targetDeviceId);
    if (targetSession) {
      targetSession.controllers = targetSession.controllers || new Set();
      if (fromDeviceId) targetSession.controllers.add(fromDeviceId);
    }

    return this.sendToDevice(targetDeviceId, 'remote_command', {
      fromDeviceId,
      command,
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Send message to a specific device using fastest channel (WebSocket first, fallback to SSE)
   */
  sendToDevice(deviceId, eventType, data) {
    const session = this.sessions.get(deviceId);
    if (!session) return false;

    // 1. Prefer WebSocket for ultra-low latency (< 5ms)
    if (session.wsClient && session.wsClient.readyState === WebSocket.OPEN) {
      try {
        session.wsClient.send(JSON.stringify({ event: eventType, data }));
        return true;
      } catch (err) {
        console.warn(`[SessionManager] WS send failed for ${deviceId}:`, err.message);
        session.wsClient = null;
      }
    }

    // 2. Fallback to Server-Sent Events (SSE)
    if (session.sseRes && !session.sseRes.writableEnded) {
      try {
        session.sseRes.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
        return true;
      } catch (err) {
        console.warn(`[SessionManager] SSE send failed for ${deviceId}:`, err.message);
        session.sseRes = null;
      }
    }

    return false;
  }

  /**
   * Broadcast an event to all connected sessions
   */
  broadcast(eventType, data) {
    for (const [id, session] of this.sessions.entries()) {
      this.sendToDevice(id, eventType, data);
    }
  }

  /**
   * Get active session by deviceId
   */
  getSession(deviceId) {
    return this.sessions.get(deviceId) || null;
  }

  /**
   * Get list of active devices formatted for clients
   */
  getDevicesList(currentDeviceId = null) {
    this.cleanupStaleSessions();

    const list = [];
    for (const [id, dev] of this.sessions.entries()) {
      list.push({
        id: dev.id,
        name: dev.name,
        type: dev.type,
        isDlna: Boolean(dev.isDlna),
        userId: dev.userId,
        userName: dev.userName,
        userDisplayName: dev.userDisplayName,
        isCurrent: dev.id === currentDeviceId,
        lastSeen: dev.lastSeen,
        capabilities: dev.capabilities,
        currentMedia: dev.currentMedia || null,
        currentPlaybackState: dev.currentPlaybackState || null
      });
    }
    return list;
  }

  /**
   * Clean up inactive devices (older than 60s for web clients; DLNA renderers checked separately)
   */
  cleanupStaleSessions() {
    const now = Date.now();
    for (const [id, dev] of this.sessions.entries()) {
      // Keep DLNA renderers alive longer (180s) unless refresh removes them
      const maxAge = dev.isDlna ? 180000 : 60000;
      if (now - dev.lastSeen > maxAge) {
        if (dev.sseRes) {
          try { dev.sseRes.end(); } catch {}
        }
        if (dev.wsClient) {
          try { dev.wsClient.close(); } catch {}
        }
        this.sessions.delete(id);
      }
    }
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// Global Singleton Instance
export const sessionManager = new SessionManager();
export default sessionManager;
