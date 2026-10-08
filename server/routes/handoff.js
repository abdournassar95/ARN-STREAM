/**
 * ══════════════════════════════════════════════════════════════════════════════
 * ARN Stream - PlayTo & Remote Control API Routes
 * مسارات التحكم الكامل والبث الفوري عبر الأجهزة المتصلة والشاشات الذكية (DLNA)
 * 
 * تطوير وبرمجة: عبده رجب نصار (ARN Technology)
 * حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.
 * ══════════════════════════════════════════════════════════════════════════════
 */

import express from 'express';
import { optionalAuth, requireAuth } from '../services/auth.js';
import sessionManager from '../services/session-manager.js';
import dlnaController from '../services/dlna-controller.js';
import { getLocalIpAddress } from '../services/dlna.js';

const router = express.Router();
router.use(optionalAuth);

export function broadcastToAll(eventType, data) {
  sessionManager.broadcast(eventType, data);
}

// POST /api/handoff/register
router.post('/register', (req, res) => {
  const { deviceId, name, type, userName, userDisplayName, currentMedia, currentPlaybackState } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: { code: 'INVALID_DEVICE', message: 'deviceId is required' } });
  }

  const userId = req.user?.id || req.body.userId || 'guest';
  const resolvedUserName = req.user?.username || userName || null;
  const resolvedDisplayName = req.user?.display_name || userDisplayName || resolvedUserName || null;

  const session = sessionManager.registerSession({
    deviceId,
    name,
    type,
    userId,
    userName: resolvedUserName,
    userDisplayName: resolvedDisplayName,
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    currentMedia,
    currentPlaybackState
  });

  res.json({ success: true, data: { deviceId: session.id, capabilities: session.capabilities } });
});

// POST /api/handoff/unregister
router.post('/unregister', (req, res) => {
  const { deviceId } = req.body;
  if (deviceId) {
    sessionManager.unregisterSession(deviceId);
  }
  res.json({ success: true });
});

// GET /api/handoff/devices
router.get('/devices', (req, res) => {
  // Trigger quick scan for any new DLNA TVs on the home network
  dlnaController.triggerSearch();

  const currentDeviceId = req.query.currentDeviceId;
  const devicesList = sessionManager.getDevicesList(currentDeviceId);

  res.json({ data: devicesList });
});

