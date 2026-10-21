import express from 'express';
import { syncplayManager } from '../services/syncplay-manager.js';

const router = express.Router();

/**
 * Middleware to extract user info from auth header or request
 */
function getUserFromReq(req) {
  if (req.user) {
    return {
      id: req.user.id || req.user.userId,
      username: req.user.username || 'مستخدم ARN',
      avatar: req.user.avatar || null
    };
  }
  return {
    id: 'user-' + Math.random().toString(36).substring(2, 9),
    username: req.body?.username || req.query?.username || 'ضيف ARN',
    avatar: null
  };
}

/**
 * POST /api/syncplay/create
 * Body: { mediaType, mediaId, mediaTitle, initialTime, isPlaying, username }
 */
router.post('/create', (req, res) => {
  try {
    const { mediaType, mediaId, mediaTitle, initialTime = 0, isPlaying = false } = req.body;
    if (!mediaType || !mediaId) {
      return res.status(400).json({ error: 'mediaType and mediaId are required' });
    }

    const hostUser = getUserFromReq(req);
    const room = syncplayManager.createRoom({
      hostUser,
      mediaType,
      mediaId,
      mediaTitle,
      initialTime: Number(initialTime) || 0,
      isPlaying: Boolean(isPlaying)
    });

    res.json({
      success: true,
      roomId: room.id,
      room: syncplayManager.getRoom(room.id)
    });
  } catch (err) {
    console.error('[SyncPlay Create Error]:', err);
    res.status(500).json({ error: 'Failed to create watch party room' });
  }
});

/**
 * GET /api/syncplay/active
 * Returns all currently active watch party rooms on the server
 */
router.get('/active', (req, res) => {
  try {
    const rooms = syncplayManager.getActiveRooms();
    res.json({
      success: true,
      rooms
    });
  } catch (err) {
    console.error('[SyncPlay Active Rooms Error]:', err);
    res.status(500).json({ error: 'Failed to fetch active rooms' });
  }
});

/**
 * GET /api/syncplay/room/:roomId
 */
router.get('/room/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const room = syncplayManager.getRoom(roomId.toUpperCase());
    if (!room) {
      return res.status(404).json({ error: 'الغرفة غير موجودة أو انتهت صلاحيتها' });
    }

    res.json({
      success: true,
      room
    });
  } catch (err) {
    console.error('[SyncPlay Get Room Error]:', err);
    res.status(500).json({ error: 'Failed to get room info' });
  }
});

export default router;
