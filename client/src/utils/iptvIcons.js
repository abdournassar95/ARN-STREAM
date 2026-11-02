/**
 * Curated Bouquet Logos, Country Flags, and Channel Badges for ARN IPTV Pro
 * Supports Drama Live topics, M3U bouquets, and fallback brand badges.
 */

function toSvgDataUri(svg) {
  try {
    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
    }
    if (typeof Buffer !== 'undefined') {
      return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf-8').toString('base64')}`;
    }
  } catch {}
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const createSvgBadge = (bg1, bg2, fg, text, sub) => {
  const safeId = text.replace(/[^a-zA-Z0-9]/g, '_') || 'badge';
  const hasSub = Boolean(sub);
  const textY = hasSub ? 16 : 22;
  const subY = 32;
  const fontSize = text.length > 7 ? 10 : text.length > 5 ? 12 : 14;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="44" viewBox="0 0 80 44">
  <defs>
    <linearGradient id="bg_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="80" height="44" rx="8" fill="${bg1}"/>
  <rect width="80" height="44" rx="8" fill="url(#bg_${safeId})"/>
  <rect width="80" height="44" rx="8" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5"/>
  <text x="40" y="${textY}" fill="${fg}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central" letter-spacing="0.5">${text}</text>
  ${hasSub ? `<text x="40" y="${subY}" fill="rgba(255,255,255,0.92)" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="8.5" text-anchor="middle" dominant-baseline="central" letter-spacing="0.4">${sub}</text>` : ''}
</svg>`;

  return toSvgDataUri(svg);
};

export const createChannelSvgLogo = (bg1, bg2, fg, title, subtitle) => {
  const safeId = title.replace(/[^a-zA-Z0-9]/g, '_') || 'ch';
  const hasSub = Boolean(subtitle);
  const textY = hasSub ? 42 : 50;
  const subY = 72;
  const fontSize = title.length > 7 ? 16 : title.length > 4 ? 20 : 24;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="ch_${safeId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="20" fill="${bg1}"/>
  <rect width="100" height="100" rx="20" fill="url(#ch_${safeId})"/>
  <rect width="100" height="100" rx="20" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <text x="50" y="${textY}" fill="${fg}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${fontSize}" text-anchor="middle" dominant-baseline="central">${title}</text>
  ${hasSub ? `<text x="50" y="${subY}" fill="rgba(255,255,255,0.85)" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" text-anchor="middle" dominant-baseline="central" letter-spacing="0.5">${subtitle}</text>` : ''}
</svg>`;

  return toSvgDataUri(svg);
};

export const BOUQUET_ICONS = {
  bein: createSvgBadge('#7c3aed', '#4c1d95', '#ffffff', 'beIN', 'SPORTS'),
  mbc: createSvgBadge('#0284c7', '#0369a1', '#ffffff', 'MBC', 'GROUP'),
  shahid: createSvgBadge('#0d9488', '#0f766e', '#facc15', 'SHAHID', 'VIP'),
  rotana: createSvgBadge('#16a34a', '#15803d', '#ffffff', 'ROTANA'),
  osn: createSvgBadge('#ef4444', '#dc2626', '#ffffff', 'OSN', 'NETWORK'),
  roya: createSvgBadge('#2563eb', '#1d4ed8', '#ffffff', 'ROYA', 'TV'),
  art: createSvgBadge('#d97706', '#b45309', '#ffffff', 'ART', 'CHANNELS'),
  netflix: createSvgBadge('#e50914', '#18181b', '#ffffff', 'NETFLIX', 'LIVE'),
  news: createSvgBadge('#0284c7', '#0f172a', '#38bdf8', 'NEWS', 'إخبارية'),
  sports: createSvgBadge('#059669', '#047857', '#ffffff', 'SPORTS', 'رياضة'),
  drama: createSvgBadge('#db2777', '#be185d', '#ffffff', 'DRAMA', 'دراما'),
  kids: createSvgBadge('#f59e0b', '#d97706', '#ffffff', 'KIDS', 'أطفال'),
  cinema: createSvgBadge('#b91c1c', '#7f1d1d', '#facc15', 'CINEMA', 'سينما'),
  doc: createSvgBadge('#0891b2', '#0e7490', '#ffffff', 'DOC', 'وثائقية'),
  islam: createSvgBadge('#059669', '#064e3b', '#34d399', 'ISLAM', 'إسلاميات'),
  quran: createSvgBadge('#047857', '#064e3b', '#6ee7b7', 'QURAN', 'القرآن'),
  radio: createSvgBadge('#3b82f6', '#1d4ed8', '#38bdf8', 'RADIO', 'راديو'),
  kurdistan: 'https://flagcdn.com/w40/iq.png',
};

const COUNTRY_FLAG_MAP = {
  // Arab Nations
  eg: 'https://flagcdn.com/w40/eg.png',
  sa: 'https://flagcdn.com/w40/sa.png',
  ae: 'https://flagcdn.com/w40/ae.png',
  qa: 'https://flagcdn.com/w40/qa.png',
  kw: 'https://flagcdn.com/w40/kw.png',
  iq: 'https://flagcdn.com/w40/iq.png',
  lb: 'https://flagcdn.com/w40/lb.png',
  jo: 'https://flagcdn.com/w40/jo.png',
  ps: 'https://flagcdn.com/w40/ps.png',
  sy: 'https://flagcdn.com/w40/sy.png',
  ma: 'https://flagcdn.com/w40/ma.png',
  dz: 'https://flagcdn.com/w40/dz.png',
  tn: 'https://flagcdn.com/w40/tn.png',
  ly: 'https://flagcdn.com/w40/ly.png',
  sd: 'https://flagcdn.com/w40/sd.png',
  ye: 'https://flagcdn.com/w40/ye.png',
  om: 'https://flagcdn.com/w40/om.png',
  bh: 'https://flagcdn.com/w40/bh.png',
  mr: 'https://flagcdn.com/w40/mr.png',
  dj: 'https://flagcdn.com/w40/dj.png',
  km: 'https://flagcdn.com/w40/km.png',

  // World Nations
  tr: 'https://flagcdn.com/w40/tr.png',
  fr: 'https://flagcdn.com/w40/fr.png',
  gb: 'https://flagcdn.com/w40/gb.png',
  uk: 'https://flagcdn.com/w40/gb.png',
  de: 'https://flagcdn.com/w40/de.png',
  es: 'https://flagcdn.com/w40/es.png',
  it: 'https://flagcdn.com/w40/it.png',
  pt: 'https://flagcdn.com/w40/pt.png',
  nl: 'https://flagcdn.com/w40/nl.png',
  be: 'https://flagcdn.com/w40/be.png',
  gr: 'https://flagcdn.com/w40/gr.png',
  ru: 'https://flagcdn.com/w40/ru.png',
  ua: 'https://flagcdn.com/w40/ua.png',
  pl: 'https://flagcdn.com/w40/pl.png',
  ro: 'https://flagcdn.com/w40/ro.png',
  bg: 'https://flagcdn.com/w40/bg.png',
  rs: 'https://flagcdn.com/w40/rs.png',
  hr: 'https://flagcdn.com/w40/hr.png',
  us: 'https://flagcdn.com/w40/us.png',
  usa: 'https://flagcdn.com/w40/us.png',
  ca: 'https://flagcdn.com/w40/ca.png',
  br: 'https://flagcdn.com/w40/br.png',
  ar: 'https://flagcdn.com/w40/ar.png',
  mx: 'https://flagcdn.com/w40/mx.png',
  co: 'https://flagcdn.com/w40/co.png',
  cl: 'https://flagcdn.com/w40/cl.png',
  in: 'https://flagcdn.com/w40/in.png',
  pk: 'https://flagcdn.com/w40/pk.png',
  ir: 'https://flagcdn.com/w40/ir.png',
  bd: 'https://flagcdn.com/w40/bd.png',
  id: 'https://flagcdn.com/w40/id.png',
  my: 'https://flagcdn.com/w40/my.png',
  th: 'https://flagcdn.com/w40/th.png',
  cn: 'https://flagcdn.com/w40/cn.png',
  kr: 'https://flagcdn.com/w40/kr.png',
  jp: 'https://flagcdn.com/w40/jp.png',
};

const KEYWORD_TO_CODE = {
  // Arab
  'مصر': 'eg',
  'egypt': 'eg',
  'السعودية': 'sa',
  'saudi': 'sa',
  'الإمارات': 'ae',
  'امارات': 'ae',
  'uae': 'ae',
  'قطر': 'qa',
  'qatar': 'qa',
  'الكويت': 'kw',
  'kuwait': 'kw',
  'العراق': 'iq',
  'iraq': 'iq',
  'لبنان': 'lb',
  'lebanon': 'lb',
  'الأردن': 'jo',
  'اردن': 'jo',
  'jordan': 'jo',
  'فلسطين': 'ps',
  'palestine': 'ps',
  'سوريا': 'sy',
  'syria': 'sy',
  'المغرب': 'ma',
  'morocco': 'ma',
  'الجزائر': 'dz',
  'algeria': 'dz',
  'تونس': 'tn',
  'tunisia': 'tn',
  'ليبيا': 'ly',
  'libya': 'ly',
  'السودان': 'sd',
  'sudan': 'sd',
  'اليمن': 'ye',
  'yemen': 'ye',
  'عمان': 'om',
  'oman': 'om',
  'البحرين': 'bh',
  'bahrain': 'bh',
  'موريتانيا': 'mr',
  'mauritania': 'mr',
  'جيبوتي': 'dj',
  'djibouti': 'dj',
  'جزر القمر': 'km',
  'comoros': 'km',
  'كردستان': 'kurdistan',
  'kurdistan': 'kurdistan',

  // World
  'تركيا': 'tr',
  'turkey': 'tr',
  'فرنسا': 'fr',
  'france': 'fr',
  'بريطانيا': 'gb',
  'united kingdom': 'gb',
  'ألمانيا': 'de',
  'germany': 'de',
  'إسبانيا': 'es',
  'spain': 'es',
  'إيطاليا': 'it',
  'italy': 'it',
  'البرتغال': 'pt',
  'portugal': 'pt',
  'هولندا': 'nl',
  'netherlands': 'nl',
  'بلجيكا': 'be',
  'belgium': 'be',
  'اليونان': 'gr',
  'greece': 'gr',
  'روسيا': 'ru',
  'russia': 'ru',
  'أمريكا': 'us',
  'usa': 'us',
  'united states': 'us',
  'كندا': 'ca',
  'canada': 'ca',
  'البرازيل': 'br',
  'brazil': 'br',
  'الأرجنتين': 'ar',
  'argentina': 'ar',
  'المكسيك': 'mx',
  'mexico': 'mx',
  'كولومبيا': 'co',
  'colombia': 'co',
  'تشيلي': 'cl',
  'chile': 'cl',
  'الهند': 'in',
  'india': 'in',
  'باكستان': 'pk',
  'pakistan': 'pk',
  'إيران': 'ir',
  'iran': 'ir',
  'بنغلاديش': 'bd',
  'bangladesh': 'bd',
  'إندونيسيا': 'id',
  'indonesia': 'id',
  'ماليزيا': 'my',
  'malaysia': 'my',
  'تايلاند': 'th',
  'thailand': 'th',
  'الصين': 'cn',
  'china': 'cn',
  'كوريا': 'kr',
  'korea': 'kr',
  'اليابان': 'jp',
  'japan': 'jp',
};

// Arabic & English alias matching for bouquets
const BOUQUET_ALIASES = [
  { keys: ['bein', 'بي ان', 'بي إن'], iconKey: 'bein' },
  { keys: ['mbc', 'ام بي سي', 'إم بي سي'], iconKey: 'mbc' },
  { keys: ['shahid', 'شاهد'], iconKey: 'shahid' },
  { keys: ['rotana', 'روتانا'], iconKey: 'rotana' },
  { keys: ['osn', 'او اس ان', 'أو إس إن'], iconKey: 'osn' },
  { keys: ['roya', 'رؤيا', 'رؤية'], iconKey: 'roya' },
  { keys: ['art', 'ايه ار تي', 'إيه آر تي'], iconKey: 'art' },
  { keys: ['netflix', 'نتفلكس', 'نتفليكس'], iconKey: 'netflix' },
  { keys: ['news', 'اخبار', 'أخبار', 'الإخبارية', 'الاخبارية'], iconKey: 'news' },
  { keys: ['sport', 'رياض', 'الرياضية'], iconKey: 'sports' },
  { keys: ['drama', 'درام', 'مسلسل'], iconKey: 'drama' },
  { keys: ['cinema', 'سينما', 'افلام', 'أفلام'], iconKey: 'cinema' },
  { keys: ['kids', 'اطفال', 'أطفال', 'كرتون'], iconKey: 'kids' },
  { keys: ['doc', 'وثائق'], iconKey: 'doc' },
  { keys: ['islam', 'اسلام', 'إسلام', 'دين'], iconKey: 'islam' },
  { keys: ['quran', 'قران', 'قرآن'], iconKey: 'quran' },
  { keys: ['radio', 'راديو', 'اذاع', 'إذاع'], iconKey: 'radio' },
];

/**
 * Resolves a visual badge (Bouquet image or Country flag) for a category
 */
export function getCategoryVisual(name, remoteTopic, icon, flag) {
  if (icon) return { type: 'icon', src: icon };
  if (flag) return { type: 'flag', src: flag };

  const lowerTopic = String(remoteTopic || '').toLowerCase();
  const lowerName = String(name || '').toLowerCase();

  // 1. Keyword / Alias Matches for Bouquets (Both Arabic & English)
  for (const item of BOUQUET_ALIASES) {
    if (item.keys.some((k) => lowerTopic.includes(k) || lowerName.includes(k))) {
      const src = BOUQUET_ICONS[item.iconKey];
      if (src) return { type: 'icon', src };
    }
  }

  // 2. Direct Topic Key Matches (2-letter ISO)
  if (lowerTopic && COUNTRY_FLAG_MAP[lowerTopic]) {
    return { type: 'flag', src: COUNTRY_FLAG_MAP[lowerTopic] };
  }

  // 3. Keyword Detection in Category Name for Countries
  for (const [kw, code] of Object.entries(KEYWORD_TO_CODE)) {
    if (lowerName.includes(kw)) {
      if (code === 'kurdistan') {
        return { type: 'icon', src: BOUQUET_ICONS.kurdistan };
      }
      return { type: 'flag', src: COUNTRY_FLAG_MAP[code] };
    }
  }

  // 4. Bracketed ISO codes, e.g. [EG], |SA|, (US)
  const isoMatch = String(name || '').match(/[\[|(|/]([A-Za-z]{2})[\]|)|/]/);
  if (isoMatch) {
    const code = isoMatch[1].toLowerCase();
    if (COUNTRY_FLAG_MAP[code]) {
      return { type: 'flag', src: COUNTRY_FLAG_MAP[code] };
    }
  }

  return null;
}

/**
 * Generates an elegant fallback badge SVG for any channel whose image is missing or fails to load.
 */
export function getChannelFallbackLogo(name) {
  const clean = String(name || '').replace(/^live_tv_/i, '').replace(/[|—\-].*$/, '').trim();
  const lower = clean.toLowerCase();

  // 1. Specific brand palettes
  if (lower.includes('ahly') || lower.includes('اهلي') || lower.includes('أهلي')) {
    return createChannelSvgLogo('#b91c1c', '#7f1d1d', '#ffffff', 'الأهلي', 'AL AHLY');
  }
  if (lower.includes('zamalek') || lower.includes('زمالك')) {
    return createChannelSvgLogo('#ffffff', '#f1f5f9', '#dc2626', 'الزمالك', 'ZAMALEK');
  }
  if (lower.includes('on sport') || lower.includes('اون سبورت') || lower.includes('أون سبورت')) {
    return createChannelSvgLogo('#0a192f', '#0284c7', '#00f2fe', 'ON', 'SPORT');
  }
  if (lower.includes('on') || lower.includes('اون') || lower.includes('أون')) {
    return createChannelSvgLogo('#0a192f', '#1e293b', '#ff7849', 'ON', 'EGYPT');
  }
  if (lower.includes('hayah') || lower.includes('حياة')) {
    return createChannelSvgLogo('#701a75', '#4a044e', '#ffffff', 'الحياة', 'TV');
  }
  if (lower.includes('dmc')) {
    return createChannelSvgLogo('#0f172a', '#1e293b', '#38bdf8', 'dmc', 'HD');
  }
  if (lower.includes('cbc')) {
    return createChannelSvgLogo('#0369a1', '#075985', '#ffffff', 'CBC', 'EGYPT');
  }
  if (lower.includes('sada') || lower.includes('صدى')) {
    return createChannelSvgLogo('#1e3a8a', '#172554', '#ffffff', 'صدى البلد', 'BALAD');
  }
  if (lower.includes('nahar') || lower.includes('نهار')) {
    return createChannelSvgLogo('#1e293b', '#0f172a', '#38bdf8', 'النهار', 'AL NAHAR');
  }
  if (lower.includes('mehwar') || lower.includes('محور')) {
    return createChannelSvgLogo('#1e3a8a', '#1e1b4b', '#ffffff', 'المحور', 'MEHWAR');
  }
  if (lower.includes('masr') || lower.includes('مصر') || lower.includes('masriyah') || lower.includes('مصرية')) {
    return createChannelSvgLogo('#991b1b', '#0f172a', '#facc15', 'المصرية', 'EGYPT');
  }

  // 2. Generic initial letter avatar
  const words = clean.split(/\s+/).filter(Boolean);
  const initials = words.length >= 2 
    ? (words[0].slice(0, 1) + words[1].slice(0, 1))
    : clean.slice(0, 3);

  return createChannelSvgLogo('#1e293b', '#0f172a', '#38bdf8', initials || 'TV');
}
