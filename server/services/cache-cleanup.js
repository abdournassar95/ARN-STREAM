import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const coversCacheDir = path.join(appData, 'ARN_Stream', 'data', 'covers_cache');

/**
 * Cleans up redundant/duplicate album covers and orphaned cache files in covers_cache.
 * Keeps exactly 1 primary cover per album and removes all duplicate files and unreferenced cache files.
 */
export function cleanupCoversCache() {
  const result = {
    deletedDbRows: 0,
    deletedFiles: 0,
    freedBytes: 0,
    remainingFiles: 0
  };

  try {
    // 1. For albums, find all images where is_primary = 0
    // Because is_primary = 1 represents the active cover for each album
    const duplicates = db.prepare(`
      SELECT id, cached_path, thumbnail_path 
      FROM images 
      WHERE media_type = 'album' AND is_primary = 0
    `).all();

    const deleteStmt = db.prepare('DELETE FROM images WHERE id = ?');
    const deleteTx = db.transaction((rows) => {
      for (const row of rows) {
        deleteStmt.run(row.id);
        result.deletedDbRows++;
      }
    });

    if (duplicates.length > 0) {
      deleteTx(duplicates);
    }

    // 2. Query all remaining active paths in images table
    const activeRows = db.prepare(`
      SELECT cached_path, thumbnail_path FROM images
    `).all();

    const activeFilesSet = new Set();
    for (const r of activeRows) {
      if (r.cached_path) activeFilesSet.add(path.normalize(r.cached_path).toLowerCase());
      if (r.thumbnail_path) activeFilesSet.add(path.normalize(r.thumbnail_path).toLowerCase());
    }

    // 3. Scan coversCacheDir and delete any file not in activeFilesSet
    if (fs.existsSync(coversCacheDir)) {
      const diskFiles = fs.readdirSync(coversCacheDir);
      for (const file of diskFiles) {
        const fullPath = path.join(coversCacheDir, file);
        const norm = path.normalize(fullPath).toLowerCase();
        if (!activeFilesSet.has(norm)) {
          try {
            const stat = fs.statSync(fullPath);
            result.freedBytes += stat.size;
            fs.unlinkSync(fullPath);
            result.deletedFiles++;
          } catch (e) {
            // Ignore if in use
          }
        } else {
          result.remainingFiles++;
        }
      }
    }

    console.log(`[Cache Cleanup] Removed ${result.deletedDbRows} duplicate DB rows, deleted ${result.deletedFiles} orphaned files, freed ${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB. Remaining: ${result.remainingFiles} files.`);
  } catch (err) {
    console.error('[Cache Cleanup] Error during cleanup:', err.message);
  }

  return result;
}
