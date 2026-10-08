# PersonalStream — Netflix + Spotify Local Media Server

> 📜 **الدستور والمرجع الشامل للمشروع:** تم توثيق كامل معمارية وهوية وخطة بناء المشروع في [ARN_STREAM_CONSTITUTION.md](file:///d:/PersonalStream/ARN_STREAM_CONSTITUTION.md).

**PersonalStream** هو خادم وسائط شخصي يعمل على `localhost` فقط — واجهة Netflix للأفلام والمسلسلات + واجهة Spotify للموسيقى. يدعم مكتبة ضخمة (500+ فيلم، 1000+ حلقة، 2000+ أغنية) مع Direct Play فقط (بدون تحويل صيغ).

---

## 🏗️ البنية — نظام الوكلاء المتعددين (Agents 0-8)

تم بناء المشروع باستخدام 9 وكلاء متخصصين بالتوازي:

| الوكيل | المسؤولية | يعتمد على |
|--------|-----------|-----------|
| **Agent 0** | Design System + i18n (العربية/الإنجليزية + RTL) | — |
| **Agent 1** | Core Backend — DB `better-sqlite3` + Media Scanner `chokidar + ffprobe` | — |
| **Agent 2** | Image System — `sharp` + Cache + Deduplication MD5 | Agent 1 |
| **Agent 3** | API Layer — جميع الـ Endpoints (Express) | Agents 1,2 |
| **Agent 4** | Netflix UI — Movies/Series + تفاصيل + مشغل Video.js | Agents 0,3 |
| **Agent 5** | Spotify UI — Music + Artist/Album/Player + MiniPlayer | Agents 0,3 |
| **Agent 6** | Shared Features — Ratings/Tags/Collections/Playlists | Agents 0,3 |
| **Agent 7** | Metadata — TMDB + MusicBrainz (يدوي فقط) | Agent 3 |
| **Agent 8** | QA & Performance — فحص 3500 ملف + اختبارات | الجميع |

---

## 🎨 نظام التصميم

```css
--color-primary-movies: #E50914
--color-primary-music:  #1DB954
--color-bg:            #0A0A0A
--color-surface:       #1A1A1A
--color-surface-hover: #252525
--color-text:          #FFFFFF
--color-text-muted:    #A1A1A1
--color-border:        #2A2A2A
```

- الخط: `Inter` للإنجليزية، `Cairo` للعربية
- RTL كامل عند اختيار العربية
- جميع النصوص في `client/src/i18n/{en,ar}.json`
- مكونات مشتركة: Button, Card, Modal, Input, Rating (نصف نجمة), Tag, Spinner, Toast

---

## 📂 هيكل المجلدات

```
PersonalStream/
├── server/
│   ├── index.js              # Express server :8096
│   ├── db.js                 # better-sqlite3 + schema كامل
│   ├── scanner/
│   │   ├── media-scanner.js  # أفلام/مسلسلات/موسيقى + demo seeding
│   │   ├── image-scanner.js  # بحث الصور حسب النمط
│   │   └── helpers.js        # parseMovieFolder, parse SxxExx, ffprobe (max 4 parallel)
│   ├── routes/               # library, movies, series, music, images, stream, playback, ratings, tags, collections, playlists
│   ├── services/
│   │   ├── image-cache.js    # sharp compress 500px + thumb 300px + MD5 dedup
│   │   ├── metadata-tmdb.js  # TMDB (يدوي)
│   │   └── metadata-musicbrainz.js
│   └── data/media.db
└── client/
    ├── src/
    │   ├── pages/Landing.jsx (كرتان: Movies & Music)
    │   ├── pages/movies/{Home, MovieDetails, SeriesDetails, Player}
    │   ├── pages/music/{Home, Artist, Album}
    │   ├── components/shared/{TopBar, Card, Rating, Tag, Button}
    │   ├── components/music/MiniPlayer.jsx (persistent)
    │   ├── i18n/{en,ar}.json
    │   ├── api/client.js (axios)
    │   └── store/usePlayerStore.js (Zustand)
    └── dist/ (production)
```

---

## 🚀 التشغيل

### المتطلبات
- Node.js 20+
- Windows (المسارات `D:\Media\...`) — يعمل أيضاً مع بيانات تجريبية إذا لم يوجد المجلد

### التثبيت والتشغيل

```bash
# تثبيت الكل
npm run install:all
# أو يدوياً
cd server && npm install
cd client && npm install

# بناء الواجهة
cd client && npm run build

# تشغيل الخادم (يخدم الـ API + الواجهة المبنية)
cd server && npm start
# → http://localhost:8096
# → API: http://localhost:8096/api

# تطوير (منفصل)
cd server && npm run dev   # --watch
cd client && npm run dev   # Vite على 5173 مع proxy إلى 8096
```

### متغيرات البيئة

```env
PORT=8096
MOVIES_PATH=D:\Media\Movies
SHOWS_PATH=D:\Media\Shows
MUSIC_PATH=D:\Media\Music
POSTERS_PATH=D:\Media\Posters
TMDB_API_KEY=your_key  # اختياري، للجلب اليدوي
```

---

## 📡 API Contract

```
GET  /api/library/landing       # إحصائيات + backdrops
GET  /api/library/movies-home   # continueWatching, recentlyAdded, collections
GET  /api/library/music-home

GET  /api/movies /api/movies/:id
GET  /api/series /api/series/:id /api/series/:id/seasons /api/episodes/:id/next-up
GET  /api/artists /api/artists/:id /api/albums /api/albums/:id /api/tracks
GET  /api/images/:type/:id  POST /api/images/:type/:id/upload  DELETE /api/images/:id
GET  /api/image/:id/full  GET /api/image/:id/thumb
GET  /api/stream/movie/:id  GET /api/stream/episode/:id  GET /api/stream/track/:id (Range 206)
POST /api/playback  GET /api/playback/continue  DELETE /api/playback/:type/:id
GET/POST/DELETE /api/ratings/:type/:id
GET/POST /api/tags + assign/unassign
GET/POST /api/collections  POST /api/collections/:id/items
GET/POST /api/playlists  POST /api/playlists/:id/items  POST /api/playlists/:id/reorder
GET  /api/search?q=&type=movie|series|track|all
POST /api/scan
GET  /api/metadata/tmdb/search?q=  POST /api/metadata/tmdb/apply
```

---

## 🖼️ تسمية المجلدات (مهم)

```
D:\Media\Movies\Inception (2010)\Inception.2010.1080p.mkv  + poster.jpg / backdrop.jpg
D:\Media\Shows\Breaking Bad\Season 01\S01E01.mkv  + poster.jpg (داخل Season)
D:\Media\Music\Pink Floyd\The Wall\01 - Track.mp3  + cover.jpg
D:\Media\Posters\Inception (2010).jpg
```

- `poster.jpg|folder.jpg|cover.jpg` — بوستر
- `backdrop.jpg|fanart.jpg|background.jpg` — خلفية
- `SXXEXX.mkv` إلزامي للحلقات
- `Season XX` إلزامي للمواسم

---

## ✅ معايير النجاح (تم التحقق)

- [x] Landing يعرض كرتين مع إحصائيات حية
- [x] فحص 3500+ ملف بدون انهيار (معاملات SQLite + حد 4 ffprobe)
- [x] Movies UI صفوف بوسترات + Continue Watching
- [x] Music UI فنانين/ألبومات + MiniPlayer ثابت
- [x] تشغيل فيديو Direct Play مع Range Requests + موسيقى مع cover
- [x] Next Up في آخر 10 ثواني للحلقة
- [x] مبدّل لغة عربي/إنجليزي مع RTL كامل
- [x] Ratings نصف نجمة + Tags مع ألوان
- [x] Collections + Playlists متسلسلة
- [x] كل النصوص قابلة للترجمة (لا نصوص ثابتة)

---

## 🔐 تحذيرات حرجة (تم تطبيقها)

- مسارات Windows عبر `path.join`
- ffprobe بحد 4 عمليات متوازية
- صور sharp مضغوطة 500px (بوستر) + thumb 300px
- إزالة تكرار الصور بـ MD5
- معاملات SQLite مجمعة

---

## 📜 الترخيص
محلي فقط — لا وصول عن بعد. Metadata provided by TMDB.
