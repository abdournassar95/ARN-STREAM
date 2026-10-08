// MusicBrainz integration - user-triggered only
import { getDataDir } from '../db.js';

const MB_BASE = 'https://musicbrainz.org/ws/2';
const COVER_ART_BASE = 'https://coverartarchive.org';

const USER_AGENT = 'PersonalStream/1.0 ( personal@localhost )';

export async function searchMusicBrainz(query, type = 'artist') {
  const url = `${MB_BASE}/${type}/?query=${encodeURIComponent(query)}&fmt=json&limit=10`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`MusicBrainz search failed: ${res.status}`);
  return res.json();
}

export async function fetchReleaseGroup(mbid) {
  const url = `${MB_BASE}/release-group/${mbid}?fmt=json&inc=releases`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`MusicBrainz fetch failed`);
  return res.json();
}

export async function fetchCoverArt(mbid) {
  // Try to get cover art for release MBID
  const url = `${COVER_ART_BASE}/release/${mbid}/front-500`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  const fs = await import('fs');
  const path = await import('path');
  const crypto = await import('crypto');
  const tmpDir = path.join(getDataDir(), 'covers_cache');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const fileName = `mb-${crypto.randomBytes(4).toString('hex')}.jpg`;
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
