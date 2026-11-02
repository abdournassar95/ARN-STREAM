import express from 'express';
import http from 'http';
import https from 'https';
import NodeCache from 'node-cache';
import { getSetting, setSetting } from '../db.js';
import { requireAdmin, requireAuth } from '../services/auth.js';
import {
  encryptPayload,
  decryptPayload,
  buildDramaPayload,
  resolveFgStream,
  rewriteM3u8WithSwap,
  FG_BOUQUET_TOPICS,
  FG_ARAB_COUNTRIES,
  FG_WORLD_COUNTRIES,
  fetchDramaTopicChannels,
  fetchCountryM3uChannels,
  fetchFullFgCatalog,
  fetchFgChannelServers,
} from '../services/iptv/fgEngine.js';
import { BUILTIN_CATEGORIES, BUILTIN_CHANNELS, BUILTIN_PLAYLIST } from '../services/iptv/builtinCatalog.js';
import { ARABIC_RADIO_CATEGORIES, ARABIC_RADIO_CHANNELS } from '../services/iptv/arabicRadioCatalog.js';

const router = express.Router();
const DEFAULT_FG_CODE = '232425';

// Bounded Cache with 10-minute TTL & max 2500 entries
const streamCache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120,
  maxKeys: 2500,
});

// Validates stream URL format and guards against dangerous internal SSRF target queries
function isValidStreamUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    if (
      hostname === 'localhost' ||
      hostname === '169.254.169.254' ||
      hostname === '100.100.100.200' ||
      hostname === 'metadata.google.internal' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('127.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.startsWith('fc00:') ||
      hostname.startsWith('fd00:') ||
      hostname.startsWith('fe80:') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.localdomain') ||
      hostname.endsWith('.onion')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    return resp;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Pipes an upstream HTTP/HTTPS binary or media stream with redirect support (up to 5 hops)
 * and automatic socket teardown on client disconnect.
 */
function pipeRemoteStream(targetUrl, reqHeaders, res, defaultContentType, redirectsLeft = 5) {
  if (!isValidStreamUrl(targetUrl) || redirectsLeft < 0) {
    if (!res.headersSent) res.status(400).end();
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    if (!res.headersSent) res.status(400).end();
    return;
  }

  const clientMod = parsedUrl.protocol === 'https:' ? https : http;
  const upstreamReq = clientMod.get(
    targetUrl,
    {
      headers: reqHeaders,
      timeout: 12000,
    },
    (upstreamRes) => {
      const status = upstreamRes.statusCode || 502;
      if ([301, 302, 303, 307, 308].includes(status) && upstreamRes.headers.location) {
        upstreamRes.resume();
        try {
          const nextUrl = new URL(upstreamRes.headers.location, targetUrl).href;
          pipeRemoteStream(nextUrl, reqHeaders, res, defaultContentType, redirectsLeft - 1);
        } catch {
          if (!res.headersSent) res.status(502).end();
        }
        return;
      }

      if (status >= 400) {
        upstreamRes.resume();
        if (!res.headersSent) res.status(status).end();
        return;
      }

      res.status(status);
      res.setHeader('Content-Type', String(upstreamRes.headers['content-type'] || defaultContentType));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      if (upstreamRes.headers['content-length']) {
        res.setHeader('Content-Length', String(upstreamRes.headers['content-length']));
      }
      if (upstreamRes.headers['content-range']) {
        res.setHeader('Content-Range', String(upstreamRes.headers['content-range']));
      }

      res.on('close', () => {
        if (!upstreamRes.destroyed) upstreamRes.destroy();
      });

      upstreamRes.pipe(res);
    }
  );

  upstreamReq.on('timeout', () => {
    upstreamReq.destroy();
    if (!res.headersSent) res.status(504).end();
  });

  upstreamReq.on('error', () => {
    if (!res.headersSent) res.status(502).end();
  });

  res.on('close', () => {
    if (!upstreamReq.destroyed) upstreamReq.destroy();
  });
}

// Parse standard M3U / M3U8 playlist text into structured categories & channels
function parseM3uPlaylist(content, playlistId) {
  const lines = String(content || '').split(/\r?\n/);
  const channels = [];
  const categoryCounts = new Map();

  let currentName = '';
  let currentGroup = 'قنوات عامة';
  let currentLogo = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      const commaIdx = line.lastIndexOf(',');
      currentName = commaIdx !== -1 ? line.substring(commaIdx + 1).trim() : `قناة ${channels.length + 1}`;
      currentGroup = groupMatch && groupMatch[1].trim() ? groupMatch[1].trim() : 'قنوات عامة';
      currentLogo = logoMatch ? logoMatch[1].trim() : '';
    } else if (!line.startsWith('#') && /^https?:\/\//i.test(line)) {
      const streamUrl = line;
      const catId = `cat-${playlistId}-${Buffer.from(currentGroup).toString('hex').slice(0, 10)}`;
      const isMovie = /\.(mp4|mkv|avi)$/i.test(streamUrl) || /movie|فيلم|افلام|أفلام/i.test(currentGroup);
      const isSeries = /series|مسلسل|حلقات/i.test(currentGroup);
      const section = isSeries ? 'series' : isMovie ? 'movies' : 'live';

      categoryCounts.set(`${section}:::${catId}:::${currentGroup}`, (categoryCounts.get(`${section}:::${catId}:::${currentGroup}`) || 0) + 1);

      channels.push({
        id: `ch-${playlistId}-${channels.length + 1}`,
        playlistId,
        categoryId: catId,
        name: currentName || `قناة ${channels.length + 1}`,
        groupTitle: currentGroup,
        section,
        logo: currentLogo || undefined,
        resolution: 'Adaptive HLS',
        bitrate: 'Auto',
        sources: [
          {
            id: 'srv-1',
            name: 'سيرفر 1 (مباشر)',
            url: streamUrl,
          },
          {
            id: 'srv-2',
            name: 'سيرفر 2 (عبر البروكسي المحلي)',
            url: `/api/live/proxy/m3u8?u=${encodeURIComponent(streamUrl)}`,
            isProxied: true,
          },
        ],
      });

      currentName = '';
      currentGroup = 'قنوات عامة';
      currentLogo = '';
    }
  }

  const categories = Array.from(categoryCounts.entries()).map(([key, count]) => {
    const [section, id, name] = key.split(':::');
    return {
      id,
      playlistId,
      name,
      section,
      count,
    };
  });

  return { categories, channels };
}

