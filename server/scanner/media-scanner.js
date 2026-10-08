import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import {
  VIDEO_EXTS, AUDIO_EXTS, isVideoFile, isAudioFile,
  parseMovieFolder, parseEpisodeFilename, parseSeasonFolder, parseSeasonInfo, parseTrackFilename,
  parseNfoFile, cleanMovieTitle, probeMedia
} from './helpers.js';
import { processAndCacheImage, extractAndCacheEmbeddedArt } from '../services/image-cache.js';

import db, { getSetting, getAllLibraries, getLibraryById, cleanupEmptyAlbums, cleanupEmptyArtists, cleanupEmptySeasons, cleanupEmptySeries } from '../db.js';

function assignTagsToMedia(genres, mediaType, mediaId) {
  if (!genres || !genres.length) return;
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const insertMediaTag = db.prepare('INSERT OR IGNORE INTO media_tags (tag_id, media_type, media_id) VALUES (?, ?, ?)');
  const incrementUsage = db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?');
  
  for (const g of genres) {
    if (!g) continue;
    let name = g.trim();
    if (!name) continue;
    name = name.charAt(0).toUpperCase() + name.slice(1);
    insertTag.run(name);
    const tag = getTag.get(name);
    if (tag) {
      const res = insertMediaTag.run(tag.id, mediaType, mediaId);
      if (res.changes > 0) incrementUsage.run(tag.id);
    }
  }
}

export async function scanLibrary(libraryId) {
  const lib = getLibraryById(libraryId);
  if (!lib) throw new Error(`Library ${libraryId} not found`);

  const stats = { movies: 0, series: 0, episodes: 0, artists: 0, albums: 0, tracks: 0, newItems: 0, errors: [] };
  console.log(`[Scanner] Starting targeted scan for library "${lib.name}" (id: ${lib.id}, type: ${lib.type})`);

  let paths = [];
  try {
    paths = lib.paths;
    if (typeof paths === 'string') paths = JSON.parse(paths);
  } catch (e) {}

  if (!Array.isArray(paths)) return stats;

  for (const rootPath of paths) {
    if (!rootPath) continue;
    try {
      if (lib.type === 'movies') {
        await scanMovies(stats, rootPath, lib.id);
      } else if (lib.type === 'shows') {
        await scanShows(stats, rootPath, lib.id);
      } else if (lib.type === 'music') {
        await scanMusic(stats, rootPath, lib.id);
      }
    } catch (e) {
      stats.errors.push(`${lib.type} (${rootPath}): ${e.message}`);
      console.error(`[Scanner] Error scanning ${lib.type}:`, e);
    }
  }

  console.log(`[Scanner] Targeted scan complete for "${lib.name}":`, stats);
  return stats;
}

export async function scanAll(options = {}) {
  const libraries = getAllLibraries();
  const stats = { movies: 0, series: 0, episodes: 0, artists: 0, albums: 0, tracks: 0, newItems: 0, errors: [] };
  console.log('[Scanner] Starting full scan for libraries:', libraries.map(l => l.name));

  for (const lib of libraries) {
    let paths = [];
    try {
      paths = lib.paths;
      if (typeof paths === 'string') paths = JSON.parse(paths);
    } catch (e) {}
    
    if (!Array.isArray(paths)) continue;

    for (const rootPath of paths) {
      if (!rootPath) continue;
      try {
        if (lib.type === 'movies') {
          await scanMovies(stats, rootPath, lib.id);
        } else if (lib.type === 'shows') {
          await scanShows(stats, rootPath, lib.id);
        } else if (lib.type === 'music') {
          await scanMusic(stats, rootPath, lib.id);
        }
      } catch (e) {
        stats.errors.push(`${lib.type} (${rootPath}): ${e.message}`);
        console.error(`[Scanner] Error scanning ${lib.type}:`, e);
      }
    }
  }

  console.log('[Scanner] Scan complete', stats);
  return stats;
}

// Find all video files recursively up to maxDepth
function findVideoFilesRecursive(dir, currentDepth = 0, maxDepth = 4) {
  let results = [];
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findVideoFilesRecursive(full, currentDepth + 1, maxDepth));
      } else if (isVideoFile(entry.name)) {
        results.push({ fullPath: full, dir, filename: entry.name });
      }
    }
  } catch (err) {
    console.error(`[Scanner] Error reading ${dir}:`, err.message);
  }
  return results;
}

