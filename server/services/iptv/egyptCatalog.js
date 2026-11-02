function buildEgyptSources(code, idLive, fallbackUrl) {
  // Dedicated rock-solid direct MPEG-TS sources for Egyptian MBC channels
  if (idLive === 'live_tv_panel_c6ab30c8f13fb5b6fc3756b08e5afd1a') {
    // MBC Drama Masr
    return [
      {
        id: `${idLive}-srv-1`,
        serverNumber: 1,
        badge: 'FHD',
        name: 'سيرفر 1 (بث فضائي مباشر FHD)',
        url: `/api/live/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
        isProxied: true,
        hasK9xSwap: true,
      },
      {
        id: `${idLive}-srv-2`,
        serverNumber: 2,
        badge: 'FHD Direct',
        name: 'سيرفر 2 (بث مباشر عالي السرعة)',
        url: 'http://185.9.2.18/chid_741/mono.m3u8',
        qualityHint: '1080p FHD Direct',
      },
      {
        id: `${idLive}-srv-3`,
        serverNumber: 3,
        badge: 'Proxy',
        name: 'سيرفر 3 (البروكسي المحلي المباشر)',
        url: `/api/live/proxy/m3u8?u=${encodeURIComponent('http://185.9.2.18/chid_741/mono.m3u8')}`,
        isProxied: true,
      },
      {
        id: `${idLive}-srv-4`,
        serverNumber: 4,
        badge: 'HD',
        name: 'سيرفر 4 (بث احتياطي)',
        url: `/api/live/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=1`,
        isProxied: true,
        hasK9xSwap: true,
      },
    ];
  }

  if (idLive === 'live_tv_mbcmsr') {
    // MBC Masr 1
    return [
      {
        id: `${idLive}-srv-1`,
        serverNumber: 1,
        badge: 'FHD',
        name: 'سيرفر 1 (بث فضائي مباشر FHD)',
        url: `/api/live/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
        isProxied: true,
        hasK9xSwap: true,
      },
      {
        id: `${idLive}-srv-2`,
        serverNumber: 2,
        badge: 'FHD Direct',
        name: 'سيرفر 2 (بث مباشر عالي السرعة)',
        url: 'http://185.9.2.18/chid_742/mono.m3u8',
        qualityHint: '1080p FHD Direct',
      },
      {
        id: `${idLive}-srv-3`,
        serverNumber: 3,
        badge: 'HD USA',
        name: 'سيرفر 3 (بث دولي احتياطي)',
        url: 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-masr-usa/857e4e8e19c0deea13c1f06ca27d6d97/index.m3u8',
        qualityHint: '720p HD',
      },
      {
        id: `${idLive}-srv-4`,
        serverNumber: 4,
        badge: 'Proxy',
        name: 'سيرفر 4 (عبر البروكسي المحلي)',
        url: `/api/live/proxy/m3u8?u=${encodeURIComponent('http://185.9.2.18/chid_742/mono.m3u8')}`,
        isProxied: true,
      },
    ];
  }

  if (idLive === 'live_tv_mbcmasr2') {
    // MBC Masr 2
    return [
      {
        id: `${idLive}-srv-1`,
        serverNumber: 1,
        badge: 'FHD',
        name: 'سيرفر 1 (بث فضائي مباشر FHD)',
        url: `/api/live/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
        isProxied: true,
        hasK9xSwap: true,
      },
      {
        id: `${idLive}-srv-2`,
        serverNumber: 2,
        badge: 'FHD Direct',
        name: 'سيرفر 2 (بث مباشر عالي السرعة)',
        url: 'http://185.9.2.18/chid_743/mono.m3u8',
        qualityHint: '1080p FHD Direct',
      },
      {
        id: `${idLive}-srv-3`,
        serverNumber: 3,
        badge: 'Proxy',
        name: 'سيرفر 3 (عبر البروكسي المحلي)',
        url: `/api/live/proxy/m3u8?u=${encodeURIComponent('http://185.9.2.18/chid_743/mono.m3u8')}`,
        isProxied: true,
      },
      {
        id: `${idLive}-srv-4`,
        serverNumber: 4,
        badge: 'HD',
        name: 'سيرفر 4 (بث احتياطي)',
        url: `/api/live/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=1`,
        isProxied: true,
        hasK9xSwap: true,
      },
    ];
  }

  const directFallback = fallbackUrl || 'https://shd-amg-fast.edgenextcdn.net/tx001/playlist.m3u8';
  return [
    {
      id: `${idLive}-srv-1`,
      serverNumber: 1,
      badge: 'FHD',
      name: 'سيرفر 1 (بث فضائي مباشر)',
      url: `/api/live/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=0`,
      isProxied: true,
      hasK9xSwap: true,
    },
    {
      id: `${idLive}-srv-2`,
      serverNumber: 2,
      badge: 'HD',
      name: 'سيرفر 2 (جودة عالية)',
      url: `/api/live/proxy/live/${encodeURIComponent(idLive)}.m3u8?code=${encodeURIComponent(code)}&srv=1`,
      isProxied: true,
      hasK9xSwap: true,
    },
    {
      id: `${idLive}-srv-3`,
      serverNumber: 3,
      badge: 'SD',
      name: 'سيرفر 3 (بث احتياطي سريع)',
      url: directFallback,
      qualityHint: 'Direct Stream',
    },
    {
      id: `${idLive}-srv-4`,
      serverNumber: 4,
      badge: 'Proxy',
      name: 'سيرفر 4 (عبر البروكسي المحلي)',
      url: `/api/live/proxy/m3u8?u=${encodeURIComponent(directFallback)}`,
      isProxied: true,
    },
  ];
}

function createEgBadge(bg1, bg2, fg, title, sub) {
  const safeId = encodeURIComponent(title).replace(/[^a-zA-Z0-9]/g, '_');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="eg_${safeId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" rx="20" fill="url(#eg_${safeId})" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
  <text x="50" y="${sub ? 48 : 58}" fill="${fg}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="${title.length > 7 ? 16 : title.length > 4 ? 20 : 25}" text-anchor="middle">${title}</text>
  ${sub ? `<text x="50" y="73" fill="rgba(255,255,255,0.85)" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="11" text-anchor="middle" letter-spacing="0.5">${sub}</text>` : ''}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getEgyptianChannels(playlistId, code = '202122', customCategoryId) {
  const categoryId = customCategoryId || `fg-cat-eg-${code}`;

  const channelDefs = [
    { id: 'live_tv_alahlytv', name: 'Al Ahly | الاهلي', logo: createEgBadge('#b91c1c', '#7f1d1d', '#ffffff', 'الأهلي', 'AL AHLY') },
    { id: 'live_tv_egzamalek', name: 'Al Zamalek | الزمالك', logo: createEgBadge('#ffffff', '#f8fafc', '#dc2626', 'الزمالك', 'ZAMALEK') },
    { id: 'live_tv_onsport2', name: 'ON Sport 2 | أون سبورت 2', logo: createEgBadge('#0a192f', '#0284c7', '#00f2fe', 'ON 2', 'SPORT') },
    { id: 'live_tv_onsport3', name: 'ON Sport 3 | أون سبورت 3', logo: createEgBadge('#0a192f', '#0284c7', '#00f2fe', 'ON 3', 'SPORT') },
    { id: 'live_tv_onsport', name: 'ON Sport | أون سبورت', logo: createEgBadge('#0a192f', '#0284c7', '#00f2fe', 'ON', 'SPORT') },
    { id: 'live_tv_egyptalfady', name: 'Al Fady TV | قناة الفادي الفضائية', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_eghayat1', name: 'Al Hayah 1 | الحياة الاولى', logo: createEgBadge('#701a75', '#4a044e', '#ffffff', 'الحياة', '1') },
    { id: 'live_tv_egyptalhayatmosalsalat', name: 'Al Hayah Drama | الحياة دراما', logo: createEgBadge('#831843', '#500724', '#ffffff', 'الحياة', 'دراما') },
    { id: 'live_tv_egyhayatmas', name: 'Al Hayat TV | الحياة المسيحية', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_egyptalhurya', name: 'Al Horreya TV | الحرية', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_alqaherawalnas', name: 'Al Kahera Wal Nas | القاهرة والناس', logo: createEgBadge('#0f172a', '#1e293b', '#f59e0b', 'القاهرة', 'والناس') },
    { id: 'live_tv_egypttv', name: 'Al Masriyah | الفضائية المصرية', logo: 'https://i.ibb.co/Kx7wmXCQ/almasriya.png' },
    { id: 'live_tv_egyalnahardrama', name: 'Al Nahar Drama | النهار دراما', logo: createEgBadge('#3b0764', '#1e1b4b', '#ffffff', 'النهار', 'دراما') },
    { id: 'live_tv_egyalnahar', name: 'Al Nahar TV | النهار', logo: createEgBadge('#1e293b', '#0f172a', '#38bdf8', 'النهار', 'AL NAHAR') },
    { id: 'live_tv_masrya1', name: 'Al Oula | القناة الأولى المصرية', logo: createEgBadge('#991b1b', '#450a0a', '#ffffff', 'الأولى', 'المصرية') },
    { id: 'live_tv_egyptalkarma', name: 'Alkarma TV | الكرمة', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_panel_4311a5eb310846973cdae8a7e09c7ee3', name: 'Alkeraza | الكرازة', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_panel_92b99085740686b724810cb75e0e7139', name: 'Alqahera News | القاهرة الاخبارية', logo: createEgBadge('#0f172a', '#1e293b', '#ef4444', 'القاهرة', 'الإخبارية') },
    { id: 'live_tv_alshareqmasr', name: 'Alsharq | الشرق المصرية', logo: createEgBadge('#047857', '#064e3b', '#ffffff', 'الشرق', 'EL SHARQ') },
    { id: 'live_tv_egyptbedaya', name: 'Bedaya TV | قناة بداية', logo: createEgBadge('#0284c7', '#0369a1', '#ffffff', 'بداية', 'BEDAYA') },
    { id: 'live_tv_cbcegydrama', name: 'CBC Drama | سي بي سي دراما', logo: createEgBadge('#831843', '#500724', '#ffffff', 'CBC', 'دراما') },
    { id: 'live_tv_cbcsofra', name: 'CBC Sofra | سي بي سي سفرة', logo: createEgBadge('#b45309', '#78350f', '#ffffff', 'CBC', 'سفرة') },
    { id: 'live_tv_cbcegyextra', name: 'CBC eXtra | سي بي سي إكسترا', logo: createEgBadge('#0f766e', '#115e59', '#ffffff', 'extra', 'NEWS') },
    { id: 'live_tv_cbcegy', name: 'CBC | سي بي سي', logo: createEgBadge('#0369a1', '#075985', '#ffffff', 'CBC', 'EGYPT') },
    { id: 'live_tv_egdmclive', name: 'DMC | دي إم سي', logo: createEgBadge('#0f172a', '#1e293b', '#38bdf8', 'dmc', 'HD') },
    { id: 'live_tv_masrya2', name: 'Egyptian TV 2 | المصرية الثانية', logo: createEgBadge('#1e3a8a', '#172554', '#ffffff', 'الثانية', 'المصرية') },
    { id: 'live_tv_egkojikidz', name: 'Koogi TV | قناة كوجي', logo: 'https://i.imgur.com/zojMTP9.png' },
    { id: 'live_tv_panel_c6ab30c8f13fb5b6fc3756b08e5afd1a', name: 'MBC Drama Masr | MBC مصر دراما', logo: createEgBadge('#0284c7', '#0369a1', '#facc15', 'MBC', 'مصر دراما') },
    { id: 'live_tv_mbcmsr', name: 'MBC Masr 1 | إم بي سي مصر 1', logo: 'https://i.imgur.com/o2elx0u.png' },
    { id: 'live_tv_mbcmasr2', name: 'MBC Masr 2 | MBC مصر 2', logo: 'https://i.imgur.com/KHo7Gtn.png' },
    { id: 'live_tv_mazzikaegypt', name: 'Mazzika | مزيكا', logo: 'https://i.imgur.com/P7PUHIx.png' },
    { id: 'live_tv_egyalmehwar', name: 'Mehwar TV | المحور', logo: createEgBadge('#1e3a8a', '#1e1b4b', '#ffffff', 'المحور', 'EL MEHWAR') },
    { id: 'live_tv_mokamelintv', name: 'Mekameleen | مكملين', logo: 'https://i.imgur.com/q7iVchl.png' },
    { id: 'live_tv_uaemixtv', name: 'Mix TV | ميكس تي في', logo: 'https://i.imgur.com/1ENdbZn.png' },
    { id: 'live_tv_egnilecinema', name: 'Nile Cinema | نيل سينما', logo: createEgBadge('#7f1d1d', '#450a0a', '#facc15', 'Nile', 'CINEMA') },
    { id: 'live_tv_egyneelnews', name: 'Nile News | النيل أخبار', logo: createEgBadge('#1e293b', '#0f172a', '#38bdf8', 'Nile', 'NEWS') },
    { id: 'live_tv_egyondrama', name: 'ON DRAMA | أون دراما', logo: createEgBadge('#0a192f', '#1e293b', '#ec4899', 'ON', 'DRAMA') },
    { id: 'live_tv_egyone', name: 'ON E | أون أي', logo: createEgBadge('#0a192f', '#1e293b', '#ff7849', 'ON', 'LIVE') },
    { id: 'live_tv_egpncdrama', name: 'PNC Drama | بي إن سي دراما', logo: createEgBadge('#4c1d95', '#2e1065', '#ffffff', 'PNC', 'DRAMA') },
    { id: 'live_tv_egpncfilm', name: 'PNC Film | بي إن سي فيلم', logo: createEgBadge('#581c87', '#3b0764', '#facc15', 'PNC', 'FILM') },
    { id: 'live_tv_rotanacomedy', name: 'Rotana Comedy | روتانا كوميدي', logo: createEgBadge('#15803d', '#14532d', '#facc15', 'روتانا', 'كوميدي') },
    { id: 'live_tv_sadaalbalad2', name: 'Sada El Balad 2 | صدى البلد 2', logo: createEgBadge('#1e3a8a', '#172554', '#38bdf8', 'صدى البلد', '2') },
    { id: 'live_tv_sadaalbalad', name: 'Sada El Balad | صدى البلد', logo: createEgBadge('#1e3a8a', '#172554', '#ffffff', 'صدى البلد', 'BALAD') },
    { id: 'live_tv_weyyak_mix', name: 'Weyyak Mix | وياك ميكس', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_egdmcdrama', name: 'dmc Drama | دي إم سي دراما', logo: createEgBadge('#1e1b4b', '#0f172a', '#f43f5e', 'dmc', 'دراما') },
    { id: 'live_tv_new_auto_03d46cbe535b0d202e1a395f29d421fa', name: 'Nile Drama | نيل دراما', logo: 'https://i.imgur.com/FasJFMM.png' },
    { id: 'live_tv_new_auto_f544a30111f464cf45e14d7cbce1b032', name: 'Rotana Cinema Egypt | روتانا سينما مصر', logo: 'https://i.imgur.com/dGlKoLW.png' },
    { id: 'live_tv_new_auto_e77ceae041e39fbbab0b06bf4eca478f', name: 'Mix Hollywood | ميكس هوليوود', logo: 'https://i.imgur.com/1ENdbZn.png' },
    { id: 'live_tv_new_auto_395552dc75a2d0f377f0cbb2b61c334d', name: 'El Radio 9090 FM | راديو 9090', logo: 'https://www.9090.fm/images/logo.png' },
    { id: 'live_tv_new_auto_1c2dab3bf965b8471c0b2f62b99d9109', name: 'NogoumFMTV | نجوم إف إم تي في', logo: 'https://i.imgur.com/krp3kgv.png' },
    { id: 'live_tv_new_auto_66611d0ca7c2dfc7187664348c562eb0', name: 'Al Ghad TV | قناة الغد', logo: 'https://i.imgur.com/ga6NXb9.png' },
    { id: 'live_tv_new_auto_7619eff8f242e04bd2ed3b9753ef85fe', name: 'Watan TV | قناة وطن', logo: 'https://i.imgur.com/pZyKaUH.png' },
    { id: 'live_tv_ten', name: 'TeN TV | تن', logo: createEgBadge('#be123c', '#881337', '#ffffff', 'TeN', 'TV') },
    { id: 'live_tv_alshams', name: 'Al Shams TV | الشمس', logo: createEgBadge('#ea580c', '#9a3412', '#ffffff', 'الشمس', 'AL SHAMS') },
    { id: 'live_tv_new_auto_f41fe6146a04bb2c405869d83e22e0b0', name: 'Aghapy TV | أغابي', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_new_auto_1edc2a578174263fafa70260a6336243', name: 'Coptic TV | سي تي في', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_new_auto_53e1cd718520aff4aa396608058c49eb', name: 'Cartoon Network Arabic | كرتون نتورك', logo: createEgBadge('#000000', '#18181b', '#ffffff', 'CN', 'بالعربية') },
    { id: 'live_tv_new_auto_c282f48a47e870c301d7e44e7e3917a2', name: 'Huda TV | قناة هدى', logo: 'https://i.imgur.com/1UUjU26.png' },
    { id: 'live_tv_new_auto_45a6544c78b15400d235e981316098f1', name: 'For You TV | فور يو', logo: 'https://i.imgur.com/gK998sT.png' },
    { id: 'live_tv_new_auto_1cd5e47b88ab8c5afa479c35d222b2e1', name: 'Elbeshara GTV | البشارة', logo: 'https://i.imgur.com/b0Wx7pE.png' },
    { id: 'live_tv_new_auto_fe85b6d5173bf6bd61a9bfd077548881', name: 'MBC 1 Egypt | إم بي سي 1 مصر', logo: 'https://i.imgur.com/CiA3plN.png' },
  ];

  return channelDefs.map((def) => ({
    id: `fg-ch-${code}-eg-${def.id}`,
    playlistId,
    categoryId,
    name: def.name,
    groupTitle: 'مصر — Egypt TV',
    section: 'live',
    logo: def.logo,
    fgLiveId: def.id,
    fgCode: code,
    resolution: '1080p FHD',
    bitrate: 'Live 24/7',
    epgCurrent: `بث فضائي مباشر عبر خادم دراما لايف — ${def.name}`,
    sources: buildEgyptSources(
      code,
      def.id,
      def.id === 'live_tv_mbcmsr'
        ? 'https://shd-gcp-live.edgenextcdn.net/live/bitmovin-mbc-1-na/eec141533c90dd34722c503a296dd0d8/index.m3u8'
        : undefined
    ),
  }));
}
