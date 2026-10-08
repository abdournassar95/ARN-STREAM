import fs from 'fs';
import path from 'path';
import { execFile, execFileSync } from 'child_process';
import sharp from 'sharp';
import db from '../db.js';

/**
 * Safely writes a file to disk as a standard, visible file.
 * If the file previously had the hidden attribute on Windows, -h is stripped so it is visible in Explorer.
 */
export function writeHiddenFile(filePath, buffer) {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (process.platform === 'win32' && fs.existsSync(filePath)) {
      try {
        execFileSync('attrib', ['-h', filePath]);
      } catch {}
    }

    fs.writeFileSync(filePath, buffer);

    // Ensure the file is not hidden on Windows so the user can easily see it in File Explorer
    if (process.platform === 'win32') {
      try {
        execFileSync('attrib', ['-h', filePath]);
      } catch {}
    }
    return true;
  } catch (err) {
    console.error('[media-file-manager] writeFile failed for:', filePath, err.message);
    return false;
  }
}

/**
 * Resolves the primary directory on disk for a given media item (movie, series, season).
 */
export function resolveMediaDirectory(type, id) {
  try {
    if (type === 'movie') {
      const movie = db.prepare('SELECT path FROM movies WHERE id = ?').get(id);
      if (movie?.path) {
        return path.dirname(movie.path);
      }
    }

    if (type === 'series') {
      const ep = db.prepare(`
        SELECT e.path, ser.library_id 
        FROM episodes e 
        JOIN seasons s ON e.season_id = s.id 
        JOIN series ser ON s.series_id = ser.id 
        WHERE ser.id = ? 
        LIMIT 1
      `).get(id);

      if (ep?.path) {
        // Try resolving via library paths
        if (ep.library_id) {
          const lib = db.prepare('SELECT paths FROM libraries WHERE id = ?').get(ep.library_id);
          if (lib?.paths) {
            try {
              const roots = JSON.parse(lib.paths);
              for (const root of roots) {
                const rel = path.relative(root, ep.path);
                if (!rel.startsWith('..') && !path.isAbsolute(rel)) {
                  const seg = rel.split(path.sep)[0];
                  return path.join(root, seg);
                }
              }
            } catch {}
          }
        }

        // Fallback: check if parent directory is a season folder (e.g., Season 1, Season 01, S01, الموسم 1)
        const parent = path.dirname(ep.path);
        const parentName = path.basename(parent).toLowerCase();
        if (
          parentName.startsWith('season') || 
          parentName.startsWith('موسم') || 
          (parentName.startsWith('s') && /^\d+$/.test(parentName.slice(1))) ||
          /^\d+$/.test(parentName)
        ) {
          return path.dirname(parent);
        }
        return parent;
      }
    }

    if (type === 'season') {
      const season = db.prepare('SELECT series_id, season_number FROM seasons WHERE id = ?').get(id);
      const ep = db.prepare('SELECT path FROM episodes WHERE season_id = ? LIMIT 1').get(id);
      if (season && ep?.path) {
        const epDir = path.dirname(ep.path);
        const epDirName = path.basename(epDir).toLowerCase();
        const isSeasonSubfolder = (
          epDirName.startsWith('season') || 
          epDirName.startsWith('موسم') || 
          (epDirName.startsWith('s') && /^\d+$/.test(epDirName.slice(1))) ||
          /^\d+$/.test(epDirName)
        );
        return {
          seasonDir: epDir,
          seriesDir: isSeasonSubfolder ? path.dirname(epDir) : epDir,
          isSeasonSubfolder,
          seasonNumber: season.season_number
        };
      }
    }

    if (type === 'artist') {
      const track = db.prepare(`
        SELECT t.path, a.title as album_title, art.name as artist_name, art.library_id
        FROM tracks t
        JOIN albums a ON t.album_id = a.id
        JOIN artists art ON a.artist_id = art.id
        WHERE art.id = ?
        LIMIT 1
      `).get(id);
      if (track?.path) {
        const albumDir = path.dirname(track.path);
        const parentDir = path.dirname(albumDir);
        if (track.artist_name && path.basename(parentDir).toLowerCase() === track.artist_name.toLowerCase()) {
          return parentDir;
        }
        return albumDir;
      }
    }
  } catch (err) {
    console.error('[media-file-manager] Error resolving directory:', err.message);
  }
  return null;
}