async function scanMovies(stats, moviesRoot, libraryId) {
  if (!moviesRoot || !fs.existsSync(moviesRoot)) {
    console.log(`[Scanner] Movies path does not exist: "${moviesRoot}"`);
    return;
  }

  const videoFiles = findVideoFilesRecursive(moviesRoot, 0, 3);
  console.log(`[Scanner] Found ${videoFiles.length} video files in movies path`);

  const insertMovie = db.prepare(`
    INSERT INTO movies (title, year, path, duration, resolution, video_codec, audio_codec, plot, library_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      title = excluded.title,
      year = COALESCE(excluded.year, movies.year),
      duration = COALESCE(excluded.duration, movies.duration),
      resolution = COALESCE(excluded.resolution, movies.resolution),
      video_codec = COALESCE(excluded.video_codec, movies.video_codec),
      audio_codec = COALESCE(excluded.audio_codec, movies.audio_codec),
      plot = COALESCE(excluded.plot, movies.plot),
      library_id = excluded.library_id
  `);

  for (const { fullPath, dir, filename } of videoFiles) {
    // Yield with micro-delay to keep CPU low and leave system resources free
    await new Promise(r => setTimeout(r, 6));

    const base = path.basename(filename, path.extname(filename));

    // Look for NFO file
    let nfoData = null;
    const nfoCandidates = [
      path.join(dir, `${base}.nfo`),
      path.join(dir, `${filename}.nfo`),
      path.join(dir, 'movie.nfo')
    ];
    for (const nfoP of nfoCandidates) {
      if (fs.existsSync(nfoP)) {
        nfoData = parseNfoFile(nfoP);
        if (nfoData) break;
      }
    }

    // Clean title and year
    const cleaned = cleanMovieTitle(filename);
    const title = nfoData?.title || cleaned.title || base;
    const year = nfoData?.year || cleaned.year || null;
    const plot = nfoData?.plot || null;

    const existingMovie = db.prepare('SELECT duration, resolution, video_codec, audio_codec FROM movies WHERE path = ?').get(fullPath);
    if (!existingMovie) stats.newItems++;

    let probe = { duration: null, resolution: null, video_codec: null, audio_codec: null };
    if (existingMovie && existingMovie.duration && existingMovie.resolution) {
      probe = existingMovie;
    } else {
      try {
        probe = await probeMedia(fullPath);
      } catch {}
    }

    try {
      insertMovie.run(
        title,
        year,
        fullPath,
        probe.duration,
        probe.resolution,
        probe.video_codec,
        probe.audio_codec,
        plot,
        libraryId
      );
      stats.movies++;

      const movieRecord = db.prepare('SELECT id FROM movies WHERE path = ?').get(fullPath);
      if (movieRecord && nfoData?.rating) {
        // Normalize rating to 0.5 - 5.0 (NFO usually 0-10)
        let normalizedRating = nfoData.rating > 5 ? nfoData.rating / 2 : nfoData.rating;
        normalizedRating = Math.round(normalizedRating * 2) / 2; // round to half step
        if (normalizedRating >= 0.5 && normalizedRating <= 5.0) {
          db.prepare(`
            INSERT INTO ratings (user_id, media_type, media_id, rating, rated_at)
            VALUES (1, 'movie', ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, media_type, media_id) DO UPDATE SET rating=excluded.rating
          `).run(movieRecord.id, normalizedRating);
        }
      }

      if (movieRecord && nfoData?.genres) {
        assignTagsToMedia(nfoData.genres, 'movie', movieRecord.id);
      }

      // Check poster & backdrop in the same directory
      if (movieRecord) {
        await findAndAttachMovieImages(dir, filename, base, movieRecord.id);
      }
    } catch (e) {
      stats.errors.push(`Movie ${filename}: ${e.message}`);
    }
  }
}

async function findAndAttachMovieImages(dir, filename, base, movieId) {
  try {
    const files = fs.readdirSync(dir);
    const lowerFiles = files.map(f => f.toLowerCase());

    // Poster match
    const posterExact = [
      `${base}-poster.jpg`, `${base}-poster.webp`, `${base}-poster.png`, `${base}-poster.jpeg`,
      `${filename}-poster.webp`, `${filename}-poster.jpg`, `${filename}-poster.png`,
      `${base}.jpg`, `${base}.webp`, `${base}.png`, `${base}.jpeg`,
      `${base} poster.jpg`, `${base} poster.png`, `${base} poster.webp`,
      'poster.jpg', 'poster.webp', 'poster.png', 'folder.jpg', 'cover.jpg'
    ];

    let foundPoster = null;
    for (const cand of posterExact) {
      const idx = lowerFiles.indexOf(cand.toLowerCase());
      if (idx !== -1) {
        foundPoster = path.join(dir, files[idx]);
        break;
      }
    }

    if (foundPoster) {
      try {
        await processAndCacheImage(foundPoster, 'movie', movieId, 'poster', 'local_file');
      } catch (e) { console.warn('[Scanner Image Warning]:', e.message); }
    }

    // Backdrop match
    const backdropExact = [
      `${base}-fanart.jpg`, `${base}-fanart.png`, `${base}-fanart.webp`,
      `${base}-landscape.jpg`, `${base}-landscape.png`, `${base}-backdrop.jpg`,
      `${base} backdrop.jpg`, `${base} fanart.jpg`,
      'fanart.jpg', 'fanart.png', 'backdrop.jpg', 'background.jpg'
    ];

    let foundBackdrop = null;
    for (const cand of backdropExact) {
      const idx = lowerFiles.indexOf(cand.toLowerCase());
      if (idx !== -1) {
        foundBackdrop = path.join(dir, files[idx]);
        break;
      }
    }

    if (foundBackdrop) {
      try {
        await processAndCacheImage(foundBackdrop, 'movie', movieId, 'backdrop', 'local_file');
      } catch (e) { console.warn('[Scanner Image Warning]:', e.message); }
    }
  } catch (e) { console.warn('[Scanner Image Warning]:', e.message); }
}

