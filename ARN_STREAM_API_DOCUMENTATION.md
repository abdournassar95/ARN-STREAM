# 📜 مستند الـ API الفعلي والكامل لمنصة ARN Stream Media Server
### المرجع التقني الشامل والشافي لجميع مسارات وخوادم ARN Stream (REST API & Real-Time WebSockets & DLNA)

> **اسم المشروع:** ARN Stream Media Server  
> **الجهة المالكة:** ARN Technology  
> **تطوير وبرمجة:** عبده رجب نصار (Abdou Ragab Nassar)  
> **حقوق الملكية الفكرية:** حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.  
> **بيئة التشغيل:** Node.js (Express 4) + SQLite3 (Better-SQLite3 WAL Mode) + FFmpeg Core  
> **المنفذ الافتراضي (Default Port):** `8096` (HTTP) & `ws://...:8096/ws/handoff` (WebSocket)  

---

## 📑 فهرس المحتويات
1. [المعمارية العامة وقواعد التواصل (Core Architecture & Standards)](#1-المعمارية-العامة-وقواعد-التواصل)
2. [نظام المصادقة والمستخدمين (Authentication & Users API)](#2-نظام-المصادقة-والمستخدمين)
3. [إدارة المكتبات والشاشات الرئيسية (Libraries & Landing API)](#3-إدارة-المكتبات-والشاشات-الرئيسية)
4. [مكتبة الأفلام والمسلسلات (Movies & Series API)](#4-مكتبة-الأفلام-والمسلسلات)
5. [الموسيقى، الصوتيات والقرآن الكريم (Music, Tracks & Quran API)](#5-الموسيقى-والصوتيات-والقرآن-الكريم)
6. [محرك البث والتشغيل ونقاط المتابعة (Streaming & Playback API)](#6-محرك-البث-والتشغيل-ونقاط-المتابعة)
7. [التحكم عن بعد والبث للأجهزة (PlayTo, Remote Control & Handoff)](#7-التحكم-عن-بعد-والبث-للأجهزة)
8. [محرك التنزيل السريع والضغط المباشر (Download & Zip Engine)](#8-محرك-التنزيل-السريع-والضغط-المباشر)
9. [البحث الذكي، الصور والترجمات (Search, Images & Subtitles)](#9-البحث-الذكي-الصور-والترجمات)
10. [الميتا داتا وجلب المعلومات الخارجية (TMDB & MusicBrainz Metadata)](#10-الميتا-داتا-وجلب-المعلومات-الخارجية)
11. [غرف المشاهدة الجماعية والبث المباشر (Watch Party & Live TV)](#11-غرف-المشاهدة-الجماعية-والبث-المباشر)
12. [قوائم التشغيل، المجموعات، الوسوم والتقييمات (Playlists, Collections & Tags)](#12-قوائم-التشغيل-المجموعات-الوسوم-والتقييمات)
13. [إعدادات الخادم وصيانة قواعد البيانات والداشبورد (Settings & Database Maintenance)](#13-إعدادات-الخادم-وصيانة-قواعد-البيانات-والداشبورد)
14. [خدمات DLNA و UPnP للشاشات الذكية (DLNA / UPnP Smart TV Services)](#14-خدمات-dlna-و-upnp-للشاشات-الذكية)

---

## 1. المعمارية العامة وقواعد التواصل

### 1.1 العناوين ونقاط الوصول الأساسية (Base URLs)
- **الخادم المحلي (Localhost):** `http://localhost:8096`
- **الشبكة المحلية (LAN):** `http://{SERVER_IP}:8096` (مثال: `http://192.168.1.15:8096`)
- **خادم الـ WebSocket اللحظي:** `ws://{SERVER_IP}:8096/ws/handoff?deviceId={DEVICE_ID}`

### 1.2 الترويسات القياسية (HTTP Headers)
- لطلبات JSON: `Content-Type: application/json`
- للعمليات المحمية: `Authorization: Bearer {JWT_TOKEN}`
- لبث الفيديو المجزأ: `Range: bytes={start}-{end}`
- لتعطيل ضغط الاستجابة عند الحاجة: `x-no-compression: true`

### 1.3 هيكل الاستجابات القياسي (Response Envelope)
كافة استجابات الـ API تتبع النمط الموحد:

**في حالة النجاح (Success):**
```json
{
  "data": { ... },
  "message": "نص اختياري يوضح نجاح العملية",
  "meta": {
    "total": 120,
    "limit": 50,
    "offset": 0
  }
}
```

**في حالة الخطأ (Error):**
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "رسالة توضيحية لسبب الخطأ"
  }
}
```

### 1.4 مستويات الأمان والتصاريح (RBAC)
- **Public (عام):** لا يتطلب مصادقة (مثل التحقق من حالة السيرفر، جلب صور الأغلفة العامة، صفحة الدخول).
- **requireAuth (مستخدم مسجل):** يتطلب توكن JWT صالح في الترويسة (`Authorization: Bearer ...`).
- **requireAdmin (مشرف فقط):** يتطلب مستخدم بدور `role: "admin"` (لعمليات الفحص، الحذف، التعديل على مسارات السيرفر والإعدادات).
- **requireSetupMode:** متاح فقط عند بدء تشغيل السيرفر لأول مرة قبل تسجيل أي حساب مشرف.

---

## 2. نظام المصادقة والمستخدمين (Authentication & Users API)

بادئة المسار: `/api/auth`

### 2.1 التحقق من حالة الخادم (Server Status)
- **المسار:** `GET /api/auth/status`
- **التصريح:** عام (Optional Auth)
- **الوصف:** فحص هل الخادم مهيأ بحساب أدمن، وهل المستخدم الحالي مسجل دخوله، وهل توجد مكتبات.
- **الاستجابة الناجحة (200 OK):**
```json
{
  "data": {
    "initialized": true,
    "authenticated": true,
    "user": {
      "id": 1,
      "username": "admin",
      "display_name": "عبده رجب نصار",
      "role": "admin",
      "avatar": "/api/avatars/avatar_1.png",
      "can_cast": 1
    },
    "hasLibraries": true
  }
}
```

### 2.2 تهيئة الخادم لأول مرة (First-Time Setup)
- **المسار:** `POST /api/auth/setup`
- **التصريح:** `requireSetupMode` (يعمل فقط إذا كان عدد المستخدمين = 0)
- **جسم الطلب (Body):**
```json
{
  "username": "admin",
  "password": "StrongPassword2026",
  "display_name": "عبده رجب نصار"
}
```
- **الاستجابة الناجحة (200 OK):** يعيد بيانات الحساب المنشأ مع توكن المصادقة JWT.

### 2.3 قائمة المستخدمين لشاشة تسجيل الدخول (Public Profiles)
- **المسار:** `GET /api/auth/public-users`
- **التصريح:** عام
- **الوصف:** يجلب الحسابات المفعلة والمحددة للعرض على شاشة اختيار البروفايل السريع.
- **الاستجابة:**
```json
{
  "data": [
    {
      "id": 1,
      "username": "abdo",
      "display_name": "عبده رجب نصار",
      "avatar": "/api/avatars/user_1.jpg"
    }
  ]
}
```

### 2.4 تسجيل الدخول (Login)
- **المسار:** `POST /api/auth/login`
- **التصريح:** عام (مزود بنظام حماية ضد التخمين Rate Limiting وتطبيع الأرقام العربية/الإنجليزية).
- **جسم الطلب:**
```json
{
  "username": "abdo",
  "password": "MySecretPassword"
}
```
- **الاستجابة الناجحة (200 OK):**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "abdo",
      "display_name": "عبده رجب نصار",
      "role": "admin",
      "avatar": "/api/avatars/user_1.jpg"
    }
  }
}
```

### 2.5 بيانات الحساب الشخصي (Current Profile)
- `GET /api/auth/me`: جلب بيانات المستخدم المسجل الحالي.
- `PUT /api/auth/profile`: تحديث الاسم الظاهر وخيار الظهور على شاشة الدخول:
  ```json
  { "display_name": "عبده نصار", "show_on_login": true }
  ```
- `PUT /api/auth/password`: تغيير كلمة المرور:
  ```json
  { "current_password": "old_password", "new_password": "new_password" }
  ```
- `POST /api/auth/avatar`: رفع صورة شخصية (Multipart FormData بحقل `avatar`).

### 2.6 إدارة المستخدمين (Admin Users Management)
- `GET /api/auth/users`: استعراض كافة الحسابات (مشرف فقط).
- `POST /api/auth/users`: إنشاء حساب جديد:
  ```json
  {
    "username": "family",
    "password": "1234Password",
    "display_name": "العائلة",
    "role": "user",
    "show_on_login": true,
    "can_cast": 1,
    "allowed_libraries": [1, 2]
  }
  ```
- `PUT /api/auth/users/:id`: تعديل بيانات مستخدم وصلاحياته.
- `DELETE /api/auth/users/:id`: حذف مستخدم.

---

## 3. إدارة المكتبات والشاشات الرئيسية (Libraries & Landing API)

### 3.1 الشاشة الرئيسية المجمعة (Hub Landing)
- **المسار:** `GET /api/library/landing`
- **التصريح:** عام (مخصص حسب صلاحيات المستخدم إن وُجد توكن)
- **الوصف:** استدعاء فوري ومجمع يعيد بيانات الصفحة الرئيسية لمنصة ARN Stream بنقرة واحدة (أفلام حديثة، مسلسلات، صوتيات، المتابعة، والكبسولات).
- **محتوى الاستجابة:**
  - `continueWatching`: قائمة العناصر غير المكتملة للمستخدم الحالي.
  - `recentlyAddedMovies`: أحدث الأفلام المضافة مع البوسترات.
  - `recentlyAddedSeries`: أحدث المسلسلات.
  - `recentlyAddedMusic`: أحدث الألبومات الصوتية.
  - `topRated`: الأعلى تقييماً.
  - `libraries`: مصفوفة المكتبات المتاحة مع إحصائياتها.

- `GET /api/library/movies-home`: الصفحة الرئيسية المتخصصة في قسم الأفلام والمسرحيات.
- `GET /api/library/music-home`: الصفحة الرئيسية المتخصصة في قسم الصوتيات والقرآن الكريم والميكسات الذكية.

### 3.2 عمليات المكتبات (`/api/libraries`)
- `GET /api/libraries`: استعراض جميع المكتبات المضافة، شاملاً:
  - `movie_count`, `series_count`, `episode_count`, `track_count`, `album_count`, `artist_count`
  - مصفوفة أغلفة ديناميكية (Cover Collage) لكل مكتبة.
- `GET /api/libraries/:id`: جلب تفاصيل مكتبة معينة ومحتوياتها.
- `POST /api/libraries` (`requireAdmin`): إضافة مكتبة جديدة:
  ```json
  {
    "name": "أفلام عربية وأجنبية",
    "type": "movies", // movies | series | music
    "path": "D:\\Media\\Movies"
  }
  ```
- `PUT /api/libraries/:id` (`requireAdmin`): تحديث اسم أو مسار المكتبة.
- `DELETE /api/libraries/:id` (`requireAdmin`): حذف المكتبة مع كافة وسائطها وسجلاتها.
- `POST /api/libraries/:id/scan` (`requireAdmin`): فحص يدوي لمجلدات مكتبة محددة.
- `GET /api/libraries/:id/available-covers`: استخراج بوسترات العناصر الموجودة داخل المكتبة لاختيار بوستر رسمي للمكتبة منها.
- `POST /api/libraries/:id/upload-cover`: رفع غلاف مخصص للمكتبة (حقل `image`).
- `PUT /api/libraries/:id/custom-covers`: تعيين مصفوفة البوسترات المختارة لكولاج المكتبة.

---

## 4. مكتبة الأفلام والمسلسلات (Movies & Series API)

### 4.1 الأفلام (`/api/movies`)
- **المسار:** `GET /api/movies`
- **معاملات البحث (Query Parameters):**
  - `q`: نص البحث (يدعم البحث العربي الموحد).
  - `library_id`: رقم المكتبة.
  - `year`: سنة الإنتاج.
  - `sort`: خيار الترتيب (`title`, `year`, `added_at`, `duration`).
  - `order`: اتجاه الترتيب (`ASC`, `DESC` - الافتراضي `DESC`).
  - `tags`: وسوم مفصولة بفواصل (مثل `tags=1,3`).
  - `limit`: عدد العناصر (افتراضي 50).
  - `offset`: التخطي للصفحات.

- **تفاصيل الفيلم الكاملة:** `GET /api/movies/:id`
  - يعيد بيانات الفيلم، المسار، الجودة، دقة العرض، الصوتيات المدمجة، الترجمات، مصفوفة البوسترات (`posters`)، صور الخلفيات (`backdrops`)، التقييم الشخصي، والتقدم في المشاهدة (`playback`).
- **أفلام شبيهة ومقترحة:** `GET /api/movies/:id/similar`
- **حذف فيلم:** `DELETE /api/movies/:id` (`requireAdmin`).

### 4.2 المسلسلات والمواسم والحلقات (`/api/series`)
- `GET /api/series`: تصفح المسلسلات مع عدد المواسم والحلقات وتصفية الوسوم.
- `GET /api/series/:id`: جلب شجرة المسلسل بالكامل:
  - تفاصيل العمل والخلفيات والبوسترات.
  - مصفوفة المواسم (`seasons`) وبداخل كل موسم حلقاته (`episodes`) مع حالة مشاهدة كل حلقة.
- `GET /api/series/seasons/:seasonId`: جلب حلقات موسم محدد.
- `GET /api/series/:id/seasons`: قائمة مواسم المسلسل.
- `GET /api/series/episodes/:id`: بيانات حلقة مفردة ورابط تشغيلها ونقاط متابعتها.
- `GET /api/series/episodes/:id/next-up`: **محرك الحلقة التالية الذكي**؛ يقوم تلقائياً بحساب الحلقة الموالية للمشاهدة بعد الحلقة الحالية أو الانتقال للموسم التالي تلقائياً.
- `GET /api/series/:id/similar`: ترشيحات لمسلسلات مشابهة.
- `POST /api/series/:id/scan` (`requireAdmin`): إعادة فحص مجلد مسلسل معين فقط.
- `DELETE /api/series/:id` (`requireAdmin`): حذف المسلسل.

---

## 5. الموسيقى، الصوتيات والقرآن الكريم (Music, Tracks & Quran API)

ملاحظة: مسارات الموسيقى موزعة تحت بادئة `/api` مباشرة:

### 5.1 الفنانون والقراء (`/api/artists`)
- `GET /api/artists`: استعراض الفنانين أو قراء القرآن الكريم مع عدد الألبومات وعدد المقاطع والصورة الشخصية.
- `GET /api/artists/:id`: بروفايل القارئ أو الفنان الشامل، يضم كافة الألبومات وقائمة أشهر المقاطع والتراكات.
- `POST /api/artists/:id/scan` (`requireAdmin`): فحص مجلد الفنان.

### 5.2 الألبومات والسور (`/api/albums`)
- `GET /api/albums`: استعراض الألبومات الصوتية.
- `GET /api/albums/:id`: تفاصيل الألبوم الصوتي مع قائمة التراكات كاملة ومدة كل مقطع.
- `POST /api/albums/:id/scan` (`requireAdmin`): إعادة فحص الألبوم.
- `DELETE /api/albums/:id` (`requireAdmin`): حذف الألبوم.

### 5.3 المقاطع الصوتية والتراكات (`/api/tracks`)
- `GET /api/tracks`: جلب التراكات مع فلاتر `album_id`, `artist_id`, `library_id`, `tags`, `limit`, `offset`.
- `GET /api/tracks/favorites`: قائمة الصوتيات المفضلة للمستخدم الحالي.
- `POST /api/tracks/:id/favorite`: تبديل حالة المفضلة (Like/Unlike).
- `POST /api/tracks/:id/rate`: تقييم التراك من 0 إلى 5 نجوم (`{ "rating": 5 }`).
- `GET /api/tracks/:id/lyrics`: جلب كلمات الأغنية أو التراك (نصوص عادية أو توقيتات متزامنة LRC).
- `PUT /api/tracks/:id/lyrics`: حفظ أو تعديل كلمات التراك يدوياً (`{ "lyrics": "..." }`).
- `POST /api/tracks/:id/play`: تسجيل استماع جديد للمقطع (يزيد عداد `play_count` ويحدث `last_played_at`).
- `GET /api/tracks/recently-played`: قائمة المقاطع المستمع إليها مؤخراً.
- `GET /api/tracks/most-played`: المقاطع الأكثر تشغيلاً واستماعاً على الإطلاق.
- `GET /api/tracks/smart-playlists`: توليد قوائم استماع ذكية وديناميكية جاهزة (مثل: ميكس الأسبوع، الأكثر استماعاً، استكشاف).
- `GET /api/tracks/genre/:genre`: استعراض التراكات حسب النوع الصوتي.

---

## 6. محرك البث والتشغيل ونقاط المتابعة (Streaming & Playback API)

### 6.1 استعلام إمكانيات البث والترميز (Stream Info)
- **المسار:** `GET /api/stream/info/:type/:id`
- **النوع المتاح (`type`):** `movie` أو `episode`
- **الوصف:** فحص ملف الفيديو عبر مكتبة FFprobe لتحديد هل يدعم التشغيل المباشر في المتصفح أو تطبيق أندرويد (Direct Play / Remux / Transcode).
- **الاستجابة:**
```json
{
  "success": true,
  "data": {
    "strategy": "direct", // direct | remux | transcode
    "probe": {
      "format": "mov,mp4,m4a,3gp,3g2,mj2",
      "duration": 7240.5,
      "videoCodec": "h264",
      "audioCodec": "aac",
      "width": 1920,
      "height": 1080,
      "bitrate": 4500000
    },
    "audioTracks": [
      { "index": 1, "language": "ara", "title": "Arabic Stereo", "codec": "aac" },
      { "index": 2, "language": "eng", "title": "English 5.1", "codec": "ac3" }
    ],
    "subtitles": [
      { "index": 3, "language": "ara", "title": "العربية", "isLocal": false },
      { "id": "local_0", "language": "ar", "title": "movie.ar.srt", "isLocal": true }
    ]
  }
}
```

### 6.2 البث المباشر للوسائط (Media Streaming Endpoints)
تدعم هذه المسارات بروتوكول HTTP 206 Partial Content مع ترويسة `Range: bytes=X-Y` لتقديم تجربة تقديم وترجيع فورية وسلسة دون انتظار:
- **بث فيلم:** `GET /api/stream/movie/:id`
- **بث حلقة:** `GET /api/stream/episode/:id`
- **بث مقطع صوتي:** `GET /api/stream/track/:id`
- **إيقاف عملية ترميز نشطة:** `POST /api/stream/kill/:id` (`requireAdmin`).

### 6.3 مزامنة نقاط المتابعة ومواصلة المشاهدة (`/api/playback`)
تتطلب كافة المسارات تسجيل الدخول (`requireAuth`):
- **حفظ تقدم المشاهدة (Save Progress):**
  - **المسار:** `POST /api/playback`
  - **جسم الطلب:**
  ```json
  {
    "media_type": "movie", // movie | episode | track
    "media_id": 42,
    "position": 1420, // الثواني المنقضية
    "duration": 7200  // إجمالي مدة المحتوى
  }
  ```
- **استرجاع محتوى مواصلة المشاهدة (Continue Watching):**
  - **المسار:** `GET /api/playback/continue?limit=10`
  - **الوصف:** يعيد تلقائياً كافة المواد التي بدأ المستخدم بمشاهدتها ولم تنتهِ بعد (أقل من 90% من المدة الإجمالية) مرتبة من الأحدث إلى الأقدم.
- **حذف أو تصفير تقدم مادة معينة:** `DELETE /api/playback/:type/:id`

---

## 7. التحكم عن بعد والبث للأجهزة (PlayTo, Remote Control & Handoff)

بادئة المسار: `/api/handoff` وقناة الـ WebSocket: `/ws/handoff`

### 7.1 اتصال الـ WebSocket فائق السرعة (Real-Time WebSocket)
- **الرابط:** `ws://{SERVER_IP}:8096/ws/handoff?deviceId={UNIQUE_DEVICE_ID}`
- **زمن الاستجابة:** أقل من 5ms.
- **طبيعة العمل:** يتيح المزامنة التامة بين الشاشات المتصلة وأجهزة الهاتف (Android) والمتصفحات وشاشات التلفاز الذكية.
- **بديل SSE الاحتياطي:** `GET /api/handoff/events?deviceId={DEVICE_ID}` (Server-Sent Events في حال تعذر اتصال الـ WS).

### 7.2 تسجيل الأجهزة المتصلة
- **تسجيل جهاز جديد:** `POST /api/handoff/register`
  ```json
  {
    "deviceId": "ARN-Android-98A7B6",
    "name": "هاتف عبده - S24 Ultra",
    "type": "android", // android | web | tv | desktop
    "currentMedia": null,
    "currentPlaybackState": { "isPlaying": false, "position": 0 }
  }
  ```
- **إلغاء تسجيل جهاز (عند الإغلاق):** `POST /api/handoff/unregister`
  ```json
  { "deviceId": "ARN-Android-98A7B6" }
  ```
- **استكشاف الأجهزة المتاحة على الشبكة وشاشات DLNA:** `GET /api/handoff/devices`

### 7.3 البث الفوري لمحتوى إلى جهاز آخر (Cast / PlayTo)
- **المسار:** `POST /api/handoff/transfer` (`requireAuth`)
- **جسم الطلب:**
```json
{
  "targetDeviceId": "samsung-smart-tv-living-room", // أو معرف جهاز ويب أو أندرويد
  "fromDeviceId": "ARN-Android-98A7B6",
  "fromDeviceName": "هاتف عبده",
  "media": {
    "id": 15,
    "type": "movie",
    "title": "Interstellar (2014)",
    "position": 2450,
    "isPlaying": true
  }
}
```

### 7.4 أوامر الريموت كنترول عن بعد (Remote Control Commands)
- **المسار:** `POST /api/handoff/command` (`requireAuth`)
- **جسم الطلب:**
```json
{
  "targetDeviceId": "target-device-id",
  "command": "seek", // play | pause | toggle | seek | volume | mute | stop | next | prev
  "value": 1820       // قيمة الثواني لـ seek أو نسبة الصوت لـ volume (0-1)
}
```

### 7.5 تحديث واستعلام حالة المشغل (Playback State)
- **إرسال الحالة الحالية للجهاز:** `POST /api/handoff/state`
  ```json
  {
    "deviceId": "ARN-Android-98A7B6",
    "state": { "isPlaying": true, "position": 512, "duration": 3600, "volume": 0.8 }
  }
  ```
- **قراءة حالة جهاز معين:** `GET /api/handoff/state/:deviceId`

---

## 8. محرك التنزيل السريع والضغط المباشر (Download & Zip Engine)

بادئة المسار: `/api/download`  
تتميز كافة روابط التنزيل بتعيين ترويسات `Content-Disposition: attachment; filename="..."` مع دعم استئناف التحميل ودعم تجميع الملفات على الطاير في أرشيفات ZIP دون استهلاك مساحة مؤقتة على القرص:

### 8.1 تنزيل الملفات المفردة الأصلية (Raw Single Downloads)
- **تنزيل فيلم كامل:** `GET /api/download/movie/:id`
- **تنزيل حلقة من مسلسل:** `GET /api/download/episode/:id`
- **تنزيل مقطع صوتي / سورة:** `GET /api/download/track/:id`

### 8.2 التنزيل الجماعي والأرشيف المضغوط الحي (Live ZIP Streaming)
- **تنزيل مسلسل كامل مضغوطاً:** `GET /api/download/series/:id`  
  (يقوم الخادم بإنشاء ملف ZIP حي يحتوي على مجلدات مرتبة: `الموسم 01/`, `الموسم 02/` مع تسميات الحلقات القياسية).
- **تنزيل موسم كامل مضغوطاً:** `GET /api/download/season/:id`
- **تنزيل ألبوم صوتي كامل مضغوطاً:** `GET /api/download/album/:id`
- **تنزيل مكتبة أعمال فنان أو قارئ بالكامل مضغوطة:** `GET /api/download/artist/:id`
- **تنزيل عناصر متعددة ومختارة دفعة واحدة:** `GET /api/download/batch?type=movie&ids=1,2,5`

---

## 9. البحث الذكي، الصور والترجمات (Search, Images & Subtitles)

### 9.1 محرك البحث التنبؤي الذكي (Predictive Search)
- **المسار:** `GET /api/search`
- **معاملات الاستعلام:**
  - `q`: الكلمة المفتاحية (تخضع لتطبيع الأحرف العربية: توحيد الهمزات، الياء، الألف، وإزالة "ال" التعريف الذكية).
  - `type`: نوع الوسائط (`all`, `movie`, `series`, `track`, `artist` - الافتراضي `all`).
  - `limit`: حد النتائج (الافتراضي 20).
- **الاستجابة:** تعيد مصفوفة النتائج مرتبة حسب الأولوية وقوة التطابق مع حقل `prediction` لأقوى تخمين للبحث.

### 9.2 عرض والتقاط الصور الثنائية (Binary Image Serving)
- **عرض الصورة بالحجم الكامل:** `GET /api/image/:id/full`
- **عرض الصورة المصغرة (Thumbnail):** `GET /api/image/:id/thumb`  
  *(تتضمن الاستجابات ترويسات `Cache-Control: public, max-age=86400` وسقوط تلقائي لصور SVG بديلة في حال فقدان الملف الأصلي).*
- **إدارة صور الوسائط (`/api/images`):**
  - `GET /api/images/:type/:id`: جلب كافة صور العنصر (بوسترات وخلفيات).
  - `POST /api/images/:type/:id/:imageType/set-primary` (`requireAdmin`): تعيين الصورة كغلاف أساسي.
  - `POST /api/images/:type/:id/:imageType/upload` (`requireAdmin`): رفع غلاف جديد.
  - `DELETE /api/images/:id` (`requireAdmin`): حذف صورة.

### 9.3 الترجمات النصية المتوافقة (Subtitles Engine)
بادئة المسار: `/api/subtitles`
- **جلب الترجمات المتوفرة محلياً:** `GET /api/subtitles/:type/:id`
- **البحث عن ترجمات عبر الإنترنت:** `GET /api/subtitles/:type/:id/search?language=ar`
- **بث ملف الترجمة بصيغة WebVTT للمتصفح والأجهزة:** `GET /api/subtitles/serve?path={ENCODED_SUB_PATH}`  
  (يقوم الخادم بتحويل ملفات `.srt`, `.sub`, `.ass` تلقائياً إلى صيغة `.vtt` المعيارية مع حماية مسارات النظام).

---

## 10. الميتا داتا وجلب المعلومات الخارجية (TMDB & MusicBrainz Metadata)

بادئة المسار: `/api/metadata`

### 10.1 فحص وجلب بيانات TMDB (الأفلام والمسلسلات)
- **البحث في TMDB:** `GET /api/metadata/tmdb/search?q={QUERY}&type={movie|tv}` (`requireAdmin`)
- **تطبيق وحفظ بيانات TMDB على وسيط:** `POST /api/metadata/tmdb/apply` (`requireAdmin`)
  ```json
  {
    "media_type": "movie",
    "media_id": 12,
    "tmdb_id": 157336
  }
  ```
- **استعلام وحفظ مفتاح TMDB API الخاص:**
  - `GET /api/metadata/tmdb-key`
  - `POST /api/metadata/tmdb-key` (`{ "key": "YOUR_TMDB_API_KEY" }`)

### 10.2 فحص وجلب بيانات MusicBrainz (الموسيقى والصوتيات)
- **البحث في قاعدة MusicBrainz العالمية:** `GET /api/metadata/musicbrainz/search?q={NAME}&type={artist|release}` (`requireAdmin`)

### 10.3 تعديل بيانات الوسائط يدوياً
- `PUT /api/metadata/:type/:id` (`requireAdmin`): تعديل العنوان، سنة الإنتاج، القصة، التقييم، المخرج، الممثلين، الأستوديو.

---

## 11. غرف المشاهدة الجماعية والبث المباشر (Watch Party & Live TV)

### 11.1 غرف المشاهدة المتزامنة (`/api/watch-party`)
كافة العمليات تتطلب تسجيل الدخول (`requireAuth`):
- **إنشاء غرفة مشاهدة:** `POST /api/watch-party/create`
  ```json
  { "mediaType": "movie", "mediaId": 18, "room_name": "سهرة الليلة" }
  ```
- **استعراض الغرف المفتوحة:** `GET /api/watch-party/rooms`
- **جلب بيانات الغرفة وأعضائها:** `GET /api/watch-party/:roomId`
- **الانضمام المباشر للغرفة واستقبال أحداث التشغيل (SSE):** `GET /api/watch-party/:roomId/join`
- **مزامنة زمن المشاهدة (صاحب الغرفة):** `POST /api/watch-party/:roomId/sync`
  ```json
  { "currentTime": 1845.2, "state": "play" }
  ```
- **مغادرة الغرفة:** `POST /api/watch-party/:roomId/leave`

### 11.2 البث التلفزيوني المباشر والقنوات (`/api/live`)
- **جلب كود أو رابط البث المباشر المعتمد:** `GET /api/live/code`
- **تحديث كود تضمين البث أو رابط M3U8:** `POST /api/live/code` (`requireAdmin`)
  ```json
  { "code": "<iframe src='...' />" }
  ```
- **مشغل البث المباشر:** `GET /api/live/player`

---

## 12. قوائم التشغيل، المجموعات، الوسوم والتقييمات (Playlists, Collections & Tags)

### 12.1 قوائم التشغيل الشخصية (`/api/playlists`)
- `GET /api/playlists`: جلب قوائم التشغيل الخاصة بالمستخدم والقوائم المشتركة.
- `POST /api/playlists` (`requireAuth`): إنشاء قائمة تشغيل:
  ```json
  { "name": "أفضل تلاوات الشيخ المنشاوي", "description": "تلاوات نادرة ومؤثرة", "is_shared": 1 }
  ```
- `GET /api/playlists/:id`: جلب القائمة وتراكاتها.
- `POST /api/playlists/:id/items`: إضافة عنصر للقائمة (`{ "track_id": 5 }`).
- `POST /api/playlists/:id/batch`: إضافة عدة عناصر دفعة واحدة (`{ "trackIds": [1, 2, 3] }`).
- `DELETE /api/playlists/:id/items/:itemId`: حذف عنصر من القائمة.
- `POST /api/playlists/:id/reorder`: إعادة ترتيب عناصر القائمة (`{ "itemIds": [...] }`).
- `PUT /api/playlists/:id`: تعديل اسم ووصف وحالة مشاركة القائمة.
- `DELETE /api/playlists/:id`: حذف قائمة التشغيل.

### 12.2 المجموعات السينمائية (`/api/collections`)
- `GET /api/collections`: عرض المجموعات مع معاينة للعناصر بداخلها.
- `POST /api/collections` (`requireAdmin`): إنشاء مجموعة (مثل "سلسلة مارفل" أو "أفلام الأوسكار").
- `GET /api/collections/:id`: جلب أفلام ومسلسلات المجموعة.
- `POST /api/collections/:id/items` (`requireAdmin`): إضافة مادة للمجموعة (`{ "media_type": "movie", "media_id": 4 }`).
- `DELETE /api/collections/:id/items/:itemId` (`requireAdmin`): إزالة مادة من المجموعة.
- `PUT /api/collections/:id` / `DELETE /api/collections/:id`: تعديل أو حذف مجموعة.

### 12.3 تقييمات المستخدمين (`/api/ratings`)
- `GET /api/ratings/:type/:id`: جلب تقييم المستخدم للمادة المحددة.
- `POST /api/ratings/:type/:id` (`requireAuth`): حفظ تقييم ومراجعة (الدرجات من 0.5 إلى 5.0 بخطوات 0.5):
  ```json
  { "rating": 4.5, "review": "فيلم رائع جداً وإخراج مذهل" }
  ```
- `DELETE /api/ratings/:type/:id` (`requireAuth`): مسح التقييم.

### 12.4 الوسوم والتصنيفات (`/api/tags`)
- `GET /api/tags`: عرض كافة الوسوم.
- `POST /api/tags` (`requireAdmin`): إنشاء وسم جديد (`{ "name": "وثائقي", "color": "#06B6D4" }`).
- `POST /api/tags/:id/assign` (`requireAdmin`): ربط وسم بمادة وسائط (`{ "media_type": "movie", "media_id": 8 }`).
- `POST /api/tags/:id/unassign` (`requireAdmin`): فك ارتباط الوسم بالمادة.
- `GET /api/tags/media/:type/:id`: جلب كافة الوسوم المربوطة بمادة معينة.

---

## 13. إعدادات الخادم وصيانة قواعد البيانات والداشبورد (Settings & Database Maintenance)

### 13.1 إعدادات النظام والشبكة (`/api/settings`)
- `GET /api/settings/network`: جلب عنوان IP الخادم الأساسي والمنفذ وكروت الشبكة المتاحة ورابط السيرفر الكامل.
- `GET /api/settings/general`: جلب الإعدادات العامة وخيار تشغيل الـ DLNA.
- `POST /api/settings/general` (`requireAdmin`): حفظ المنفذ وتشغيل/إيقاف خدمة الـ DLNA.
- `GET /api/settings/volume`: جلب مستوى الصوت الافتراضي.
- `POST /api/settings/volume` (`requireAdmin`): حفظ مستوى الصوت الافتراضي وحالة الكتم.
- `GET /api/settings/folders`: استعراض مسارات المجلدات المضبوطة ومطابقتها على القرص.
- `POST /api/settings/folders` (`requireAdmin`): تحديث مجلدات الأفلام والمسلسلات والموسيقى.
- `POST /api/settings/validate-path` (`requireAdmin`): التحقق من صحة مسار مجلد محلي على جهاز الخادم.
- `GET /api/settings/browse` (`requireAdmin`): استعراض مجلدات نظام التشغيل لتسهيل اختيار المجلد من الواجهة.
- `POST /api/settings/pick-folder` (`requireAdmin`): فتح نافذة Windows الأصلية لاختيار المجلد برمجياً.
- `POST /api/settings/clear-data` (`requireAdmin`): إعادة ضبط المصنع لقاعدة البيانات وحذف المحتويات.

### 13.2 مؤشرات الأداء والداشبورد الحي (`/api/dashboard`)
- **المسار:** `GET /api/dashboard/stats` (`requireAdmin`)
- **البيانات المسترجعة:**
  - `server`: مدة التشغيل (Uptime)، نوع النظام، الحمل على المعالج (CPU Load)، استهلاك الذاكرة، والمساحة المتبقية على القرص الصلب.
  - `database`: عدد المواد التي لم يتم ربطها بـ TMDB والصور المؤقتة.
  - `activeStreams`: عدد عمليات البث المباشر النشطة حالياً (Direct Play مقابل عمليات إعادة الترميز Transcode).

### 13.3 صيانة قاعدة البيانات SQLite (`/api/database`)
كافة المسارات مخصصة للمشرفين (`requireAdmin`):
- `GET /api/database/stats`: إحصائيات الجداول وحجم قاعدة البيانات وتجزئتها.
- `POST /api/database/clean-missing`: **محرك فحص الملفات المفقودة؛** يقوم بفحص الأقراص وحذف كافة التسجيلات للملفات التي تم نقلها أو حذفها فعلياً من القرص.
- `POST /api/database/clean-orphans`: حذف السجلات اليتيمة والصور غير المربوطة والمواسم الفارغة.
- `GET /api/database/duplicates`: كشف الملفات المكررة.
- `POST /api/database/clean-duplicates`: دمج وتنظيف الملفات المكررة.
- `POST /api/database/vacuum`: إجراء ضغط وتحسين فيزيائي لملف قاعدة البيانات (SQLite VACUUM).
- `POST /api/database/backup`: أخذ نسخة احتياطية فورية من قاعدة البيانات.
- `GET /api/database/backups`: عرض قائمة النسخ الاحتياطية المتوفرة وتواريخها.

---

## 14. خدمات DLNA و UPnP للشاشات الذكية (DLNA / UPnP Smart TV Services)

يوفر خادم ARN Stream خدمة DLNA مدمجة متوافقة مع كافة الشاشات الذكية (Samsung Tizen, LG webOS, Sony Android TV, VLC Player):

- **ملف مواصفات الجهاز (Device Descriptor XML):**  
  `GET /dlna/device.xml`  
  (يتم الإعلان عنه عبر حزم UDP Multicast SSDP على العنوان `239.255.255.250:1900`).
- **فهرس المحتويات (ContentDirectory Service):**  
  `GET /dlna/ContentDirectory.xml`
- **إدارة الاتصال (ConnectionManager Service):**  
  `GET /dlna/ConnectionManager.xml`
- **نقطة التحكم والتصفح (SOAP Control Action):**  
  `POST /dlna/control/ContentDirectory`  
  (تستقبل استعلامات `Browse` وتستجيب بشجرة مجلدات الوسائط بتنسيق DIDL-Lite XML).
- **نقطة إعداد الاتصال:**  
  `POST /dlna/control/ConnectionManager`

---

## 🎯 ملخص المعايير والتكامل للمطورين

1. **سهولة الربط مع تطبيقات الهاتف والأندرويد (Mobile & Android Ready):**  
   جميع مصفوفات البيانات، الحقول، والمسارات متوافقة بنسبة 100% مع مواصفات تطبيق الأندرويد في ملف `ARN_STREAM_ANDROID_CLIENT_SPECIFICATION.md` ومكتبة `AndroidX Media3 (ExoPlayer)`.
2. **الأداء العالي وتوفير الموارد:**  
   كافة استجابات الـ GET السريعة تخضع لطبقة كاش في الذاكرة (`response-cache`) ويتم إبطالها تلقائياً عند إجراء أي تعديل أو فحص.
3. **الدعم العربي الكامل:**  
   محرك البحث، أسماء الملفات، الترجمات، وتصنيفات الوسوم تدعم اللغة العربية دعماً أصيلاً وموثقاً.

---
**ARN Technology (c) 2026 — تطوير وبرمجة: عبده رجب نصار**
