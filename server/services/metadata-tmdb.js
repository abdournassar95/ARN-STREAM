// TMDB integration - user-triggered only, never auto
// Requires TMDB_API_KEY env var
const TMDB_BASE = 'https://api.themoviedb.org/3';

function getApiKey() {
  return process.env.TMDB_API_KEY || null;
}

export async function searchTMDB(query, type = 'multi') {
  const key = getApiKey();
  if (!key) throw new Error('TMDB_API_KEY not configured');
  const url = `${TMDB_BASE}/search/${type === 'movie' ? 'movie' : type === 'tv' ? 'tv' : 'multi'}?api_key=${key}&query=${encodeURIComponent(query)}&language=en-US`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB search failed: ${res.status}`);
  const data = await res.json();
  return data.results?.slice(0, 10) || [];
}

export async function fetchMovieDetails(tmdbId) {
  const key = getApiKey();
  if (!key) throw new Error('TMDB_API_KEY not configured');
  const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${key}&language=en-US&append_to_response=images`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchTVDetails(tmdbId) {
  const key = getApiKey();
  if (!key) throw new Error('TMDB_API_KEY not configured');
  const url = `${TMDB_BASE}/tv/${tmdbId}?api_key=${key}&language=en-US&append_to_response=images`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB fetch failed: ${res.status}`);
  return res.json();
}

export async function downloadAndCacheTMDBImage(imagePath, saveDir) {
  // imagePath is like "/abc.jpg"
  const fullUrl = `https://image.tmdb.org/t/p/original${imagePath}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error('TMDB image download failed');
  const buffer = Buffer.from(await res.arrayBuffer());
  const fs = await import('fs');
  const path = await import('path');
  const crypto = await import('crypto');
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
  const fileName = `tmdb-${crypto.randomBytes(4).toString('hex')}.jpg`;
  const filePath = path.join(saveDir, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
}
