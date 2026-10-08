import db from '../db.js';

// In-memory watch party rooms
const rooms = new Map();

export function createRoom(hostUserId, mediaType, mediaId) {
  const roomId = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const host = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(hostUserId);
  rooms.set(roomId, {
    id: roomId,
    hostId: hostUserId,
    hostName: host?.display_name || host?.username || 'Host',
    mediaType,
    mediaId,
    state: 'paused',
    currentTime: 0,
    members: new Map(),
    createdAt: Date.now()
  });
  return rooms.get(roomId);
}

export function joinRoom(roomId, userId, sseRes) {
  const room = rooms.get(roomId);
  if (!room) return null;
  const user = db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(userId);
  room.members.set(userId, {
    userId,
    name: user?.display_name || user?.username || `User ${userId}`,
    sseRes,
    joinedAt: Date.now()
  });
  broadcastToRoom(roomId, 'member_joined', { userId, name: user?.display_name || user?.username });
  return room;
}

export function leaveRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const member = room.members.get(userId);
  room.members.delete(userId);
  broadcastToRoom(roomId, 'member_left', { userId, name: member?.name });
  // Auto-destroy room if empty
  if (room.members.size === 0) {
    rooms.delete(roomId);
  }
}

export function syncState(roomId, userId, { action, currentTime }) {
  const room = rooms.get(roomId);
  if (!room) return;
  // Only host can control playback
  if (userId !== room.hostId) return;
  if (action === 'play') room.state = 'playing';
  if (action === 'pause') room.state = 'paused';
  if (typeof currentTime === 'number') room.currentTime = currentTime;
  broadcastToRoom(roomId, 'sync', { action, currentTime, state: room.state, from: userId });
}

export function broadcastToRoom(roomId, event, data) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const [, member] of room.members) {
    if (member.sseRes && !member.sseRes.writableEnded) {
      try {
        member.sseRes.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      } catch {}
    }
  }
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function listRooms() {
  return Array.from(rooms.values()).map(r => ({
    id: r.id,
    hostName: r.hostName,
    mediaType: r.mediaType,
    mediaId: r.mediaId,
    memberCount: r.members.size,
    state: r.state
  }));
}

// Cleanup stale rooms older than 6 hours
setInterval(() => {
  const now = Date.now();
  for (const [id, room] of rooms) {
    if (now - room.createdAt > 6 * 3600 * 1000) {
      rooms.delete(id);
    }
  }
}, 3600 * 1000);
