import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDir = path.resolve(__dirname, '../../backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const appDataDb = path.join(appData, 'ARN_Stream', 'data', 'media.db');
const fallbackDb = path.resolve(__dirname, '../data/media.db');
const srcDb = fs.existsSync(appDataDb) ? appDataDb : fallbackDb;

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = path.join(backupDir, `media_dev_backup_${timestamp}.db`);
fs.copyFileSync(srcDb, backupFile);
console.log('✅ Live active DB backed up successfully at:', backupFile);

// Create clean database template
const cleanDbPath = path.join(backupDir, 'clean_media.db');
if (fs.existsSync(cleanDbPath)) {
  fs.unlinkSync(cleanDbPath);
}

const dbSource = new Database(srcDb);
const dbClean = new Database(cleanDbPath);

// Clone schema
const schemaRows = dbSource.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND type IN ('table', 'index', 'trigger') AND name NOT LIKE 'sqlite_%'").all();
dbClean.exec('PRAGMA foreign_keys = OFF;');
for (const row of schemaRows) {
  try {
    dbClean.exec(row.sql);
  } catch (e) {
    console.error('Error creating schema object:', e.message);
  }
}
dbClean.exec('PRAGMA foreign_keys = ON;');

const tables = dbClean.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
const usersCount = dbClean.prepare('SELECT COUNT(*) as c FROM users').get().c;
const librariesCount = dbClean.prepare('SELECT COUNT(*) as c FROM libraries').get().c;

console.log('✅ Clean DB tables created:', tables);
console.log(`✅ Clean DB users count: ${usersCount} (Ready for fresh onboarding)`);
console.log(`✅ Clean DB libraries count: ${librariesCount}`);

dbSource.close();
dbClean.close();
console.log('✅ Clean DB created at:', cleanDbPath);