export function groupVideosBySeason(showVideos, seriesPath) {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  // 1. Partition videos into subfolders (relative to seriesPath) vs root files
  const subFolderGroups = new Map();
  const rootVideos = [];

  for (const item of showVideos) {
    const rel = path.relative(seriesPath, item.dir);
    if (!rel || rel === '.') {
      rootVideos.push(item);
    } else {
      const topSub = rel.split(path.sep)[0];
      if (!subFolderGroups.has(topSub)) {
        subFolderGroups.set(topSub, []);
      }
      subFolderGroups.get(topSub).push(item);
    }
  }

  // 2. Determine season assignments for each subfolder
  const assignedFolders = new Map(); // folderName -> { seasonNum, seasonTitle, folderName }
  const usedSeasonNumbers = new Set();

  if (rootVideos.length > 0) {
    usedSeasonNumbers.add(1);
  }

  // Pass 1: Parse subfolders with explicit season names / numbers / ordinals
  for (const [folderName, items] of subFolderGroups.entries()) {
    const info = parseSeasonInfo(folderName);
    if (info && info.seasonNumber) {
      assignedFolders.set(folderName, {
        seasonNum: info.seasonNumber,
        seasonTitle: info.title || null,
        folderName
      });
      usedSeasonNumbers.add(info.seasonNumber);
    }
  }

  // Pass 2: If a subfolder has files with explicit S02E01, etc., use the file's season
  for (const [folderName, items] of subFolderGroups.entries()) {
    if (assignedFolders.has(folderName)) continue;
    const explicitFileSeasons = items
      .map(it => parseEpisodeFilename(it.filename))
      .filter(p => p.isExplicit && p.season != null && p.season > 0)
      .map(p => p.season);

    if (explicitFileSeasons.length > 0) {
      const counts = {};
      for (const s of explicitFileSeasons) counts[s] = (counts[s] || 0) + 1;
      const bestSeason = parseInt(Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b), 10);
      if (bestSeason && !usedSeasonNumbers.has(bestSeason)) {
        assignedFolders.set(folderName, {
          seasonNum: bestSeason,
          seasonTitle: folderName,
          folderName
        });
        usedSeasonNumbers.add(bestSeason);
      }
    }
  }

  // Pass 3: For remaining subfolders (custom names like "+كبريت", "متحف الدحيح", or documentary topics):
  // Assign next available season numbers sequentially
  const unassignedFolderNames = Array.from(subFolderGroups.keys())
    .filter(fn => !assignedFolders.has(fn))
    .sort((a, b) => collator.compare(a, b));

  let nextSeason = 1;
  for (const fn of unassignedFolderNames) {
    while (usedSeasonNumbers.has(nextSeason)) {
      nextSeason++;
    }
    assignedFolders.set(fn, {
      seasonNum: nextSeason,
      seasonTitle: fn,
      folderName: fn
    });
    usedSeasonNumbers.add(nextSeason);
    nextSeason++;
  }

  // 3. Assemble seasonsMap: seasonNum -> { seasonNum, seasonTitle, folderNames: [], videos: [] }
  const seasonsMap = new Map();

  if (rootVideos.length > 0) {
    seasonsMap.set(1, {
      seasonNum: 1,
      seasonTitle: null,
      folderNames: [],
      videos: rootVideos.map(v => ({ ...v, parsedEp: parseEpisodeFilename(v.filename), seasonNum: 1 }))
    });
  }

  for (const [folderName, items] of subFolderGroups.entries()) {
    const assignment = assignedFolders.get(folderName);
    const sNum = assignment.seasonNum;
    if (!seasonsMap.has(sNum)) {
      seasonsMap.set(sNum, {
        seasonNum: sNum,
        seasonTitle: assignment.seasonTitle,
        folderNames: [folderName],
        videos: []
      });
    } else {
      seasonsMap.get(sNum).folderNames.push(folderName);
      if (!seasonsMap.get(sNum).seasonTitle && assignment.seasonTitle) {
        seasonsMap.get(sNum).seasonTitle = assignment.seasonTitle;
      }
    }

    for (const item of items) {
      const parsedEp = parseEpisodeFilename(item.filename);
      seasonsMap.get(sNum).videos.push({
        ...item,
        parsedEp,
        seasonNum: sNum
      });
    }
  }

  return seasonsMap;
}

