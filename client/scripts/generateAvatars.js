import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dir = path.join(__dirname, '..', 'public', 'avatars');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const avatars = [
  {
    file: 'avatar-1.svg',
    name: 'Director',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6366f1"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#cbd5e1"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg1)"/>
  <rect x="26" y="42" width="48" height="36" rx="4" fill="#1e293b" stroke="#475569" stroke-width="1.5"/>
  <polygon points="26,42 74,42 70,30 22,30" fill="#0f172a" stroke="#475569" stroke-width="1.5"/>
  <polygon points="27,31 35,31 32,41 24,41" fill="url(#g1)"/>
  <polygon points="41,31 49,31 46,41 38,41" fill="url(#g1)"/>
  <polygon points="55,31 63,31 60,41 52,41" fill="url(#g1)"/>
  <polygon points="68,31 71,31 67,41 64,41" fill="url(#g1)"/>
  <circle cx="50" cy="60" r="10" fill="#6366f1" opacity="0.4"/>
  <polygon points="47,54 56,60 47,66" fill="#38bdf8"/>
</svg>`
  },
  {
    file: 'avatar-2.svg',
    name: 'Cinema Popcorn',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg2" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ea580c"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg2)"/>
  <polygon points="32,45 68,45 64,80 36,80" fill="#ffffff"/>
  <polygon points="38,45 44,45 43,80 37,80" fill="#dc2626"/>
  <polygon points="50,45 56,45 55,80 49,80" fill="#dc2626"/>
  <polygon points="62,45 67,45 64,80 59,80" fill="#dc2626"/>
  <circle cx="37" cy="38" r="7" fill="#fef08a"/>
  <circle cx="48" cy="33" r="8" fill="#fde047"/>
  <circle cx="61" cy="37" r="7" fill="#fef08a"/>
  <circle cx="42" cy="42" r="6" fill="#fffbeb"/>
  <circle cx="56" cy="41" r="6" fill="#fffbeb"/>
  <circle cx="50" cy="38" r="5" fill="#facc15"/>
  <rect x="33" y="54" width="34" height="9" rx="2" fill="#1e293b"/>
  <rect x="35" y="56" width="13" height="5" rx="1" fill="#0284c7"/>
  <rect x="52" y="56" width="13" height="5" rx="1" fill="#e11d48"/>
</svg>`
  },
  {
    file: 'avatar-3.svg',
    name: 'Sound DJ',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg3" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg3)"/>
  <path d="M26,52 A24,24 0 0,1 74,52" fill="none" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
  <rect x="20" y="46" width="10" height="20" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
  <rect x="70" y="46" width="10" height="20" rx="4" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
  <line x1="38" y1="62" x2="38" y2="46" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
  <line x1="44" y1="67" x2="44" y2="41" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
  <line x1="50" y1="70" x2="50" y2="38" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
  <line x1="56" y1="67" x2="56" y2="41" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
  <line x1="62" y1="62" x2="62" y2="46" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
</svg>`
  },
  {
    file: 'avatar-4.svg',
    name: 'Vinyl Master',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg4" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg4)"/>
  <circle cx="50" cy="50" r="32" fill="#0f172a" stroke="#334155" stroke-width="1.5"/>
  <circle cx="50" cy="50" r="26" fill="none" stroke="#1e293b" stroke-width="1.5"/>
  <circle cx="50" cy="50" r="20" fill="none" stroke="#334155" stroke-width="1"/>
  <circle cx="50" cy="50" r="12" fill="#f59e0b"/>
  <circle cx="50" cy="50" r="3.5" fill="#0f172a"/>
  <path d="M26,38 A32,32 0 0,1 42,21 L46,31 A20,20 0 0,0 36,41 Z" fill="#ffffff" opacity="0.15"/>
  <path d="M74,62 A32,32 0 0,1 58,79 L54,69 A20,20 0 0,0 64,59 Z" fill="#ffffff" opacity="0.15"/>
</svg>`
  },
  {
    file: 'avatar-5.svg',
    name: 'Cosmic Astronaut',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg5" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="100%" stop-color="#312e81"/>
    </linearGradient>
    <linearGradient id="visor" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="50%" stop-color="#ec4899"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg5)"/>
  <circle cx="50" cy="48" r="26" fill="#f8fafc"/>
  <rect x="34" y="68" width="32" height="12" rx="5" fill="#cbd5e1"/>
  <ellipse cx="50" cy="48" rx="20" ry="16" fill="url(#visor)"/>
  <path d="M38,40 Q45,36 54,38" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" fill="none" opacity="0.8"/>
  <circle cx="24" cy="28" r="1.5" fill="#ffffff"/>
  <circle cx="78" cy="30" r="1" fill="#ffffff"/>
  <circle cx="72" cy="70" r="1.5" fill="#ffffff"/>
