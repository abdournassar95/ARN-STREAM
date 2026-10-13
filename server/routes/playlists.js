import express from 'express';
import db from '../db.js';
import { requireAuth, optionalAuth } from '../services/auth.js';

const router = express.Router();

function canEditPlaylist(pl, req) {
  if (!pl || !req.user) return false;
  if (req.user.role === 'admin') return true;
  if (pl.user_id && pl.user_id === req.user.id) return true;
  return false;
}

// Require authentication for playlists
router.use(requireAuth);

router.get('/', (req, res) => {
  const { libraryId } = req.query;
  const userId = req.user?.id || null;
  const isAdmin = req.user?.role === 'admin';
  
  let query = 'SELECT * FROM playlists WHERE 1=1';
  const params = [];

  if (libraryId) {
    query += ' AND (library_id = ? OR library_id IS NULL)';
    params.push(Number(libraryId));
  }

  // If user is authenticated and not admin, only show own playlists or shared playlists
  if (!isAdmin) {
    if (userId) {
      query += ' AND (user_id = ? OR is_shared = 1 OR user_id IS NULL)';
      params.push(userId);
    } else {
      // Unauthenticated visitor can only view explicitly shared playlists
      query += ' AND is_shared = 1';
    }
  }

  query += ' ORDER BY updated_at DESC';
  const lists = db.prepare(query).all(...params);
  
  const enriched = lists.map(pl => {
    const count = db.prepare(`SELECT COUNT(*) as c FROM playlist_items WHERE playlist_id=?`).get(pl.id).c;
    const duration = db.prepare(`SELECT SUM(tracks.duration) as total FROM playlist_items JOIN tracks ON tracks.id=playlist_items.track_id WHERE playlist_items.playlist_id=?`).get(pl.id).total || 0;
    return { ...pl, tracksCount: count, totalDuration: duration };
  });
  res.json({ data: enriched });
});

router.post('/', requireAuth, (req, res) => {
  const { name, description, type = 'manual', rules = null, libraryId, is_shared = 0 } = req.body;
  if (!name) return res.status(400).json({ error: { code: 'MISSING_NAME', message: 'name required' } });
  
  const userId = req.user.id;
  const libId = libraryId ? Number(libraryId) : null;
  const info = db.prepare(`INSERT INTO playlists (library_id, user_id, name, description, type, rules, is_shared) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    libId, 
    userId, 
    name.trim(), 
    description || null, 
    type, 
    rules ? JSON.stringify(rules) : null, 
    is_shared ? 1 : 0
  );
  const pl = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(info.lastInsertRowid);
  res.status(201).json({ data: pl });
});

router.put('/:id', (req, res) => {
  const pl = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(req.params.id);
  if (!pl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } });
  
  if (!canEditPlaylist(pl, req)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied to edit this playlist' } });
  }

  const { name, description, rules, is_shared } = req.body;
  db.prepare(`UPDATE playlists SET name=COALESCE(?, name), description=COALESCE(?, description), rules=COALESCE(?, rules), is_shared=COALESCE(?, is_shared), updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(
      name !== undefined ? name.trim() : null, 
      description !== undefined ? description : null, 
      rules ? JSON.stringify(rules) : null, 
      is_shared !== undefined ? (is_shared ? 1 : 0) : null, 
      req.params.id
    );
  const updated = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(req.params.id);
  res.json({ data: updated });
});

router.delete('/:id', (req, res) => {
  const pl = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(req.params.id);
  if (!pl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } });

  if (!canEditPlaylist(pl, req)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied to delete this playlist' } });
  }

  db.prepare(`DELETE FROM playlists WHERE id=?`).run(req.params.id);
  db.prepare(`DELETE FROM playlist_items WHERE playlist_id=?`).run(req.params.id);
  res.json({ data: { success: true } });
});

router.get('/:id', (req, res) => {
  const pl = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(req.params.id);
  if (!pl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } });

  // If playlist is private and belongs to another user (and not admin)
  if (!pl.is_shared && req.user?.role !== 'admin') {
    if (!req.user || (pl.user_id && pl.user_id !== req.user.id)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This playlist is private' } });
    }
  }

  const items = db.prepare(`
    SELECT playlist_items.*, tracks.title, tracks.duration, tracks.path, tracks.library_id,
           COALESCE(albums.title, '') as albumTitle, COALESCE(artists.name, '') as artistName,
           artists.id as artistId, tracks.album_id
    FROM playlist_items
    JOIN tracks ON tracks.id=playlist_items.track_id
    LEFT JOIN albums ON albums.id=tracks.album_id
    LEFT JOIN artists ON artists.id=albums.artist_id
    WHERE playlist_items.playlist_id=? ORDER BY playlist_items.position
  `).all(pl.id);
  const enriched = items.map(it => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(it.album_id);
    return { ...it, cover: img ? `/api/image/${img.id}/thumb` : null, url: `/api/stream/track/${it.track_id}` };
  });
  res.json({ data: { ...pl, items: enriched } });
});

