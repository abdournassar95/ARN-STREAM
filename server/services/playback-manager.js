import db from '../db.js';

/**
 * Get clean, deduplicated, and dynamic Continue Watching list for a user.
 * 
 * Rules:
 * 1. Movies: Must have position > 5s and < 90% of duration.
 * 2. Series: Deduplicated per series (at most 1 card per series).
 *    - Always picks the most recently watched episode.
 *    - If that episode is completed (>= 90%), automatically surfaces the NEXT episode (progress 0%).
 *    - If all episodes of the series are watched, excludes the series.
 * 3. Media must still exist in the database.
 * 4. Strictly sorted by `updated_at DESC`.
 */
export function getContinueWatching(userId = 1, options = {}) {
  const { limit = 8 } = options;

  // 1. In-progress movies
  const movies = db.prepare(`
    SELECT ps.id as playback_id, ps.position, ps.duration, ps.updated_at,
           m.id, m.title, m.year, m.path, 'movie' as media_type
    FROM playback_state ps
    JOIN movies m ON m.id = ps.media_id AND ps.media_type = 'movie'
    WHERE ps.user_id = ?
      AND ps.position > 5
      AND (ps.duration IS NULL OR ps.position < ps.duration * 0.90)
    ORDER BY ps.updated_at DESC
    LIMIT ?
  `).all(userId, limit).map(m => {
    const poster = db.prepare(`
      SELECT id FROM images 
      WHERE media_type = 'movie' AND media_id = ? AND image_type = 'poster' 
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(m.id);
    
    const backdrop = db.prepare(`
      SELECT id FROM images 
      WHERE media_type = 'movie' AND media_id = ? AND image_type = 'backdrop' 
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(m.id);

    return {
      playbackId: m.playback_id,
      id: m.id,
      mediaId: m.id,
      type: 'movie',
      media_type: 'movie',
      title: m.title,
      year: m.year,
      position: m.position,
      duration: m.duration,
      progress: m.duration ? Math.min(100, (m.position / m.duration) * 100) : 0,
      updated_at: m.updated_at,
      poster: poster ? `/api/image/${poster.id}/thumb` : null,
      backdrop: backdrop ? `/api/image/${backdrop.id}/full` : (poster ? `/api/image/${poster.id}/full` : null),
      backdropThumb: backdrop ? `/api/image/${backdrop.id}/thumb` : (poster ? `/api/image/${poster.id}/thumb` : null)
    };
  });

  // 2. Distinct series with user watch history
  const seriesRows = db.prepare(`
    SELECT DISTINCT sea.series_id
    FROM playback_state ps
    JOIN episodes ep ON ep.id = ps.media_id AND ps.media_type = 'episode'
    JOIN seasons sea ON sea.id = ep.season_id
    WHERE ps.user_id = ? AND ps.position > 5
  `).all(userId);

  const seriesItems = [];

  for (const { series_id } of seriesRows) {
    const s = db.prepare(`SELECT id, title, year FROM series WHERE id = ?`).get(series_id);
    if (!s) continue;

    // Get the most recently watched episode for this series
    const latestPlayback = db.prepare(`
      SELECT ps.id as playback_id, ps.position, ps.duration, ps.updated_at,
             ep.id as episode_id, ep.title as episode_title, ep.episode_number,
             sea.season_number, sea.id as season_id
      FROM playback_state ps
      JOIN episodes ep ON ep.id = ps.media_id AND ps.media_type = 'episode'
      JOIN seasons sea ON sea.id = ep.season_id
      WHERE sea.series_id = ? AND ps.user_id = ?
      ORDER BY ps.updated_at DESC
      LIMIT 1
    `).get(series_id, userId);

    if (!latestPlayback) continue;

    let targetEpisode = null;
    let position = latestPlayback.position;
    let duration = latestPlayback.duration;
    let progress = duration ? (position / duration) * 100 : 0;
    const updatedAt = latestPlayback.updated_at;
    let isNextUp = false;

    // If the latest watched episode is finished (>= 90%), advance to the next episode
    if (duration && position >= duration * 0.90) {
      // Check next episode in the same season
      let nextEp = db.prepare(`
        SELECT ep.id, ep.title, ep.episode_number, sea.season_number, ep.duration
        FROM episodes ep
        JOIN seasons sea ON sea.id = ep.season_id
        WHERE ep.season_id = ? AND ep.episode_number > ?
        ORDER BY ep.episode_number ASC
        LIMIT 1
      `).get(latestPlayback.season_id, latestPlayback.episode_number);

      // Or first episode in subsequent seasons
      if (!nextEp) {
        nextEp = db.prepare(`
          SELECT ep.id, ep.title, ep.episode_number, sea.season_number, ep.duration
          FROM episodes ep
          JOIN seasons sea ON sea.id = ep.season_id
          WHERE sea.series_id = ? AND sea.season_number > ?
          ORDER BY sea.season_number ASC, ep.episode_number ASC
          LIMIT 1
        `).get(series_id, latestPlayback.season_number);
      }

      if (nextEp) {
        targetEpisode = nextEp;
        position = 0;
        duration = nextEp.duration || duration;
        progress = 0;
        isNextUp = true;
      } else {
        // User finished all available episodes of this series
        continue;
      }
    } else {
      targetEpisode = {
        id: latestPlayback.episode_id,
        title: latestPlayback.episode_title,
        episode_number: latestPlayback.episode_number,
        season_number: latestPlayback.season_number,
        duration: latestPlayback.duration
      };
    }

    const poster = db.prepare(`
      SELECT id FROM images 
      WHERE media_type = 'series' AND media_id = ? AND image_type = 'poster' 
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(series_id);

    const backdrop = db.prepare(`
      SELECT id FROM images 
      WHERE media_type = 'series' AND media_id = ? AND image_type = 'backdrop' 
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(series_id);

    // Clean, localized episode subtitle
    let episodeSubtitle = '';
    if (targetEpisode.season_number && targetEpisode.episode_number) {
      episodeSubtitle = `الموسم ${targetEpisode.season_number} • الحلقة ${targetEpisode.episode_number}`;
      if (targetEpisode.title && !['1','2','3','4','5','6','7','8','9','10'].includes(String(targetEpisode.title).trim()) && !String(targetEpisode.title).toLowerCase().startsWith('episode')) {
        episodeSubtitle += `: ${targetEpisode.title}`;
      }
    } else if (targetEpisode.episode_number) {
      episodeSubtitle = `الحلقة ${targetEpisode.episode_number}`;
      if (targetEpisode.title && !['1','2','3','4','5','6','7','8','9','10'].includes(String(targetEpisode.title).trim()) && !String(targetEpisode.title).toLowerCase().startsWith('episode')) {
        episodeSubtitle += `: ${targetEpisode.title}`;
      }
    }

    seriesItems.push({
      playbackId: latestPlayback.playback_id,
      id: series_id,
      seriesId: series_id,
      mediaId: targetEpisode.id,
      episodeId: targetEpisode.id,
      type: 'series',
      media_type: 'series',
      title: s.title,
      episodeTitle: episodeSubtitle,
      seasonNumber: targetEpisode.season_number,
      episodeNumber: targetEpisode.episode_number,
      year: s.year,
      position,
      duration,
      progress: Math.min(100, Math.max(0, progress)),
      isNextUp,
      updated_at: updatedAt,
      poster: poster ? `/api/image/${poster.id}/thumb` : null,
      backdrop: backdrop ? `/api/image/${backdrop.id}/full` : (poster ? `/api/image/${poster.id}/full` : null),
      backdropThumb: backdrop ? `/api/image/${backdrop.id}/thumb` : (poster ? `/api/image/${poster.id}/thumb` : null)
    });
  }

  // Combine and sort strictly by updated_at DESC
  return [...movies, ...seriesItems]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, limit);
}

/**
 * Get clean, deduplicated, and dynamic Continue Listening list for a user (max 8 items by default).
 * Deduplicated per album so the user gets up to 8 distinct albums/recitations,
 * with full artist backdrop/poster and album cover artwork.
 */
function stripAudioExt(name) {
  if (!name) return '';
  return String(name).replace(/\.(mp3|flac|m4a|wav|ogg|aac|wma|opus)$/i, '').trim();
}

export function getContinueListening(userId = 1, options = {}) {
  const { limit = 8 } = options;

  const rows = db.prepare(`
    SELECT ps.id as playback_id, ps.position, ps.duration as saved_duration, ps.updated_at,
           t.id as track_id, t.title as track_title, t.track_number, t.duration as track_duration,
           al.id as album_id, al.title as album_title, al.year,
           ar.id as artist_id, ar.name as artist_name
    FROM playback_state ps
    JOIN tracks t ON t.id = ps.media_id
    JOIN albums al ON al.id = t.album_id
    JOIN artists ar ON ar.id = al.artist_id
    WHERE ps.user_id = ?
      AND (ps.media_type = 'track' OR ps.media_type = 'audio')
      AND ps.position > 3
    ORDER BY ps.updated_at DESC
  `).all(userId);

  const seenAlbums = new Set();
  const items = [];

  for (const r of rows) {
    if (seenAlbums.has(r.album_id)) continue;

    let targetTrack = {
      id: r.track_id,
      title: r.track_title,
      track_number: r.track_number,
      duration: r.track_duration || r.saved_duration || 0
    };
    let position = r.position || 0;
    let duration = r.saved_duration || r.track_duration || 0;
    let isNextUp = false;

    // If track is >= 95% finished, try advancing to the next track in the album
    if (duration > 0 && position >= duration * 0.95) {
      const nextTrack = db.prepare(`
        SELECT id, title, track_number, duration
        FROM tracks
        WHERE album_id = ? AND (
          (track_number IS NOT NULL AND ? IS NOT NULL AND track_number > ?)
          OR (id > ? AND (track_number IS NULL OR ? IS NULL))
        )
        ORDER BY COALESCE(track_number, 999999) ASC, id ASC
        LIMIT 1
      `).get(r.album_id, r.track_number, r.track_number, r.track_id, r.track_number);

      if (nextTrack) {
        targetTrack = nextTrack;
        position = 0;
        duration = nextTrack.duration || 0;
        isNextUp = true;
      } else {
        // Entire album finished
        continue;
      }
    }

    seenAlbums.add(r.album_id);

    const albumCover = db.prepare(`
      SELECT id FROM images
      WHERE media_type = 'album' AND media_id = ? AND (image_type = 'album_cover' OR image_type = 'poster')
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(r.album_id);

    const artistPoster = db.prepare(`
      SELECT id FROM images
      WHERE media_type = 'artist' AND media_id = ? AND (image_type = 'poster' OR image_type = 'avatar')
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(r.artist_id);

    const artistBackdrop = db.prepare(`
      SELECT id FROM images
      WHERE media_type = 'artist' AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(r.artist_id);

    const coverId = albumCover?.id || artistPoster?.id || null;
    const backdropId = artistBackdrop?.id || albumCover?.id || artistPoster?.id || null;

    const progress = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;

    items.push({
      playbackId: r.playback_id,
      id: targetTrack.id,
      trackId: targetTrack.id,
      mediaId: targetTrack.id,
      albumId: r.album_id,
      artistId: r.artist_id,
      type: 'audio',
      media_type: 'track',
      title: stripAudioExt(targetTrack.title),
      trackTitle: stripAudioExt(targetTrack.title),
      trackNumber: targetTrack.track_number,
      albumTitle: stripAudioExt(r.album_title),
      artistName: r.artist_name,
      year: r.year,
      position,
      duration,
      progress,
      isNextUp,
      updated_at: r.updated_at,
      cover: coverId ? `/api/image/${coverId}/thumb` : null,
      poster: coverId ? `/api/image/${coverId}/thumb` : null,
      posterFull: coverId ? `/api/image/${coverId}/full` : null,
      backdrop: backdropId ? `/api/image/${backdropId}/full` : null,
      backdropThumb: backdropId ? `/api/image/${backdropId}/thumb` : null,
      artistAvatar: artistPoster ? `/api/image/${artistPoster.id}/thumb` : null
    });

    if (items.length >= limit) break;
  }

  return items;
}

/**
 * Remove playback history for a media item or an entire series/album.
 */
export function removePlaybackState(userId, mediaType, mediaId) {
  if (mediaType === 'series') {
    return db.prepare(`
      DELETE FROM playback_state 
      WHERE user_id = ? AND media_type = 'episode' AND media_id IN (
        SELECT ep.id FROM episodes ep
        JOIN seasons sea ON sea.id = ep.season_id
        WHERE sea.series_id = ?
      )
    `).run(userId, Number(mediaId));
  }

  if (mediaType === 'album') {
    return db.prepare(`
      DELETE FROM playback_state
      WHERE user_id = ? AND (media_type = 'track' OR media_type = 'audio') AND media_id IN (
        SELECT id FROM tracks WHERE album_id = ?
      )
    `).run(userId, Number(mediaId));
  }

  if (mediaType === 'track' || mediaType === 'audio') {
    return db.prepare(`
      DELETE FROM playback_state
      WHERE user_id = ? AND (media_type = 'track' OR media_type = 'audio') AND media_id = ?
    `).run(userId, Number(mediaId));
  }

  return db.prepare(`
    DELETE FROM playback_state 
    WHERE media_type = ? AND media_id = ? AND user_id = ?
  `).run(mediaType, Number(mediaId), userId);
}