async function scanShows(stats, showsRoot, libraryId) {
  if (!showsRoot || !fs.existsSync(showsRoot)) {
    console.log(`[Scanner] Shows path does not exist: "${showsRoot}"`);
    return;
  }

  let seriesDirs = [];
  try {
    seriesDirs = fs.readdirSync(showsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
  } catch (err) {
    console.error(`[Scanner] Cannot read shows directory: ${err.message}`);
    return;
  }

  // If no subdirectories were found, check if showsRoot itself has video files directly
  if (seriesDirs.length === 0) {
    const rootVideos = findVideoFilesRecursive(showsRoot, 0, 1);
    if (rootVideos.length > 0) {
      seriesDirs = [{ name: path.basename(showsRoot), isSelfRoot: true }];
    }
  }

  const insertSeries = db.prepare('INSERT OR IGNORE INTO series (title, year, plot, library_id) VALUES (?, ?, ?, ?)');
  const getSeries = db.prepare('SELECT id FROM series WHERE title = ?');
  const insertSeason = db.prepare(`
    INSERT INTO seasons (series_id, season_number, title)
    VALUES (?, ?, ?)
    ON CONFLICT(series_id, season_number) DO UPDATE SET
      title = COALESCE(excluded.title, seasons.title)
  `);
  const getSeason = db.prepare('SELECT id, title FROM seasons WHERE series_id = ? AND season_number = ?');
  const insertEpisode = db.prepare(`
    INSERT INTO episodes (season_id, episode_number, title, path, duration, resolution)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      season_id = excluded.season_id,
      episode_number = excluded.episode_number,
      title = excluded.title,
      duration = COALESCE(excluded.duration, episodes.duration),
      resolution = COALESCE(excluded.resolution, episodes.resolution)
  `);

  for (const sDir of seriesDirs) {
    const seriesPath = sDir.isSelfRoot ? showsRoot : path.join(showsRoot, sDir.name);
    const rawTitle = sDir.name.trim();

    // Find all video files inside this series folder recursively
    const showVideos = findVideoFilesRecursive(seriesPath, 0, 3);
    if (showVideos.length === 0) {
      continue; // Skip empty directories
    }

    // Check for tvshow.nfo
    let seriesPlot = null;
    let seriesTitle = rawTitle;
    let seriesYear = null;
    let seriesGenres = null;
    const tvshowNfo = path.join(seriesPath, 'tvshow.nfo');
    if (fs.existsSync(tvshowNfo)) {
      const nfo = parseNfoFile(tvshowNfo);
      if (nfo?.title) seriesTitle = nfo.title;
      if (nfo?.plot) seriesPlot = nfo.plot;
      if (nfo?.year) seriesYear = parseInt(nfo.year, 10) || null;
      if (nfo?.genres) seriesGenres = nfo.genres;
    }

    // Check if series already exists to prevent duplicate empty records
    let seriesRow = db.prepare('SELECT id FROM series WHERE title = ? AND library_id = ?').get(seriesTitle, libraryId)
      || (seriesTitle !== rawTitle ? db.prepare('SELECT id FROM series WHERE title = ? AND library_id = ?').get(rawTitle, libraryId) : null)
      || db.prepare('SELECT id FROM series WHERE title = ?').get(seriesTitle)
      || db.prepare('SELECT id FROM series WHERE title = ?').get(rawTitle);

    let seriesId;
    if (!seriesRow) {
      try {
        const insertRes = insertSeries.run(seriesTitle, seriesYear, seriesPlot, libraryId);
        seriesId = insertRes.lastInsertRowid;
      } catch (err) {
        seriesRow = getSeries.get(seriesTitle) || getSeries.get(rawTitle);
        if (seriesRow) seriesId = seriesRow.id;
      }
    } else {
      seriesId = seriesRow.id;
      db.prepare('UPDATE series SET year = COALESCE(?, year), plot = COALESCE(?, plot), library_id = ? WHERE id = ?')
        .run(seriesYear, seriesPlot, libraryId, seriesId);
    }

    if (!seriesId) continue;
    stats.series++;

    if (seriesGenres) {
      assignTagsToMedia(seriesGenres, 'series', seriesId);
    }

    // Find and attach posters / backdrops for this series
    await findAndAttachSeriesImages(seriesPath, seriesId);

    // 1. Group videos by season using smart multi-season resolver
    const seasonsMap = groupVideosBySeason(showVideos, seriesPath);
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

    for (const [seasonNum, seasonData] of seasonsMap.entries()) {
      const { seasonTitle, videos: sVideos, folderNames } = seasonData;
      let seasonId;
      try {
        insertSeason.run(seriesId, seasonNum, seasonTitle);
        const seasonRow = getSeason.get(seriesId, seasonNum);
        if (!seasonRow) continue;
        seasonId = seasonRow.id;
        if (seasonTitle && (!seasonRow.title || seasonRow.title !== seasonTitle)) {
          db.prepare('UPDATE seasons SET title = ? WHERE id = ?').run(seasonTitle, seasonId);
        }
      } catch (e) {
        stats.errors.push(`Series ${seriesId} season ${seasonNum} error: ${e.message}`);
        continue;
      }

      // Sort files naturally by filename
      sVideos.sort((a, b) => collator.compare(a.filename, b.filename));

      // Collect explicitly defined episode numbers
      const explicitNumbers = new Set(
        sVideos
          .filter(v => v.parsedEp.isExplicit && v.parsedEp.episode != null)
          .map(v => v.parsedEp.episode)
      );
      const hasAnyExplicit = explicitNumbers.size > 0;
      let nextAutoNumber = 1;

      for (let i = 0; i < sVideos.length; i++) {
        // Yield with micro-delay to prevent CPU spike
        await new Promise(r => setTimeout(r, 6));
        const video = sVideos[i];
        let epNumber;

        if (hasAnyExplicit) {
          if (video.parsedEp.isExplicit && video.parsedEp.episode != null) {
            epNumber = video.parsedEp.episode;
          } else {
            while (explicitNumbers.has(nextAutoNumber)) {
              nextAutoNumber++;
            }
            epNumber = nextAutoNumber;
            nextAutoNumber++;
          }
        } else {
          // No files in this season have explicit numbers (e.g. YouTube / Documentaries)
          // Assign clean sequential numbering 1, 2, 3... based on sorted filename
          epNumber = i + 1;
        }

        // Check for episode NFO or clean filename title
        const base = path.basename(video.filename, path.extname(video.filename));
        const epNfoPath = path.join(video.dir, `${base}.nfo`);
        let epTitle = null;
        if (fs.existsSync(epNfoPath)) {
          const epNfo = parseNfoFile(epNfoPath);
          if (epNfo?.title) epTitle = epNfo.title;
        }
        if (!epTitle) {
          let cleanBase = base
            .replace(/\s*[\(\[]\s*\d{3,4}p[^\)\]]*[\)\]]/gi, '')
            .replace(/\b\d{3,4}p\b/gi, '')
            .replace(/\b\d{3,4}x\d{3,4}\b/gi, '')
            .replace(/\s*[\(\[]\s*(?:19|20)\d{2}\s*[\)\]]/gi, '')
            .replace(/_(?:Low|High|HD|FHD)\b/gi, '')
            .replace(/\s*@\S+/g, '')
            .replace(/^[\s_.-]+|[\s_.-]+$/g, '')
            .trim();

          const leadingMatch = cleanBase.match(/^(\d{1,3})\s*[-._]\s*(.+)$/);
          if (leadingMatch && leadingMatch[2]?.trim()) {
            cleanBase = leadingMatch[2].trim();
          }
          epTitle = cleanBase || `الحلقة ${epNumber}`;
        }

        const existingEpisode = db.prepare('SELECT duration, resolution FROM episodes WHERE path = ?').get(video.fullPath);
        if (!existingEpisode) stats.newItems++;

        let probe = { duration: null, resolution: null };
        if (existingEpisode && existingEpisode.duration && existingEpisode.resolution) {
          probe = existingEpisode;
        } else {
          try {
            probe = await probeMedia(video.fullPath);
          } catch {}
        }

        try {
          insertEpisode.run(seasonId, epNumber, epTitle, video.fullPath, probe.duration, probe.resolution);
          stats.episodes++;
        } catch (e) {
          stats.errors.push(e.message);
        }
      }
    }

    // Attach season posters if available
    try {
      const distinctSeasons = db.prepare('SELECT id, season_number, title FROM seasons WHERE series_id = ?').all(seriesId);
      for (const dSeason of distinctSeasons) {
        const sNum = dSeason.season_number;
        const sNumPadded = String(sNum).padStart(2, '0');
        const candidates = [
          path.join(seriesPath, `season${sNumPadded}-poster.jpg`),
          path.join(seriesPath, `season${sNumPadded}-poster.png`),
          path.join(seriesPath, `season${sNum}-poster.jpg`),
          path.join(seriesPath, `Season ${sNum}`, 'poster.jpg'),
          path.join(seriesPath, `Season ${sNum}`, 'folder.jpg'),
          path.join(seriesPath, `${sNum}`, 'poster.jpg'),
          path.join(seriesPath, `${sNum}`, 'folder.jpg')
        ];

        const seasonInfo = seasonsMap.get(sNum);
        if (seasonInfo?.folderNames) {
          for (const fn of seasonInfo.folderNames) {
            candidates.push(
              path.join(seriesPath, fn, 'poster.jpg'),
              path.join(seriesPath, fn, 'poster.png'),
              path.join(seriesPath, fn, 'folder.jpg'),
              path.join(seriesPath, fn, 'cover.jpg'),
              path.join(seriesPath, fn, 'front.jpg')
            );
          }
        }

        for (const cand of candidates) {
          if (fs.existsSync(cand)) {
            await processAndCacheImage(cand, 'season', dSeason.id, 'season_poster', 'local_file');
            break;
          }
        }
      }
    } catch {}
  }

  // Clean up any empty series or empty seasons that have 0 episodes
  try {
    cleanupEmptySeasons();
    cleanupEmptySeries();
  } catch (e) {
    console.error('[Scanner] Cleanup empty series error:', e.message);
  }
}

