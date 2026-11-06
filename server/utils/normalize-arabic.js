/**
 * Arabic text normalisation used by the search engine (SQLite `norm_ar`).
 * Kept dependency-free so it can be unit-tested without the native database.
 */
export function normalizeArabic(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '');
}

/** Converts Arabic-Indic digits (٠-٩ / ۰-۹) to ASCII digits. */
export function normalizeDigits(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0));
}

export default normalizeArabic;