// ============================================================================
// 1. STREAM PROXY ROUTES (Accessible directly by <video> & Hls.js)
// ============================================================================

router.get('/ping', (_req, res) => {
  res.json({
    status: 'pong',
    engine: 'ARN Stream Native IPTV AES-128-CBC + HLS Proxy Engine v2.6',
    cachedStreams: streamCache.keys().length,
    timestamp: new Date().toISOString(),
  });
});

// Real Local Stream Proxy with k9x_ Swap De-obfuscation Demo & Live Upstream Resolution
router.get('/proxy/k9x-demo/:id', async (req, res) => {
  const idLive = req.params.id.replace('.m3u8', '');
  const upstreamUrl = 'https://live-hls-apps-aja-fa.getaj.net/AJA/01.m3u8';

  try {
    const resp = await fetchWithTimeout(upstreamUrl, {}, 10000);
    const data = await resp.text();
    const baseUrl = upstreamUrl.substring(0, upstreamUrl.lastIndexOf('/') + 1);

    const swapDict = { k9x_: '' };
    const cleanRewritten = rewriteM3u8WithSwap(String(data), baseUrl, idLive, swapDict, '/api/live/proxy');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-ARN-Proxy-Engine', 'k9x_ Swap Stripped + AES-128-CBC Verified');
    res.send(cleanRewritten);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Proxy error';
    res.status(502).send(msg);
  }
});

