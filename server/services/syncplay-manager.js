import crypto from 'crypto';
import { WebSocket } from 'ws';

/**
 * ARN SyncPlay Manager — Ultra-low latency synchronized room watching for ARN Stream
 * Developed by Abdou Ragab Nassar (ARN Technology)
 */
class SyncPlayManager {
  constructor() {
    // Map<roomId, RoomState>
    this.rooms = new Map();
    // Map<ws, { roomId, clientInfo }>
    this.clientMeta = new Map();

    // Periodic room cleanup for stale empty rooms (runs every 60s)
    setInterval(() => this.cleanupRooms(), 60 * 1000);
  }

  generateRoomId() {
    return 'ARN-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  /**
   * Create a new Watch Party room
   */
  createRoom({ hostUser, mediaType, mediaId, mediaTitle, initialTime = 0, isPlaying = false }) {
    let roomId = this.generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = this.generateRoomId();
    }

    const room = {
      id: roomId,
      hostUserId: hostUser.id,
      mediaType,
      mediaId,
      mediaTitle: mediaTitle || 'ARN Stream Video',
      playbackState: {
        currentTime: initialTime,
        isPlaying: Boolean(isPlaying),
        speed: 1.0,
        updatedAt: Date.now()
      },
      clients: new Set(),
      messages: [],
      createdAt: Date.now(),
      lastActivityAt: Date.now()
    };

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Get public details of a room
   */
  getRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: room.id,
      mediaType: room.mediaType,
      mediaId: room.mediaId,
      mediaTitle: room.mediaTitle,
      hostUserId: room.hostUserId,
      playbackState: this.calculateEstimatedState(room),
      memberCount: room.clients.size,
      members: this.getRoomMembers(room)
    };
  }

  /**
   * Get all active rooms on the server
   */
  getActiveRooms() {
    const list = [];
    for (const room of this.rooms.values()) {
      if (room.clients.size > 0 || (Date.now() - (room.lastActivityAt || room.createdAt) < 10 * 60 * 1000)) {
        list.push({
          id: room.id,
          mediaType: room.mediaType,
          mediaId: room.mediaId,
          mediaTitle: room.mediaTitle,
          memberCount: room.clients.size,
          hostUserId: room.hostUserId,
          playbackState: this.calculateEstimatedState(room),
          members: this.getRoomMembers(room),
          createdAt: room.createdAt,
          lastActivityAt: room.lastActivityAt
        });
      }
    }
    return list;
  }


  /**
   * Extrapolates current video position based on elapsed time if playing
   */
  calculateEstimatedState(room) {
    const state = { ...room.playbackState };
    if (state.isPlaying) {
      const elapsedSec = (Date.now() - state.updatedAt) / 1000;
      state.currentTime = state.currentTime + (elapsedSec * state.speed);
    }
    return state;
  }

  /**
   * Attach a WebSocket to a SyncPlay room
   */
  joinRoom(roomId, ws, user) {
    const room = this.rooms.get(roomId);
    if (!room) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Room not found' }));
      ws.close(4004, 'Room not found');
      return false;
    }

    // Generate unique connection identifier per socket instance
    const baseDev = user.deviceId || (user.id ? `user-${user.id}` : 'dev');
    const connectionId = user.connectionId || `${baseDev}_${Math.random().toString(36).substring(2, 8)}`;

    // Register client
    this.clientMeta.set(ws, {
      roomId,
      connectionId,
      user: {
        id: user.id || `anon-${Date.now()}`,
        deviceId: connectionId,
        username: user.username || 'ضيف ARN',
        avatar: user.avatar || null
      },
      joinedAt: Date.now()
    });

    room.clients.add(ws);
    room.lastActivityAt = Date.now();

    // The FIRST connection to join the room is the host!
    if (!room.hostConnectionId) {
      room.hostConnectionId = connectionId;
      room.hostUserId = user.id;
    }

    const isHost = connectionId === room.hostConnectionId;

    // Send initial full room state to the newly joined client
    ws.send(JSON.stringify({
      type: 'INIT_ROOM_STATE',
      roomId: room.id,
      mediaType: room.mediaType,
      mediaId: room.mediaId,
      mediaTitle: room.mediaTitle,
      playbackState: this.calculateEstimatedState(room),
      isHost,
      connectionId,
      hostUserId: room.hostUserId,
      members: this.getRoomMembers(room),
      recentMessages: room.messages.slice(-30)
    }));

    // Broadcast member joined notification to other room members
    this.broadcast(room, {
      type: 'MEMBER_JOINED',
      user: {
        id: connectionId,
        userId: user.id,
        username: user.username,
        avatar: user.avatar,
        isHost
      },
      members: this.getRoomMembers(room)
    }, ws);

    return true;
  }

  /**
   * Leave room and clean up connection
   */
  leaveRoom(ws) {
    const meta = this.clientMeta.get(ws);
    if (!meta) return;

    const { roomId, user, connectionId } = meta;
    this.clientMeta.delete(ws);

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.clients.delete(ws);
    room.lastActivityAt = Date.now();

    // If host left, elect the next connection as host
    if (room.hostConnectionId === connectionId && room.clients.size > 0) {
      const nextWs = room.clients.values().next().value;
      const nextMeta = this.clientMeta.get(nextWs);
      if (nextMeta) {
        room.hostConnectionId = nextMeta.connectionId;
        room.hostUserId = nextMeta.user.id;
        this.broadcast(room, {
          type: 'HOST_CHANGED',
          newHostConnectionId: room.hostConnectionId,
          newHostDeviceId: room.hostConnectionId,
          newHostUserId: room.hostUserId,
          newHostUsername: nextMeta.user.username
        });
      }
    }

    // Broadcast member left
    this.broadcast(room, {
      type: 'MEMBER_LEFT',
      userId: user.id,
      connectionId,
      username: user.username,
      members: this.getRoomMembers(room)
    });
  }

  /**
   * Handle incoming WebSocket messages from room participants
   */
  handleMessage(ws, rawData) {
    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch {
      return;
    }

    const meta = this.clientMeta.get(ws);
    if (!meta) return;

    const room = this.rooms.get(meta.roomId);
    if (!room) return;

    room.lastActivityAt = Date.now();
    const { user, connectionId } = meta;
    const isHost = connectionId === room.hostConnectionId;

    switch (msg.type) {
      case 'PLAY': {
        room.playbackState = {
          currentTime: typeof msg.currentTime === 'number' ? msg.currentTime : room.playbackState.currentTime,
          isPlaying: true,
          speed: msg.speed || 1.0,
          updatedAt: Date.now()
        };
        this.broadcast(room, {
          type: 'SYNC_PLAY',
          currentTime: room.playbackState.currentTime,
          speed: room.playbackState.speed,
          by: user.username
        }, ws);
        break;
      }

      case 'PAUSE': {
        room.playbackState = {
          currentTime: typeof msg.currentTime === 'number' ? msg.currentTime : room.playbackState.currentTime,
          isPlaying: false,
          speed: 1.0,
          updatedAt: Date.now()
        };
        this.broadcast(room, {
          type: 'SYNC_PAUSE',
          currentTime: room.playbackState.currentTime,
          by: user.username
        }, ws);
        break;
      }

      case 'SEEK': {
        room.playbackState = {
          currentTime: msg.currentTime || 0,
          isPlaying: typeof msg.isPlaying === 'boolean' ? msg.isPlaying : room.playbackState.isPlaying,
          speed: msg.speed || 1.0,
          updatedAt: Date.now()
        };
        this.broadcast(room, {
          type: 'SYNC_SEEK',
          currentTime: room.playbackState.currentTime,
          isPlaying: room.playbackState.isPlaying,
          by: user.username
        }, ws);
        break;
      }

      case 'HEARTBEAT': {
        // Only host's heartbeat updates the authoritative room playback time
        if (isHost && typeof msg.currentTime === 'number') {
          room.playbackState = {
            currentTime: msg.currentTime,
            isPlaying: Boolean(msg.isPlaying),
            speed: msg.speed || 1.0,
            updatedAt: Date.now()
          };
          this.broadcast(room, {
            type: 'SYNC_HEARTBEAT',
            currentTime: room.playbackState.currentTime,
            isPlaying: room.playbackState.isPlaying,
            speed: room.playbackState.speed
          }, ws);
        }
        break;
      }

      case 'CHAT': {
        const text = String(msg.text || '').trim();
        if (!text) return;

        const chatItem = {
          id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          user: {
            id: user.id,
            username: user.username,
            avatar: user.avatar
          },
          text: text.slice(0, 500),
          timestamp: Date.now()
        };

        room.messages.push(chatItem);
        if (room.messages.length > 100) room.messages.shift();

        this.broadcast(room, {
          type: 'NEW_CHAT_MESSAGE',
          message: chatItem
        });
        break;
      }

      case 'EMOJI_BURST': {
        const emoji = String(msg.emoji || '❤️').slice(0, 4);
        this.broadcast(room, {
          type: 'EMOJI_BURST',
          emoji,
          user: {
            id: user.id,
            username: user.username
          }
        });
        break;
      }

      case 'CHANGE_MEDIA': {
        if (!isHost) return;
        if (msg.mediaType && msg.mediaId) {
          room.mediaType = msg.mediaType;
          room.mediaId = msg.mediaId;
          room.mediaTitle = msg.mediaTitle || 'ARN Stream Video';
          room.playbackState = {
            currentTime: 0,
            isPlaying: false,
            speed: 1.0,
            updatedAt: Date.now()
          };
          this.broadcast(room, {
            type: 'MEDIA_CHANGED',
            mediaType: room.mediaType,
            mediaId: room.mediaId,
            mediaTitle: room.mediaTitle
          });
        }
        break;
      }

      default:
        break;
    }
  }

  getRoomMembers(room) {
    return Array.from(room.clients).map((clientWs) => {
      const meta = this.clientMeta.get(clientWs);
      const isHost = meta?.connectionId === room.hostConnectionId;
      return {
        id: meta?.connectionId || meta?.user?.id,
        userId: meta?.user?.id,
        username: meta?.user?.username || 'ضيف ARN',
        avatar: meta?.user?.avatar || null,
        isHost
      };
    });
  }

  /**
   * Broadcast message to all room participants (optional excludeWs)
   */
  broadcast(room, payload, excludeWs = null) {
    const raw = JSON.stringify(payload);
    for (const clientWs of room.clients) {
      if (clientWs !== excludeWs && clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(raw);
        } catch (e) {
          console.warn('[SyncPlay broadcast error]', e.message);
        }
      }
    }
  }

  /**
   * Delete empty rooms inactive for more than 15 minutes
   */
  cleanupRooms() {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.clients.size === 0 && now - room.lastActivityAt > 15 * 60 * 1000) {
        this.rooms.delete(roomId);
        console.log(`[SyncPlay] Cleaned up inactive room: ${roomId}`);
      }
    }
  }
}

export const syncplayManager = new SyncPlayManager();
export default syncplayManager;
