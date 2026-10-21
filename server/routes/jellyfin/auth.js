import { findUserById } from '../../db.js';
import { verifyToken } from '../../services/auth.js';

export const SERVER_ID = 'arn-stream';
export const SERVER_NAME = 'ARN Stream';
export const SERVER_VERSION = '10.11.0';

function readHeaderToken(req) {
  const authorization = req.headers.authorization || req.headers.Authorization;
  if (authorization) {
    const mediaBrowserMatch = /Token="([^"]*)"/i.exec(authorization);
    if (mediaBrowserMatch) return mediaBrowserMatch[1];
    if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  }

  const headerToken = req.headers['x-emby-token']
    || req.headers['x-mediabrowser-token']
    || req.headers['x-emby-authorization-token'];
  if (headerToken) return String(headerToken);

  const query = req.query || {};
  return query.api_key || query.ApiKey || query.apiKey || query.token || null;
}

export function getRequestToken(req) {
  const token = readHeaderToken(req);
  return token ? String(token) : null;
}

export function resolveUser(req) {
  if (req.jfUser !== undefined) return req.jfUser;
  const token = getRequestToken(req);
  if (!token) {
    req.jfUser = null;
    return null;
  }
  const decoded = verifyToken(token);
  const user = decoded ? findUserById(decoded.id) : null;
  req.jfToken = token;
  req.jfUser = user && user.is_active ? user : null;
  return req.jfUser;
}

export function optionalJfAuth(req, res, next) {
  resolveUser(req);
  next();
}

export function requireJfAuth(req, res, next) {
  const user = resolveUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = user;
  next();
}

export function getUserImageTag(user) {
  return user && user.avatar ? 'primary' : undefined;
}

export function toUserDto(user) {
  const isAdmin = user.role === 'admin';
  const enabledFolders = Array.isArray(user.allowed_libraries) ? user.allowed_libraries.map(String) : [];
  return {
    Id: String(user.id),
    Name: user.username,
    ServerId: SERVER_ID,
    DisplayName: user.display_name || user.username,
    HasPassword: true,
    HasConfiguredPassword: true,
    PrimaryImageTag: getUserImageTag(user),
    LastLoginDate: user.last_login || null,
    LastActivityDate: new Date().toISOString(),
    Configuration: {
      AudioLanguagePreference: '',
      PlayDefaultAudioTrack: true,
      SubtitleLanguagePreference: '',
      DisplayMissingEpisodes: false,
      GroupedFolders: [],
      SubtitleMode: 'Default',
      DisplayCollectionsView: false,
      EnableLocalPassword: false,
      OrderedViews: [],
      LatestItemsExcludes: [],
      MyMediaExcludes: [],
      HidePlayedInLatest: false,
      RememberAudioSelections: true,
      RememberSubtitleSelections: true,
      EnableNextEpisodeAutoPlay: true
    },
    Policy: {
      IsAdministrator: isAdmin,
      IsHidden: !user.is_active,
      IsDisabled: !user.is_active,
      EnableAllFolders: isAdmin || !user.allowed_libraries,
      EnabledFolders: enabledFolders,
      EnableContentDownloading: user.can_download !== false,
      EnableRemoteControlOfOtherUsers: isAdmin,
      EnableSharedDeviceControl: isAdmin,
      EnableRemoteAccess: true,
      EnableLiveTvManagement: isAdmin,
      EnableLiveTvAccess: true,
      EnableMediaPlayback: true,
      EnableAudioPlaybackTranscoding: true,
      EnableVideoPlaybackTranscoding: true,
      EnablePlaybackRemuxing: true,
      EnableCollectionManagement: isAdmin,
      EnableSubtitleDownloading: true,
      EnableSubtitleManagement: isAdmin
    }
  };
}
