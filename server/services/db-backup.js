import fs from 'fs';
import path from 'path';
import { getDataDir, dbPath } from '../db.js';

const getBackupsDir = () => {
  const dir = path.join(getDataDir(), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

export function runBackup() {
  try {
    const backupsDir = getBackupsDir();
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const HH = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    
    const filename = `media_backup_${YYYY}-${MM}-${DD}_${HH}-${mm}.db`;
    const destPath = path.join(backupsDir, filename);
    
    fs.copyFileSync(dbPath, destPath);
    
    const size = fs.statSync(destPath).size;
    console.log(`[DB Backup] ✅ Backup created: ${filename}`);
    
    // Keep only last 7 backups
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith('media_backup_') && f.endsWith('.db'))
      .sort((a, b) => {
        // sort by filename which includes YYYY-MM-DD_HH-mm
        return b.localeCompare(a); // descending
      });
      
    if (files.length > 7) {
      const toDelete = files.slice(7);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(backupsDir, file));
        console.log(`[DB Backup] 🗑️ Removed old backup: ${file}`);
      }
    }
    
    return { success: true, filename, size };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function scheduleBackups(intervalHours = 24) {
  setInterval(() => {
    runBackup();
  }, intervalHours * 60 * 60 * 1000);
}

export function listBackups() {
  const backupsDir = getBackupsDir();
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('media_backup_') && f.endsWith('.db'))
    .sort((a, b) => b.localeCompare(a));
    
  return files.map(filename => {
    const stat = fs.statSync(path.join(backupsDir, filename));
    return {
      filename,
      size: stat.size,
      date: stat.mtime
    };
  });
}

export function restoreBackup(filename, confirm = false) {
  if (!confirm) {
    return { success: false, error: 'Confirmation required to restore backup' };
  }
  
  try {
    const backupsDir = getBackupsDir();
    const sourcePath = path.join(backupsDir, filename);
    
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: 'Backup file not found' };
    }
    
    fs.copyFileSync(sourcePath, dbPath);
    console.log(`[DB Backup] 🔄 Backup restored: ${filename}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
