# 🎬 منصة ARN Stream المتكاملة (خادم وتطبيق بث الوسائط)
### ARN Stream — Ultimate Home & Enterprise Media Server & Streaming Ecosystem

> **تطوير وبرمجة:** عبده رجب نصار  
> **الشركة:** ARN Technology  
> **حقوق الملكية والنشر:** جميع الحقوق محفوظة (c) 2026 لشركة ARN Technology  
> **الهوية:** تصميم عصري فاخر (Dark Glassmorphic UI) مع أداء عالي وسرعة استجابة فائقة.

---

## 🌟 نظرة عامة عن المنصة (Overview)

منصة **ARN Stream** هي منظومة وسائط ترفيهية متكاملة تجمع بين أفضل تجارب منصات البث العالمية (**Netflix** للأفلام والمسلسلات والمسرحيات والوثائقيات) و(**Spotify** للموسيقى والألبومات والتراكات) وقسم خاص للوسائط الروحية (**القرآن الكريم**)، مع معمارية Direct Play بدون استهلاك زائد لموارد المعالج وبدون الحاجة لمفاتيح API خارجية.

المنظومة تضم:
1. 🖥️ **خادم الوسائط الفائق (Backend Media Server):** مبني بـ Node.js و Express مع محرك قواعد بيانات SQLite سريع جداً، وفحص الوسائط عبر FFmpeg/ffprobe وإدارة الكاش الذكي للصور بدقة عالية.
2. 🌐 **واجهة مستخدم الويب (Web Client UI):** مبنية بـ React 18 و Vite وتنسيقات Tailwind CSS الفاخرة بنمط Glassmorphism ودعم كامل للغة العربية (RTL) والإنجليزية.
3. 📱 **تطبيق الأندرويد الهجين (Android Native Client):** تطبيق أصلي مبني بتقنيات Jetpack Compose الحديثة و ExoPlayer (Media3)، مع اكتشاف تلقائي للخوادم عبر الشبكة المحلية (UDP Auto-Discovery) والربط السريع عبر QR Code.
4. 🚀 **مشغل سطح المكتب وحزمة التثبيت (Launcher & Desktop Setup):** سكريبتات تشغيل تلقائية وحزمة تثبيت Inno Setup موقعة رقمياً بشهادة ARN Technology المعتمدة لتخطي حظر Smart App Control و SmartScreen.

---

## 🗂️ هيكل المجلدات والملفات (Project Architecture)

```
ARN-Stream/
├── android/                   # تطبيق الأندرويد الرسمي (Jetpack Compose + ExoPlayer + WebView)
│   ├── app/
│   │   ├── src/main/java/     # شاشات الاتصال، المشغل، والبحث التلقائي
│   │   ├── src/main/res/      # الأيقونات والثيم الداكن الفاخر
│   │   └── build.gradle.kts   # إعدادات البناء والتوقيع الرقمي الرسمي
│   └── gradle/                # حزم ومكتبات أندرويد Gradle
├── server/                    # خادم الوسائط الخلفي (Node.js / Express / SQLite)
│   ├── index.js               # نقطة الانطلاق الرئيسية لخادم Express ومنافذ البث
│   ├── db.js                  # هيكل وتجهيز قاعدة بيانات SQLite فائقة السرعة
│   ├── scanner/               # محرك فحص المجلدات واستخراج الميتاداتا وفحص التراكات
│   ├── services/              # خدمات كاش الصور، واستعلامات TMDB التلقائية
│   └── routes/                # مسارات الـ API (أفلام، مسلسلات، صوتيات، تشغيل، تقييمات)
├── client/                    # واجهة المستخدم الأمامية (React + Vite + Tailwind CSS)
│   ├── src/pages/             # شاشات الأفلام، المسلسلات، الموسيقى، والمشغل
│   ├── src/components/        # المكونات الزجاجية الشفافة، البطاقات، والقوائم
│   ├── src/i18n/              # الترجمة الكاملة (عربي مع RTL وإنجليزي)
│   └── package.json           # حزم واجهة الويب
├── launcher/                  # مشغل سطح المكتب والشاشات المساعدة
├── scripts/                   # سكريبتات الأتمتة والفحص
├── cert/                      # شهادات التوثيق الرقمي لـ ARN Technology
├── .github/workflows/         # خطوط أنابيب GitHub Actions للبناء التلقائي لـ APK
├── installer.iss              # ملف بناء حزمة التثبيت Inno Setup
├── build_and_sign.ps1         # سكريبت البناء والتوقيع الرقمي المعتمد RFC-3161
└── package.json               # إدارة وتشغيل المشروع ككل
```