</svg>`
  },
  {
    file: 'avatar-6.svg',
    name: 'Retro Gamer',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg6" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d946ef"/>
      <stop offset="100%" stop-color="#701a75"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg6)"/>
  <rect x="22" y="36" width="56" height="34" rx="10" fill="#1e293b" stroke="#f472b6" stroke-width="1.5"/>
  <rect x="30" y="47" width="14" height="5" rx="1.5" fill="#64748b"/>
  <rect x="34.5" y="42.5" width="5" height="14" rx="1.5" fill="#64748b"/>
  <circle cx="60" cy="46" r="3.5" fill="#38bdf8"/>
  <circle cx="68" cy="46" r="3.5" fill="#f43f5e"/>
  <circle cx="64" cy="54" r="3.5" fill="#22c55e"/>
  <ellipse cx="47" cy="61" rx="2" ry="1" fill="#94a3b8"/>
  <ellipse cx="53" cy="61" rx="2" ry="1" fill="#94a3b8"/>
</svg>`
  },
  {
    file: 'avatar-7.svg',
    name: 'Cyber Hero',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg7" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="neon" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#06b6d4"/>
      <stop offset="50%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg7)"/>
  <path d="M32,46 C32,32 68,32 68,46 C68,58 60,66 50,66 C40,66 32,58 32,46 Z" fill="#334155"/>
  <polygon points="26,45 74,45 70,55 30,55" fill="url(#neon)"/>
  <line x1="28" y1="50" x2="72" y2="50" stroke="#ffffff" stroke-width="1.5"/>
  <circle cx="28" cy="50" r="4" fill="#06b6d4"/>
  <circle cx="72" cy="50" r="4" fill="#8b5cf6"/>
  <path d="M34,70 L50,65 L66,70 L72,84 L28,84 Z" fill="#1e293b" stroke="#06b6d4" stroke-width="1"/>
</svg>`
  },
  {
    file: 'avatar-8.svg',
    name: 'Royal VIP',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg8" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="50%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg8)"/>
  <polygon points="24,64 76,64 72,40 58,52 50,34 42,52 28,40" fill="url(#gold)" stroke="#a16207" stroke-width="1"/>
  <circle cx="28" cy="38" r="3" fill="#ef4444"/>
  <circle cx="50" cy="32" r="3.5" fill="#06b6d4"/>
  <circle cx="72" cy="38" r="3" fill="#ef4444"/>
  <circle cx="42" cy="60" r="2" fill="#ffffff"/>
  <circle cx="50" cy="60" r="2.5" fill="#ef4444"/>
  <circle cx="58" cy="60" r="2" fill="#ffffff"/>
  <rect x="23" y="63" width="54" height="7" rx="2" fill="#ca8a04" stroke="#a16207" stroke-width="1"/>
</svg>`
  },
  {
    file: 'avatar-9.svg',
    name: 'Studio Mic',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg9" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e11d48"/>
      <stop offset="100%" stop-color="#9f1239"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg9)"/>
  <rect x="41" y="28" width="18" height="28" rx="9" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="41" y1="37" x2="59" y2="37" stroke="#94a3b8" stroke-width="1"/>
  <line x1="41" y1="43" x2="59" y2="43" stroke="#94a3b8" stroke-width="1"/>
  <line x1="50" y1="28" x2="50" y2="47" stroke="#94a3b8" stroke-width="1"/>
  <path d="M33,45 C33,62 67,62 67,45" fill="none" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
  <line x1="50" y1="57" x2="50" y2="73" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
  <line x1="38" y1="74" x2="62" y2="74" stroke="#1e293b" stroke-width="4" stroke-linecap="round"/>
  <circle cx="50" cy="42" r="26" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.2" stroke-dasharray="3,3"/>