// GET /api/handoff/events (SSE Endpoint)
router.get('/events', (req, res) => {
  const deviceId = req.query.deviceId;
  if (!deviceId) {
    return res.status(400).json({ error: { message: 'deviceId query param is required' } });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.flushHeaders?.();

  // Attach to sessionManager
  sessionManager.attachSse(deviceId, res, {
    ip: req.ip,
    userAgent: req.headers['user-agent'] || '',
    userId: req.user?.id || 'guest',
    userName: req.user?.username || null
  });

  // Initial keep-alive ping
  res.write(`event: ping\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

  const keepAliveInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    const session = sessionManager.getSession(deviceId);
    if (session && session.sseRes === res) {
      session.sseRes = null;
    }
  });
});

// POST /api/handoff/transfer
router.post('/transfer', requireAuth, async (req, res) => {
  const { targetDeviceId, fromDeviceId, fromDeviceName, media } = req.body;
  if (!targetDeviceId || !media) {
    return res.status(400).json({ error: { message: 'targetDeviceId and media are required' } });
  }

  // Permission check for casting
  if (req.user.role !== 'admin' && (req.user.can_cast === false || req.user.can_cast === 0)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'ليس لديك صلاحية البث للأجهزة الأخرى' } });
  }

  const targetSession = sessionManager.getSession(targetDeviceId);
  if (!targetSession) {
    return res.status(404).json({ error: { code: 'DEVICE_OFFLINE', message: 'الجهاز المستهدف غير متصل حالياً' } });
  }

  // Track controller relationship
  targetSession.controllers = targetSession.controllers || new Set();
  if (fromDeviceId) targetSession.controllers.add(fromDeviceId);

  // 1. Check if target is a standalone DLNA Smart TV (Samsung, LG, Sony, etc.)
  if (targetSession.isDlna) {
    const host = getLocalIpAddress();
    const port = process.env.PORT || 8096;
    const mediaEndpoint = media.type === 'track'
      ? `http://${host}:${port}/api/stream/track/${media.id}`
      : `http://${host}:${port}/api/stream/${media.type || 'movie'}/${media.id}`;

    const startTime = Math.floor(media.currentTime || media.position || 0);
    const dlnaRes = await dlnaController.playToDevice(targetDeviceId, mediaEndpoint, media, startTime);

    return res.json({
      success: dlnaRes.success !== false,
      delivered: dlnaRes.success !== false,
      isDlna: true,
      mediaEndpoint
    });
  }

  // 2. Target is an ARN Stream app client (Desktop, Mobile, Tablet, Browser)
  const delivered = sessionManager.sendToDevice(targetDeviceId, 'handoff', {
    fromDeviceId,
    fromDeviceName: fromDeviceName || 'جهازك الآخر',
    media,
    timestamp: Date.now()
  });

  // Optimistic target state update
  sessionManager.updatePlaybackState(targetDeviceId, {
    currentTime: media.currentTime || 0,
    duration: media.duration || 0,
    isPlaying: true,
    volume: 1,
    isMuted: false,
    speed: 1,
    media: {
      id: media.id,
      title: media.title,
      type: media.type,
      poster: media.poster,
      duration: media.duration
    }
  });

  res.json({ success: true, delivered });
});

// POST /api/handoff/command (Remote Control)
router.post('/command', requireAuth, async (req, res) => {
  const { targetDeviceId, fromDeviceId, command, value } = req.body;
  if (!targetDeviceId || !command) {
    return res.status(400).json({ error: { message: 'targetDeviceId and command are required' } });
  }

  // Permission check for remote control
  if (req.user.role !== 'admin' && (req.user.can_cast === false || req.user.can_cast === 0)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'ليس لديك صلاحية التحكم عن بُعد في الأجهزة' } });
  }

  const targetSession = sessionManager.getSession(targetDeviceId);

  // 1. If target is DLNA Smart TV, execute UPnP SOAP actions
  if (targetSession && targetSession.isDlna) {
    let dlnaSuccess = true;
    switch (command) {
      case 'play':
        dlnaSuccess = await dlnaController.play(targetDeviceId);
        break;
      case 'pause':
        dlnaSuccess = await dlnaController.pause(targetDeviceId);
        break;
      case 'stop':
        dlnaSuccess = await dlnaController.stop(targetDeviceId);
        break;
      case 'seek':
        if (typeof value === 'number') {
          dlnaSuccess = await dlnaController.seek(targetDeviceId, value);
        }
        break;
      case 'seek_delta':
        if (typeof value === 'number') {
          const cur = targetSession.currentPlaybackState?.currentTime || 0;
          dlnaSuccess = await dlnaController.seek(targetDeviceId, Math.max(0, cur + value));
        }
        break;
      case 'volume':
        if (typeof value === 'number') {
          dlnaSuccess = await dlnaController.setVolume(targetDeviceId, value);
        }
        break;
      case 'mute':
        dlnaSuccess = await dlnaController.setMute(targetDeviceId, !!value);
        break;
      default:
        break;
    }

    return res.json({ success: true, delivered: true, isDlna: true });
  }

  // 2. Target is an ARN Stream app client
  const delivered = sessionManager.dispatchRemoteCommand(fromDeviceId, targetDeviceId, command, value);
  res.json({ success: true, delivered });
});

// POST /api/handoff/state (Target device syncs playback state back to controllers)
router.post('/state', (req, res) => {
  const { targetDeviceId, fromDeviceId, deviceId, state } = req.body;
  const reportingDeviceId = fromDeviceId || deviceId;
  if (!state) return res.status(400).json({ error: { message: 'state is required' } });

  // Update in sessionManager (automatically notifies all registered controllers in < 5ms)
  if (reportingDeviceId) {
    sessionManager.updatePlaybackState(reportingDeviceId, state);
  }

  // Also deliver to explicit targetDeviceId if provided
  let delivered = false;
  if (targetDeviceId) {
    delivered = sessionManager.sendToDevice(targetDeviceId, 'remote_state', {
      deviceId: reportingDeviceId,
      ...state,
      timestamp: Date.now()
    });
  }

  res.json({ success: true, delivered });
});

// GET /api/handoff/state/:deviceId (Instant state retrieval)
router.get('/state/:deviceId', (req, res) => {
  const session = sessionManager.getSession(req.params.deviceId);
  if (!session) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Device not found' } });
  }

  res.json({
    data: {
      deviceId: session.id,
      name: session.name,
      type: session.type,
      isDlna: Boolean(session.isDlna),
      currentMedia: session.currentMedia || null,
      playbackState: session.currentPlaybackState || null
    }
  });
});

export default router;