---

## 🚀 طريقة التثبيت والتشغيل السريع (Quick Start)

### 1. المتطلبات الأساسية
- **Node.js**: الإصدار 18 أو أحدث (يُفضل 20 LTS).
- **نظام التشغيل**: Windows 10/11 أو Linux أو macOS.
- **Android Studio / Android SDK**: (اختياري لبناء تطبيق الهاتف محلياً، كما يتم بناؤه آلياً عبر GitHub Actions).

### 2. تثبيت الحزم (Installation)
من المجلد الرئيسي للمشروع، قم بتشغيل:
```bash
npm run install:all
```
أو تثبيت كل جزء بشكل منفصل:
```bash
# تثبيت حزم الخادم
cd server
npm install

# تثبيت حزم واجهة الويب
cd ../client
npm install
```

### 3. تشغيل وضع التطوير (Development Mode)
```bash
# تشغيل الخادم والواجهة معاً
npm run dev
```
- واجهة الويب ستعمل على: `http://localhost:5173`
- خادم الـ API والبث سيعمل على: `http://localhost:8096`

### 4. بناء نسخة الإنتاج (Production Build)
```bash
npm run build
```
سيتم بناء واجهة الويب ووضعها داخل مجلد `client/dist/` ليعمل الخادم على تقديمها مباشرة دون الحاجة لخادم تطوير منفصل.

---

## 📱 تطبيق الأندرويد (Android Client)

- مبني بدعم أحدث معايير Google Material 3 و Jetpack Compose.
- يدعم البث الهجين (Hybrid Web & ExoPlayer Media3 Direct Stream).
- **اكتشاف تلقائي للخادم:** يقوم التطبيق بالبحث في الشبكة المحلية عبر بروتوكول UDP عن خادم ARN Stream المتصل تلقائياً.
- **مسح كود الاستجابة السريعة (QR Code):** يمكن تصوير باركود الشاشة من جهاز الكمبيوتر للربط المباشر.
- **البناء التلقائي (CI/CD):** يتم بناء ملفات الـ APK تلقائياً عبر GitHub Actions وإصدارها في قسم Releases.

---

## 🛡️ الأمان والتوقيع الرقمي (Code Signing)

كافة الحزم والملفات التنفيذية لمشاريع شركة **ARN Technology** موقعة رقمياً بشهادة معتمدة وطابع زمني **RFC-3161** لضمان الأصالة والأمان التام، وتخطي حماية **Windows 11 Smart App Control** و SmartScreen بدون أي تحذيرات أمنية.

---

## 📞 التواصل والدعم الفني (Contact & Social Links)

للتواصل مع المطور ومؤسس شركة **ARN Technology**:

- 👤 **المطور:** عبده رجب نصار (Abdou Ragab Nassar)
- 🟢 **WhatsApp:** [+201556710314](https://wa.me/201556710314)
- ✈️ **Telegram:** [@ABDOURNASSAR95](https://t.me/ABDOURNASSAR95)
- 🌐 **Facebook:** [abdouragab.nassar](https://www.facebook.com/abdouragab.nassar)
- 💬 **Messenger:** [abdouragab.nassar](https://m.me/abdouragab.nassar)

---

## 📜 الترخيص وحقوق الملكية (License)

حقوق النشر (c) 2026 لشركة **ARN Technology**. جميع الحقوق محفوظة للمطور عبده رجب نصار.
يُمنع استخدام هذا البرنامج أو إعادة توزيعه أو تعديله تجارياً دون إذن كتابي مسبق.
