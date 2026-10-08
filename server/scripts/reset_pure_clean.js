import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const appDataDb = path.join(appData, 'ARN_Stream', 'data', 'media.db');
const backupDir = path.resolve(__dirname, '../../backups');
const cleanDbPath = path.join(backupDir, 'clean_media.db');

console.log('App Data DB:', appDataDb);

function resetDb(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist:', filePath);
    return;
  }
  const db = new Database(filePath);
  db.pragma('foreign_keys = OFF');
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
  console.log('Tables in', filePath, ':', tables);

  const tx = db.transaction(() => {
    for (const t of tables) {
      db.prepare(`DELETE FROM ${t}`).run();
    }
    // Vacuum and reset auto-increment sequences
    try {
      db.prepare("DELETE FROM sqlite_sequence").run();
    } catch (e) {}
  });

  tx();
  db.pragma('foreign_keys = ON');
  db.exec('VACUUM');

  const userCount = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
  const libCount = db.prepare("SELECT COUNT(*) as c FROM libraries").get().c;
  console.log(`✅ [${filePath}] Reset complete -> Users: ${userCount}, Libraries: ${libCount}`);
  db.close();
}

// Reset both AppData DB and clean_media.db template
resetDb(cleanDbPath);
resetDb(appDataDb);
