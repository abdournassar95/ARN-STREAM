# 📱 دليل تطبيق أندرويد لمنصة ARN Stream
### ARN Stream Android Native & Hybrid Client — Technical Reference

> **الشركة:** ARN Technology  
> **تطوير وبرمجة:** عبده رجب نصار  
> **حقوق الملكية والنشر:** جميع الحقوق محفوظة (c) 2026 لشركة ARN Technology  
> **حزمة التطبيق (Package):** `com.aistudio.arnstream.client`  
> **الهدف:** Android 14+ (API 34/36) | الحد الأدنى: Android 7.0 (API 24)  

---

## 🌟 1. نظرة عامة (Overview)

تطبيق **ARN Stream** لنظام أندرويد هو عميل وسائط مدمج وذكي يوفر للمستخدمين إمكانية الوصول إلى خادم الوسائط المنزلي أو السحابي من هواتفهم وأجهزتهم اللوحية وشاشات أندرويد.

يتميز التطبيق بـ **المعمارية الثنائية (Dual Architecture)**:
1. **الوضع الأصيل (Native Mode):** مبني بنسبة 100% باستخدام **Jetpack Compose** الحديث ومحرك **ExoPlayer (Media3)** لتشغيل الوسائط بسلاسة متناهية وأقل استهلاك للبطارية.
2. **الوضع الهجين (Hybrid Web Client Fallback):** متصفح WebView عالي الأداء ومُهيأ يتيح التبديل بنقرة زر واحدة للوصول لكافة أدوات لوحة التحكم الإدارية أو ميزات الويب المتقدمة.

---

## 🚀 2. المميزات الرئيسية (Core Features)

### 2.1 الاكتشاف التلقائي للخوادم (UDP Auto-Discovery)
* لا يحتاج المستخدم إلى حفظ عناوين الـ IP أو كتابتها يدوياً.
* يقوم فلاس التطبيق بإرسال حزم بث دورية (UDP Broadcasts) عبر الشبكة المحلية على المنفذ المخصص لرصد أي خادم ARN Stream نشط خلال أجزاء من الثانية.

### 2.2 مسح رمز الاستجابة السريعة (QR Code Instant Connect)
* مدمج بكاميرا ماسحة تعتمد على مكتبة **Google MLKit Barcode Scanning**.
* يقوم المستخدم بمسح رمز الاستجابة السريعة (QR Code) المعروض في شاشة الحاسوب عبر المتصفح ليتم الاتصال وتسجيل الدخول فورياً دون الحاجة لكتابة اسم المستخدم أو كلمة المرور.

### 2.3 مشغل الصوت في الخلفية (Background Audio Playback)
* يعتمد على `ArnPlaybackService` المتوافق مع معايير Android MediaSession.
* إمكانية الاستماع للقرآن الكريم والموسيقى أثناء إغلاق الشاشة أو استخدام تطبيقات أخرى، مع لوحة تحكم كاملة في شاشة القفل وستارة الإشعارات.

### 2.4 الهوية البصرية الفاخرة (Dark Glassmorphic UI)
* تصميم كبسولي متكيف بألوان زجاجية داكنة تناسب شاشات AMOLED.
* استخدام خطوط `Cairo` و `Montserrat` المريحة للعين.
* دعم الوضع العربي الكامل (RTL) مع أيقونات ومؤثرات حركية تفاعلية.

---

## 🏗️ 3. الهيكل البرمجي للتطبيق (Directory Structure)

```
android/app/src/main/
├── AndroidManifest.xml                  # الأذونات، الخدمات، والأنشطة
├── java/com/example/
│   ├── MainActivity.kt                  # نقطة الانطلاق وإدارة مسارات Compose
│   ├── data/
│   │   ├── api/ArnApiService.kt         # واجهات Retrofit للتواصل مع خادم الباك إند
│   │   ├── discovery/NetworkDiscovery   # محرك الاكتشاف التلقائي عبر الشبكة (UDP)
│   │   ├── model/ServerModels.kt        # نماذج البيانات (الأفلام، الصوتيات، المستخدمين)
│   │   └── storage/PreferencesManager   # حفظ التفضيلات ومفاتيح الدخول في DataStore
│   ├── playback/
│   │   ├── AudioPlayerController.kt     # وحدة التحكم بمشغل الصوت
│   │   └── service/ArnPlaybackService   # خدمة التشغيل الخلفي بنظام Media3
│   ├── ui/
│   │   ├── components/                  # المكونات المشتركة (البوسترات، الكبسولات، النافبار)
│   │   ├── navigation/                  # إدارة شاشات التطبيق والتبديل
│   │   ├── screens/                     # شاشات الواجهة:
│   │   │   ├── connect/ConnectScreen    # شاشة البحث عن الخوادم والاتصال
│   │   │   ├── home/HomeScreen          # الصفحة الرئيسية واستعراض المحتوى
│   │   │   ├── player/VideoPlayerScreen # مشغل الفيديو المتقدم
│   │   │   ├── audio/AudioPlayerScreen  # مشغل الصوتيات مع قوائم الأغاني
│   │   │   ├── remote/RemoteControl     # ريموت كنترول للتحكم في الشاشات
│   │   │   └── web/WebClientScreen      # شاشة العرض الهجين WebView
│   │   └── theme/                       # مصفوفة الألوان، الخطوط، والسمات
│   └── util/                            # دوال فحص الروابط ومساعد التحميل
└── res/                                 # الأيقونات ثلاثية الأبعاد وموارد التصميم
```

---

## 🔐 4. أذونات التطبيق (Permissions)

* `INTERNET`: للاتصال بالخادم وبث المحتوى.
* `ACCESS_NETWORK_STATE` & `ACCESS_WIFI_STATE`: لرصد حالة الشبكة المحلية.
* `CHANGE_WIFI_MULTICAST_STATE`: لتفعيل حزم UDP Multicast لاكتشاف السيرفر.
* `CAMERA`: لمسح كود الـ QR للربط السريع.
* `FOREGROUND_SERVICE` & `FOREGROUND_SERVICE_MEDIA_PLAYBACK`: لضمان استمرار تشغيل الصوت في الخلفية.
* `POST_NOTIFICATIONS`: لإظهار بطاقة التحكم بالصوت في لوحة إشعارات أندرويد 13+.

---

## 🛠️ 5. البناء التلقائي والتوقيع الرقمي (CI/CD Pipeline)

يتم بناء حزم الـ APK بصيغة Release تلقائياً عبر منصة GitHub Actions من خلال ملف التكوين [.github/workflows/build-android.yml](file:///e:/مشاريعي/ARN-Stream/.github/workflows/build-android.yml):
1. إعداد بيئة Java 17 وتثبيت Android SDK 36.
2. بناء حزمة التطبيق عبر أمر `./gradlew assembleRelease`.
3. توقيع الحزمة تلقائياً ونشرها كـ Release Artifact جاهز للتحميل المباشر.