async function findAndAttachSeriesImages(seriesPath, seriesId) {
  try {
    const ser = db.prepare('SELECT title FROM series WHERE id = ?').get(seriesId);
    const cleanTitle = (ser?.title || '').replace(/[\\/:*?"<>|]/g, '').trim().toLowerCase();
    const files = fs.readdirSync(seriesPath);
    const lowerFiles = files.map(f => f.toLowerCase());

    const hasPoster = db.prepare(`SELECT id FROM images WHERE media_type='series' AND media_id=? AND image_type='poster'`).get(seriesId);
    if (!hasPoster) {
      const posterCandidates = [
        ...(cleanTitle ? [
          `${cleanTitle}-poster.jpg`, `${cleanTitle}-poster.jpeg`, `${cleanTitle}-poster.png`, `${cleanTitle}-poster.webp`,
          `${cleanTitle} poster.jpg`, `${cleanTitle} poster.png`
        ] : []),
        'poster.jpg', 'poster.jpeg', 'poster.png', 'poster.webp', 'folder.jpg', 'cover.jpg'
      ];
      for (const cand of posterCandidates) {
        const idx = lowerFiles.indexOf(cand);
        if (idx !== -1) {
          const full = path.join(seriesPath, files[idx]);
          await processAndCacheImage(full, 'series', seriesId, 'poster', 'local_file');
          break;
        }
      }
    }

    const hasBackdrop = db.prepare(`SELECT id FROM images WHERE media_type='series' AND media_id=? AND image_type='backdrop'`).get(seriesId);
    if (!hasBackdrop) {
      const backdropCandidates = [
        ...(cleanTitle ? [
          `${cleanTitle}-backdrop.jpg`, `${cleanTitle}-backdrop.jpeg`, `${cleanTitle}-backdrop.png`, `${cleanTitle}-backdrop.webp`,
          `${cleanTitle}-fanart.jpg`, `${cleanTitle}-landscape.jpg`,
          `${cleanTitle} backdrop.jpg`
        ] : []),
        'fanart.jpg', 'fanart.jpeg', 'fanart.png', 'fanart.webp', 'backdrop.jpg', 'background.jpg', 'banner.jpg'
      ];
      for (const cand of backdropCandidates) {
        const idx = lowerFiles.indexOf(cand);
        if (idx !== -1) {
          const full = path.join(seriesPath, files[idx]);
          await processAndCacheImage(full, 'series', seriesId, 'backdrop', 'local_file');
          break;
        }
      }
    }
  } catch (e) { console.warn('[Scanner Image Warning]:', e.message); }
}

// Find all audio files recursively
function findAudioFilesRecursive(dir, currentDepth = 0, maxDepth = 5) {
  let results = [];
  if (currentDepth > maxDepth || !fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findAudioFilesRecursive(full, currentDepth + 1, maxDepth));
      } else if (isAudioFile(entry.name)) {
        results.push({ fullPath: full, dir, filename: entry.name });
      }
    }
  } catch (err) {
    console.error(`[Scanner] Error reading audio ${dir}:`, err.message);
  }
  return results;
}