/**
 * Saves a poster or backdrop image directly into the movie or series folder on disk
 * with the hidden attribute (+h).
 */
export async function saveMediaImageToFolder(type, id, imageType, imageBuffer) {
  try {
    let jpegBuffer = imageBuffer;
    if (sharp) {
      try {
        jpegBuffer = await sharp(imageBuffer).jpeg({ quality: 92, mozjpeg: true }).toBuffer();
      } catch {
        jpegBuffer = imageBuffer;
      }
    }

    if (type === 'movie' || type === 'series') {
      const mediaDir = resolveMediaDirectory(type, id);
      if (!mediaDir || !fs.existsSync(mediaDir)) {
        console.warn(`[media-file-manager] Directory not found for ${type} #${id}`);
        return null;
      }

      let filename = imageType === 'backdrop' ? 'backdrop.jpg' : 'poster.jpg';
      let oldSpacedFilename = null;
      let baseName = '';

      if (type === 'movie') {
        const movie = db.prepare('SELECT path FROM movies WHERE id = ?').get(id);
        if (movie?.path) {
          baseName = path.parse(movie.path).name;
          filename = imageType === 'backdrop' ? `${baseName}-backdrop.jpg` : `${baseName}-poster.jpg`;
          oldSpacedFilename = imageType === 'backdrop' ? `${baseName} backdrop.jpg` : `${baseName} poster.jpg`;
        }
      } else if (type === 'series') {
        const ser = db.prepare('SELECT title FROM series WHERE id = ?').get(id);
        baseName = (ser?.title || '').replace(/[\\/:*?"<>|]/g, '').trim();
        if (baseName) {
          filename = imageType === 'backdrop' ? `${baseName}-backdrop.jpg` : `${baseName}-poster.jpg`;
          oldSpacedFilename = imageType === 'backdrop' ? `${baseName} backdrop.jpg` : `${baseName} poster.jpg`;
        }
      }

      const targetPath = path.join(mediaDir, filename);

      // Clean up legacy spaced file if present so it doesn't leave clutter
      if (oldSpacedFilename) {
        const oldSpacedPath = path.join(mediaDir, oldSpacedFilename);
        if (fs.existsSync(oldSpacedPath) && oldSpacedPath !== targetPath) {
          try { fs.unlinkSync(oldSpacedPath); } catch {}
        }
      }

      const ok = writeHiddenFile(targetPath, jpegBuffer);
      if (ok) {
        console.log(`[media-file-manager] Saved ${imageType} to:`, targetPath);

        // Also write standard poster.jpg / backdrop.jpg if in a dedicated folder
        const genericName = imageType === 'backdrop' ? 'backdrop.jpg' : 'poster.jpg';
        const genericPath = path.join(mediaDir, genericName);
        if (genericPath !== targetPath) {
          try {
            const vidFiles = fs.readdirSync(mediaDir).filter(f => /\.(mp4|mkv|avi|mov)$/i.test(f));
            if (vidFiles.length <= 1 || type === 'series') {
              writeHiddenFile(genericPath, jpegBuffer);
            }
          } catch {}
        }

        // If series, also sync with season 1 files on disk so they never diverge
        if (type === 'series') {
          const s1 = db.prepare('SELECT id FROM seasons WHERE series_id = ? AND season_number = 1').get(id);
          if (s1) {
            const s1Name = imageType === 'backdrop' ? 'season01-backdrop.jpg' : 'season01-poster.jpg';
            writeHiddenFile(path.join(mediaDir, s1Name), jpegBuffer);
          }
        }
        return targetPath;
      }
    }

    if (type === 'season') {
      const seasonInfo = resolveMediaDirectory('season', id);
      if (!seasonInfo) return null;

      const sNumPadded = String(seasonInfo.seasonNumber).padStart(2, '0');
      let targetPath = null;

      if (imageType === 'season_poster' || imageType === 'poster') {
        if (seasonInfo.isSeasonSubfolder && fs.existsSync(seasonInfo.seasonDir)) {
          // Inside season subfolder: save as poster.jpg
          const subPath = path.join(seasonInfo.seasonDir, 'poster.jpg');
          writeHiddenFile(subPath, jpegBuffer);
        }
        // Also save in series directory as seasonXX-poster.jpg
        targetPath = path.join(seasonInfo.seriesDir, `season${sNumPadded}-poster.jpg`);
        writeHiddenFile(targetPath, jpegBuffer);

        // If Season 1, also synchronize series primary poster.jpg!
        if (seasonInfo.seasonNumber === 1) {
          const seriesPoster = path.join(seasonInfo.seriesDir, 'poster.jpg');
          writeHiddenFile(seriesPoster, jpegBuffer);
        }
      } else if (imageType === 'backdrop') {
        targetPath = path.join(seasonInfo.seriesDir, `season${sNumPadded}-backdrop.jpg`);
        writeHiddenFile(targetPath, jpegBuffer);

        // If Season 1, also synchronize series primary backdrop.jpg!
        if (seasonInfo.seasonNumber === 1) {
          const seriesBackdrop = path.join(seasonInfo.seriesDir, 'backdrop.jpg');
          writeHiddenFile(seriesBackdrop, jpegBuffer);
        }
      }

      return targetPath;
    }

    if (type === 'artist') {
      const artistDir = resolveMediaDirectory('artist', id);
      if (artistDir && fs.existsSync(artistDir)) {
        const filename = (imageType === 'backdrop' || imageType === 'fanart') ? 'backdrop.jpg' : 'folder.jpg';
        const targetPath = path.join(artistDir, filename);
        const ok = writeHiddenFile(targetPath, jpegBuffer);
        if (ok) {
          console.log(`[media-file-manager] Saved hidden artist ${imageType} to:`, targetPath);
          return targetPath;
        }
      }
    }
  } catch (err) {
    console.error('[media-file-manager] saveMediaImageToFolder error:', err.message);
  }
  return null;
}

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

/**
 * Saves metadata (NFO) directly into the movie or series folder on disk
 * with the hidden attribute (+h).
 */
export async function saveMetadataToFolder(type, id) {
  try {
    if (type === 'movie') {
      const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
      if (!movie || !movie.path) return false;
      const mediaDir = path.dirname(movie.path);
      const baseName = path.parse(movie.path).name;
      const targetPath = path.join(mediaDir, `${baseName}.nfo`);

      let nfoContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<movie>\n`;
      if (movie.title) nfoContent += `  <title>${escapeXml(movie.title)}</title>\n`;
      if (movie.year) nfoContent += `  <year>${movie.year}</year>\n`;
      if (movie.plot) nfoContent += `  <plot>${escapeXml(movie.plot)}</plot>\n`;
      nfoContent += `</movie>`;

      return writeHiddenFile(targetPath, Buffer.from(nfoContent, 'utf8'));
    } else if (type === 'series') {
      const mediaDir = resolveMediaDirectory('series', id);
      if (!mediaDir) return false;
      const series = db.prepare('SELECT * FROM series WHERE id = ?').get(id);
      if (!series) return false;
      const targetPath = path.join(mediaDir, `tvshow.nfo`);

      let nfoContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<tvshow>\n`;
      if (series.title) nfoContent += `  <title>${escapeXml(series.title)}</title>\n`;
      if (series.year) nfoContent += `  <year>${series.year}</year>\n`;
      if (series.plot) nfoContent += `  <plot>${escapeXml(series.plot)}</plot>\n`;
      nfoContent += `</tvshow>`;

      return writeHiddenFile(targetPath, Buffer.from(nfoContent, 'utf8'));
    } else if (type === 'season') {
      const seasonInfo = resolveMediaDirectory('season', id);
      if (!seasonInfo) return false;
      const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(id);
      if (!season) return false;

      let nfoContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<season>\n`;
      nfoContent += `  <seasonnumber>${season.season_number}</seasonnumber>\n`;
      if (season.title) nfoContent += `  <title>${escapeXml(season.title)}</title>\n`;
      if (season.year) nfoContent += `  <year>${season.year}</year>\n`;
      if (season.plot) nfoContent += `  <plot>${escapeXml(season.plot)}</plot>\n`;
      nfoContent += `</season>`;

      const sNumPadded = String(season.season_number).padStart(2, '0');
      let targetPath;
      if (seasonInfo.isSeasonSubfolder && fs.existsSync(seasonInfo.seasonDir)) {
        targetPath = path.join(seasonInfo.seasonDir, 'season.nfo');
      } else {
        targetPath = path.join(seasonInfo.seriesDir, `season${sNumPadded}.nfo`);
      }
      return writeHiddenFile(targetPath, Buffer.from(nfoContent, 'utf8'));
    }
  } catch (err) {
    console.error('[media-file-manager] saveMetadataToFolder error:', err.message);
  }
  return false;
}