router.post('/:id/items', (req, res) => {
  const pl = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(req.params.id);
  if (!pl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } });

  if (!canEditPlaylist(pl, req)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied to edit this playlist' } });
  }

  const { track_id } = req.body;
  if (!track_id) return res.status(400).json({ error: { code: 'MISSING_TRACK', message: 'track_id required' } });
  const maxPos = db.prepare(`SELECT MAX(position) as m FROM playlist_items WHERE playlist_id=?`).get(req.params.id).m || 0;
  const info = db.prepare(`INSERT INTO playlist_items (playlist_id, track_id, position) VALUES (?, ?, ?)`).run(req.params.id, Number(track_id), maxPos + 1);
  db.prepare(`UPDATE playlists SET updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.params.id);
  const item = db.prepare(`SELECT * FROM playlist_items WHERE id=?`).get(info.lastInsertRowid);
  res.status(201).json({ data: item });
});

// Bulk add tracks: accepts track_ids[], album_id, or artist_id
router.post('/:id/batch', (req, res) => {
  const playlistId = req.params.id;
  const pl = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(playlistId);
  if (!pl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } });

  if (!canEditPlaylist(pl, req)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied to edit this playlist' } });
  }

  const { track_ids, album_id, artist_id } = req.body;
  let ids = [];

  if (Array.isArray(track_ids) && track_ids.length) {
    ids = track_ids.map(Number);
  } else if (album_id) {
    const tracks = db.prepare(`SELECT id FROM tracks WHERE album_id=? ORDER BY track_number, title`).all(Number(album_id));
    ids = tracks.map(t => t.id);
  } else if (artist_id) {
    const tracks = db.prepare(`SELECT tracks.id FROM tracks JOIN albums ON albums.id=tracks.album_id WHERE albums.artist_id=? ORDER BY albums.year, albums.title, tracks.track_number`).all(Number(artist_id));
    ids = tracks.map(t => t.id);
  }

  if (!ids.length) return res.status(400).json({ error: { code: 'NO_TRACKS', message: 'No tracks to add' } });

  let maxPos = db.prepare(`SELECT MAX(position) as m FROM playlist_items WHERE playlist_id=?`).get(playlistId).m || 0;

  const tx = db.transaction(() => {
    for (const trackId of ids) {
      const exists = db.prepare(`SELECT id FROM playlist_items WHERE playlist_id=? AND track_id=?`).get(playlistId, trackId);
      if (exists) continue;
      maxPos++;
      db.prepare(`INSERT INTO playlist_items (playlist_id, track_id, position) VALUES (?, ?, ?)`).run(playlistId, trackId, maxPos);
    }
  });
  tx();
  db.prepare(`UPDATE playlists SET updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(playlistId);
  res.status(201).json({ data: { success: true, added: ids.length } });
});

router.delete('/:id/items/:itemId', (req, res) => {
  const pl = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(req.params.id);
  if (!pl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } });

  if (!canEditPlaylist(pl, req)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied to edit this playlist' } });
  }

  db.prepare(`DELETE FROM playlist_items WHERE id=? AND playlist_id=?`).run(req.params.itemId, req.params.id);
  db.prepare(`UPDATE playlists SET updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.params.id);
  res.json({ data: { success: true } });
});

router.post('/:id/reorder', (req, res) => {
  const pl = db.prepare(`SELECT * FROM playlists WHERE id=?`).get(req.params.id);
  if (!pl) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Playlist not found' } });

  if (!canEditPlaylist(pl, req)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Permission denied to edit this playlist' } });
  }

  const { order } = req.body;
  if (!Array.isArray(order)) return res.status(400).json({ error: { code: 'INVALID_ORDER', message: 'order must be array' } });
  const tx = db.transaction(() => {
    order.forEach((itemId, idx) => {
      db.prepare(`UPDATE playlist_items SET position=? WHERE id=? AND playlist_id=?`).run(idx + 1, itemId, req.params.id);
    });
  });
  tx();
  db.prepare(`UPDATE playlists SET updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.params.id);
  res.json({ data: { success: true } });
});

export default router;