async function scanMusic(stats, musicRoot, libraryId) {
  if (!musicRoot || !fs.existsSync(musicRoot)) {
    console.log(`[Scanner] Music path does not exist: "${musicRoot}"`);
    return;
  }

  const norm = (s) => (s || '').toLowerCase().replace(/[-_.\s]+/g, ' ').trim();

  const insertArtist = db.prepare('INSERT OR IGNORE INTO artists (name, library_id) VALUES (?, ?)');
  const getArtist = db.prepare('SELECT id FROM artists WHERE name = ?');
  const insertAlbum = db.prepare('INSERT OR IGNORE INTO albums (artist_id, title, year, library_id) VALUES (?, ?, ?, ?)');
  const getAlbum = db.prepare('SELECT id FROM albums WHERE artist_id = ? AND title = ?');
  const insertTrack = db.prepare(`
    INSERT INTO tracks (album_id, title, track_number, duration, path, library_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      title = COALESCE(excluded.title, tracks.title),
      track_number = COALESCE(excluded.track_number, tracks.track_number),
      duration = COALESCE(excluded.duration, tracks.duration),
      library_id = excluded.library_id
  `);

  const audioFiles = findAudioFilesRecursive(musicRoot, 0, 5);
  console.log(`[Scanner] Found ${audioFiles.length} audio files in music path`);

  // Cache existing artists in memory for fast normalized matching
  let cachedArtists = db.prepare('SELECT id, name FROM artists').all();

  for (const { fullPath, dir, filename } of audioFiles) {
    // Yield with micro-delay to prevent CPU spike and keep disk I/O smooth
    await new Promise(r => setTimeout(r, 6));

    const rel = path.relative(musicRoot, fullPath);
    const parts = rel.split(path.sep);

    let folderArtist = parts.length > 1 ? parts[0] : null;
    let folderAlbum = parts.length > 2 ? parts[1] : null;

    let meta = { title: null, artist: null, album: null, year: null, trackNumber: null, duration: null, picture: null, genres: null };
    try {
      const parsed = await mm.parseFile(fullPath, { duration: true });
      meta.title = parsed.common.title;
      meta.artist = parsed.common.artist || parsed.common.albumartist;
      meta.album = parsed.common.album;
      meta.year = parsed.common.year;
      meta.trackNumber = parsed.common.track?.no;
      meta.duration = parsed.format.duration ? Math.round(parsed.format.duration) : null;
      meta.picture = parsed.common.picture?.[0] || null;
      meta.genres = parsed.common.genre || null;
    } catch {}

    const parsedFilename = parseTrackFilename(filename);

    const artistName = folderArtist || meta.artist || 'فنان غير معروف';
    const albumTitle = folderAlbum || meta.album || 'أغاني منفردة';
    const trackTitle = meta.title || parsedFilename.title || path.basename(filename, path.extname(filename));
    const trackNum = meta.trackNumber || parsedFilename.track || null;
    const duration = meta.duration || null;
    const yearMatch = albumTitle?.match(/\b(19\d\d|20\d\d)\b/);
    const year = meta.year || (yearMatch ? parseInt(yearMatch[1], 10) : null);

    try {
      // 1. Check if track already exists in database
      const existingTrack = db.prepare(`
        SELECT t.id, t.album_id, a.artist_id 
        FROM tracks t 
        JOIN albums a ON t.album_id = a.id 
        WHERE t.path = ?
      `).get(fullPath);

      let artistId = null;
      let albumId = null;

      if (existingTrack) {
        // Retain existing artist and album so renamed artists/albums are NOT duplicated!
        artistId = existingTrack.artist_id;
        albumId = existingTrack.album_id;
      } else {
        stats.newItems++;
        // New track: resolve artist carefully
        // A. If folderArtist is present, check if other tracks from the same artist directory belong to an artist
        if (folderArtist) {
          const artistDir = path.join(musicRoot, folderArtist);
          const matchDir = db.prepare(`
            SELECT a.artist_id 
            FROM tracks t 
            JOIN albums a ON t.album_id = a.id 
            WHERE t.path LIKE ? 
            LIMIT 1
          `).get(artistDir + '%');

          if (matchDir) {
            artistId = matchDir.artist_id;
          }
        }

        // B. Check exact name in DB
        if (!artistId) {
          const exactArtist = getArtist.get(artistName);
          if (exactArtist) artistId = exactArtist.id;
        }

        // C. Check normalized name (e.g. "AMR-DIAB" matches "AMR DIAB")
        if (!artistId) {
          const targetNorm = norm(artistName);
          const found = cachedArtists.find(a => norm(a.name) === targetNorm);
          if (found) artistId = found.id;
        }

        // D. Create new artist only if no match found
        if (!artistId) {
          insertArtist.run(artistName, libraryId);
          const newArtist = getArtist.get(artistName);
          if (newArtist) {
            artistId = newArtist.id;
            cachedArtists.push({ id: artistId, name: artistName });
          }
        }

        if (!artistId) continue;

        // Resolve album for new track
        let albumRow = getAlbum.get(artistId, albumTitle);
        if (!albumRow) {
          // Check normalized album title for this artist
          const targetAlbNorm = norm(albumTitle);
          const existingAlbums = db.prepare('SELECT id, title FROM albums WHERE artist_id = ?').all(artistId);
          albumRow = existingAlbums.find(a => norm(a.title) === targetAlbNorm);
        }

        if (!albumRow) {
          try {
            insertAlbum.run(artistId, albumTitle, year, libraryId);
            albumRow = getAlbum.get(artistId, albumTitle);
          } catch (e) {
            stats.errors.push(`Album ${albumTitle} error: ${e.message}`);
            continue;
          }
        }

        if (!albumRow) continue;
        albumId = albumRow.id;
      }

      // Update album year/library_id if year was extracted
      if (year) {
        db.prepare('UPDATE albums SET year = COALESCE(year, ?), library_id = COALESCE(library_id, ?) WHERE id = ?').run(year, libraryId, albumId);
      } else {
        db.prepare('UPDATE albums SET library_id = COALESCE(library_id, ?) WHERE id = ?').run(libraryId, albumId);
      }

      insertTrack.run(albumId, trackTitle, trackNum, duration, fullPath, libraryId);
      stats.tracks++;

      const trackRow = db.prepare('SELECT id FROM tracks WHERE path = ?').get(fullPath);
      if (trackRow && meta.genres) {
        assignTagsToMedia(meta.genres, 'track', trackRow.id);
        assignTagsToMedia(meta.genres, 'album', albumId);
        assignTagsToMedia(meta.genres, 'artist', artistId);
      }

      // Try embedded art if album has no cover
      if (meta.picture) {
        const hasCover = db.prepare('SELECT 1 FROM images WHERE media_type = ? AND media_id = ?').get('album', albumId);
        if (!hasCover) {
          try {
            await extractAndCacheEmbeddedArt(fullPath, albumId);
          } catch {}
        }
      }
    } catch (e) {
      stats.errors.push(e.message);
    }
  }

  // Clean up any empty albums or empty artists that have 0 tracks
  try {
    cleanupEmptyAlbums();
    cleanupEmptyArtists();
  } catch (e) {
    console.error('[Scanner] Cleanup empty music error:', e.message);
  }

  // Count unique artists and albums that have tracks
  stats.artists = db.prepare(`
    SELECT COUNT(*) as c FROM artists 
    WHERE (library_id = ? OR (? = 3 AND library_id IS NULL))
    AND EXISTS (SELECT 1 FROM albums JOIN tracks ON tracks.album_id = albums.id WHERE albums.artist_id = artists.id)
  `).get(libraryId, libraryId)?.c || 0;

  stats.albums = db.prepare(`
    SELECT COUNT(*) as c FROM albums 
    WHERE (library_id = ? OR (? = 3 AND library_id IS NULL))
    AND EXISTS (SELECT 1 FROM tracks WHERE tracks.album_id = albums.id)
  `).get(libraryId, libraryId)?.c || 0;
}

/**
 * Targeted scan for a single series (and optionally a single season).
 * Prunes deleted episodes, discovers new files, updates metadata,
 * assigns clean sequential numbering, and updates artwork.
 */
