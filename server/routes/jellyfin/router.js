import express from 'express';
import db, {
  findUserById,
  findUserByUsername,
  getAllUsers,
  getLibraryById,
  getSetting,
  setSetting
} from '../../db.js';
import { generateToken, hashPassword, verifyPassword } from '../../services/auth.js';
import {
  SERVER_ID,
  SERVER_NAME,
  SERVER_VERSION,
  toUserDto,
  optionalJfAuth,
  requireJfAuth
} from './auth.js';
import { makeId, parseId, parseUserId } from './ids.js';
import {
  queryItems,
  latestItems,
  resumeItems,
  nextUpItems,
  similarItems,
  searchHints,
  filtersFor,
  getLibrariesForUser,
  getItemDto,
  getAncestors,
  getMediaRowWithContext,
  canAccessMediaItem,
  findMediaTypeById,
  normalizeTypes
} from './query.js';
import { buildStreamUrl, handleItemStream } from './stream.js';
import { toTicks, ticksToSeconds, fileContainer } from './dto.js';

const router = express.Router();
const playSessionItems = new Map();
const PLAY_SESSION_LIMIT = 500;

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function asList(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => asList(entry));
  return String(value)
    .split(/[|,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function boolParam(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

function intParam(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function requestedUser(req, explicitId) {
  const id = parseUserId(explicitId)
    || parseUserId(req.params.userId)
    || parseUserId(req.query.UserId)
    || parseUserId(req.body && req.body.UserId);

  if (!id) return req.jfUser;
  if (req.jfUser.role !== 'admin' && id !== req.jfUser.id) return null;
  const user = findUserById(id);
  return user && user.is_active ? user : null;
}

function optionsFromQuery(req, overrides = {}) {
  const query = req.query;
  const options = {
    parentId: query.ParentId || query.parentId || null,
    includeTypes: normalizeTypes(asList(query.IncludeItemTypes || query.IncludeItemType)),
    excludeTypes: normalizeTypes(asList(query.ExcludeItemTypes || query.ExcludeItemType)),
    mediaTypes: asList(query.MediaTypes).map((value) => value.toLowerCase()),
    filters: asList(query.Filters).map((value) => value.toLowerCase()),
    genres: asList(query.Genres),
    years: asList(query.Years).map(Number).filter(Number.isFinite),
    searchTerm: query.SearchTerm || query.searchTerm || '',
    sortBy: asList(query.SortBy),
    sortOrder: asList(query.SortOrder),
    startIndex: intParam(query.StartIndex, 0),
    limit: query.Limit !== undefined ? intParam(query.Limit, undefined) : undefined,
    isPlayed: boolParam(query.IsPlayed),
    isFavorite: boolParam(query.IsFavorite),
    artistIds: new Set(asList(query.ArtistIds).map(Number).filter(Number.isFinite)),
    albumIds: new Set(asList(query.AlbumIds).map(Number).filter(Number.isFinite)),
    ...overrides
  };
  return options;
}

function userDataResponse(user, type, id) {
  const row = getMediaRowWithContext(type, id);
  const favoriteRow = db.prepare(
    'SELECT 1 FROM user_favorites WHERE user_id = ? AND media_type = ? AND media_id = ?'
  ).get(user.id, type, id);
  const state = db.prepare(
    'SELECT * FROM playback_state WHERE user_id = ? AND media_type = ? AND media_id = ?'
  ).get(user.id, type, id);
  const duration = row ? Number(row.duration) || 0 : 0;
  const stateDuration = state ? Number(state.duration) || duration : duration;
  const played = Boolean(state && stateDuration > 0 && Number(state.position) >= stateDuration * 0.9)
    || (type === 'track' && row && Number(row.play_count) > 0);

  return {
    PlaybackPositionTicks: toTicks(state ? state.position : 0),
    PlayCount: row && row.play_count ? Number(row.play_count) : (played ? 1 : 0),
    IsFavorite: Boolean(favoriteRow) || Boolean(row && row.is_favorite),
    Played: played,
    Key: makeId(type, id),
    ItemId: makeId(type, id)
  };
}

function upsertProgress(user, type, id, positionTicks, durationTicks) {
  const row = getMediaRowWithContext(type, id);
  if (!row) return;
  const duration = Number(row.duration) || ticksToSeconds(durationTicks) || 0;
  let position = Math.max(0, Math.round(ticksToSeconds(positionTicks)));

  if (duration > 0 && position > duration * 0.9) {
    position = Math.round(duration);
  }

  db.prepare(`
    INSERT INTO playback_state (user_id, media_type, media_id, position, duration, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, media_type, media_id) DO UPDATE SET
      position = excluded.position,
      duration = CASE WHEN excluded.duration > 0 THEN excluded.duration ELSE playback_state.duration END,
      updated_at = CURRENT_TIMESTAMP
  `).run(user.id, type, id, position, Math.round(duration));
}

function resolvePlaybackItem(itemId) {
  const parsed = parseId(itemId);
  if (parsed && (parsed.type === 'movie' || parsed.type === 'episode' || parsed.type === 'track')) {
    return parsed;
  }
  const type = findMediaTypeById(itemId);
  return type ? { type, id: Number(itemId) } : null;
}

function playbackItemFromReport(req) {
  const body = req.body || {};
  const directId = body.ItemId || (body.NowPlayingItem && body.NowPlayingItem.Id);
  if (directId) return resolvePlaybackItem(directId);

  const playSessionId = body.PlaySessionId;
  if (playSessionId && playSessionItems.has(playSessionId)) {
    const item = playSessionItems.get(playSessionId);
    return { type: item.type, id: item.id };
  }

  return null;
}

function storePlaySession(playSessionId, item) {
  if (!playSessionId) return;
  if (playSessionItems.size >= PLAY_SESSION_LIMIT) {
    playSessionItems.delete(playSessionItems.keys().next().value);
  }
  playSessionItems.set(playSessionId, item);
}

function mediaSourceFor(user, type, id, req, startTicks) {
  const row = getMediaRowWithContext(type, id);
  if (!row) return null;

  const container = fileContainer(row.path) || (type === 'track' ? 'mp3' : 'mp4');
  const isTrack = type === 'track';
  const videoContainers = new Set(['mp4', 'm4v', 'webm']);
  const videoCodecs = new Set(['h264', 'avc1', 'vp8', 'vp9', 'av1', 'theora']);
  const audioCodecs = new Set(['aac', 'mp3', 'opus', 'vorbis', 'flac']);

  const videoCodec = row.video_codec ? String(row.video_codec).toLowerCase() : null;
  const audioCodec = row.audio_codec ? String(row.audio_codec).toLowerCase() : null;

  const canDirectPlay = isTrack || (
    videoContainers.has(container)
    && (!videoCodec || videoCodecs.has(videoCodec))
    && (!audioCodec || audioCodecs.has(audioCodec))
  );

  const startSeconds = ticksToSeconds(startTicks);
  const directUrl = buildStreamUrl(req, type, id);
  const transcodeUrl = buildStreamUrl(req, type, id, {
    startSeconds,
    mode: canDirectPlay ? 'direct' : 'transcode',
    relative: true
  });
  const runtimeTicks = toTicks(row.duration);

  return {
    Protocol: 'Http',
    Id: makeId(type, id),
    Path: directUrl,
    Type: 'Default',
    Container: container,
    Size: 0,
    Name: row.title || row.name || '',
    IsRemote: false,
    ETag: `${type}-${id}-${row.added_at || ''}`,
    RunTimeTicks: runtimeTicks,
    ReadAtNativeFramerate: false,
    SupportsDirectPlay: canDirectPlay,
    SupportsDirectStream: canDirectPlay,
    SupportsTranscoding: true,
    TranscodingUrl: transcodeUrl,
    TranscodingContainer: canDirectPlay ? undefined : 'mp4',
    TranscodingSubProtocol: 'http',
    RequiredHttpHeaders: [],
    MediaStreams: [],
    MediaAttachments: [],
    Formats: [],
    Bitrate: 0,
    DefaultAudioStreamIndex: null,
    DefaultSubtitleStreamIndex: null,
    VideoType: isTrack ? undefined : 'VideoFile',
    MediaSourceCount: 1,
    IsInfiniteStream: false,
    SupportsProbing: true,
    AnalyzeDurationMs: 1000
  };
}

function serveItemImage(req, res, itemValue, imageType) {
  const parsed = parseId(itemValue);
  const type = parsed ? parsed.type : findMediaTypeById(itemValue);
  const id = parsed ? parsed.id : Number(itemValue);
  if (!type || !Number.isFinite(id)) return res.status(404).end();

  const normalizedType = String(imageType || 'Primary').toLowerCase();
  const requestedIndex = intParam(req.params.imageIndex, 0) || 0;
  const tag = intParam(req.query.tag, null);

  if (tag) {
    const tagged = db.prepare(
      'SELECT * FROM images WHERE id = ? AND media_type = ? AND media_id = ?'
    ).get(tag, type, id);
    if (tagged) return redirectImage(req, res, tagged);
  }

  if (type === 'library') {
    const library = getLibraryById(id);
    if (!library) return res.status(404).end();
    const covers = Array.isArray(library.covers) ? library.covers : [];
    for (const cover of covers) {
      const match = /\/api\/image\/(\d+)\/([a-z]+)/i.exec(String(cover));
      if (match) {
        const useThumb = match[2].toLowerCase() === 'thumb';
        return res.redirect(302, `/api/image/${match[1]}/${useThumb ? 'thumb' : 'full'}`);
      }
    }
    return res.status(404).end();
  }

  if (type === 'playlist' || type === 'collection') {
    const table = type === 'playlist' ? 'playlists' : 'collections';
    const row = db.prepare(`SELECT cover_image_id FROM ${table} WHERE id = ?`).get(id);
    if (!row || !row.cover_image_id) return res.status(404).end();
    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(row.cover_image_id);
    return image ? redirectImage(req, res, image) : res.status(404).end();
  }

  const candidates = [];
  candidates.push([type, id]);

  if (type === 'episode') {
    const episode = getMediaRowWithContext('episode', id);
    if (episode) {
      if (episode.season_id) candidates.push(['season', episode.season_id]);
      if (episode.series_id) candidates.push(['series', episode.series_id]);
    }
  } else if (type === 'season') {
    const season = getMediaRowWithContext('season', id);
    if (season && season.series_id) candidates.push(['series', season.series_id]);
  } else if (type === 'track') {
    const track = getMediaRowWithContext('track', id);
    if (track && track.album_id) {
      candidates.push(['album', track.album_id]);
      if (track.artist_id) candidates.push(['artist', track.artist_id]);
    }
  } else if (type === 'album') {
    const album = getMediaRowWithContext('album', id);
    if (album && album.artist_id) candidates.push(['artist', album.artist_id]);
  }

  const typeMap = {
    primary: ['poster', 'season_poster', 'album_cover', 'cover', 'avatar', 'thumb'],
    backdrop: ['backdrop', 'fanart'],
    banner: ['banner'],
    logo: ['logo'],
    thumb: ['thumb'],
    disc: ['disc'],
    art: ['art'],
    box: ['box'],
    screenshot: ['screenshot'],
    menu: ['menu'],
    profile: ['profile']
  };
  const imageTypes = typeMap[normalizedType] || [normalizedType];

  for (const [mediaType, mediaId] of candidates) {
    const placeholders = imageTypes.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT * FROM images
      WHERE media_type = ? AND media_id = ? AND LOWER(image_type) IN (${placeholders})
      ORDER BY is_primary DESC, id DESC
    `).all(mediaType, mediaId, ...imageTypes);

    if (!rows.length) continue;
    const image = normalizedType === 'backdrop'
      ? rows[Math.min(requestedIndex, rows.length - 1)]
      : rows[0];
    return redirectImage(req, res, image);
  }

  return res.status(404).end();
}

function redirectImage(req, res, image) {
  const maxWidth = Number(req.query.maxWidth || req.query.fillWidth || 0);
  const maxHeight = Number(req.query.maxHeight || req.query.fillHeight || 0);
  const useThumb = (maxWidth > 0 && maxWidth <= 400) || (maxHeight > 0 && maxHeight <= 600);
  return res.redirect(302, `/api/image/${image.id}/${useThumb ? 'thumb' : 'full'}`);
}

function serveUserImage(req, res) {
  const userId = parseUserId(req.params.userId);
  const user = userId ? findUserById(userId) : null;
  if (!user || !user.avatar) return res.status(404).end();
  return res.redirect(302, user.avatar);
}

router.get('/System/Info/Public', (req, res) => {
  res.json({
    ServerName: SERVER_NAME,
    Id: SERVER_ID,
    Version: SERVER_VERSION,
    ProductName: 'ARN Stream',
    OperatingSystem: '',
    StartupWizardCompleted: true
  });
});

router.get('/System/Info', optionalJfAuth, (req, res) => {
  res.json({
    ServerName: SERVER_NAME,
    Id: SERVER_ID,
    Version: SERVER_VERSION,
    ProductName: 'ARN Stream',
    OperatingSystem: 'Windows',
    StartupWizardCompleted: true,
    HasPendingRestart: false,
    IsShuttingDown: false,
    SupportsLibraryMonitor: false,
    WebSocketPortNumber: req.socket && req.socket.localPort ? req.socket.localPort : 8096,
    CanSelfRestart: false,
    CanLaunchWebBrowser: false,
    ProgramDataPath: '',
    WebPath: '/jellyfin',
    ItemsByNamePath: '',
    CachePath: '',
    LogPath: '',
    InternalMetadataPath: '',
    TranscodingTempPath: '',
    HasUpdateAvailable: false,
    EncoderLocation: 'System',
    SystemUpdateLevel: 'Release',
    OperatingSystemDisplayName: 'Windows',
    CanSelfUpdate: false,
    CompletedInstallations: [],
    LibraryScanFanoutConcurrency: 0,
    LibraryMetadataRefreshConcurrency: 0
  });
});

router.get('/System/Endpoint', (req, res) => {
  res.json({ IsLocal: true, IsInNetwork: true });
});

router.get('/System/Ping', (req, res) => {
  res.send('Jellyfin Server');
});

router.get('/Branding/Configuration', (req, res) => {
  res.json({ LoginDisclaimer: '', CustomCss: '', SplashscreenEnabled: false });
});

router.get('/Branding/Splashscreen', (req, res) => {
  res.status(404).end();
});

router.get('/QuickConnect/Enabled', (req, res) => {
  res.json(false);
});

router.get('/Localization/Options', (req, res) => {
  res.json([
    { Name: 'English', Value: 'en-US' },
    { Name: 'العربية', Value: 'ar-SA' }
  ]);
});

router.get('/Startup/Configuration', (req, res) => {
  res.json({
    UICulture: 'en-US',
    MetadataCountryCode: 'US',
    PreferredMetadataLanguage: 'en',
    ServerName: SERVER_NAME
  });
});

router.get('/Startup/User', (req, res) => {
  res.json({ Name: '', ConnectUserName: '' });
});

router.get('/Startup/RemoteAccess', (req, res) => {
  res.json({
    EnableRemoteAccess: true,
    EnableAutomaticPortMapping: false,
    IsPortMappingEnabled: false
  });
});

router.post('/Startup/Complete', (req, res) => {
  res.status(204).end();
});

router.get('/Users/Public', (req, res) => {
  const users = getAllUsers()
    .filter((user) => user.is_active && user.show_on_login !== 0)
    .map((user) => toUserDto(user));
  res.json(users);
});

router.post('/Users/AuthenticateByName', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const username = String(body.Username || body.username || '').trim();
  const password = String(body.Pw || body.Password || body.password || '');

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const user = findUserByUsername(username);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const valid = password ? await verifyPassword(password, user.password_hash) : false;
  if (!valid) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = generateToken(user);
  const refreshed = findUserById(user.id);

  res.json({
    User: toUserDto(refreshed),
    AccessToken: token,
    ServerId: SERVER_ID,
    SessionInfo: {
      Id: `arn-${user.id}-${Date.now()}`,
      UserId: String(user.id),
      UserName: user.username,
      DeviceId: body.DeviceId || '',
      DeviceName: body.DeviceName || '',
      Client: body.Client || 'Jellyfin Web',
      ApplicationVersion: body.Version || '',
      ServerId: SERVER_ID
    }
  });
}));

router.post('/Users/Authenticate', asyncHandler(async (req, res) => {
  const authorization = req.headers.authorization || '';
  const match = /^Basic\s+(.+)$/i.exec(authorization);
  let username = '';
  let password = '';

  if (match) {
    const decoded = Buffer.from(match[1], 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    username = separator >= 0 ? decoded.slice(0, separator) : decoded;
    password = separator >= 0 ? decoded.slice(separator + 1) : '';
  } else if (req.body) {
    username = String(req.body.Username || req.body.username || '');
    password = String(req.body.Pw || req.body.Password || req.body.password || '');
  }

  const user = username ? findUserByUsername(username.trim()) : null;
  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const token = generateToken(user);
  res.json({
    User: toUserDto(findUserById(user.id)),
    AccessToken: token,
    ServerId: SERVER_ID
  });
}));

router.get('/Users/:userId/Images/:imageType/:imageIndex?', (req, res) => {
  serveUserImage(req, res);
});

router.get('/Items/:itemId/Images/:imageType/:imageIndex?', (req, res) => {
  serveItemImage(req, res, req.params.itemId, req.params.imageType);
});

router.get('/Artists/:itemId/Images/:imageType/:imageIndex?', (req, res) => {
  serveItemImage(req, res, req.params.itemId, req.params.imageType);
});

router.get('/Audio/:itemId/Images/:imageType/:imageIndex?', (req, res) => {
  serveItemImage(req, res, req.params.itemId, req.params.imageType);
});

router.get('/Videos/:itemId/Images/:imageType/:imageIndex?', (req, res) => {
  serveItemImage(req, res, req.params.itemId, req.params.imageType);
});

router.use(requireJfAuth);

router.get('/Users', (req, res) => {
  const users = req.jfUser.role === 'admin'
    ? getAllUsers()
    : [findUserById(req.jfUser.id)];
  res.json(users.filter(Boolean).map((user) => toUserDto(user)));
});

router.get('/Users/Me', (req, res) => {
  res.json(toUserDto(findUserById(req.jfUser.id)));
});

router.get('/Users/:userId', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  res.json(toUserDto(user));
});

router.post('/Users/:userId/Configuration', (req, res) => {
  res.status(204).end();
});

router.post('/Users/New', asyncHandler(async (req, res) => {
  if (req.jfUser.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const name = String((req.body && req.body.Name) || '').trim();
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (findUserByUsername(name)) return res.status(400).json({ error: 'User already exists' });
  const passwordHash = await hashPassword('jellyfin');
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, display_name, role, is_active) VALUES (?, ?, ?, ?, 1)'
  ).run(name, passwordHash, name, 'user');
  res.json(toUserDto(findUserById(result.lastInsertRowid)));
}));

router.delete('/Users/:userId', (req, res) => {
  if (req.jfUser.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const user = requestedUser(req);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.id === req.jfUser.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(user.id);
  res.status(204).end();
});

function sendViews(req, res) {
  const user = requestedUser(req) || req.jfUser;
  const libraries = getLibrariesForUser(user, false);
  res.json({ Items: libraries, TotalRecordCount: libraries.length });
}

router.get('/UserViews', sendViews);
router.get('/Users/:userId/Views', sendViews);

router.get('/Library/MediaFolders', (req, res) => {
  const libraries = getLibrariesForUser(req.jfUser, false);
  res.json({ Items: libraries, TotalRecordCount: libraries.length });
});

router.get('/Users/:userId/Items', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  const options = optionsFromQuery(req);
  res.json(queryItems(user, options));
});

router.get('/Users/:userId/Items/Resume', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  const options = optionsFromQuery(req, { limit: intParam(req.query.Limit, 12) });
  res.json(resumeItems(user, options));
});

router.get('/Users/:userId/Items/Latest', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  const options = optionsFromQuery(req, { limit: intParam(req.query.Limit, 20) });
  const items = latestItems(user, options);
  res.json(items);
});

router.get('/Users/:userId/FavoriteItems', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  const options = optionsFromQuery(req, {
    isFavorite: true,
    limit: intParam(req.query.Limit, 100)
  });
  res.json(queryItems(user, options));
});

router.get('/Items', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  res.json(queryItems(user, optionsFromQuery(req)));
});

router.get('/Items/Filters', (req, res) => {
  res.json(filtersFor(req.jfUser));
});

router.get('/Users/:userId/Items/Filters', (req, res) => {
  res.json(filtersFor(req.jfUser));
});

router.get('/Users/:userId/Items/:itemId', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  const parsed = parseId(req.params.itemId);
  const type = parsed ? parsed.type : findMediaTypeById(req.params.itemId);
  const id = parsed ? parsed.id : Number(req.params.itemId);
  if (!type) return res.status(404).json({ error: 'Not found' });
  const item = getItemDto(user, type, id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.get('/Items/:itemId/Ancestors', (req, res) => {
  const parsed = parseId(req.params.itemId);
  if (!parsed) return res.json([]);
  res.json(getAncestors(req.jfUser, parsed.type, parsed.id));
});

router.get('/Items/:itemId/Similar', (req, res) => {
  const parsed = parseId(req.params.itemId);
  if (!parsed) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
  if (!canAccessMediaItem(req.jfUser, parsed.type, parsed.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(similarItems(
    req.jfUser,
    parsed.type,
    parsed.id,
    intParam(req.query.Limit, 24)
  ));
});

router.get('/Movies/:itemId/Similar', (req, res) => {
  const parsed = parseId(req.params.itemId);
  const id = parsed ? parsed.id : Number(req.params.itemId);
  res.json(similarItems(req.jfUser, 'movie', id, intParam(req.query.Limit, 24)));
});

router.get('/Shows/:seriesId/Similar', (req, res) => {
  const parsed = parseId(req.params.seriesId);
  const id = parsed ? parsed.id : Number(req.params.seriesId);
  res.json(similarItems(req.jfUser, 'series', id, intParam(req.query.Limit, 24)));
});

router.get('/Shows/NextUp', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  res.json(nextUpItems(user, {
    parentId: req.query.ParentId || null,
    seriesId: req.query.SeriesId || null,
    startIndex: intParam(req.query.StartIndex, 0),
    limit: intParam(req.query.Limit, 24)
  }));
});

router.get('/Shows/Upcoming', (req, res) => {
  res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
});

function sendSeasons(req, res) {
  const parsed = parseId(req.params.seriesId);
  if (!parsed) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
  const options = optionsFromQuery(req, {
    parentId: makeId('series', parsed.id),
    includeTypes: new Set(['season']),
    limit: intParam(req.query.Limit, 500)
  });
  res.json(queryItems(req.jfUser, options));
}

function sendEpisodes(req, res) {
  const parsed = parseId(req.params.seriesId);
  if (!parsed) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
  const seasonId = parseId(req.query.SeasonId);
  const options = optionsFromQuery(req, {
    parentId: seasonId ? makeId('season', seasonId.id) : makeId('series', parsed.id),
    includeTypes: new Set(['episode']),
    limit: intParam(req.query.Limit, 1000)
  });
  res.json(queryItems(req.jfUser, options));
}

router.get('/Shows/:seriesId/Seasons', sendSeasons);
router.get('/Shows/:seriesId/Episodes', sendEpisodes);

router.get('/Artists', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  const options = optionsFromQuery(req, {
    includeTypes: new Set(['artist']),
    limit: intParam(req.query.Limit, 200)
  });
  res.json(queryItems(user, options));
});

router.get('/Artists/:itemId', (req, res) => {
  const parsed = parseId(req.params.itemId);
  const id = parsed ? parsed.id : Number(req.params.itemId);
  const item = getItemDto(req.jfUser, 'artist', id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.get('/Artists/:itemId/Albums', (req, res) => {
  const parsed = parseId(req.params.itemId);
  if (!parsed) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
  const options = optionsFromQuery(req, {
    parentId: makeId('artist', parsed.id),
    includeTypes: new Set(['album']),
    limit: intParam(req.query.Limit, 200)
  });
  res.json(queryItems(req.jfUser, options));
});

router.get('/Artists/:itemId/Similar', (req, res) => {
  const parsed = parseId(req.params.itemId);
  const id = parsed ? parsed.id : Number(req.params.itemId);
  res.json(similarItems(req.jfUser, 'artist', id, intParam(req.query.Limit, 24)));
});

router.get('/Playlists', (req, res) => {
  const options = optionsFromQuery(req, {
    includeTypes: new Set(['playlist']),
    limit: intParam(req.query.Limit, 200)
  });
  res.json(queryItems(req.jfUser, options));
});

router.get('/Playlists/:playlistId/Items', (req, res) => {
  const parsed = parseId(req.params.playlistId);
  if (!parsed) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
  const options = optionsFromQuery(req, {
    parentId: makeId('playlist', parsed.id),
    limit: intParam(req.query.Limit, 1000)
  });
  res.json(queryItems(req.jfUser, options));
});

router.get('/Playlists/:playlistId', (req, res) => {
  const parsed = parseId(req.params.playlistId);
  const id = parsed ? parsed.id : Number(req.params.playlistId);
  const item = getItemDto(req.jfUser, 'playlist', id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.get('/Collections/:collectionId/Items', (req, res) => {
  const parsed = parseId(req.params.collectionId);
  if (!parsed) return res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
  const options = optionsFromQuery(req, {
    parentId: makeId('collection', parsed.id),
    limit: intParam(req.query.Limit, 500)
  });
  res.json(queryItems(req.jfUser, options));
});

router.get('/Search/Hints', (req, res) => {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });
  res.json(searchHints(user, req.query.SearchTerm || '', intParam(req.query.Limit, 20)));
});

router.get('/Genres', (req, res) => {
  const genres = filtersFor(req.jfUser).Genres;
  const items = genres.map((name, index) => ({
    Id: `genre_${index}`,
    Name: name,
    Type: 'Genre',
    MediaType: 'Video',
    IsFolder: true
  }));
  res.json({ Items: items, TotalRecordCount: items.length, StartIndex: 0 });
});

router.get('/Persons', (req, res) => {
  res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
});

router.get('/Studios', (req, res) => {
  res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
});

router.get('/Movies/Recommendations', (req, res) => {
  res.json([]);
});

router.get('/Trailers', (req, res) => {
  res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
});

router.get('/Plugins', (req, res) => {
  res.json([]);
});

router.get('/Devices', (req, res) => {
  res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
});

router.get('/Channels', (req, res) => {
  res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
});

router.get('/Sessions', (req, res) => {
  res.json([]);
});

router.post('/Sessions/Capabilities', (req, res) => {
  res.status(204).end();
});

router.post('/Sessions/Capabilities/Full', (req, res) => {
  res.status(204).end();
});

router.post('/Sessions/Logout', (req, res) => {
  res.status(204).end();
});

router.post('/Sessions/Playing', (req, res) => {
  const item = playbackItemFromReport(req);
  if (!item) return res.status(204).end();
  const body = req.body || {};
  upsertProgress(req.jfUser, item.type, item.id, body.PositionTicks, body.NowPlayingItem && body.NowPlayingItem.RunTimeTicks);
  storePlaySession(body.PlaySessionId, item);
  res.status(204).end();
});

router.post('/Sessions/Playing/Progress', (req, res) => {
  const item = playbackItemFromReport(req);
  if (!item) return res.status(204).end();
  const body = req.body || {};
  upsertProgress(req.jfUser, item.type, item.id, body.PositionTicks, body.NowPlayingItem && body.NowPlayingItem.RunTimeTicks);
  res.status(204).end();
});

router.post('/Sessions/Playing/Stopped', (req, res) => {
  const item = playbackItemFromReport(req);
  if (!item) return res.status(204).end();
  const body = req.body || {};
  upsertProgress(req.jfUser, item.type, item.id, body.PositionTicks, body.NowPlayingItem && body.NowPlayingItem.RunTimeTicks);
  if (body.PlaySessionId) playSessionItems.delete(body.PlaySessionId);
  res.status(204).end();
});

router.get('/Items/:itemId/PlaybackInfo', (req, res) => {
  sendPlaybackInfo(req, res);
});

router.post('/Items/:itemId/PlaybackInfo', (req, res) => {
  sendPlaybackInfo(req, res);
});

function sendPlaybackInfo(req, res) {
  const user = requestedUser(req);
  if (!user) return res.status(403).json({ error: 'Forbidden' });

  const parsed = resolvePlaybackItem(req.params.itemId);
  if (!parsed || !canAccessMediaItem(user, parsed.type, parsed.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const body = req.body || {};
  const startTicks = Number(body.StartTimeTicks || req.query.StartTimeTicks || 0);
  const source = mediaSourceFor(user, parsed.type, parsed.id, req, startTicks);
  if (!source) return res.status(404).json({ error: 'Item not found' });

  const playSessionId = `arn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  storePlaySession(playSessionId, parsed);

  res.json({
    MediaSources: [source],
    PlaySessionId: playSessionId,
    UserId: String(user.id),
    StartTimeTicks: startTicks
  });
}

router.get('/Items/:itemId', (req, res) => {
  const parsed = parseId(req.params.itemId);
  const type = parsed ? parsed.type : findMediaTypeById(req.params.itemId);
  const id = parsed ? parsed.id : Number(req.params.itemId);
  if (!type) return res.status(404).json({ error: 'Not found' });
  const item = getItemDto(req.jfUser, type, id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.get('/Videos/:itemId/stream', (req, res) => {
  handleItemStream(req, res);
});

router.get('/Videos/:itemId/stream.:container', (req, res) => {
  handleItemStream(req, res);
});

router.get('/Audio/:itemId/universal', (req, res) => {
  handleItemStream(req, res);
});

router.get('/Audio/:itemId/stream', (req, res) => {
  handleItemStream(req, res);
});

router.get('/Audio/:itemId/stream.:container', (req, res) => {
  handleItemStream(req, res);
});

router.get('/Videos/:itemId/AlternateSources', (req, res) => {
  res.json([]);
});

router.get('/Audio/:itemId/Lyrics', (req, res) => {
  res.status(404).json({ error: 'Lyrics not found' });
});

router.post('/UserFavoriteItems/:itemId', (req, res) => {
  const parsed = parseId(req.params.itemId);
  if (!parsed) return res.status(404).json({ error: 'Not found' });
  db.prepare(`
    INSERT OR IGNORE INTO user_favorites (user_id, media_type, media_id)
    VALUES (?, ?, ?)
  `).run(req.jfUser.id, parsed.type, parsed.id);
  if (parsed.type === 'track') {
    db.prepare('UPDATE tracks SET is_favorite = 1 WHERE id = ?').run(parsed.id);
  }
  res.json(userDataResponse(req.jfUser, parsed.type, parsed.id));
});

router.delete('/UserFavoriteItems/:itemId', (req, res) => {
  const parsed = parseId(req.params.itemId);
  if (!parsed) return res.status(404).json({ error: 'Not found' });
  db.prepare(
    'DELETE FROM user_favorites WHERE user_id = ? AND media_type = ? AND media_id = ?'
  ).run(req.jfUser.id, parsed.type, parsed.id);
  if (parsed.type === 'track') {
    db.prepare('UPDATE tracks SET is_favorite = 0 WHERE id = ?').run(parsed.id);
  }
  res.json(userDataResponse(req.jfUser, parsed.type, parsed.id));
});

router.post('/UserPlayedItems/:itemId', (req, res) => {
  const parsed = parseId(req.params.itemId);
  if (!parsed) return res.status(404).json({ error: 'Not found' });
  const row = getMediaRowWithContext(parsed.type, parsed.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const duration = Number(row.duration) || 0;
  db.prepare(`
    INSERT INTO playback_state (user_id, media_type, media_id, position, duration, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, media_type, media_id) DO UPDATE SET
      position = excluded.position,
      duration = excluded.duration,
      updated_at = CURRENT_TIMESTAMP
  `).run(req.jfUser.id, parsed.type, parsed.id, Math.round(duration), Math.round(duration));
  if (parsed.type === 'track') {
    db.prepare('UPDATE tracks SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(parsed.id);
  }
  res.json(userDataResponse(req.jfUser, parsed.type, parsed.id));
});

router.delete('/UserPlayedItems/:itemId', (req, res) => {
  const parsed = parseId(req.params.itemId);
  if (!parsed) return res.status(404).json({ error: 'Not found' });
  db.prepare(
    'DELETE FROM playback_state WHERE user_id = ? AND media_type = ? AND media_id = ?'
  ).run(req.jfUser.id, parsed.type, parsed.id);
  if (parsed.type === 'track') {
    db.prepare('UPDATE tracks SET play_count = 0, last_played_at = NULL WHERE id = ?').run(parsed.id);
  }
  res.json(userDataResponse(req.jfUser, parsed.type, parsed.id));
});

router.get('/DisplayPreferences/:preferenceId', (req, res) => {
  const key = `jellyfin_display_${req.jfUser.id}_${req.params.preferenceId}`;
  const stored = getSetting(key);
  if (stored) {
    try {
      return res.json(JSON.parse(stored));
    } catch {
      return res.json({});
    }
  }
  res.json({
    Id: req.params.preferenceId,
    ViewType: 'Poster',
    SortBy: 'SortName',
    SortOrder: 'Ascending',
    RememberIndexing: false,
    PrimaryImageHeight: 250,
    PrimaryImageWidth: 250,
    CustomPrefs: {},
    ScrollDirection: 'Horizontal'
  });
});

router.post('/DisplayPreferences/:preferenceId', (req, res) => {
  const key = `jellyfin_display_${req.jfUser.id}_${req.params.preferenceId}`;
  setSetting(key, JSON.stringify(req.body || {}));
  res.status(204).end();
});

router.get('/UserSettings/:userId', (req, res) => {
  res.json({});
});

router.get('/System/Configuration', (req, res) => {
  res.json({});
});

router.get('/System/Logs', (req, res) => {
  res.json([]);
});

router.get('/System/ActivityLog/Entries', (req, res) => {
  res.json({ Items: [], TotalRecordCount: 0, StartIndex: 0 });
});

router.get('/Tasks', (req, res) => {
  res.json([]);
});

router.use((err, req, res, next) => {
  console.error('[Jellyfin API]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

export default router;
