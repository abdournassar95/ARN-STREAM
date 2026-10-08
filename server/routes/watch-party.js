import express from 'express';
import { requireAuth } from '../services/auth.js';
import { createRoom, joinRoom, leaveRoom, syncState, getRoom, listRooms } from '../services/watch-party.js';

const router = express.Router();
router.use(requireAuth);

// POST /api/watch-party/create - Create a new watch party room
router.post('/create', (req, res) => {
  const { mediaType, mediaId } = req.body;
  if (!mediaType || !mediaId) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'mediaType and mediaId required' } });
  const room = createRoom(req.user.id, mediaType, mediaId);
  res.json({ data: { roomId: room.id, hostName: room.hostName } });
});

// GET /api/watch-party/rooms - List active rooms
router.get('/rooms', (req, res) => {
  res.json({ data: listRooms() });
});

// GET /api/watch-party/:roomId - Get room info
router.get('/:roomId', (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Room not found' } });
  res.json({
    data: {
      id: room.id,
      hostId: room.hostId,
      hostName: room.hostName,
      mediaType: room.mediaType,
      mediaId: room.mediaId,
      state: room.state,
      currentTime: room.currentTime,
      memberCount: room.members.size,
      members: Array.from(room.members.values()).map(m => ({ userId: m.userId, name: m.name }))
    }
  });
});

// GET /api/watch-party/:roomId/join - Join room via SSE stream
router.get('/:roomId/join', (req, res) => {
  const room = getRoom(req.params.roomId);
  if (!room) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Room not found' } });
  
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(`event: joined\ndata: ${JSON.stringify({ roomId: room.id, state: room.state, currentTime: room.currentTime })}\n\n`);
  
  joinRoom(req.params.roomId, req.user.id, res);
  
  req.on('close', () => {
    leaveRoom(req.params.roomId, req.user.id);
  });
});

// POST /api/watch-party/:roomId/sync - Sync playback state (host only)
router.post('/:roomId/sync', (req, res) => {
  const { action, currentTime } = req.body;
  syncState(req.params.roomId, req.user.id, { action, currentTime });
  res.json({ data: { synced: true } });
});

// POST /api/watch-party/:roomId/leave - Leave room
router.post('/:roomId/leave', (req, res) => {
  leaveRoom(req.params.roomId, req.user.id);
  res.json({ data: { left: true } });
});

export default router;
