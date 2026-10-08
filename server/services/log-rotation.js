import fs from 'fs';
import path from 'path';
import { getDataDir } from '../db.js';

export function rotateServerLog() {
  try {
    const logDir = path.dirname(getDataDir());
    const logFile = path.join(logDir, 'server.log');
    
    if (!fs.existsSync(logFile)) return;
    
    const stat = fs.statSync(logFile);
    const sizeMB = stat.size / (1024 * 1024);
    
    if (sizeMB > 10) {
      const now = new Date();
      const YYYY = now.getFullYear();
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const DD = String(now.getDate()).padStart(2, '0');
      
      // If a log file for today already exists, append a timestamp
      let rotatedFile = `${logFile}.${YYYY}-${MM}-${DD}`;
      if (fs.existsSync(rotatedFile)) {
        const HH = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        rotatedFile = `${logFile}.${YYYY}-${MM}-${DD}_${HH}-${mm}-${ss}`;
      }
      
      fs.renameSync(logFile, rotatedFile);
      fs.writeFileSync(logFile, ''); // create fresh empty log file
      
      console.log(`[Log Rotation] Rotated server.log (was ${Math.round(sizeMB)} MB)`);
      
      // Keep only the last 5 rotated log files
      const files = fs.readdirSync(logDir)
        .filter(f => f.startsWith('server.log.') && f !== 'server.log')
        .sort((a, b) => b.localeCompare(a));
        
      if (files.length > 5) {
        const toDelete = files.slice(5);
        for (const file of toDelete) {
          fs.unlinkSync(path.join(logDir, file));
        }
      }
    }
  } catch (err) {
    console.error('[Log Rotation] Error:', err.message);
  }
}

export function scheduleLogRotation() {
  setInterval(() => {
    rotateServerLog();
  }, 12 * 60 * 60 * 1000);
}
