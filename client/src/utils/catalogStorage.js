const DB_NAME = 'arn_iptv_pro_idb_v1';
const DB_VERSION = 1;
const STORE_NAME = 'catalog_store';

/**
 * Normalizes any legacy `/api/proxy/...` stream URLs to `/api/live/proxy/...`
 */
export function normalizeProxyUrl(url) {
  if (!url || typeof url !== 'string') return url;
  if (url.startsWith('/api/proxy/')) {
    return '/api/live/proxy/' + url.slice('/api/proxy/'.length);
  }
  return url;
}

export function normalizeChannelItem(ch) {
  if (!ch || typeof ch !== 'object') return ch;
  const isRadio = ch.section === 'radio' || String(ch.categoryId || '').startsWith('rad-cat-');
  const normalizedLogo = isRadio ? '/ARN-logo.png' : ch.logo;
  if (Array.isArray(ch.sources)) {
    return {
      ...ch,
      logo: normalizedLogo,
      sources: ch.sources.map((s) => ({
        ...s,
        url: normalizeProxyUrl(s.url),
      })),
    };
  }
  return isRadio ? { ...ch, logo: normalizedLogo } : ch;
}

function openCatalogDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

export async function saveCatalogToIdb(key, data) {
  try {
    const db = await openCatalogDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, key);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch (idbErr) {
    console.warn(`[CatalogStorage] IndexedDB save failed for key="${key}", falling back to localStorage:`, idbErr);
    try {
      const lsKey = `arn_iptv_idb_fallback_${key}`;
      localStorage.setItem(lsKey, JSON.stringify(data));
    } catch {
      // localStorage also full
    }
  }
}

export async function loadCatalogFromIdb(key) {
  try {
    const db = await openCatalogDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        db.close();
        const res = req.result;
        if (!Array.isArray(res)) {
          resolve(null);
          return;
        }
        resolve(key === 'channels' ? res.map(normalizeChannelItem) : res);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (idbErr) {
    console.warn(`[CatalogStorage] IndexedDB read failed for key="${key}", trying localStorage fallback:`, idbErr);
    try {
      const lsKey = `arn_iptv_idb_fallback_${key}`;
      const raw = localStorage.getItem(lsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return key === 'channels' ? parsed.map(normalizeChannelItem) : parsed;
        }
      }
    } catch {
      // localStorage fallback also unavailable
    }
    return null;
  }
}
