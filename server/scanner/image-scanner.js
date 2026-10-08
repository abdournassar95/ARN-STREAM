import fs from 'fs';
import path from 'path';
import db, { getSetting, getLibraryFolders } from '../db.js';
import { hashFile, POSTER_NAMES, BACKDROP_NAMES, COVER_NAMES } from './helpers.js';
import { processAndCacheImage, extractAndCacheEmbeddedArt } from '../services/image-cache.js';

export function getImageRoots() {
  return {
    movies: getLibraryFolders('movies'),
    shows: getLibraryFolders('shows'),
    music: getLibraryFolders('music'),
    posters: getLibraryFolders('posters'),
  };
}

export async function scanImages() {
  console.log('[ImageScanner] Scanning images...');
  const roots = getImageRoots();
  let count = 0;

  // 1. Scan movies
  const movies = db.prepare('SELECT id, title, path FROM movies').all();
  for (const movie of movies) {
    if (!movie.path || !fs.existsSync(movie.path)) continue;
    const folder = path.dirname(movie.path);
    const base = path.basename(movie.path, path.extname(movie.path));
    const filename = path.basename(movie.path);

    const hasPoster = db.prepare(`SELECT id FROM images WHERE media_type='movie' AND media_id=? AND image_type='poster'`).get(movie.id);
    const hasBackdrop = db.prepare(`SELECT id FROM images WHERE media_type='movie' AND media_id=? AND image_type='backdrop'`).get(movie.id);

    if (!hasPoster || !hasBackdrop) {
      try {
        const files = fs.readdirSync(folder);
        const lowerFiles = files.map(f => f.toLowerCase());

        if (!hasPoster) {
          const posterCandidates = [
            `${base}-poster.jpg`, `${base}-poster.webp`, `${base}-poster.png`, `${base}-poster.jpeg`,
            `${filename}-poster.webp`, `${filename}-poster.jpg`, `${filename}-poster.png`,
            `${base}.jpg`, `${base}.webp`, `${base}.png`,
            `${base} poster.jpg`, `${base} poster.png`,
            'poster.jpg', 'poster.webp', 'poster.png', 'folder.jpg', 'cover.jpg'
          ];
          for (const cand of posterCandidates) {
            const idx = lowerFiles.indexOf(cand.toLowerCase());
            if (idx !== -1) {
              const full = path.join(folder, files[idx]);
              const res = await processAndCacheImage(full, 'movie', movie.id, 'poster', 'local_file');
              if (res) count++;
              break;
            }
          }
        }

        if (!hasBackdrop) {
          const backdropCandidates = [
            `${base}-fanart.jpg`, `${base}-fanart.png`, `${base}-fanart.webp`,
            `${base}-landscape.jpg`, `${base}-backdrop.jpg`,
            `${base} backdrop.jpg`, `${base} fanart.jpg`,
            'fanart.jpg', 'fanart.png', 'backdrop.jpg', 'background.jpg'
          ];
          for (const cand of backdropCandidates) {
            const idx = lowerFiles.indexOf(cand.toLowerCase());
            if (idx !== -1) {
              const full = path.join(folder, files[idx]);
              const res = await processAndCacheImage(full, 'movie', movie.id, 'backdrop', 'local_file');
              if (res) count++;
              break;
            }
          }
        }
      } catch {}
    }
  }

  // 2. Scan series (posters and backdrops)
  const seriesList = db.prepare('SELECT id, title FROM series').all();
  for (const s of seriesList) {
    let hasPoster = db.prepare(`SELECT id FROM images WHERE media_type='series' AND media_id=? AND image_type='poster'`).get(s.id);
    let hasBackdrop = db.prepare(`SELECT id FROM images WHERE media_type='series' AND media_id=? AND image_type='backdrop'`).get(s.id);
    if (hasPoster && hasBackdrop) continue;

    const sampleEp = db.prepare(`
      SELECT episodes.path FROM episodes
      JOIN seasons ON seasons.id = episodes.season_id
      WHERE seasons.series_id = ? LIMIT 1
    `).get(s.id);

    if (!sampleEp || !sampleEp.path) continue;

    // Check directory of episode, parent, and grandparent
    let curDir = path.dirname(sampleEp.path);
    const candidateDirs = [];
    for (let i = 0; i < 3; i++) {
      if (curDir && fs.existsSync(curDir)) {
        candidateDirs.push(curDir);
        const parent = path.dirname(curDir);
        if (parent === curDir) break;
        curDir = parent;
      }
    }

    for (const dir of candidateDirs) {
      try {
        const files = fs.readdirSync(dir);
        const lowerFiles = files.map(f => f.toLowerCase());

        const cleanSeriesTitle = (s.title || '').replace(/[\\/:*?"<>|]/g, '').trim().toLowerCase();

        if (!hasPoster) {
          const posterCandidates = [
            ...(cleanSeriesTitle ? [
              `${cleanSeriesTitle}-poster.jpg`, `${cleanSeriesTitle}-poster.jpeg`, `${cleanSeriesTitle}-poster.png`, `${cleanSeriesTitle}-poster.webp`,
              `${cleanSeriesTitle} poster.jpg`, `${cleanSeriesTitle} poster.png`
            ] : []),
            'poster.jpg', 'poster.jpeg', 'poster.png', 'poster.webp', 'folder.jpg', 'cover.jpg'
          ];
          for (const cand of posterCandidates) {
            const idx = lowerFiles.indexOf(cand);
            if (idx !== -1) {
              const full = path.join(dir, files[idx]);
              const res = await processAndCacheImage(full, 'series', s.id, 'poster', 'local_file');
              if (res) { count++; hasPoster = true; break; }
            }
          }
        }

        if (!hasBackdrop) {
          const backdropCandidates = [
            ...(cleanSeriesTitle ? [
              `${cleanSeriesTitle}-backdrop.jpg`, `${cleanSeriesTitle}-backdrop.jpeg`, `${cleanSeriesTitle}-backdrop.png`, `${cleanSeriesTitle}-backdrop.webp`,
              `${cleanSeriesTitle}-fanart.jpg`, `${cleanSeriesTitle}-landscape.jpg`,
              `${cleanSeriesTitle} backdrop.jpg`
            ] : []),
            'fanart.jpg', 'fanart.jpeg', 'fanart.png', 'fanart.webp', 'backdrop.jpg', 'background.jpg', 'banner.jpg'
          ];
          for (const cand of backdropCandidates) {
            const idx = lowerFiles.indexOf(cand);
            if (idx !== -1) {
              const full = path.join(dir, files[idx]);
              const res = await processAndCacheImage(full, 'series', s.id, 'backdrop', 'local_file');
              if (res) { count++; hasBackdrop = true; break; }
            }
          }
        }
      } catch {}
    }
  }

  // 3. Scan albums (covers)
  const albums = db.prepare(`
    SELECT albums.id, albums.title, artists.name as artistName
    FROM albums JOIN artists ON artists.id = albums.artist_id
  `).all();

  for (const album of albums) {
    const existingCover = db.prepare(`SELECT * FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover'`).get(album.id);
    let hasCover = false;
    if (existingCover) {
      const cacheExists = existingCover.cached_path ? fs.existsSync(existingCover.cached_path) : true;
      const thumbExists = existingCover.thumbnail_path ? fs.existsSync(existingCover.thumbnail_path) : true;
      const localExists = (existingCover.source === 'local_file' && existingCover.local_path) ? fs.existsSync(existingCover.local_path) : true;
      
      if (!cacheExists || !thumbExists || !localExists) {
        db.prepare('DELETE FROM images WHERE id=?').run(existingCover.id);
      } else {
        hasCover = true;
      }
    }
    if (hasCover) continue;

    // Find any track of this album to get directory
    const sampleTrack = db.prepare(`SELECT path FROM tracks WHERE album_id=? LIMIT 1`).get(album.id);
    if (!sampleTrack || !fs.existsSync(sampleTrack.path)) continue;

    // Extract embedded art from the track file directly
    // Per user request, do not use external files like folder.jpg or cover.jpg
    try {
      const res = await extractAndCacheEmbeddedArt(sampleTrack.path, album.id);
      if (res) count++;
    } catch {}
  }

  // 4. Scan artists (images)
  const artists = db.prepare('SELECT id, name FROM artists').all();
  for (const artist of artists) {
    const existingArtistImg = db.prepare(`SELECT * FROM images WHERE media_type='artist' AND media_id=?`).get(artist.id);
    let hasArtistImg = false;
    if (existingArtistImg) {
      const cacheExists = existingArtistImg.cached_path ? fs.existsSync(existingArtistImg.cached_path) : true;
      const thumbExists = existingArtistImg.thumbnail_path ? fs.existsSync(existingArtistImg.thumbnail_path) : true;
      const localExists = (existingArtistImg.source === 'local_file' && existingArtistImg.local_path) ? fs.existsSync(existingArtistImg.local_path) : true;
      
      if (!cacheExists || !thumbExists || !localExists) {
        db.prepare('DELETE FROM images WHERE id=?').run(existingArtistImg.id);
      } else {
        hasArtistImg = true;
      }
    }
    if (hasArtistImg) continue;

    // Per user request, do not scan for local image files (like folder.jpg, artist.jpg) in artist folders.
  }

  // 5. Central posters folder (if configured)
  for (const pRoot of roots.posters) {
    if (pRoot && fs.existsSync(pRoot)) {
      count += await scanCentralPosters(pRoot);
    }
  }

  console.log(`[ImageScanner] Done. Processed ${count} images`);
  return { scanned: count };
}

async function scanCentralPosters(postersRoot) {
  let files = [];
  try {
    files = fs.readdirSync(postersRoot);
  } catch {
    return 0;
  }

  let count = 0;
  for (const file of files) {
    const full = path.join(postersRoot, file);
    try {
      if (fs.statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }

    const base = path.parse(file).name;
    let matched = false;
    const movies = db.prepare('SELECT id, title FROM movies').all();
    for (const m of movies) {
      if (base.toLowerCase().includes(m.title.toLowerCase())) {
        try {
          await processAndCacheImage(full, 'movie', m.id, file.toLowerCase().includes('season') ? 'season_poster' : 'poster', 'local_folder');
          count++;
          matched = true;
          break;
        } catch {}
      }
    }
    if (matched) continue;

    const series = db.prepare('SELECT id, title FROM series').all();
    for (const s of series) {
      if (base.toLowerCase().includes(s.title.toLowerCase())) {
        try {
          await processAndCacheImage(full, 'series', s.id, 'poster', 'local_folder');
          count++;
          break;
        } catch {}
      }
    }
  }
  return count;
}
