import fs from 'fs';
import path from 'path';
import https from 'https';
import db from '../db.js';

/**
 * ARN Stream Lyrics & Quran Verses Service
 * Handles local .lrc files, embedded tags, and online fallback via LRCLIB
 */
class LyricsService {
  /**
   * Find local companion .lrc or .txt file next to audio file
   */
  findLocalLyricsFile(audioFilePath) {
    if (!audioFilePath || !fs.existsSync(audioFilePath)) return null;

    const dir = path.dirname(audioFilePath);
    const ext = path.extname(audioFilePath);
    const baseName = path.basename(audioFilePath, ext);

    const candidates = [
      path.join(dir, `${baseName}.lrc`),
      path.join(dir, `${baseName}.txt`),
      path.join(dir, `${baseName}.ar.lrc`),
      path.join(dir, `${baseName}.ar.txt`),
      path.join(dir, 'lyrics.lrc'),
      path.join(dir, 'lyrics.txt')
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          const content = fs.readFileSync(cand, 'utf-8');
          if (content && content.trim().length > 0) {
            return {
              lyrics: content.trim(),
              source: 'local_file',
              filePath: cand,
              isSynced: /\[\d{2}:\d{2}/.test(content)
            };
          }
        } catch (e) {
          console.warn(`[LyricsService] Error reading candidate ${cand}:`, e.message);
        }
      }
    }
    return null;
  }

  /**
   * Fetch synchronized or plain lyrics from LRCLIB API
   */
  async fetchFromLrclib(title, artist, album, duration) {
    if (!title) return null;

    return new Promise((resolve) => {
      try {
        const queryParams = new URLSearchParams({
          track_name: title,
          ...(artist ? { artist_name: artist } : {}),
          ...(album ? { album_name: album } : {}),
          ...(duration ? { duration: Math.round(duration).toString() } : {})
        });

        const url = `https://lrclib.net/api/get?${queryParams.toString()}`;
        
        const req = https.get(url, {
          headers: {
            'User-Agent': 'ARN-Stream-MediaServer/2.6.0 (https://github.com/abdournassar95/ARN-STREAM)',
            'Accept': 'application/json'
          },
          timeout: 4500
        }, (res) => {
          if (res.statusCode !== 200) {
            // Not found or error
            res.resume();
            return resolve(null);
          }

          let rawData = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => { rawData += chunk; });
          res.on('end', () => {
            try {
              const data = JSON.parse(rawData);
              const lyrics = data.syncedLyrics || data.plainLyrics || null;
              if (lyrics) {
                resolve({
                  lyrics,
                  source: 'lrclib',
                  isSynced: !!data.syncedLyrics,
                  instrumental: !!data.instrumental
                });
              } else {
                resolve(null);
              }
            } catch {
              resolve(null);
            }
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve(null);
        });

        req.on('error', () => {
          resolve(null);
        });
      } catch (err) {
        resolve(null);
      }
    });
  }

  /**
   * Get lyrics for a track by ID.
   * Priority:
   * 1. DB cache (tracks.lyrics)
   * 2. Local companion .lrc/.txt file
   * 3. LRCLIB API query (with auto-cache to DB)
   */
  async getLyricsForTrack(trackId) {
    const track = db.prepare(`
      SELECT t.id, t.title, t.duration, t.path, t.lyrics,
             al.title as albumTitle,
             ar.name as artistName
      FROM tracks t
      LEFT JOIN albums al ON t.album_id = al.id
      LEFT JOIN artists ar ON al.artist_id = ar.id
      WHERE t.id = ?
    `).get(trackId);

    if (!track) return null;

    // 1. Existing DB lyrics
    if (track.lyrics && track.lyrics.trim().length > 0) {
      return {
        id: track.id,
        title: track.title,
        artist: track.artistName,
        lyrics: track.lyrics,
        source: 'database',
        isSynced: /\[\d{2}:\d{2}/.test(track.lyrics)
      };
    }

    // 2. Check local companion file
    if (track.path) {
      const local = this.findLocalLyricsFile(track.path);
      if (local && local.lyrics) {
        // Save to DB for instant subsequent access
        try {
          db.prepare('UPDATE tracks SET lyrics = ? WHERE id = ?').run(local.lyrics, track.id);
        } catch {}
        return {
          id: track.id,
          title: track.title,
          artist: track.artistName,
          lyrics: local.lyrics,
          source: local.source,
          isSynced: local.isSynced
        };
      }
    }

    // 3. Fallback to LRCLIB (if non-Quranic/music tracks)
    const isQuran = /قرآن|سورة|quran|surah/i.test(`${track.title} ${track.albumTitle} ${track.artistName}`);
    if (!isQuran && track.title) {
      const online = await this.fetchFromLrclib(track.title, track.artistName, track.albumTitle, track.duration);
      if (online && online.lyrics) {
        try {
          db.prepare('UPDATE tracks SET lyrics = ? WHERE id = ?').run(online.lyrics, track.id);
        } catch {}
        return {
          id: track.id,
          title: track.title,
          artist: track.artistName,
          lyrics: online.lyrics,
          source: online.source,
          isSynced: online.isSynced
        };
      }
    }

    return {
      id: track.id,
      title: track.title,
      artist: track.artistName,
      lyrics: null,
      source: 'none',
      isSynced: false
    };
  }

  /**
   * Save or update lyrics manually for a track
   */
  saveLyrics(trackId, lyricsText) {
    const cleaned = (lyricsText || '').trim();
    db.prepare('UPDATE tracks SET lyrics = ? WHERE id = ?').run(cleaned || null, trackId);
    return {
      id: trackId,
      lyrics: cleaned || null,
      isSynced: cleaned ? /\[\d{2}:\d{2}/.test(cleaned) : false
    };
  }
}

export const lyricsService = new LyricsService();
export default lyricsService;