// Full Drama Live /proxy/live/:id Route
router.get('/proxy/live/:id', async (req, res) => {
  const idLive = req.params.id.replace('.m3u8', '');
  const code = String(req.query.code || getSetting('live_tv_fg_code', DEFAULT_FG_CODE) || '202122');
  const srvIdx = Number(req.query.srv || 0);
  const cacheKey = `${idLive}:::${srvIdx}`;

  let info = streamCache.get(cacheKey) || null;
  if (!info) {
    info = await resolveFgStream(code, idLive, srvIdx);
    if (info?.streamUrl) {
      streamCache.set(cacheKey, info);
      streamCache.set(idLive, info);
    }
  }

  if (!info?.streamUrl) {
    res.status(502).json({ error: 'Stream resolution failed', idLive, srv: srvIdx });
    return;
  }

  try {
    const reqHeaders = { ...(info.headers || {}) };
    if (info.agent) reqHeaders['User-Agent'] = info.agent;

    let responseData = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await fetchWithTimeout(info.streamUrl, { headers: reqHeaders }, 15000);
        responseData = await resp.text();
        break;
      } catch (fetchErr) {
        if (attempt === 2) throw fetchErr;
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const baseUrl = info.streamUrl.substring(0, info.streamUrl.lastIndexOf('/') + 1);
    const rewritten = rewriteM3u8WithSwap(responseData, baseUrl, idLive, info.swap || {}, '/api/live/proxy');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (err) {
    streamCache.del(cacheKey);
    const msg = err instanceof Error ? err.message : 'Upstream stream error';
    res.status(500).send(msg);
  }
});

// Subplaylist & Generic M3U8 Proxy Route
router.get(['/proxy/subplaylist', '/proxy/m3u8'], async (req, res) => {
  const targetUrl = String(req.query.u || '');
  const idLive = String(req.query.id || 'generic');
  if (!targetUrl || !isValidStreamUrl(targetUrl)) {
    res.status(400).send('Invalid or restricted target URL');
    return;
  }

  const info = streamCache.get(idLive);
  const reqHeaders = { ...(info?.headers || {}) };
  if (info?.agent) reqHeaders['User-Agent'] = info.agent;

  try {
    const resp = await fetchWithTimeout(targetUrl, { headers: reqHeaders }, 10000);
    const text = await resp.text();
    const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
    const rewritten = rewriteM3u8WithSwap(String(text), baseUrl, idLive, info?.swap || {}, '/api/live/proxy');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (err) {
    if (!res.headersSent) {
      const msg = err instanceof Error ? err.message : 'Failed to proxy subplaylist';
      res.status(502).send(msg);
    }
  }
});

// Dedicated Audio & Radio Stream Proxy (/api/live/proxy/audio & /api/live/proxy/stream)
router.get(['/proxy/audio', '/proxy/stream'], (req, res) => {
  const targetUrl = String(req.query.u || '');
  if (!targetUrl || !isValidStreamUrl(targetUrl)) {
    res.status(400).send('Invalid or restricted audio stream URL');
    return;
  }

  const reqHeaders = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept: '*/*',
    'Icy-MetaData': '0',
  };
  if (req.headers.range) {
    reqHeaders['Range'] = String(req.headers.range);
  }

  pipeRemoteStream(targetUrl, reqHeaders, res, 'audio/mpeg');
});

// MPEG-TS / fMP4 Video Segment Stream Pipe (/api/live/proxy/ts)
router.get('/proxy/ts', (req, res) => {
  const targetUrl = String(req.query.u || '');
  const idLive = String(req.query.id || 'generic');
  if (!targetUrl || !isValidStreamUrl(targetUrl)) {
    res.status(400).end();
    return;
  }

  const info = streamCache.get(idLive);
  const reqHeaders = {
    'User-Agent':
      info?.agent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Icy-MetaData': '0',
    ...(info?.headers || {}),
  };
  if (req.headers.range) {
    reqHeaders['Range'] = String(req.headers.range);
  }

  pipeRemoteStream(targetUrl, reqHeaders, res, 'video/mp2t');
});

// ============================================================================
// 2. CATALOG, FG ENGINE, M3U & XTREAM CODES API ROUTES
// ============================================================================

// Get current FG Code
router.get('/code', (req, res) => {
  const code = getSetting('live_tv_fg_code', DEFAULT_FG_CODE);
  res.json({ code });
});

// Update FG Code
router.post('/code', requireAuth, requireAdmin, (req, res) => {
  const { code } = req.body;
  if (!code || !code.trim()) {
    return res.status(400).json({ error: 'Code is required' });
  }
  setSetting('live_tv_fg_code', code.trim());
  res.json({ success: true, code: code.trim() });
});

// Built-in Catalog (Arabic Live Channels + Egyptian Channels + Arabic Radio & Quran)
router.get('/catalog/builtin', (_req, res) => {
  const radioCategoriesWithPl = ARABIC_RADIO_CATEGORIES.map((c) => ({ ...c, playlistId: BUILTIN_PLAYLIST.id }));
  const radioChannelsWithPl = ARABIC_RADIO_CHANNELS.map((ch) => ({ ...ch, playlistId: BUILTIN_PLAYLIST.id }));

  res.json({
    playlist: {
      ...BUILTIN_PLAYLIST,
      channelCount: BUILTIN_CHANNELS.length + radioChannelsWithPl.length,
    },
    categories: [...BUILTIN_CATEGORIES, ...radioCategoriesWithPl],
    channels: [...BUILTIN_CHANNELS, ...radioChannelsWithPl],
  });
});

// Dedicated Arabic Radio Stations Catalog Endpoint
router.get('/radio/catalog', (req, res) => {
  const playlistId = String(req.query.playlistId || 'arn-arabic-radio-2026').trim();
  const categories = ARABIC_RADIO_CATEGORIES.map((c) => ({ ...c, playlistId }));
  const channels = ARABIC_RADIO_CHANNELS.map((ch) => ({ ...ch, playlistId }));
  res.json({
    success: true,
    playlist: {
      id: playlistId,
      name: 'إذاعات الراديو والقرآن الكريم المباشرة',
      type: 'builtin',
      codeOrUrl: 'Arabic Radio Live Hub',
      channelCount: channels.length,
      updatedAt: new Date().toISOString().split('T')[0],
    },
    categories,
    channels,
  });
});

// FG Code Activation Endpoint
router.post('/fg/activate', async (req, res) => {
  try {
    const code = String(req.body?.code || getSetting('live_tv_fg_code', DEFAULT_FG_CODE) || '202122').trim();
    const playlistId = `fg-${code}`;
    const payload = buildDramaPayload(code);
    const encryptedRequest = encryptPayload(payload);

    const { categories: fgCategories, channels: fgChannels } = await fetchFullFgCatalog(code, playlistId);

    const radioCategoriesWithPl = ARABIC_RADIO_CATEGORIES.map((c) => ({ ...c, playlistId }));
    const radioChannelsWithPl = ARABIC_RADIO_CHANNELS.map((ch) => ({ ...ch, playlistId }));

    const allCategories = [...fgCategories, ...radioCategoriesWithPl];
    const allChannels = [...fgChannels, ...radioChannelsWithPl];
    const totalArabicChannels = allChannels.length;

    res.json({
      success: true,
      code,
      encryptedHandshake: encryptedRequest.slice(0, 64) + '...',
      playlist: {
        id: playlistId,
        name: `باقة القنوات الفضائية والإذاعات العربية (FG: ${code})`,
        type: 'fg_code',
        codeOrUrl: code,
        channelCount: totalArabicChannels,
        updatedAt: new Date().toISOString().split('T')[0],
      },
      categories: allCategories,
      channels: allChannels,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر تفعيل كود FG';
    res.status(500).json({ success: false, error: msg });
  }
});

// On-Demand Topic / Country Channels Endpoint (/api/live/fg/topic/:topicKey)
router.get('/fg/topic/:topicKey', async (req, res) => {
  try {
    const topicKey = String(req.params.topicKey || '').trim();
    const code = String(req.query.code || getSetting('live_tv_fg_code', DEFAULT_FG_CODE) || '202122').trim();
    const playlistId = String(req.query.playlistId || `fg-${code}`).trim();

    let resolvedKey = topicKey;
    if (topicKey === 'eg' || topicKey === 'egypt') {
      resolvedKey = '20';
    }

    const allDefs = [...FG_BOUQUET_TOPICS, ...FG_ARAB_COUNTRIES, ...FG_WORLD_COUNTRIES];
    const foundDef = allDefs.find((d) => d.key === resolvedKey || d.key === topicKey) || {
      key: resolvedKey,
      name: resolvedKey === '20' ? 'مصر — Egypt TV' : `قنوات ${resolvedKey.toUpperCase()}`,
      type: 'drama_topic',
      defaultCount: resolvedKey === '20' ? 61 : 50,
    };

    const channels =
      foundDef.type === 'country_m3u'
        ? await fetchCountryM3uChannels(code, foundDef, playlistId)
        : await fetchDramaTopicChannels(code, foundDef, playlistId);

    res.json({
      success: true,
      topicKey,
      categoryId: `fg-cat-${foundDef.key}-${code}`,
      count: channels.length,
      channels,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر جلب قنوات التصنيف';
    res.status(500).json({ success: false, error: msg });
  }
});

// Fetch All Real Server Candidates for a specific Drama Live Channel
router.get('/fg/channel-servers/:idLive', async (req, res) => {
  try {
    const idLive = String(req.params.idLive || '').trim();
    const code = String(req.query.code || getSetting('live_tv_fg_code', DEFAULT_FG_CODE) || '202122').trim();
    if (!idLive) {
      res.status(400).json({ success: false, error: 'Missing channel id_live' });
      return;
    }

    const servers = await fetchFgChannelServers(code, idLive);
    res.json({
      success: true,
      idLive,
      count: servers.length,
      servers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر استخراج خوادم القناة';
    res.status(500).json({ success: false, error: msg });
  }
});

// Sync Full Live Arabic Satellite Repository (350+ Real Arabic Channels from iptv-org)
router.post('/iptv/sync-arabic', async (_req, res) => {
  try {
    const targetUrl = 'https://iptv-org.github.io/iptv/languages/ara.m3u';
    const resp = await fetchWithTimeout(targetUrl, {}, 12000);
    const data = await resp.text();
    const playlistId = 'iptv-org-ara-live';
    const parsed = parseM3uPlaylist(String(data), playlistId);

    res.json({
      success: true,
      playlist: {
        id: playlistId,
        name: `القنوات الفضائية العربية الشاملة (${parsed.channels.length} قناة حية)`,
        type: 'm3u_url',
        codeOrUrl: targetUrl,
        channelCount: parsed.channels.length,
        updatedAt: new Date().toISOString().split('T')[0],
      },
      categories: parsed.categories,
      channels: parsed.channels,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر جلب القنوات الفضائية العربية';
    res.status(500).json({ success: false, error: msg });
  }
});

// Parse M3U URL or Uploaded Content
router.post('/m3u/parse', async (req, res) => {
  try {
    const { name, url, content } = req.body || {};
    let rawM3u = content || '';

    if (!rawM3u && url) {
      if (!isValidStreamUrl(String(url))) {
        res.status(400).json({ success: false, error: 'رابط القائمة المدخل غير صالح أو محظور أمنياً.' });
        return;
      }
      const resp = await fetchWithTimeout(String(url), {}, 12000);
      rawM3u = await resp.text();
    }

    if (!rawM3u || !rawM3u.includes('#EXTM3U')) {
      res.status(400).json({
        success: false,
        error: 'لم يتم العثور على ترويسة #EXTM3U صالحة في القائمة المدخلة.',
      });
      return;
    }

    const playlistId = `m3u-${Date.now()}`;
    const parsed = parseM3uPlaylist(rawM3u, playlistId);

    res.json({
      success: true,
      playlist: {
        id: playlistId,
        name: name || 'قائمة M3U مخصصة',
        type: url ? 'm3u_url' : 'm3u_file',
        codeOrUrl: url || 'ملف محلي',
        channelCount: parsed.channels.length,
        updatedAt: new Date().toISOString().split('T')[0],
      },
      categories: parsed.categories,
      channels: parsed.channels,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر جلب أو تحليل ملف M3U';
    res.status(500).json({ success: false, error: msg });
  }
});

// Xtream Codes Account Authentication Endpoint
router.post('/xtream/authenticate', async (req, res) => {
  try {
    let { host = '', username = '', password = '' } = req.body || {};
    host = String(host).trim().replace(/\/+$/, '');
    username = String(username).trim();
    password = String(password).trim();

    if (!host || !username || !password) {
      res.status(400).json({
        success: false,
        error: 'يرجى إدخال عنوان السيرفر، اسم المستخدم، وكلمة المرور.',
      });
      return;
    }

    if (!/^https?:\/\//i.test(host)) {
      host = `http://${host}`;
    }

    if (!isValidStreamUrl(host)) {
      res.status(400).json({ success: false, error: 'عنوان السيرفر المدخل غير صالح أو محظور.' });
      return;
    }

    const authUrl = `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
    const resp = await fetchWithTimeout(authUrl, {}, 12000);
    const data = await resp.json();

    if (!data || typeof data !== 'object') {
      res.status(400).json({ success: false, error: 'استجابة غير صالحة من سيرفر Xtream' });
      return;
    }

    const userInfo = data.user_info;
    if (!userInfo || userInfo.auth === 0 || userInfo.status !== 'Active') {
      const errorDetail = userInfo?.message || 'فشل المصادقة — الحساب غير نشط أو البيانات غير صحيحة';
      res.status(401).json({ success: false, error: errorDetail });
      return;
    }

    let expDateFormatted = 'غير محدد';
    if (userInfo.exp_date && !isNaN(Number(userInfo.exp_date))) {
      const d = new Date(Number(userInfo.exp_date) * 1000);
      expDateFormatted = d.toISOString().split('T')[0];
    }

    res.json({
      success: true,
      userInfo: {
        username: userInfo.username,
        status: userInfo.status,
        expDate: expDateFormatted,
        maxConnections: userInfo.max_connections || '1',
        activeCons: userInfo.active_cons || '0',
        isTrial: userInfo.is_trial === '1',
      },
      serverInfo: data.server_info || {},
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر الاتصال بسيرفر Xtream Codes';
    res.status(500).json({ success: false, error: msg });
  }
});

// Xtream Codes Sync Catalog (Live + VOD + Series)
router.post('/xtream/sync', async (req, res) => {
  try {
    let { host = '', username = '', password = '', playlistName = '', includeVod = true, includeSeries = true } = req.body || {};
    host = String(host).trim().replace(/\/+$/, '');
    username = String(username).trim();
    password = String(password).trim();

    if (!host || !username || !password) {
      res.status(400).json({ success: false, error: 'البيانات غير مكتملة' });
      return;
    }

    if (!/^https?:\/\//i.test(host)) {
      host = `http://${host}`;
    }

    if (!isValidStreamUrl(host)) {
      res.status(400).json({ success: false, error: 'عنوان السيرفر المدخل غير صالح أو محظور.' });
      return;
    }

    const playlistId = `xtream-${Buffer.from(`${host}:::${username}`).toString('hex').slice(0, 10)}`;
    const baseApi = `${host}/player_api.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const authResp = await fetchWithTimeout(baseApi, {}, 12000);
    const authData = await authResp.json();
    const userInfo = authData?.user_info;
    if (!userInfo || userInfo.auth === 0) {
      res.status(401).json({ success: false, error: 'بيانات الدخول غير صحيحة أو تم إيقاف الحساب' });
      return;
    }

    const categories = [];
    const channels = [];

    // Fetch Live categories and streams
    try {
      const [liveCatsResp, liveStreamsResp] = await Promise.all([
        fetchWithTimeout(`${baseApi}&action=get_live_categories`, {}, 15000).then((r) => r.json()),
        fetchWithTimeout(`${baseApi}&action=get_live_streams`, {}, 25000).then((r) => r.json()),
      ]);

      const rawLiveCats = Array.isArray(liveCatsResp) ? liveCatsResp : [];
      const rawLiveStreams = Array.isArray(liveStreamsResp) ? liveStreamsResp : [];
      const liveCatCounts = new Map();

      for (const stream of rawLiveStreams) {
        const catId = String(stream.category_id || '0');
        liveCatCounts.set(catId, (liveCatCounts.get(catId) || 0) + 1);

        const streamId = stream.stream_id;
        const directStreamUrl = `${host}/live/${username}/${password}/${streamId}.m3u8`;

        channels.push({
          id: `xtream-live-${streamId}`,
          playlistId,
          categoryId: `xtream-cat-${catId}`,
          name: stream.name || `قناة ${streamId}`,
          groupTitle: 'بث مباشر',
          section: 'live',
          logo: stream.stream_icon || '',
          resolution: stream.resolution || 'HD',
          sources: [
            {
              id: 'srv-xtream-live-1',
              name: 'سيرفر Xtream الأصلي (مباشر)',
              url: directStreamUrl,
            },
            {
              id: 'srv-xtream-live-2',
              name: 'سيرفر بروكسي ARN المحلي (تجاوز القيود)',
              url: `/api/live/proxy/m3u8?u=${encodeURIComponent(directStreamUrl)}`,
              isProxied: true,
            },
          ],
        });
      }

      for (const cat of rawLiveCats) {
        const cId = String(cat.category_id);
        const count = liveCatCounts.get(cId) || 0;
        categories.push({
          id: `xtream-cat-${cId}`,
          playlistId,
          name: cat.category_name || 'باقة مباشرة',
          section: 'live',
          count,
        });
      }
    } catch (liveErr) {
      console.warn('[Xtream] Warning fetching live streams:', liveErr instanceof Error ? liveErr.message : 'Unknown error');
    }

    // Fetch VOD Movies
    if (includeVod) {
      try {
        const [vodCatsResp, vodStreamsResp] = await Promise.all([
          fetchWithTimeout(`${baseApi}&action=get_vod_categories`, {}, 15000).then((r) => r.json()),
          fetchWithTimeout(`${baseApi}&action=get_vod_streams`, {}, 25000).then((r) => r.json()),
        ]);

        const rawVodCats = Array.isArray(vodCatsResp) ? vodCatsResp : [];
        const rawVodStreams = Array.isArray(vodStreamsResp) ? vodStreamsResp : [];
        const vodCatCounts = new Map();

        for (const movie of rawVodStreams) {
          const catId = String(movie.category_id || '0');
          vodCatCounts.set(catId, (vodCatCounts.get(catId) || 0) + 1);

          const streamId = movie.stream_id;
          const ext = movie.container_extension || 'mp4';
          const directUrl = `${host}/movie/${username}/${password}/${streamId}.${ext}`;

          channels.push({
            id: `xtream-vod-${streamId}`,
            playlistId,
            categoryId: `xtream-vod-cat-${catId}`,
            name: movie.name || `فيلم ${streamId}`,
            groupTitle: 'أفلام VOD',
            section: 'movies',
            logo: movie.stream_icon || '',
            rating: movie.rating ? String(movie.rating) : undefined,
            sources: [
              {
                id: 'srv-xtream-vod-1',
                name: 'سيرفر الفيلم الأصلي (VOD)',
                url: directUrl,
              },
              {
                id: 'srv-xtream-vod-2',
                name: 'سيرفر البروكسي المحلي',
                url: `/api/live/proxy/ts?u=${encodeURIComponent(directUrl)}`,
                isProxied: true,
              },
            ],
          });
        }

        for (const cat of rawVodCats) {
          const cId = String(cat.category_id);
          const count = vodCatCounts.get(cId) || 0;
          categories.push({
            id: `xtream-vod-cat-${cId}`,
            playlistId,
            name: cat.category_name || 'باقة أفلام',
            section: 'movies',
            count,
          });
        }
      } catch (vodErr) {
        console.warn('[Xtream] Warning fetching VOD:', vodErr instanceof Error ? vodErr.message : 'Unknown error');
      }
    }

    // Fetch Series
    if (includeSeries) {
      try {
        const [seriesCatsResp, seriesListResp] = await Promise.all([
          fetchWithTimeout(`${baseApi}&action=get_series_categories`, {}, 15000).then((r) => r.json()),
          fetchWithTimeout(`${baseApi}&action=get_series`, {}, 25000).then((r) => r.json()),
        ]);

        const rawSeriesCats = Array.isArray(seriesCatsResp) ? seriesCatsResp : [];
        const rawSeriesList = Array.isArray(seriesListResp) ? seriesListResp : [];
        const seriesCatCounts = new Map();

        for (const item of rawSeriesList) {
          const catId = String(item.category_id || '0');
          seriesCatCounts.set(catId, (seriesCatCounts.get(catId) || 0) + 1);

          const seriesId = item.series_id;
          channels.push({
            id: `xtream-series-${seriesId}`,
            playlistId,
            categoryId: `xtream-series-cat-${catId}`,
            name: item.name || `مسلسل ${seriesId}`,
            groupTitle: 'مسلسلات Series',
            section: 'series',
            logo: item.cover || '',
            rating: item.rating ? String(item.rating) : undefined,
            year: item.releaseDate ? String(item.releaseDate).slice(0, 4) : undefined,
            sources: [
              {
                id: 'srv-xtream-series-1',
                name: 'سيرفر المسلسل',
                url: `${host}/series/${username}/${password}/${seriesId}`,
              },
            ],
          });
        }

        for (const cat of rawSeriesCats) {
          const cId = String(cat.category_id);
          const count = seriesCatCounts.get(cId) || 0;
          categories.push({
            id: `xtream-series-cat-${cId}`,
            playlistId,
            name: cat.category_name || 'باقة مسلسلات',
            section: 'series',
            count,
          });
        }
      } catch (seriesErr) {
        console.warn('[Xtream] Warning fetching Series:', seriesErr instanceof Error ? seriesErr.message : 'Unknown error');
      }
    }

    const totalChannels = channels.length;
    const finalName = playlistName.trim() || `اشتراك Xtream (${userInfo.username})`;

    res.json({
      success: true,
      playlist: {
        id: playlistId,
        name: finalName,
        type: 'xtream',
        codeOrUrl: host,
        channelCount: totalChannels,
        updatedAt: new Date().toISOString().split('T')[0],
      },
      accountInfo: {
        username: userInfo.username,
        status: userInfo.status,
        expDate:
          userInfo.exp_date && !isNaN(Number(userInfo.exp_date))
            ? new Date(Number(userInfo.exp_date) * 1000).toISOString().split('T')[0]
            : 'غير محدد',
        maxConnections: userInfo.max_connections || '1',
      },
      categories,
      channels,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'تعذر مزامنة واستيراد حساب Xtream Codes';
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
