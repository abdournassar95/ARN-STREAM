import express from 'express';
import db, { getSetting, setSetting } from '../db.js';
import { requireAdmin } from '../services/auth.js';

const router = express.Router();

const DEFAULT_FG_CODE = '232425';

// Get current FG Code
router.get('/code', (req, res) => {
  const code = getSetting('live_tv_fg_code', DEFAULT_FG_CODE);
  res.json({ code });
});

// Update FG Code
router.post('/code', requireAdmin, (req, res) => {
  const { code } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Code is required' });
  }
  setSetting('live_tv_fg_code', code.trim());
  res.json({ success: true, code: code.trim() });
});

// Proxy and inject Drama Live web app with pre-configured FG Code
router.get('/player', async (req, res) => {
  try {
    const fgCode = req.query.code || getSetting('live_tv_fg_code', DEFAULT_FG_CODE);
    let validUrl = 'https://web.dramalive.cc/';
    if (req.query.url) {
      try {
        const parsed = new URL(req.query.url);
        if (parsed.protocol !== 'https:' || parsed.hostname !== 'web.dramalive.cc') {
          return res.status(400).send('400 Invalid or unauthorized streaming target URL');
        }
        validUrl = parsed.toString();
      } catch {
        return res.status(400).send('400 Malformed streaming target URL');
      }
    }
    const targetUrl = validUrl;

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch Drama Live source');
    }

    let html = await response.text();

    // Prepare auto-injection script for localStorage source_config
    const sourceConfigJson = JSON.stringify({
      type: "fgCode",
      fgCode: fgCode,
      m3uUrl: "",
      xtreamUsername: "",
      xtreamPassword: "",
      xtreamUrl: "",
      xtreamAgent: "",
      finalUrlLink: ""
    });

    const injectionScript = `
  <!-- ARN Stream Auto-Config Injection for Drama Live -->
  <script>
    (function() {
      try {
        var activeCode = ${JSON.stringify(fgCode)};
        var configObj = ${sourceConfigJson};
        var current = localStorage.getItem("flutter.source_config");
        if (!current || !current.includes(activeCode)) {
          localStorage.setItem("flutter.source_config", JSON.stringify(configObj));
        }
      } catch (err) {
        console.warn("[ARN Stream] Pre-injection failed:", err);
      }
    })();
  </script>
`;

    // 1. Set base href to https://web.dramalive.cc/ so all Flutter assets/workers/bundles resolve correctly
    if (html.includes('<base href="/">')) {
      html = html.replace('<base href="/">', `<base href="https://web.dramalive.cc/">\n${injectionScript}`);
    } else {
      html = html.replace('<head>', `<head>\n<base href="https://web.dramalive.cc/">\n${injectionScript}`);
    }

    // Set correct response headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  } catch (err) {
    console.error('[Live TV Proxy Error]:', err);
    res.status(500).send(`Error loading live TV player: ${err.message}`);
  }
});

export default router;
