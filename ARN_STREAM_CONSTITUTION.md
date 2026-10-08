# 🏛️ دستور وخطة بناء مشروع ARN Stream
### الدليل المرجعي الشامل والمعمارية الفنية لمنصة الوسائط المتكاملة
> **تطوير وبرمجة:** عبده رجب نصار  
> **الشركة المالكة:** ARN Technology  
> **حقوق النشر والملكية الفكرية:** (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.

---

## 📌 1. نظرة عامة وفلسفة المشروع (Vision & Identity)

منصة **ARN Stream** هي خادم وسائط منزلي ومؤسسي متكامل، صُممت لتجمع بين أفضل ما في منصة **Netflix** (لتجربة مشاهدة الأفلام والمسلسلات والمسرحيات والوثائقيات) وأفضل ما في منصة **Spotify** (لتجربة الاستماع للألبومات والتراكات والقوائم الذكية) مع تخصيص فخم للوسائط الروحية مثل **القرآن الكريم**.

### الركائز الأساسية:
1. **الفخامة البصرية (Luxury Dark Glassmorphism):** واجهة مستخدم داكنة بزجاج شفاف فائق الجودة (`backdrop-blur-2xl`)، أطر مضيئة، وتوهج ديناميكي محيطي.
2. **الاستقلالية التامة (Zero Third-Party Dependency):** جلب البيانات والميتاداتا والبوسترات العربية من مصادر عالمية (TMDB و IMDb) تلقائياً دون إلزام المستخدم بشراء أو استخراج مفاتيح API.
3. **السرعة والأداء اللحظي:** استعلامات قاعدة بيانات فائقة السرعة مع كاش محلي للصور وتحليل مسبق للملفات الصوتية والمرئية.
4. **دعم اللغة العربية الأصيل (First-Class Arabic RTL):** دعم كامل للاتجاه من اليمين لليسار، وتطبيع نصوص البحث باللغة العربية (تجاهل الهمزات، التاء المربوطة، وحركات التشكيل).

---

## 🎨 2. نظام الهيدر الزجاجي العائم وهوية الألوان الديناميكية (Dynamic UI System)

تعتمد المنصة على نظام هيدر عائم زجاجي (`Floating Glassmorphic Capsule`) يثبت في أعلى الشاشة ويتغير لونه وتوهجه تلقائياً حسب نوع المكتبة النشطة:

### مصفوفة ألوان المكتبات (Dynamic Library Palette):
| المكتبة | اللون الأساسي | لون التوهج (Glow) | الأيقونة | المعنى البصري |
| :--- | :--- | :--- | :--- | :--- |
| **أفلام (Movies)** | `#E50914` | `rgba(229, 9, 20, 0.45)` | `Film` 🎬 | أحمر سينمائي كلاسيكي نابض |
| **مسلسلات (Series)** | `#F59E0B` | `rgba(245, 158, 11, 0.45)` | `Tv` 📺 | ذهبي وكهرماني ملكي فخم |
| **مسرحيات (Plays)** | `#8B5CF6` | `rgba(139, 92, 246, 0.45)` | `Drama` 🎭 | بنفسجي مخملي يجسد روح المسرح |
| **وثائقية (Documentaries)** | `#06B6D4` | `rgba(6, 182, 212, 0.45)` | `Clapperboard` 🎥 | أزرق محيطي يرمز للاكتشاف |
| **موسيقى (Music)** | `#1DB954` | `rgba(29, 185, 84, 0.45)` | `Music` 🎵 | أخضر زمردي مريح ومستوحى من سبوتيفاي |
| **القرآن الكريم (Holy Quran)** | `#0D9488` | `rgba(13, 148, 136, 0.45)` | `BookOpen` 📖 | تركواز روحي هادئ ووقور |
| **البث المباشر (Live TV)** | `#EF4444` | `rgba(239, 68, 68, 0.45)` | `Tv2` / `Tv` 📺 | أحمر قرمزي نابض يرمز للبث الحي والرياضي (Drama Live) |
| **الرئيسية / العامة** | `#E50914` | `rgba(229, 9, 20, 0.35)` | `Home` 🏠 | أوبسيديان داكن بتوهج ناعم متعدد |

### مكونات الهيدر العائم:
- **شعار ARN Stream ثلاثي الأبعاد:** دائري بحواف متوهجة يفتح الصفحة الرئيسية.
- **روابط المكتبات الذكية:** عرض المكتبات الفعلية في القاعدة مع تمييز المكتبة الحالية بكبسولة نشطة مضيئة.
- **شريط البحث التنبؤي الذكي (Predictive Search):** كبسولة زجاجية تتوهج بلون المكتبة الحالية، مع اقتراحات مباشرة أثناء الكتابة وإكمال تلقائي بالـ `Tab`.
- **زر فحص المكتبة ("فحص المكتبة"):** كبسولة بيضاء متوهجة بنص ملون بلون المكتبة وأيقونة دوران حية أثناء الفحص.
- **أزرار التحكم الدائرية الزجاجية (Glass Action Pills):**
  - زر تبديل الوضع (ليلي / نهاري ☀️/🌙).
  - زر لوحة التحكم والإعدادات (ترس ⚙️).
  - زر تبديل اللغة الفوري (AR / EN 🌐).

---

## 🧠 3. محرك جلب الميتاداتا الذكي (Keyless Metadata Engine)

تم ابتكار وتطوير نظام استرجاع البيانات والملصقات في ملف `server/routes/metadata.js` بحيث يعمل كالتالي:

1. **الكشط المباشر بدون مفتاح API (Direct Web Scraper):**
   - محاكاة متصفح حديث واستدعاء صفحات `themoviedb.org/{tv|movie}/{id}?language=ar`.
   - استخراج العنوان العربي الرسمي، الملخص، سنة الإنتاج، التقييم، وبوسترات وخلفيات فائقة الدقة (`w780` و `original`).
2. **التعرف التلقائي على الأكواد والروابط (Slug & Code Parser):**
   - يدعم إدخال الكود المباشر بعد `/tv/` أو `/movie/` (مثل: `52698-al-kabeer` أو `52698`).
   - يدعم إدخال رابط TMDB كاملاً مباشرة في شريط البحث.
   - يدعم كود IMDb المباشر (مثل: `tt2290891`).
3. **استبعاد الممثلين تماماً:**
   - تم إلغاء البحث في ويكيبيديا لتجنب خلط أسماء الفنانين بأسماء الأعمال، وتم قصر نتائج البحث حصراً على الأعمال الفنية ومسلسلات وأفلام.
4. **الحفظ والإغلاق التلقائي:**
   - عند الضغط على "حفظ التغييرات"، يتم تخزين البيانات، تحميل وحفظ البوسترات، إغلاق النافذة والعودة الفورية لصفحة العمل مع إعادة جلب البيانات في الخلفية (`Invalidate & Refetch Queries`).

---

## 🏗️ 4. المعمارية التقنية وحزم البرمجيات (Tech Stack)

### واجهة المستخدم (Client - Frontend):
- **الإطار والمحرك:** `React 18` مبني بواسطة `Vite 5` فائق السرعة.
- **التصميم والتنسيق:** `Tailwind CSS` مع تخصيصات لونية دقيقة، ونظام متغيرات `CSS Variables` للوضع الليلي والنهاري.
- **إدارة الحالة والكاش:** `@tanstack/react-query v5` لإدارة البيانات والطلبات غير المتزامنة، مع `Zustand` لإدارة حالة المشغل والإعدادات.
- **الأيقونات والمؤثرات:** `lucide-react` لأيقونات متجهة نقية وخفيفة.
- **التدويل (i18n):** `i18next` لدعم اللغتين العربية والإنجليزية مع اتجاهات `RTL` و `LTR`.
- **التوجيه والمسارات:** `react-router-dom v6`.

### الخادم والواجهة الخلفية (Server - Backend):
- **بيئة التشغيل:** `Node.js (v20+ / ESM Modules)`.
- **إطار العمل:** `Express.js 4`.
- **قاعدة البيانات:** `better-sqlite3` مع تفعيل `WAL Mode` ودوال تطبيع النصوص العربية `norm_ar`.
- **معالجة الوسائط والفيديو:** `fluent-ffmpeg` و `@ffmpeg-installer/ffmpeg` و `@ffprobe-installer/ffprobe`.
- **معالجة وتصغير الصور:** `sharp` لتوليد صور مصغرة (Thumbnails) خفيفة وسريعة التحميل.
- **مراقبة المجلدات التلقائية:** `chokidar` لمزامنة الإضافات الجديدة فورياً.
- **الأمان والتحقق:** `jsonwebtoken (JWT)` و `bcryptjs` لحماية مسارات الإدارة.

---

## 🗄️ 5. هيكل قاعدة البيانات ومخطط الجداول (Database Schema)

مسار قاعدة البيانات النشطة: `server/data/media.db`

```sql
-- المستخدمين
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  allowed_libraries TEXT,
  is_active BOOLEAN DEFAULT 1,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- المكتبات
CREATE TABLE libraries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'movies', 'shows', 'music'
  paths TEXT NOT NULL,
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  custom_covers TEXT DEFAULT NULL
);

-- الأفلام
CREATE TABLE movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  year INTEGER,
  plot TEXT,
  path TEXT UNIQUE NOT NULL,
  duration INTEGER,
  resolution TEXT,
  video_codec TEXT,
  audio_codec TEXT,
  tmdb_id INTEGER,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE
);

-- المسلسلات
CREATE TABLE series (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  plot TEXT,
  year INTEGER,
  tmdb_id INTEGER,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE
);

-- المواسم
CREATE TABLE seasons (
  id INTEGER PRIMARY KEY,
  series_id INTEGER REFERENCES series(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  title TEXT,
  plot TEXT,
  year INTEGER,
  UNIQUE(series_id, season_number)
);

-- الحلقات
CREATE TABLE episodes (
  id INTEGER PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT,
  path TEXT UNIQUE NOT NULL,
  duration INTEGER,
  resolution TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- الصوتيات (الفنانين، الألبومات، المسارات)
CREATE TABLE artists (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, added_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE albums (id INTEGER PRIMARY KEY, artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE, title TEXT NOT NULL, year INTEGER, cover_path TEXT, added_at DATETIME DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE tracks (id INTEGER PRIMARY KEY, album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE, title TEXT NOT NULL, track_number INTEGER, duration INTEGER, path TEXT UNIQUE NOT NULL, bit_rate INTEGER, format TEXT, added_at DATETIME DEFAULT CURRENT_TIMESTAMP, library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE);

-- الصور والملصقات والخلفيات
CREATE TABLE images (
  id INTEGER PRIMARY KEY,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  image_type TEXT NOT NULL, -- 'poster', 'backdrop', 'season_poster'
  path TEXT NOT NULL,
  source TEXT DEFAULT 'local',
  is_primary BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- التقييمات (مع قيد التوافق مع المستخدم)
CREATE TABLE ratings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  rating REAL NOT NULL,
  review TEXT,
  rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, media_type, media_id)
);

-- استئناف المشاهدة وحالة التشغيل
CREATE TABLE playback_state (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  completed BOOLEAN DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, media_type, media_id)
);
```

---

## ⚡ 6. أوامر التشغيل والبناء (Build & Run Commands)

### 1. وضع التطوير المشترك (Development Mode):
من المجلد الرئيسي `d:\PersonalStream`:
```bash
npm run dev
```
*يقوم هذا الأمر بتشغيل كل من سيرفر الباك اند (على المنفذ `8096`) والواجهة الأمامية (على المنفذ `5173`) بشكل متزامن.*

### 2. بناء حزمة الإنتاج للواجهة الأمامية (Production Build):
```bash
npm run build
```
*يتم إنتاج الملفات النظيفة والمضغوطة داخل مجلد `client/dist`.*

### 3. تشغيل السيرفر منفرداً:
```bash
npm run dev:server
# أو
npm run dev:client
```

---

## 🛡️ 7. معايير التطوير ونظافة الكود في ARN Technology

1. **الوقاية من أخطاء الـ Temporal Dead Zone (TDZ):**
   - يجب دائماً التأكد من ترتيب تعريف المتغيرات والدوال الخطافية (`Hooks / Mutations`) بحيث لا يتم قراءة أي متغير متعلق بالحالة (مثل `isSaving`) قبل اكتمال سطر تعريفه.
2. **استعلامات SQLite الآمنة:**
   - عند استخدام `ON CONFLICT` في SQLite، يجب مطابقة الأعمدة بدقة مع القيود المعرفة في الجدول (`UNIQUE(user_id, media_type, media_id)`).
3. **معالجة مسارات الملفات:**
   - عند التعامل مع مسارات الوسائط على نظام Windows، يجب تحويل الشرطات المائلة العكسية إلى شرطات أمامية لتجنب مشاكل فك الترميز في الروابط.
4. **نظافة المجلدات:**
   - الحفاظ على خلو المشروع من الملفات التجريبية أو الملفات الصفرية (`0-byte`) لضمان سرعة النسخ الاحتياطي وحماية سلامة بيئة العمل.

---

## 📞 8. معلومات المطور والشركة الرسمية

- **الشركة المطورة:** ARN Technology
- **تطوير وبرمجة:** عبده رجب نصار
- **واتساب:** [+201556710314](https://wa.me/201556710314)
- **تليجرام:** [@ABDOURNASSAR95](https://t.me/ABDOURNASSAR95)
- **فيسبوك:** [abdouragab.nassar](https://www.facebook.com/abdouragab.nassar)
- **ماسنجر:** [abdouragab.nassar](https://m.me/abdouragab.nassar)

---
*تم إنشاء هذا الدستور المرجعي ليكون المرجع الأساسي لتطوير وصيانة منصة ARN Stream في مساحة العمل.*
