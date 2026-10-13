import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { getSetting, setSetting, getLibraryFolders, setLibraryFolders, clearMediaData } from '../db.js';
import { requireAdmin } from '../services/auth.js';
import { startDlna, stopDlna } from '../services/dlna.js';

const router = express.Router();

function getFolderStatus(p) {
  if (!p || typeof p !== 'string' || !p.trim()) {
    return { path: '', exists: false, isDirectory: false };
  }
  const cleanPath = p.trim();
  try {
    const exists = fs.existsSync(cleanPath);
    const isDirectory = exists ? fs.statSync(cleanPath).isDirectory() : false;
    return { path: cleanPath, exists, isDirectory };
  } catch {
    return { path: cleanPath, exists: false, isDirectory: false };
  }
}

function getAvailableDrives() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const drives = [];
  for (const letter of letters) {
    const driveRoot = `${letter}:\\`;
    try {
      if (fs.existsSync(driveRoot)) {
        drives.push(driveRoot);
      }
    } catch {}
  }
  return drives.length > 0 ? drives : ['C:\\'];
}

router.get('/network', (req, res) => {
  const nets = os.networkInterfaces();
  const interfaces = [];
  let primaryIp = '127.0.0.1';

  for (const [name, netList] of Object.entries(nets)) {
    if (!Array.isArray(netList)) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        interfaces.push({
          name,
          address: net.address
        });
        if (primaryIp === '127.0.0.1' || name.toLowerCase().includes('wi-fi') || name.toLowerCase().includes('wlan')) {
          primaryIp = net.address;
        }
      }
    }
  }

  const port = getSetting('server_port', '8096');
  const serverUrl = `http://${primaryIp}:${port}`;

  res.json({
    data: {
      ip: primaryIp,
      port: Number(port),
      serverUrl,
      interfaces
    }
  });
});

router.get('/general', (req, res) => {
  res.json({
    data: {
      port: getSetting('server_port', '8096'),
      dlnaEnabled: getSetting('dlna_enabled', 'true') === 'true'
    }
  });
});

router.post('/general', requireAdmin, (req, res) => {
  const { port, dlnaEnabled } = req.body || {};
  if (port) setSetting('server_port', String(port));
  if (dlnaEnabled !== undefined) {
    const isEnabled = dlnaEnabled === true || dlnaEnabled === 'true';
    setSetting('dlna_enabled', isEnabled ? 'true' : 'false');
    try {
      if (isEnabled) {
        const p = Number(port || getSetting('server_port', '8096'));
        startDlna(p);
      } else {
        stopDlna();
      }
    } catch (e) {
      console.warn('[Settings DLNA Toggle Warning]:', e.message);
    }
  }
  res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح.' });
});

router.get('/volume', (req, res) => {
  const vol = parseFloat(getSetting('user_volume', '0.8'));
  const muted = getSetting('user_muted', 'false') === 'true';
  res.json({ data: { volume: isNaN(vol) ? 0.8 : vol, muted } });
});

router.post('/volume', requireAdmin, (req, res) => {
  const { volume, muted } = req.body || {};
  if (volume !== undefined) {
    setSetting('user_volume', String(Math.max(0, Math.min(1, Number(volume)))));
  }
  if (muted !== undefined) {
    setSetting('user_muted', muted ? 'true' : 'false');
  }
  res.json({ success: true });
});

router.get('/folders', requireAdmin, (req, res) => {
  const categories = ['movies', 'shows', 'music', 'posters'];
  const data = {};

  for (const cat of categories) {
    const paths = getLibraryFolders(cat);
    data[cat] = paths.map(p => getFolderStatus(p));
  }

  res.json({ data });
});

router.post('/folders', requireAdmin, (req, res) => {
  const body = req.body || {};
  const categories = ['movies', 'shows', 'music', 'posters'];

  for (const cat of categories) {
    // Check if plural array was sent e.g. movies_paths: [...]
    if (Array.isArray(body[`${cat}_paths`])) {
      setLibraryFolders(cat, body[`${cat}_paths`]);
    } else if (typeof body[`${cat}_path`] === 'string') {
      // Legacy single path fallback
      setLibraryFolders(cat, [body[`${cat}_path`]]);
    }
  }

  const data = {};
  for (const cat of categories) {
    const paths = getLibraryFolders(cat);
    data[cat] = paths.map(p => getFolderStatus(p));
  }

  res.json({
    data,
    message: 'Settings saved successfully'
  });
});

router.post('/validate-path', requireAdmin, (req, res) => {
  const { folderPath } = req.body || {};
  if (!folderPath || typeof folderPath !== 'string') {
    return res.json({ data: { path: '', exists: false, isDirectory: false } });
  }
  res.json({ data: getFolderStatus(folderPath) });
});

// Browse folders from the server filesystem (Admin only)
router.get('/browse', requireAdmin, (req, res) => {
  try {
    const queryPath = req.query.path ? String(req.query.path).trim() : '';
    const drives = getAvailableDrives();

    if (!queryPath) {
      return res.json({
        data: {
          current: null,
          parent: null,
          drives,
          folders: drives.map(d => ({ name: d, path: d }))
        }
      });
    }

    const resolved = path.resolve(queryPath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      return res.status(400).json({ error: { code: 'INVALID_PATH', message: 'Directory does not exist' } });
    }

    const items = fs.readdirSync(resolved, { withFileTypes: true });
    const folders = items
      .filter(item => {
        if (!item.isDirectory()) return false;
        // Exclude system / hidden directories
        if (item.name.startsWith('$') || item.name.startsWith('.')) return false;
        if (item.name.toLowerCase() === 'system volume information') return false;
        return true;
      })
      .map(item => ({
        name: item.name,
        path: path.join(resolved, item.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const parsedPath = path.parse(resolved);
    const isRoot = resolved === parsedPath.root || resolved === `${parsedPath.root}\\` || resolved === `${parsedPath.root}/`;
    const parent = isRoot ? null : path.dirname(resolved);

    res.json({
      data: {
        current: resolved,
        parent,
        drives,
        folders
      }
    });
  } catch (err) {
    res.status(500).json({ error: { code: 'BROWSE_FAILED', message: err.message } });
  }
});

// Native Windows Folder Picker Dialog
router.post('/pick-folder', requireAdmin, (req, res) => {
  if (process.platform !== 'win32') {
    return res.json({ data: { supported: false, path: null } });
  }

  const psScript = `
Add-Type -AssemblyName System.Windows.Forms;
$dlg = New-Object System.Windows.Forms.FolderBrowserDialog;
$dlg.Description = "اختر مجلد الوسائط / Select Media Folder";
$dlg.ShowNewFolderButton = $true;
$result = $dlg.ShowDialog();
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dlg.SelectedPath);
}
`.trim();

  // Execute PowerShell command with window popup
  exec(`powershell -NoProfile -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { timeout: 120000 }, (error, stdout, stderr) => {
    if (error) {
      // User cancelled or timed out
      return res.json({ data: { supported: true, path: null, cancelled: true } });
    }
    const chosen = stdout.trim();
    return res.json({
      data: {
        supported: true,
        path: chosen || null,
        cancelled: !chosen
      }
    });
  });
});

router.post('/clear-data', requireAdmin, (req, res) => {
  try {
    clearMediaData();
    res.json({ data: { success: true, message: 'All media data cleared successfully' } });
  } catch (err) {
    res.status(500).json({ error: { code: 'CLEAR_FAILED', message: err.message } });
  }
});

export default router;

