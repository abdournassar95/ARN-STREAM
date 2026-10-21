const TYPE_TO_PREFIX = {
  movie: 'mv',
  episode: 'ep',
  series: 'sr',
  season: 'sn',
  artist: 'ar',
  album: 'al',
  track: 'tr',
  library: 'lib',
  playlist: 'pl',
  collection: 'col'
};

const PREFIX_TO_TYPE = Object.fromEntries(
  Object.entries(TYPE_TO_PREFIX).map(([type, prefix]) => [prefix, type])
);

export function makeId(type, id) {
  const prefix = TYPE_TO_PREFIX[type];
  if (!prefix) throw new Error(`Unknown item type: ${type}`);
  return `${prefix}_${Number(id)}`;
}

export function parseId(value) {
  if (value === undefined || value === null) return null;
  const match = /^([a-z]{2,4})_(\d+)$/i.exec(String(value).trim());
  if (!match) return null;
  const type = PREFIX_TO_TYPE[match[1].toLowerCase()];
  if (!type) return null;
  return { type, id: Number(match[2]) };
}

export function parseUserId(value) {
  if (value === undefined || value === null) return null;
  const match = /^(?:us_)?(\d+)$/i.exec(String(value).trim());
  return match ? Number(match[1]) : null;
}

export function mediaTypeToTable(mediaType) {
  switch (String(mediaType || '').toLowerCase()) {
    case 'movie': return 'movie';
    case 'episode': return 'episode';
    case 'track':
    case 'audio': return 'track';
    case 'series': return 'series';
    case 'season': return 'season';
    case 'album': return 'album';
    case 'artist': return 'artist';
    default: return null;
  }
}

export function isVideoType(type) {
  return type === 'movie' || type === 'episode';
}

export function isAudioType(type) {
  return type === 'track' || type === 'album' || type === 'artist';
}
