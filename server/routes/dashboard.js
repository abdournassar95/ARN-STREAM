import express from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();
router.use(requireAdmin);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get basic disk info (Node >= 19.6.0 has fs.statfsSync)
function getDiskStats(checkPath = __dirname) {
  try {
    if (fs.statfsSync) {
      const stats = fs.statfsSync(checkPath);
      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      return { totalBytes, freeBytes, usedBytes: totalBytes - freeBytes };
    }
  } catch (e) {
    console.error('Failed to get disk stats:', e.message);
  }
  return { totalBytes: 0, freeBytes: 0, usedBytes: 0 };
}

router.get('/stats', (req, res) => {
  try {
    // 1. System Stats
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();
    // Calculate simple CPU load based on os.loadavg() (returns average load over 1, 5, 15 min)
    // Note: loadavg() is less accurate on Windows, but sufficient for a basic dashboard
    const cpuLoad = os.loadavg()[0]; 
    const uptime = os.uptime();
    
    // Attempt to get disk stats for the drive where the DB/app is located
    const diskStats = getDiskStats(path.join(__dirname, '..', 'data'));

    // 2. Database Stats (Unmatched items)
    const unmatchedMovies = db.prepare(`SELECT COUNT(*) as c FROM movies WHERE tmdb_id IS NULL OR tmdb_id = ''`).get().c;
    const unmatchedSeries = db.prepare(`SELECT COUNT(*) as c FROM series WHERE tmdb_id IS NULL OR tmdb_id = ''`).get().c;
    // Assuming tracks don't have TMDB, but if we have images we can check if they are placeholder
    const placeholderImages = db.prepare(`SELECT COUNT(*) as c FROM images WHERE source = 'placeholder'`).get().c;

    // 3. Active Streams / Tasks
    // `global.activeStreams` is expected to be maintained by `stream.js`
    const activeStreams = global.activeStreams ? Object.values(global.activeStreams) : [];
    
    const activeDirectPlays = activeStreams.filter(s => s.type === 'direct').length;
    const activeTranscodes = activeStreams.filter(s => s.type === 'transcode').length;

    res.json({
      data: {
        server: {
          uptime,
          platform: os.platform(),
          cpuModel: cpus[0]?.model,
          cpuCores: cpus.length,
          cpuLoad,
        },
        memory: {
          total: totalMem,
          free: freeMem,
          used: totalMem - freeMem,
          usagePercent: ((totalMem - freeMem) / totalMem) * 100
        },
        storage: {
          total: diskStats.totalBytes,
          free: diskStats.freeBytes,
          used: diskStats.usedBytes,
          usagePercent: diskStats.totalBytes ? (diskStats.usedBytes / diskStats.totalBytes) * 100 : 0
        },
        unmatched: {
          movies: unmatchedMovies,
          series: unmatchedSeries,
          images: placeholderImages
        },
        streams: {
          total: activeStreams.length,
          direct: activeDirectPlays,
          transcode: activeTranscodes,
          tasks: activeStreams
        }
      }
    });
  } catch (err) {
    console.error('[Dashboard Error]', err);
    res.status(500).json({ error: { code: 'DASHBOARD_ERROR', message: err.message } });
  }
});

export default router;