export async function scanSingleSeries(seriesId, targetSeasonId = null) {
  const ser = db.prepare(`
    SELECT series.*, libraries.paths as lib_paths 
    FROM series 
    LEFT JOIN libraries ON libraries.id = series.library_id 
    WHERE series.id = ?
  `).get(seriesId);
  if (!ser) throw new Error(`المسلسل برقم ${seriesId} غير موجود.`);

  let libPaths = [];
  try {
    libPaths = typeof ser.lib_paths === 'string' ? JSON.parse(ser.lib_paths) : (ser.lib_paths || []);
  } catch {}
  if (!Array.isArray(libPaths)) libPaths = [];

  const existingEpisodes = db.prepare(`
    SELECT episodes.id, episodes.path, episodes.season_id, seasons.season_number
    FROM episodes 
    JOIN seasons ON seasons.id = episodes.season_id 
    WHERE seasons.series_id = ?
  `).all(seriesId);

  let seriesPath = null;

  // 1. Locate seriesPath from existing episodes
  if (existingEpisodes.length > 0) {
    for (const lp of libPaths) {
      if (existingEpisodes[0].path.toLowerCase().startsWith(lp.toLowerCase())) {
        const rel = path.relative(lp, existingEpisodes[0].path);
        const topDir = rel.split(path.sep)[0];
        const candidate = path.join(lp, topDir);
        if (fs.existsSync(candidate)) {
          seriesPath = candidate;
          break;
        }
      }
    }
    if (!seriesPath) {
      seriesPath = path.dirname(existingEpisodes[0].path);
      if (parseSeasonFolder(path.basename(seriesPath)) !== null) {
        seriesPath = path.dirname(seriesPath);
      }
    }
  }

  // 2. If still not found, check library roots
  if (!seriesPath || !fs.existsSync(seriesPath)) {
    for (const lp of libPaths) {
      const candidate = path.join(lp, ser.title);
      if (fs.existsSync(candidate)) {
        seriesPath = candidate;
        break;
      }
      try {
        const subdirs = fs.readdirSync(lp, { withFileTypes: true }).filter(d => d.isDirectory());
        for (const d of subdirs) {
          if (d.name.trim() === ser.title || cleanMovieTitle(d.name).title === ser.title) {
            seriesPath = path.join(lp, d.name);
            break;
          }
        }
      } catch {}
      if (seriesPath) break;
    }
  }

  if (!seriesPath || !fs.existsSync(seriesPath)) {
    throw new Error(`تعذر العثور على مجلد المسلسل "${ser.title}" على القرص الصلب.`);
  }

  const stats = {
    added: 0,
    updated: 0,
    deleted: 0,
    total: 0,
    errors: []
  };

  // 3. Prune deleted files
  for (const ep of existingEpisodes) {
    if (targetSeasonId && ep.season_id !== targetSeasonId) continue;
    if (!fs.existsSync(ep.path)) {
      db.prepare('DELETE FROM episodes WHERE id = ?').run(ep.id);
      stats.deleted++;
    }
  }

  // 4. Find all video files on disk
  const showVideos = findVideoFilesRecursive(seriesPath, 0, 3);
  if (showVideos.length === 0) {
    cleanupEmptySeasons();
    return stats;
  }

  // 5. Update series posters / fanart
  await findAndAttachSeriesImages(seriesPath, seriesId);

  const insertSeason = db.prepare(`
    INSERT INTO seasons (series_id, season_number, title)
    VALUES (?, ?, ?)
    ON CONFLICT(series_id, season_number) DO UPDATE SET
      title = COALESCE(excluded.title, seasons.title)
  `);
  const getSeason = db.prepare('SELECT id, title FROM seasons WHERE series_id = ? AND season_number = ?');
  const insertEpisode = db.prepare(`
    INSERT INTO episodes (season_id, episode_number, title, path, duration, resolution)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(path) DO UPDATE SET
      season_id = excluded.season_id,
      episode_number = excluded.episode_number,
      title = excluded.title,
      duration = COALESCE(excluded.duration, episodes.duration),
      resolution = COALESCE(excluded.resolution, episodes.resolution)
  `);

  // Group files by season using smart multi-season resolver
  const seasonsMap = groupVideosBySeason(showVideos, seriesPath);
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  for (const [seasonNum, seasonData] of seasonsMap.entries()) {
    const { seasonTitle, videos: sVideos, folderNames } = seasonData;
    let seasonId;
    try {
      insertSeason.run(seriesId, seasonNum, seasonTitle);
      const seasonRow = getSeason.get(seriesId, seasonNum);
      if (!seasonRow) continue;
      seasonId = seasonRow.id;
      if (seasonTitle && (!seasonRow.title || seasonRow.title !== seasonTitle)) {
        db.prepare('UPDATE seasons SET title = ? WHERE id = ?').run(seasonTitle, seasonId);
      }
    } catch (e) {
      stats.errors.push(`Season ${seasonNum} error: ${e.message}`);
      continue;
    }

    // If a specific season was targeted, skip other seasons
    if (targetSeasonId && seasonId !== targetSeasonId) continue;

    sVideos.sort((a, b) => collator.compare(a.filename, b.filename));

    const explicitNumbers = new Set(
      sVideos
        .filter(v => v.parsedEp.isExplicit && v.parsedEp.episode != null)
        .map(v => v.parsedEp.episode)
    );
    const hasAnyExplicit = explicitNumbers.size > 0;
    let nextAutoNumber = 1;

    for (let i = 0; i < sVideos.length; i++) {
      const video = sVideos[i];
      let epNumber;

      if (hasAnyExplicit) {
        if (video.parsedEp.isExplicit && video.parsedEp.episode != null) {
          epNumber = video.parsedEp.episode;
        } else {
          while (explicitNumbers.has(nextAutoNumber)) {
            nextAutoNumber++;
          }
          epNumber = nextAutoNumber;
          nextAutoNumber++;
        }
      } else {
        epNumber = i + 1;
      }

      const base = path.basename(video.filename, path.extname(video.filename));
      const epNfoPath = path.join(video.dir, `${base}.nfo`);
      let epTitle = null;
      if (fs.existsSync(epNfoPath)) {
        const epNfo = parseNfoFile(epNfoPath);
        if (epNfo?.title) epTitle = epNfo.title;
      }
      if (!epTitle) {
        let cleanBase = base
          .replace(/\s*[\(\[]\s*\d{3,4}p[^\)\]]*[\)\]]/gi, '')
          .replace(/\b\d{3,4}p\b/gi, '')
          .replace(/\b\d{3,4}x\d{3,4}\b/gi, '')
          .replace(/\s*[\(\[]\s*(?:19|20)\d{2}\s*[\)\]]/gi, '')
          .replace(/_(?:Low|High|HD|FHD)\b/gi, '')
          .replace(/\s*@\S+/g, '')
          .replace(/^[\s_.-]+|[\s_.-]+$/g, '')
          .trim();

        const leadingMatch = cleanBase.match(/^(\d{1,3})\s*[-._]\s*(.+)$/);
        if (leadingMatch && leadingMatch[2]?.trim()) {
          cleanBase = leadingMatch[2].trim();
        }
        epTitle = cleanBase || `الحلقة ${epNumber}`;
      }

      const existingEpisode = db.prepare('SELECT id, duration, resolution FROM episodes WHERE path = ?').get(video.fullPath);
      if (!existingEpisode) {
        stats.added++;
      } else {
        stats.updated++;
      }

      let probe = { duration: null, resolution: null };
      if (existingEpisode && existingEpisode.duration && existingEpisode.resolution) {
        probe = existingEpisode;
      } else {
        try {
          probe = await probeMedia(video.fullPath);
        } catch {}
      }

      try {
        insertEpisode.run(seasonId, epNumber, epTitle, video.fullPath, probe.duration, probe.resolution);
      } catch (e) {
        stats.errors.push(e.message);
      }
    }

    // Attach season artwork if available
    try {
      const sNumPadded = String(seasonNum).padStart(2, '0');
      const candidates = [
        path.join(seriesPath, `season${sNumPadded}-poster.jpg`),
        path.join(seriesPath, `season${sNumPadded}-poster.png`),
        path.join(seriesPath, `season${seasonNum}-poster.jpg`),
        path.join(seriesPath, `Season ${seasonNum}`, 'poster.jpg'),
        path.join(seriesPath, `Season ${seasonNum}`, 'folder.jpg'),
        path.join(seriesPath, `${seasonNum}`, 'poster.jpg'),
        path.join(seriesPath, `${seasonNum}`, 'folder.jpg')
      ];

      if (folderNames) {
        for (const fn of folderNames) {
          candidates.push(
            path.join(seriesPath, fn, 'poster.jpg'),
            path.join(seriesPath, fn, 'poster.png'),
            path.join(seriesPath, fn, 'folder.jpg'),
            path.join(seriesPath, fn, 'cover.jpg'),
            path.join(seriesPath, fn, 'front.jpg')
          );
        }
      }

      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          await processAndCacheImage(cand, 'season', seasonId, 'season_poster', 'local_file');
          break;
        }
      }
    } catch {}
  }

  cleanupEmptySeasons();

  stats.total = db.prepare(`
    SELECT COUNT(*) as c 
    FROM episodes 
    JOIN seasons ON seasons.id = episodes.season_id 
    WHERE seasons.series_id = ? ${targetSeasonId ? 'AND seasons.id = ?' : ''}
  `).get(...(targetSeasonId ? [seriesId, targetSeasonId] : [seriesId]))?.c || 0;

  return stats;
}