</svg>`
  },
  {
    file: 'avatar-10.svg',
    name: 'Chill Cat',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg10" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c"/>
      <stop offset="100%" stop-color="#f43f5e"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg10)"/>
  <polygon points="32,46 26,24 45,35" fill="#1e293b"/>
  <polygon points="32,42 29,29 41,36" fill="#f472b6"/>
  <polygon points="68,46 74,24 55,35" fill="#1e293b"/>
  <polygon points="68,42 71,29 59,36" fill="#f472b6"/>
  <circle cx="50" cy="52" r="22" fill="#1e293b"/>
  <polygon points="33,48 48,48 46,57 35,57" fill="#38bdf8"/>
  <polygon points="52,48 67,48 65,57 54,57" fill="#38bdf8"/>
  <line x1="47" y1="51" x2="53" y2="51" stroke="#38bdf8" stroke-width="2"/>
  <polygon points="48,62 52,62 50,64" fill="#f472b6"/>
  <path d="M46,65 Q50,68 54,65" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
  <line x1="28" y1="58" x2="20" y2="56" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="28" y1="62" x2="19" y2="64" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="72" y1="58" x2="80" y2="56" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="72" y1="62" x2="81" y2="64" stroke="#cbd5e1" stroke-width="1.5"/>
</svg>`
  },
  {
    file: 'avatar-11.svg',
    name: 'Shadow Ninja',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg11" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg11)"/>
  <ellipse cx="50" cy="50" rx="24" ry="26" fill="#1e293b"/>
  <polygon points="35,44 65,44 62,54 38,54" fill="#020617"/>
  <ellipse cx="42" cy="49" rx="4.5" ry="2" fill="#ef4444"/>
  <ellipse cx="58" cy="49" rx="4.5" ry="2" fill="#ef4444"/>
  <circle cx="43" cy="49" r="1" fill="#ffffff"/>
  <circle cx="59" cy="49" r="1" fill="#ffffff"/>
  <path d="M26,44 Q16,42 12,50" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M26,46 Q18,48 14,58" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
</svg>`
  },
  {
    file: 'avatar-12.svg',
    name: 'Star Legend',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg12" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#ca8a04"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg12)"/>
  <circle cx="50" cy="50" r="35" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.4" stroke-dasharray="4,3"/>
  <polygon points="50,22 57,38 75,40 61,53 65,71 50,61 35,71 39,53 25,40 43,38" fill="#ffffff"/>
  <polygon points="50,26 55,40 70,42 58,53 62,67 50,59 38,67 42,53 30,42 45,40" fill="#fef08a"/>
</svg>`
  },
  {
    file: 'avatar-13.svg',
    name: 'Cozy Listener',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg13" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#78350f"/>
      <stop offset="100%" stop-color="#451a03"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg13)"/>
  <rect x="35" y="46" width="30" height="26" rx="6" fill="#f8fafc"/>
  <path d="M65,52 C72,52 72,64 65,64" fill="none" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="50" cy="48" rx="13" ry="3" fill="#b45309"/>
  <path d="M45,40 Q43,32 47,26" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <path d="M53,42 Q57,34 53,28" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
  <circle cx="48" cy="60" r="2.5" fill="#b45309"/>
  <rect x="49.5" y="54" width="1.5" height="6" fill="#b45309"/>
  <path d="M51,54 Q55,53 55,57" fill="none" stroke="#b45309" stroke-width="1.5" stroke-linecap="round"/>
</svg>`
  },
  {
    file: 'avatar-14.svg',
    name: 'Drama Theatre',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg14" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#be123c"/>
      <stop offset="100%" stop-color="#881337"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg14)"/>
  <ellipse cx="42" cy="46" rx="16" ry="19" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5"/>
  <ellipse cx="36" cy="42" rx="2.5" ry="3" fill="#713f12"/>
  <ellipse cx="46" cy="42" rx="2.5" ry="3" fill="#713f12"/>
  <path d="M34,53 Q41,61 48,53" fill="none" stroke="#713f12" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="58" cy="54" rx="16" ry="19" fill="#e2e8f0" stroke="#64748b" stroke-width="1.5"/>
  <ellipse cx="54" cy="50" rx="2.5" ry="3" fill="#334155"/>
  <ellipse cx="64" cy="50" rx="2.5" ry="3" fill="#334155"/>
  <path d="M54,63 Q60,57 66,63" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round"/>
</svg>`
  },
  {
    file: 'avatar-15.svg',
    name: 'Diamond VIP',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg15" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="dia" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg15)"/>
  <polygon points="50,26 76,46 50,78 24,46" fill="url(#dia)" stroke="#bae6fd" stroke-width="1.5"/>
  <polygon points="50,26 62,46 50,78 38,46" fill="#ffffff" opacity="0.2"/>
  <line x1="24" y1="46" x2="76" y2="46" stroke="#ffffff" stroke-width="1.5"/>
  <path d="M22,30 L25,30 L23.5,27 Z" fill="#ffffff"/>
  <circle cx="24" cy="29" r="3" fill="#ffffff" opacity="0.5"/>
  <circle cx="75" cy="68" r="2.5" fill="#ffffff" opacity="0.7"/>
</svg>`
  },
  {
    file: 'avatar-16.svg',
    name: 'Neon Lightning',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg16" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4c1d95"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <linearGradient id="bolt" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047"/>
      <stop offset="100%" stop-color="#eab308"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="50" fill="url(#bg16)"/>
  <polygon points="54,20 32,52 48,52 44,80 68,46 52,46" fill="url(#bolt)"/>
  <polygon points="53,24 38,49 49,49 46,68 61,48 51,48" fill="#ffffff" opacity="0.5"/>
</svg>`
  }
];

avatars.forEach(a => {
  const filePath = path.join(dir, a.file);
  fs.writeFileSync(filePath, a.svg.trim(), 'utf8');
  console.log('Created ' + a.file);
});
console.log('All 16 SVG avatars generated successfully!');
