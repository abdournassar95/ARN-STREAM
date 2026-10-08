/**
 * Utility helper to localize canonical library names at the UI display level,
 * leaving original disk paths and database values intact.
 */
export function localizeLibraryName(name, isArabic) {
  if (!name) return '';
  if (isArabic) return name;

  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (lower === 'أفلام' || lower === 'افلام') return 'Movies';
  if (lower === 'مسلسلات') return 'TV Series';
  if (lower === 'موسيقى' || lower === 'موسيقي') return 'Music';
  if (lower === 'مسرحيات' || lower === 'مسرح') return 'Plays';
  if (lower === 'وثائقية' || lower === 'وثائقيات') return 'Documentaries';
  if (lower === 'القرآن الكريم' || lower === 'القران الكريم' || lower === 'قرآن' || lower === 'قران') return 'Holy Quran';

  if (trimmed.startsWith('أحدث ') || trimmed.startsWith('احدث ')) {
    const sub = trimmed.slice(5);
    return `Latest ${localizeLibraryName(sub, false)}`;
  }

  return trimmed;
}