/**
 * Targeted scan for a single season.
 */
export async function scanSingleSeason(seasonId) {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId);
  if (!season) throw new Error(`الموسم برقم ${seasonId} غير موجود.`);

  const stats = await scanSingleSeries(season.series_id, seasonId);
  return { stats, seasonId, seriesId: season.series_id };
}

/**
 * Targeted scan for a single artist.
 */
export async function scanSingleArtist(artistId) {
  const artist = db.prepare('SELECT id, name, library_id FROM artists WHERE id = ?').get(artistId);
  if (!artist) throw new Error(`الفنان برقم ${artistId} غير موجود.`);
  
  const stats = { movies: 0, series: 0, episodes: 0, artists: 0, albums: 0, tracks: 0, newItems: 0, errors: [] };
  
  // Find all unique directories of this artist's tracks
  const tracks = db.prepare(`
    SELECT t.path 
    FROM tracks t 
    JOIN albums a ON t.album_id = a.id 
    WHERE a.artist_id = ?
  `).all(artistId);

  if (tracks.length === 0) {
    throw new Error('لم يتم العثور على مسارات خاصة بهذا الفنان.');
  }

  const dirs = new Set();
  for (const track of tracks) {
    if (track.path && fs.existsSync(track.path)) {
      dirs.add(path.dirname(track.path));
    }
  }

  const uniqueDirs = Array.from(dirs);
  if (uniqueDirs.length === 0) {
    throw new Error('مسارات الفنان غير موجودة على القرص.');
  }

  const parentDirs = new Set();
  for (const dir of uniqueDirs) {
    parentDirs.add(dir);
    const parent = path.dirname(dir);
    if (path.basename(parent).toLowerCase().includes(artist.name.toLowerCase())) {
      parentDirs.add(parent);
    }
  }

  const dirsToScan = Array.from(parentDirs);

  for (const dir of dirsToScan) {
    if (fs.existsSync(dir)) {
      try {
        await scanMusic(stats, dir, artist.library_id);
      } catch (e) {
        stats.errors.push(e.message);
      }
    }
  }
  
  return { stats, artistId };
}

/**
 * Targeted scan for a single album.
 */
export async function scanSingleAlbum(albumId) {
  const album = db.prepare('SELECT id, title, library_id FROM albums WHERE id = ?').get(albumId);
  if (!album) throw new Error(`الألبوم برقم ${albumId} غير موجود.`);

  const stats = { movies: 0, series: 0, episodes: 0, artists: 0, albums: 0, tracks: 0, newItems: 0, errors: [] };

  const track = db.prepare('SELECT path FROM tracks WHERE album_id = ? LIMIT 1').get(albumId);
  if (!track || !track.path || !fs.existsSync(track.path)) {
    throw new Error('لم يتم العثور على مسار للألبوم على القرص.');
  }

  const albumDir = path.dirname(track.path);
  
  if (fs.existsSync(albumDir)) {
    try {
      await scanMusic(stats, albumDir, album.library_id);
    } catch (e) {
      stats.errors.push(e.message);
    }
  }

  return { stats, albumId };
}
