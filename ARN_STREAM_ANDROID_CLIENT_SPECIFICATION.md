# 📱 المخطط المعماري الشامل لبناء تطبيق أندرويد لمنصة ARN Stream
### الدليل المرجعي الفني والهندسي المتكامل لبناء تطبيق Android Client أصيل (Native)
> **اسم المنصة والخادم:** ARN Stream Media Server  
> **تطوير وبرمجة الخادم والمنصة:** عبده رجب نصار  
> **الشركة المالكة:** ARN Technology  
> **حقوق النشر والملكية الفكرية:** (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.  
> **الغرض من الوثيقة:** تغذية هذا الدليل بالكامل لنماذج الذكاء الاصطناعي (مثل Google AI Studio / Gemini 1.5 Pro / Ultra) لتوليد كود تطبيق الأندرويد بالكامل باحترافية وبدون أي نقص.

---

## 📑 فهرس المحتويات
1. [نظرة عامة وفلسفة التصميم](#1-نظرة-عامة-وفلسفة-التصميم)
2. [الهوية البصرية والرقمية الرسمية (Brand & Digital Identity - ARN Technology)](#2-الهوية-البصرية-والرقمية-الرسمية-لـ-arn-technology)
3. [المعمارية التقنية وحزم برمجيات أندرويد (Tech Stack)](#3-المعمارية-التقنية-وحزم-برمجيات-أندرويد-tech-stack)
4. [نظام الاكتشاف التلقائي والربط برمز QR (Server Discovery & Pairing)](#4-نظام-الاكتشاف-التلقائي-والربط-برمز-qr)
5. [دليل الـ API Endpoints وهياكل البيانات (REST & WebSocket)](#5-دليل-الـ-api-endpoints-وهياكل-البيانات)
6. [مشغل الوسائط المتطور (ExoPlayer & Media3 Architecture)](#6-مشغل-الوسائط-المتطور-exoplayer--media3)
7. [نظام التشغيل في الخلفية ومستمع الصوتيات (Background Audio & MediaSession)](#7-نظام-التشغيل-في-الخلفية-ومستمع-الصوتيات)
8. [نظام الريموت كنترول الذكي والبث للأجهزة (PlayTo / Remote Control)](#8-نظام-الريموت-كنترول-الذكي-والبث-للأجهزة)
9. [نظام التنزيل والمشاهدة دون إنترنت (Offline Download Engine)](#9-نظام-التنزيل-والمشاهدة-دون-إنترنت)
10. [شاشات وواجهات المستخدم ومكونات Compose الرسمية (UI/UX Specifications)](#10-شاشات-وواجهات-المستخدم-ومكونات-compose-الرسمية)
11. [هيكلية حزم وملفات المشروع (Android Project Structure)](#11-هيكلية-حزم-وملفات-المشروع)
12. [ملفات الإعدادات والتبعيات والتوقيع الرقمي (build.gradle.kts & Manifest)](#12-ملفات-الإعدادات-والتبعيات-والتوقيع-الرقمي)
13. [تعليمات موجهة لـ AI Studio لتوليد المشروع خطوة بخطوة](#13-تعليمات-موجهة-لـ-ai-studio)

---

## 🎨 1. نظرة عامة وفلسفة التصميم

### 1.1 فلسفة التطبيق (Vision & Identity)
تطبيق **ARN Stream Android** هو العميل الرسمي (Client) الموجه لهواتف وأجهزة أندرويد اللوحية (ويمكن تشغيله على Android TV مستقبلاً). يهدف إلى تقديم تجربة مستخدم تجمع بين **فخامة واجهات نيتفلكس (Netflix)** في تصفح ومشاهدة الأفلام والمسلسلات، و**انسيابية سبوتيفاي (Spotify)** في الاستماع للألبومات والأغاني، مع دعم كامل ومخصص للوسائط الروحية كـ **القرآن الكريم** ومحطات **البث المباشر (Live TV)**.

### 1.2 مصفوفة الألوان والسمات الديناميكية (Dynamic Capsule Colors)
يجب أن يتفاعل التطبيق بصرياً مع المكتبة النشطة ويغير ألوان الكبسولات وأضواء التوهج (Neon Ambient Glow) وفقاً لمصفوفة منصة ARN Stream:

| نوع المكتبة | الرمز | اللون الأساسي (Primary) | لون التوهج (Ambient Glow) | الوصف البصري |
| :--- | :---: | :---: | :---: | :--- |
| **الأفلام (Movies)** | 🎬 | `#E50914` | `rgba(229, 9, 20, 0.45)` | أحمر سينمائي نابض |
| **المسلسلات (Shows/Series)** | 📺 | `#F59E0B` | `rgba(245, 158, 11, 0.45)` | ذهبي كهرماني ملكي |
| **المسرحيات (Plays)** | 🎭 | `#8B5CF6` | `rgba(139, 92, 246, 0.45)` | بنفسجي مخملي عميق |
| **الوثائقيات (Documentaries)** | 🎥 | `#06B6D4` | `rgba(6, 182, 212, 0.45)` | أزرق محيطي للاكتشاف |
| **الموسيقى (Music)** | 🎵 | `#1DB954` | `rgba(29, 185, 84, 0.45)` | زمردي نابض مريح |
| **القرآن الكريم (Holy Quran)** | 📖 | `#0D9488` | `rgba(139, 92, 246, 0.45)` | تركواز روحي وقور |
| **البث المباشر (Live TV)** | 📡 | `#EF4444` | `rgba(239, 68, 68, 0.45)` | أحمر ناري للبث المباشر |
| **الرئيسية / العامة** | 🏠 | `#E50914` | `rgba(229, 9, 20, 0.35)` | كبسولة أوبسيديان داكنة |

### 1.3 معايير التصميم الزجاجي (Luxury Dark Glassmorphism)
- **خلفية الشاشة الأساسية:** `#090D16` إلى `#020617` (تدرج لوني فاحم داكن وناعم).
- **البطاقات والكبسولات:** `Color(0x1AFFFFFF)` مع حد زجاجي `Border(1.dp, Color(0x26FFFFFF))` وبلور خلفي (`Modifier.blur()` في الأجهزة المدعومة).
- **الخطوط:** خط عربي حديث فخم (Tajawal أو Cairo أو Readex Pro) للغة العربية، وInter/Outfit للإنجليزية والأرقام.
- **دعم الاتجاه (RTL Support):** واجهة عربية أصيلة بنسبة 100% تبدأ من اليمين لليسار مع إمكانية التبديل للإنجليزية.
- **شعار التطبيق:** دائري ثلاثي الأبعاد خاص بـ ARN Stream مع حواف متوهجة بظل ديناميكي.

---

## 🛡️ 2. الهوية البصرية والرقمية الرسمية (ARN Technology Brand & Digital Identity)

تم تأسيس هذا القسم وفقاً للمحددات والمعايير البرمجية الصارمة لشركة **ARN Technology** والمطور **عبده رجب نصار** لضمان توحيد هوية المشاريع البرمجية وتكاملها:

### 2.1 بيانات المطور والشركة الرسمية (Official Brand Credentials)
- **الشركة المالكة والمطورة:** ARN Technology
- **تطوير وبرمجة:** عبده رجب نصار (Abdou Ragab Nassar)
- **حقوق النشر والملكية الفكرية:** حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة.
- **رؤية الهوية:** التركيز على الأناقة البصرية، النمط الزجاجي الشفاف الداكن (Luxury Dark Glassmorphism)، تجربة المستخدم الخالية من التعقيد (Seamless UX)، واللغة العربية كلغة أولى وأصيلة.

### 2.2 بيانات التواصل الاجتماعي الرسمية (Social & Support Channels)
يتم استخدام هذه الروابط في نافذة "حول التطبيق" (About Dialog) وقسم الدعم الفني:
| المنصة | المعرف / الرقم | رابط الفتح التلقائي المباشر |
| :--- | :--- | :--- |
| **واتساب (WhatsApp)** | `+201556710314` | `https://wa.me/201556710314` |
| **تليجرام (Telegram)** | `@ABDOURNASSAR95` | `https://t.me/ABDOURNASSAR95` |
| **فيسبوك (Facebook)** | `abdouragab.nassar` | `https://www.facebook.com/abdouragab.nassar` |
| **ماسنجر (Messenger)** | `abdouragab.nassar` | `https://m.me/abdouragab.nassar` |

### 2.3 المعايير الصارمة لأزرار التواصل الاجتماعي في الواجهة (Social Action Buttons Spec):
1. **الشكل الهندسي:** دائرية تماماً (`CircleShape` / `border-radius: 25px`، أبعاد `50.dp × 50.dp`).
2. **الأيقونات:** تعتمد على أيقونات متجهة (Vector Drawables) مخصصة لكل منصة ومحفوظة محلياً في مجلد `res/drawable/` (`ic_social_whatsapp.xml`, `ic_social_telegram.xml`, إلخ).
3. **التفاعل الحركي (Hover & Press Effect):**
   - الحالة الافتراضية: خلفية شفافة زجاجية `Color(0x1AFFFFFF)` مع إطار ناعم `Color(0x26FFFFFF)`.
   - عند الضغط أو اللمس (Pressed/Focused): تتحول الخلفية إلى لون داكن مميز ونابض `Color(0xFF1E293B)` مع تأثير تموج ولمعان نيون.
4. **طريقة الفتح:** استخدام `Intent(Intent.ACTION_VIEW, Uri.parse(url))` مع معالجة الأخطاء والتوجيه للمتصفح في حال عدم تثبيت التطبيق المخصص.

### 2.4 نافذة "حول التطبيق" الرسمية (About ARN Stream Dialog Specification):
- **نوع النافذة:** نافذة منبثقة زجاجية عائمة بتصميم `Dialog` أو `ModalBottomSheet` في Jetpack Compose.
- **لون الخلفية:** كحلي داكن وفاحم `Color(0xFF0F172A)` مع حد زجاجي مضيء.
- **شعار التطبيق:** الشعار الرسمي ثلاثي الأبعاد (3D Logo) بحجم `80.dp` مع توهج محيطي نابض بلون زمردي وأزرق.
- **عنوان النافذة:** `ARN Stream Mobile` أو `حول ARN Stream`.
- **نص المطور الحصري:** "تطوير وبرمجة: عبده رجب نصار" بلون أخضر زمردي مميز وفخم `Color(0xFF10B981)`.
- **نص حقوق النشر:** "حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة." بلون رمادي مريح `Color(0xFF94A3B8)`.
- **صف أزرار التواصل:** عرض الأزرار الدائرية الأربعة في المنتصف مع حركات انسيابية عند النقر.

#### كود Jetpack Compose المرجعي لنافذة AboutDialog:
```kotlin
package com.arntechnology.stream.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.arntechnology.stream.R

@Composable
fun ArnAboutDialog(
    isOpen: Boolean,
    onDismiss: () -> Unit
) {
    if (!isOpen) return
    val context = LocalContext.current

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            shape = RoundedCornerShape(28.dp),
            color = Color(0xFF0F172A),
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
                .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(28.dp))
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // الشعار ثلاثي الأبعاد
                Box(
                    modifier = Modifier
                        .size(80.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF1E293B)),
                    contentAlignment = Alignment.Center
                ) {
                    Image(
                        painter = painterResource(id = R.drawable.ic_arn_logo_3d),
                        contentDescription = "ARN Stream 3D Logo",
                        modifier = Modifier.size(64.dp)
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // اسم المنصة
                Text(
                    text = "ARN Stream",
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Black,
                    color = Color.White
                )

                Text(
                    text = "الإصدار 1.0.0 (2026)",
                    fontSize = 12.sp,
                    color = Color(0xFF64748B)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // اسم المبرمج باللون الأخضر الزمردي المميز لهوية ARN Technology
                Text(
                    text = "تطوير وبرمجة: عبده رجب نصار",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF10B981),
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(6.dp))

                // نص حقوق النشر
                Text(
                    text = "حقوق النشر (c) 2026 لشركة ARN Technology.\nجميع الحقوق محفوظة.",
                    fontSize = 12.sp,
                    color = Color(0xFF94A3B8),
                    textAlign = TextAlign.Center,
                    lineHeight = 18.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                // صف أزرار التواصل الاجتماعي الدائرية الرسمية
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    SocialCircularButton(
                        iconRes = R.drawable.ic_social_whatsapp,
                        contentDescription = "WhatsApp",
                        onClick = { openUrl(context, "https://wa.me/201556710314") }
                    )
                    SocialCircularButton(
                        iconRes = R.drawable.ic_social_telegram,
                        contentDescription = "Telegram",
                        onClick = { openUrl(context, "https://t.me/ABDOURNASSAR95") }
                    )
                    SocialCircularButton(
                        iconRes = R.drawable.ic_social_facebook,
                        contentDescription = "Facebook",
                        onClick = { openUrl(context, "https://www.facebook.com/abdouragab.nassar") }
                    )
                    SocialCircularButton(
                        iconRes = R.drawable.ic_social_messenger,
                        contentDescription = "Messenger",
                        onClick = { openUrl(context, "https://m.me/abdouragab.nassar") }
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // زر الإغلاق الزجاجي
                Button(
                    onClick = onDismiss,
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth().height(44.dp)
                ) {
                    Text(text = "إغلاق", color = Color.White, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun SocialCircularButton(
    iconRes: Int,
    contentDescription: String,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isPressed by interactionSource.collectIsPressedAsState()
    val bgColor = if (isPressed) Color(0xFF1E293B) else Color(0x14FFFFFF)

    Box(
        modifier = Modifier
            .size(50.dp)
            .clip(CircleShape)
            .background(bgColor)
            .border(1.dp, Color(0x26FFFFFF), CircleShape)
            .clickable(interactionSource = interactionSource, indication = null, onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Icon(
            painter = painterResource(id = iconRes),
            contentDescription = contentDescription,
            tint = Color.Unspecified,
            modifier = Modifier.size(26.dp)
        )
    }
}

private fun openUrl(context: Context, url: String) {
    try {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        context.startActivity(intent)
    } catch (_: Exception) {}
}
```

### 2.5 شاشة البداية الملكية (ARN Splash Screen):
- عرض شعار ARN Stream ثلاثي الأبعاد مع نبضات توهج أزرق وزمردي متتالية (`animateFloat` مع `InfiniteRepeatableSpec`).
- نص الترحيب: "ARN Stream" مع توقيع: "تطوير وبرمجة عبده رجب نصار - ARN Technology 2026".
- في الخلفية: فحص تلقائي سريع (Auto LAN Discovery) للاتصال بالخادم الأخير في DataStore في غضون 1.5 ثانية، للانتقال المباشر للواجهة دون تأخير.

### 2.6 الهوية الرقمية والأمنية للتطبيق (Digital Cryptographic Identity):
1. **معرف التطبيق المعتمد (Application ID):**
   `com.arntechnology.stream`
2. **التوقيع الرقمي لحزمة أندرويد (Release Keystore Signing):**
   - يتم توقيع تطبيق أندرويد بشهادة رقمية رسمية معتمدة لـ **ARN Technology** تم إنشاؤها عبر أداة `keytool` القياسية:
     ```bash
     keytool -genkey -v -keystore arn_technology_release.jks -alias arn_technology -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Abdou Ragab Nassar, OU=Development, O=ARN Technology, L=Alexandria, ST=Alexandria, C=EG"
     ```
   - دعم التوقيع الرباعي الكامل في ملف `build.gradle.kts`:
     - `v1SigningEnabled = true` (Jar Signature للأجهزة القديمة).
     - `v2SigningEnabled = true` (Full APK Signature للأمان).
     - `v3SigningEnabled = true` (Key Rotation).
     - `v4SigningEnabled = true` (Streaming Installation عبر ADB و Play Store).
3. **توثيق اتصالات الشبكة المحلية وشهادة الجذر (Network Security Config):**
   - يتيح ملف `network_security_config.xml` الاتصال السلس بخوادم ARN Stream على الشبكات المنزلية الخاصة (`192.168.0.0/16`, `10.0.0.0/8`, `172.16.0.0/12`).
   - دمج شهادة الجذر لـ ARN Technology (`ARN_Technology_Root.cer`) داخل مسار `res/raw/arn_root_cert.cer` لدعم اتصالات HTTPS الموثوقة ذاتياً دون إظهار أي تحذيرات أمنية أو اعتراضات من نظام أندرويد.
4. **البصمة الرقمية للجهاز في جلسات السيرفر (Device Session Identifier):**
   - يقوم التطبيق بتوليد معرف فريد غير مكرر للجهاز مبني على صيغة:
     `ARN-Android-{UUID}`
   - تسجيل اسم الهاتف وموديله الفعلي (مثل "هاتف عبده - Galaxy S24 Ultra") في كائن جلسات الـ Handoff والـ WebSocket لضمان التعرف السلس على الجهاز بين كافة شاشات المنزل.

---

## 🏗️ 3. المعمارية التقنية وحزم برمجيات أندرويد (Tech Stack)

تم اختيار أحدث التقنيات المعيارية من Google لضمان أعلى أداء واستقرار واستهلاك منخفض للبطارية:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│        Jetpack Compose + Material 3 + Jetpack Navigation    │
│            MVI / MVVM + Coroutines StateFlow                │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                           │
│           UseCases + Business Logic + Data Models           │
├─────────────────────────────────────────────────────────────┤
│                       Data Layer                            │
│  Retrofit 2 (REST)  │  OkHttp (WebSocket/SSE)  │ Room (Offline)
│  AndroidX Media3 (ExoPlayer)  │ WorkManager (Downloads)     │
└─────────────────────────────────────────────────────────────┘
```

- **اللغة:** Kotlin 2.0+
- **واجهة المستخدم:** Jetpack Compose + Compose Foundation + Material 3
- **معمارية الكود:** Clean Architecture + MVVM/MVI + Repository Pattern
- **إدارة الحالة غير المتزامنة:** Kotlin Coroutines & `StateFlow` / `SharedFlow`
- **حقن التبعيات (Dependency Injection):** Hilt (أو Koin)
- **الشبكة والاتصال:** 
  - `Retrofit 2` مع محول `Kotlinx.Serialization` أو `Moshi`
  - `OkHttp 4` للتعامل مع الـ Interceptors (إضافة الـ Bearer Token تلقائياً)، وإدارة الـ WebSocket وقنوات الـ SSE (Server-Sent Events)
- **مشغل الوسائط المتكامل:** `AndroidX Media3` (`media3-exoplayer`, `media3-ui`, `media3-session`, `media3-datasource-okhttp`)
- **قاعدة البيانات المحلية:** `Room Database` (لكاش الوسائط، سجل المشاهدة بدون إنترنت، والتنزيلات المحلية)
- **تخزين الإعدادات الخفيفة:** `Jetpack DataStore (Preferences)`
- **تحميل الصور:** `Coil 3` لـ Jetpack Compose (مع كاش في الذاكرة والقرص)
- **معالجة التنزيلات الطويلة في الخلفية:** `WorkManager` (مع Foreground Service وإشعارات التقدم القابلة للاستئناف)
- **مسح الباركود ورمز الـ QR:** Google Mobile Services Code Scanner (`play-services-code-scanner`) أو CameraX + ML Kit Barcode Scanning

---

## 📡 4. نظام الاكتشاف التلقائي والربط برمز QR

يتيح التطبيق للمستخدم الوصول السريع للخادم دون عناء كتابة عناوين الـ IP أو المنافذ يدويّاً من خلال طريقتين ذكيتين:

### 4.1 الطريقة الأولى: المسح الفوري لرمز QR (Instant QR Pairing)
في واجهة ARN Stream على الكمبيوتر، يقوم المستخدم بالنقر على أيقونة QR في الهيدر، فتظهر نافذة تحتوي على رمز QR بداخله رابط السيرفر المباشر على الشبكة المنزلية، مثال:
`http://192.168.1.15:8096`

#### سير عمل الماسح في تطبيق أندرويد:
1. يضغط المستخدم على زر "مسح رمز QR" في شاشة البداية.
2. تفتح الكاميرا باستخدام `GmsBarcodeScanner` (خفيف ولا يتطلب صلاحيات معقدة) أو شاشة Compose مع CameraX.
3. فور التقاط الرابط:
   - يتم التحقق من صحة الصيغة `http://{ip}:{port}` أو `https://...`.
   - يرسل التطبيق طلباً فورياً لاختبار الصحة: `GET /api/auth/status`.
   - إذا استجاب الخادم بحالة `200 OK`، يتم حفظ عنوان الخادم في DataStore والتحويل فوراً لشاشة تسجيل الدخول أو اختيار الملف الشخصي.

### 4.2 الطريقة الثانية: الاكتشاف التلقائي على الشبكة المحلية (Auto LAN Discovery)
يدعم خادم ARN Stream بروتوكول **SSDP / UPnP** (المشغل على المنفذ `1900 UDP`) مع هوية خادم محددة: `urn:schemas-upnp-org:device:MediaServer:1` و UUID: `37a911f6-d703-4f51-b844-934c9c10f81d`.

بالإضافة لذلك، يقوم التطبيق بمحرك اكتشاف مزدوج (Dual Discovery Engine):

#### 1. اكتشاف SSDP M-SEARCH (UPnP Multicast):
- إرسال حزمة UDP Multicast على العنوان `239.255.255.250:1900` تحتوي على:
```http
M-SEARCH * HTTP/1.1
HOST: 239.255.255.250:1900
MAN: "ssdp:discover"
MX: 3
ST: urn:schemas-upnp-org:device:MediaServer:1
```
- قراءة حزمة الرد واستخراج حقل `LOCATION:` (مثلاً `http://192.168.1.15:8096/dlna/device.xml`).
- استخلاص الـ IP والـ Port مباشرة.

#### 2. الاكتشاف الموازي السريع لفحص الشبكة (Subnet Fast Ping Scanner):
- استخراج الـ Subnet الحالي للهاتف (مثلاً `192.168.1.0/24`).
- إرسال طلبات متوازية فائقة السرعة (`Coroutine Dispatchers.IO` مع Timeout 500ms) على المنفذ الافتراضي `8096` للمسار `/api/auth/status`.
- فور عثور أي عنوان على إجابة تحتوي على `{"data": {"initialized": ...}}`، يتم إدراجه في قائمة الخوادم المكتشفة مع اسم الخادم والـ IP.

#### 3. كود Kotlin المرجعي لاكتشاف الخادم:
```kotlin
class ServerDiscoveryRepository @Inject constructor(
    private val okHttpClient: OkHttpClient,
    @ApplicationContext private val context: Context
) {
    suspend fun discoverServers(): Flow<DiscoveredServer> = channelFlow {
        // 1. تشغيل SSDP Listener
        launch(Dispatchers.IO) {
            discoverViaSsdp { server -> trySend(server) }
        }
        // 2. تشغيل فحص النطاق السريع Subnet Ping
        launch(Dispatchers.IO) {
            discoverViaSubnetScan { server -> trySend(server) }
        }
    }

    private suspend fun discoverViaSubnetScan(onFound: (DiscoveredServer) -> Unit) = coroutineScope {
        val wifiIp = getLocalWifiIpAddress() ?: return@coroutineScope
        val subnetPrefix = wifiIp.substringBeforeLast(".") + "."
        
        // فحص العناوين من 1 إلى 254
        (1..254).map { host ->
            async(Dispatchers.IO) {
                val testIp = "$subnetPrefix$host"
                val url = "http://$testIp:8096/api/auth/status"
                try {
                    val request = Request.Builder().url(url).build()
                    val response = okHttpClient.newCall(request).execute()
                    if (response.isSuccessful) {
                        onFound(DiscoveredServer(name = "ARN Stream ($testIp)", host = testIp, port = 8096, baseUrl = "http://$testIp:8096"))
                    }
                } catch (_: Exception) {}
            }
        }
    }
}
```

---

## 🔌 5. دليل الـ API Endpoints وهياكل البيانات

يحتوي الخادم على واجهات برمجية غنية ومنظمة. كافة الطلبات تعتمد بادئة `http://{serverIp}:{port}` وتستخدم الـ Headers القياسية:
- `Authorization: Bearer {token}` (للعمليات التي تتطلب تسجيل دخول).
- `Content-Type: application/json`

### 5.1 نظام المصادقة والمستخدمين (Authentication)

#### 1. حالة تهيئة الخادم (Check Server Status)
- **المسار:** `GET /api/auth/status`
- **التصريح:** اختياري (Optional Auth)
- **الاستجابة الناجحة:**
```json
{
  "data": {
    "initialized": true,
    "authenticated": false,
    "user": null,
    "hasLibraries": true
  }
}
```

#### 2. قائمة المستخدمين الظاهرين لشاشة الدخول (Public Profiles)
- **المسار:** `GET /api/auth/public-users`
- **الوظيفة:** عرض قائمة المستخدمين النشطين كبروفايلات لاختيار البروفايل وكتابة كلمة المرور (على غرار Netflix).
- **الاستجابة:**
```json
{
  "data": [
    {
      "id": 1,
      "username": "admin",
      "display_name": "عبده رجب نصار",
      "avatar": "/api/avatars/avatar_1_171234567.png"
    }
  ]
}
```

#### 3. تسجيل الدخول (Login)
- **المسار:** `POST /api/auth/login`
- **المدخلات (JSON Body):**
```json
{
  "username": "admin",
  "password": "your_password"
}
```
- **الاستجابة:**
```json
{
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsIn...",
    "user": {
      "id": 1,
      "username": "admin",
      "display_name": "عبده رجب نصار",
      "role": "admin",
      "allowed_libraries": null,
      "can_download": 1,
      "can_cast": 1,
      "avatar": "/api/avatars/avatar_1_171234567.png"
    }
  }
}
```

---

### 5.2 مكتبات الوسائط (Libraries Management)

#### 1. جلب كافة المكتبات
- **المسار:** `GET /api/libraries`
- **المعلمات:** `?non_empty=true` (لإخفاء المكتبات الفارغة)
- **الاستجابة:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "أفلام عربية وأجنبية",
      "type": "movies",
      "icon": "film",
      "custom_covers": "{\"cover1\":\"/api/image/...\"}",
      "movies_count": 450,
      "shows_count": 0,
      "tracks_count": 0
    },
    {
      "id": 2,
      "name": "مسلسلات",
      "type": "shows",
      "icon": "tv",
      "movies_count": 0,
      "shows_count": 85,
      "tracks_count": 0
    },
    {
      "id": 3,
      "name": "القرآن الكريم",
      "type": "music",
      "icon": "book-open",
      "movies_count": 0,
      "shows_count": 0,
      "tracks_count": 114
    }
  ]
}
```

#### 2. جلب محتوى مكتبة محددة
- **المسار:** `GET /api/libraries/:id`
- **المعلمات:** `?sort=added_at&order=desc&q=&limit=50&offset=0`
- **خيارات الترتيب (sort):** `added_at` | `year` | `title` | `rating`

---

### 5.3 الأفلام (Movies)

#### 1. قائمة الأفلام مع الفرز والفلترة
- **المسار:** `GET /api/movies`
- **المعلمات:** `?q=&year=&library_id=&sort=added_at&order=DESC&limit=50&offset=0&tags=`
- **الاستجابة:**
```json
{
  "data": [
    {
      "id": 12,
      "title": "الجزيرة",
      "year": 2007,
      "plot": "قصة حقيقية تدور حول تاجر مخدرات في الصعيد...",
      "duration": 7800,
      "resolution": "1080p",
      "video_codec": "h264",
      "audio_codec": "aac",
      "poster": "/api/image/45/thumb",
      "backdrop": "/api/image/46/full",
      "rating": 8.4,
      "tags": [{"id": 1, "name": "أكشن", "color": "#ef4444"}]
    }
  ],
  "meta": { "total": 1, "limit": 50, "offset": 0 }
}
```

#### 2. تفاصيل فيلم محدد
- **المسار:** `GET /api/movies/:id`
- **الاستجابة:** كائن الفيلم مدمج معه روابط البوسترات والخلفيات المتعددة `posters` و `backdrops` وتقييم العمل ومعلومات الدقة والمدة الزمنية.

---

### 5.4 المسلسلات والمواسم والحلقات (Series & Episodes)

#### 1. قائمة المسلسلات
- **المسار:** `GET /api/series?q=&library_id=&sort=added_at&order=DESC&limit=50&offset=0`
- **عناصر الاستجابة:** تشمل `id`, `title`, `year`, `plot`, `poster`, `backdrop`, `seasons_count`, `episodes_count`.

#### 2. تفاصيل المسلسل وقائمة مواسمه
- **المسار:** `GET /api/series/:id`
- **الاستجابة:** تحتوي على بيانات المسلسل بالإضافة إلى مصفوفة المواسم `seasons`:
```json
{
  "data": {
    "id": 5,
    "title": "الكبير أوي",
    "year": 2010,
    "plot": "عمدة المزاريطة يكتشف أن لديه إخوة توأم...",
    "poster": "/api/image/102/thumb",
    "backdrop": "/api/image/103/full",
    "seasons": [
      {
        "id": 10,
        "season_number": 1,
        "title": "الموسم الأول",
        "episodes_count": 15
      }
    ]
  }
}
```

#### 3. حلقات موسم محدد
- **المسار:** `GET /api/series/:id/season/:seasonNumber`
- **الاستجابة:** قائمة كائنات الحلقات (`episodes`) متضمنة `id`, `episode_number`, `title`, `duration`, `resolution`, `path`.

---

### 5.5 الصوتيات والقرآن الكريم (Artists, Albums & Tracks)

#### 1. قائمة القراء / الفنانين
- **المسار:** `GET /api/artists?q=&library_id=&sort=name&order=asc&limit=100`
- **الاستجابة:** `id`, `name`, `image`, `albumsCount`, `tracksCount`, `year`.

#### 2. ألبومات فنان / أجزاء المصحف لقارئ
- **المسار:** `GET /api/artists/:id/albums`
- **الاستجابة:** قائمة الألبومات مع أغلفة الصور `cover` وسنة الإصدار وعدد المقاطع.

#### 3. تفاصيل الألبوم والتراكات
- **المسار:** `GET /api/albums/:id`
- **الاستجابة:** بيانات الألبوم مع مصفوفة `tracks` متضمنة `id`, `title`, `track_number`, `duration`, `bit_rate`, `format`.

---

### 5.6 البث الحي والتلفزيون المباشر (Live TV)
- **جلب كود تفعيل البث (Drama Live FG Code):** `GET /api/live/code`
- **مشغل البث المباشر (Proxy Player Web):** `GET /api/live/player?code={fgCode}`
  - *تطبيق أندرويد:* يمكنه فتح هذا الرابط مباشرة داخل Compose `AndroidView(WebView)` مع دعم كامل للشاشات العريضة وتدوير الشاشة التلقائي لملء الشاشة مع تسريع عتادي (Hardware Acceleration).

---

### 5.7 التدفق الحي للبث ومعلومات الفيديو (Streaming & Subtitles)

#### 1. معلومات دفق الوسائط والترجمات والمسارات الصوتية
- **المسار:** `GET /api/stream/info/:type/:id`
- **الأنواع:** `type` = `movie` أو `episode`
- **الاستجابة:**
```json
{
  "success": true,
  "data": {
    "strategy": {
      "mode": "direct", // direct أو remux أو transcode
      "videoCodec": "h264",
      "audioCodec": "aac",
      "duration": 7200
    },
    "audioTracks": [
      { "id": 0, "title": "اللغة العربية (الأصلية)", "language": "ara", "codec": "aac" },
      { "id": 1, "title": "English Commentary", "language": "eng", "codec": "ac3" }
    ],
    "subtitles": [
      { "id": "sub_0", "title": "ترجمة عربية احترافية", "language": "ar", "format": "srt", "isLocal": true },
      { "id": "sub_1", "title": "English Subtitles", "language": "en", "format": "vtt", "isLocal": false }
    ]
  }
}
```

#### 2. روابط تشغيل الفيديو والصوت
- **فيلم:** `GET /api/stream/movie/:id` (يدعم HTTP 206 Byte-Range Seek)
- **حلقة:** `GET /api/stream/episode/:id`
- **صوت / تراك:** `GET /api/stream/track/:id`
- **التقديم مع إعادة الترميز (إذا طلب العميل):** `GET /api/stream/movie/:id?start=120&mode=transcode`

#### 3. جلب ملف الترجمة
- **المسار:** `GET /api/subtitles/serve?path={encodedLocalPath}`
- يتم إرجاع المحتوى كـ `text/vtt` متوافق مباشرة مع مشغل ExoPlayer.

---

### 5.8 استئناف المشاهدة وحفظ التقدم (Playback State)
- **حفظ نقطة التوقف الحالية:** `POST /api/playback`
```json
{
  "media_type": "movie", // أو episode أو track
  "media_id": 12,
  "position": 1420, // بالثواني
  "duration": 7200
}
```
- **جلب قائمة "مواصلة المشاهدة" (Continue Watching):**
  - **المسار:** `GET /api/playback/continue?limit=10`
  - ترجع الأعمال غير المكتملة مع مدة المشاهدة والنسبة المئوية لعرض شريط تقدم أحمر على البوستر.

---

### 5.9 البحث الذكي التنبؤي المطبع (Predictive Search)
- **المسار:** `GET /api/search?q={query}&type=all&limit=25`
- **ميزة الخادم:** تطبيع تلقائي للغة العربية (تجاهل أشكال الألف `أ, إ, آ, ا`، الياء `ي, ى`، التاء المربوطة `ة, ه`، وحذف ال التعريف تلقائياً).
- **النتائج:** قائمة مدمجة من الأفلام، المسلسلات، والتراكات مرتبة حسب الصلة (`rank`) مع بوسترات مصغرة.

---

## 🎬 6. مشغل الوسائط المتطور (ExoPlayer & Media3)

يجب بناء مشغل الفيديو في أندرويد باستخدام **AndroidX Media3 ExoPlayer**، مع المميزات التالية:

### 5.1 استراتيجيات التشغيل (Playback Strategies)
1. **Direct Play (التشغيل المباشر الفائق):**
   - صيغ MP4, MKV, WebM المشفرة بـ H.264 / H.265 / AV1 وصوت AAC / AC3 / MP3.
   - استخدام `OkHttpDataSource.Factory` لتمكين الـ Caching والـ Range Requests.
2. **Remux / Transcoding Playback:**
   - في حال كانت الحاوية غير مدعومة أو تم طلب جودة منخفضة لتوفير البيانات، يتم تمرير رابط السيرفر المتضمن `mode=transcode`.
3. **التحكم بالترجمات والدبلجة:**
   - استدعاء `/api/stream/info/:type/:id` وتمرير الترجمات عبر `MediaItem.SubtitleConfiguration`:
   ```kotlin
   val subtitleConfig = MediaItem.SubtitleConfiguration.Builder(subtitleUri)
       .setMimeType(MimeTypes.TEXT_VTT)
       .setLanguage("ar")
       .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
       .build()
   val mediaItem = MediaItem.Builder()
       .setUri(streamUrl)
       .setSubtitleConfigurations(listOf(subtitleConfig))
       .build()
   ```

### 5.2 ميزات واجهة المشغل (Player Controls UI in Compose):
- **شاشة المشاهدة السينمائية الكاملة (Immersive Fullscreen):** إخفاء أشرطة النظام (System Bars) والتحكم عبر الإيماءات (Gestures):
  - السحب للأعلى والأسفل يميناً: رفع وخفض الصوت.
  - السحب للأعلى والأسفل يساراً: تعديل سطوع الشاشة (Brightness).
  - النقر المزدوج يميناً أو يساراً: تقديم وتأخير 10 ثوانٍ مع أنيميشن دائري أنيق.
- **زر قفل الشاشة (Touch Lock):** لمنع اللمسات العرضية أثناء المشاهدة.
- **زر أبعاد الشاشة (Aspect Ratio Fill / Fit):** للتبديل بين العرض الأصلي، وملاءمة الشاشة، والقص لملء الشاشة بالكامل (Pinch-to-zoom).
- **قائمة اختيار الترجمة والصوت:** نافذة سفلية زجاجية (Glassmorphic BottomSheet) لاختيار الصوت والترجمة وحجم الخط.
- **زر نقل البث (PlayTo Button):** لبث الفيلم للشاشات التلفزيونية في المنزل أو الأجهزة الأخرى مباشرة.
- **دعم صورة داخل صورة (Picture-in-Picture - PiP):** استمرار المشاهدة في نافذة عائمة عند الخروج من التطبيق.
- **الحفظ التلقائي لنقطة المشاهدة:** مؤقت زمني يرسل كل 10 ثوانٍ تحديثاً لمسار `/api/playback`.

---

## 🎧 7. نظام التشغيل في الخلفية ومستمع الصوتيات (Background Audio & MediaSession)

لتشغيل القرآن الكريم والموسيقى يجب بناء **MediaSessionService**:

### 7.1 المكونات المعمارية:
1. **`PlaybackService : MediaSessionService`**:
   - يعمل كخدمة تعمل في الخلفية (Foreground Service).
   - يعرض إشعار وسائط نظام أندرويد المعياري (Media Notification) مع البوستر، زر التشغيل والإيقاف المؤقت، التقديم، والتأخير.
   - يدعم أزرار التحكم من سماعات الرأس وسماعات البلوتوث وشاشة القفل و Android Auto.
2. **المشغل المصغر الدائم (Floating Mini Player):**
   - كبسولة زجاجية عائمة فوق شريط التنقل السفلي في كافة شاشات التطبيق تعرض اسم السورة/التراك، القارئ/الفنان، وزر Play/Pause، والتقدم.
   - النقر على الكبسولة يفتح شاشة المشغل الكاملة (Expanded Player) بحركة انسيابية فائقة الجودة.
3. **المشغل الموسيقي الممتد (Expanded Full Audio Screen):**
   - خلفية ضبابية ديناميكية مستخرجة من ألوان بوستر الألبوم عبر مكتبة `Palette`.
   - شريط تقدم زمني سلس (Seekbar) مع إمكانية التقديم والتأخير.
   - أزرار التكرار (Repeat One / All) والتشغيل العشوائي (Shuffle).
   - عرض قائمة الانتظار الحالية (Playback Queue) مع إمكانية إعادة الترتيب بالسحب والإفلات.

---

## 📲 8. نظام الريموت كنترول الذكي والبث للأجهزة (PlayTo / Remote Control)

يحتوي الخادم على محرك تحكم فوري لحظي (< 5ms Latency) يعتمد على **WebSocket** و **SSE** في المسار:
`/ws/handoff?deviceId={deviceId}` و `/api/handoff/*`.

### 8.1 دور تطبيق أندرويد:
1. **التطبيق كـ جهاز تحكم (Remote Controller):**
   - يكتشف الأجهزة والشاشات المتصلة من خلال `GET /api/handoff/devices`.
   - يتيح نقل الفيلم الذي تشاهده على الهاتف حالياً إلى الشاشة الكبيرة بنقرة زر واحدة عبر `POST /api/handoff/transfer`.
   - يفتح واجهة **الريموت كنترول الفاخرة (Luxury Remote UI)**:
     - أزرار تنقل تفاعلية (D-Pad: Up, Down, Left, Right, Enter / Select).
     - أزرار التحكم بالوسائط: Play, Pause, Seek (+10s, -10s), Volume Slider, Mute.
     - كيبورد افتراضي (Virtual Keyboard): الكتابة من كيبورد الهاتف لترسل الحروف فورا للتلفاز للبحث السريع.
     - اختيار الترجمة والصوت للتلفاز من شاشة الهاتف.
2. **التطبيق كـ جهاز استقبال (Playback Target):**
   - تسجيل الهاتف كجلسة في السيرفر عبر `POST /api/handoff/register`.
   - الاستماع لقناة WebSocket `/ws/handoff`، وعند استقبال أمر `handoff` يقوم التطبيق بفتح الفيلم ومواصلة المشاهدة فوراً بنفس الثانية الزمنية!

### 8.2 بروتوكول أوامر الريموت كنترول (`POST /api/handoff/command`):
```json
{
  "targetDeviceId": "living-room-tv",
  "fromDeviceId": "my-android-phone",
  "command": "seek_delta", // أو "play", "pause", "volume", "mute", "speed", "dpad", "send_string"
  "value": 10
}
```

---

## 💾 9. نظام التنزيل والمشاهدة دون إنترنت (Offline Download Engine)

يتيح الخادم تنزيل الملفات الأصلية عبر مسارات `/api/download/*`.

### 9.1 معمارية التنزيل في أندرويد:
- استخدام **`WorkManager`** مع `CoroutineWorker` لضمان استمرار التحميل حتى لو تم إغلاق التطبيق أو إعادة تشغيل الهاتف.
- استخدام مسار التخزين المخصص المعزول (`context.getExternalFilesDir(Environment.DIRECTORY_MOVIES)`).
- حفظ ميتاداتا العناصر المنزلة (العنوان، البوستر المحلي، مسار الملف على القرص، المدة) في جدول **Room Database** محلي (`offline_media`).
- دعم استئناف التحميل (Resume Partial Downloads) عبر ترويسة `Range: bytes={existingBytes}-`.
- عرض شاشة مخصصة بالتطبيق: **"الوسائط المنزلة" (Downloads Tab)** تتيح تشغيل المحتوى دون الحاجة للاتصال بالخادم نهائياً.

---

## 🖼️ 10. شاشات وواجهات المستخدم ومكونات Compose الرسمية (UI/UX Specifications)

يتم بناء التطبيق بالشاشات التالية المتطابقة مع فخامة ARN Stream:

### 1. شاشة الاتصال بالخادم (Server Connection Screen):
- ترحيب بهوية ARN Technology وشعار ARN Stream ثلاثي الأبعاد المتوهج.
- زر كبير بارز: **"مسح رمز QR" (Scan QR Code)**.
- بطاقات الخوادم المكتشفة تلقائياً عبر الشبكة مع نبض أخضر مباشر (`Server Found on LAN`).
- خيار الإدخال اليدوي للعنوان (`http://192.168.1.100:8096`).

### 2. شاشة اختيار الحساب والدخول (Profile Selection & Login Screen):
- عرض بطاقات المستخدمين بشكل أفقي جذاب مع الأفاتار الخاص بكل مستخدم.
- النقر على المستخدم يفتح مربع إدخال كلمة المرور (Glassmorphic Dialog) مع حقل كلمة مرور متوهج، وزر "دخول".

### 3. الشاشة الرئيسية (Home Screen):
- **الهيدر العائم (Floating Capsule Header):** شعار المنصة، زر البحث السريع، زر البث (Cast/PlayTo)، والأفاتار.
- **شريط المكتبات السريع (Quick Library Tabs):** كبسولات أفقية ملونة لكل مكتبة (أفلام، مسلسلات، موسيقى، قرآن، بث حي).
- **البانر البطولي الدوار (Hero Featured Carousel):** استعراض لأحدث وأبرز الأفلام والمسلسلات مع ملخص وزر "مشاهدة الآن" وزر "المعلومات".
- **قسم "مواصلة المشاهدة" (Continue Watching):** بطاقات للمحتوى غير المكتمل مع شريط التقدم وزر تشغيل فوري.
- **أقسام أفقية غنية:** "أضيف حديثاً"، "أعلى التقييمات"، "أفلام مقترحة لك".

### 4. شاشات المكتبات التفصيلية (Library Browser Screen):
- تبديل ثيم وألوان الشاشة ديناميكياً حسب نوع المكتبة النشطة (أحمر للأفلام، ذهبي للمسلسلات، إلخ).
- شبكة عرض مرنة (Grid 2 أو 3 أعمدة) مع بوسترات عالية الجودة.
- خيارات التصفية والفرز (حسب السنة، التقييم، تاريخ الإضافة، الأبجدية).

### 5. شاشة تفاصيل العمل (Media Details Screen):
- خلفية علوية ضخمة من الـ Backdrop مع تدرج داكن نحو الأسفل.
- البوستر الرسمي، العنوان، سنة الإنتاج، التقييم بالنجوم، الدقة (4K / 1080p)، والتصنيفات (Tags).
- أزرار الإجراءات الرئيسية:
  - زر كبير: **"تشغيل" (Play)** باللون المميز للمكتبة.
  - زر **"تنزيل" (Download)** للمشاهدة بدون إنترنت مع مؤشر نسبة التنزيل.
  - زر **"بث للشاشة" (PlayTo / Cast)** لاختيار شاشة منزلية.
- في حالة المسلسلات: قائمة أفقية للمواسم وقائمة عمودية للحلقات مع وصف ومدة كل حلقة.

### 6. شاشة مشغل الفيديو المتقدم (ExoPlayer Fullscreen Screen):
- كما هو مفصل في القسم السادس.

### 7. شاشة مشغل الصوتيات والقرآن الكريم (Audio & Quran Player):
- كما هو مفصل في القسم السابع.

### 8. شاشة الريموت كنترول التفاعلي (PlayTo Smart Remote Control Screen):
- كما هو مفصل في القسم الثامن.

### 9. شاشة البث التلفزيوني المباشر (Live TV Screen):
- استعراض قنوات الدراما والمباريات الرياضية في بيئة مهيأة بدون إعلانات مزعجة.

### 10. نافذة "حول البرنامج" (About ARN Stream Dialog):
- مفصلة برمجياً وكودياً في القسم 2 عبر المكون المرجعي `ArnAboutDialog.kt`.

---

## 📂 11. هيكلية حزم وملفات المشروع (Android Project Structure)

```
app/src/main/java/com/arntechnology/stream/
├── ArnStreamApp.kt                      # تطبيق Hilt الأساسي
├── data/
│   ├── api/
│   │   ├── ArnApiService.kt             # واجهة Retrofit لجميع مسارات الخادم
│   │   ├── AuthInterceptor.kt           # حقن التوكن تلقائياً
│   │   └── NetworkModule.kt             # إعدادات OkHttp و Retrofit
│   ├── discovery/
│   │   ├── ServerDiscoveryRepository.kt # محرك SSDP و Subnet Scanner
│   │   └── QrCodeScannerHelper.kt       # ماسح Google Code Scanner
│   ├── local/
│   │   ├── AppDatabase.kt               # قاعدة بيانات Room
│   │   ├── dao/                         # واجهات DAO للوسائط المنزلة
│   │   └── entities/                    # جداول OfflineMediaEntity
│   ├── handoff/
│   │   ├── HandoffWebSocketClient.kt    # اتصال الـ WebSocket فائق السرعة
│   │   └── HandoffRepository.kt         # إرسال أوامر الريموت كنترول
│   └── repository/
│       ├── AuthRepository.kt
│       ├── MediaRepository.kt
│       ├── PlaybackRepository.kt
│       └── DownloadRepository.kt
├── domain/
│   ├── model/                          # كائنات البيانات النقية (Movie, Series, Track, etc.)
│   └── usecase/                        # منطق الأعمال المتخصص
├── playback/
│   ├── service/
│   │   └── ArnPlaybackService.kt        # MediaSessionService للتشغيل في الخلفية
│   └── player/
│       ├── ExoPlayerManager.kt          # مدير مشغل الفيديو والترجمات
│       └── AudioPlayerManager.kt        # مدير مشغل الصوتيات
├── worker/
│   └── MediaDownloadWorker.kt           # تنزيل الملفات في الخلفية مع استئناف التحميل
└── ui/
    ├── theme/
    │   ├── Color.kt                     # ألوان ARN Dark Glassmorphism
    │   ├── Theme.kt                     # سمة Compose الداكنة
    │   └── Type.kt                      # الخطوط العربية والإنجليزية
    ├── navigation/
    │   ├── NavGraph.kt                  # توجيه الشاشات
    │   └── Screen.kt                    # تعريف الشاشات والـ Routes
    ├── components/                      # المكونات الزجاجية المشتركة
    │   ├── GlassCard.kt
    │   ├── DynamicHeaderCapsule.kt
    │   ├── MediaPosterCard.kt
    │   ├── MiniPlayerCapsule.kt
    │   └── ArnAboutDialog.kt            # نافذة حول البرنامج الرسمية
    └── screens/
        ├── splash/SplashScreen.kt       # شاشة البداية بهوية ARN الرسمية
        ├── connect/ConnectScreen.kt
        ├── login/ProfileLoginScreen.kt
        ├── home/HomeScreen.kt
        ├── library/LibraryBrowserScreen.kt
        ├── details/MediaDetailsScreen.kt
        ├── player/VideoPlayerScreen.kt
        ├── audio/AudioPlayerScreen.kt
        ├── remote/RemoteControlScreen.kt
        ├── live/LiveTvScreen.kt
        └── downloads/DownloadsScreen.kt
```

---

## 📦 12. ملفات الإعدادات والتبعيات والتوقيع الرقمي

### 12.1 إعدادات `app/build.gradle.kts` مع التوقيع الرقمي لـ ARN Technology
```kotlin
import java.io.FileInputStream
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt.android)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.arntechnology.stream"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.arntechnology.stream"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    // إعدادات التوقيع الرقمي الرسمي لـ ARN Technology
    signingConfigs {
        create("release") {
            // يتم تخزين بيانات الشهادة في gradle.properties أو متغيرات البيئة
            storeFile = file(project.findProperty("ARN_KEYSTORE_PATH") ?: "arn_technology_release.jks")
            storePassword = project.findProperty("ARN_KEYSTORE_PASSWORD")?.toString() ?: "arn_stream_2026"
            keyAlias = project.findProperty("ARN_KEY_ALIAS")?.toString() ?: "arn_technology"
            keyPassword = project.findProperty("ARN_KEY_PASSWORD")?.toString() ?: "arn_stream_2026"

            // تفعيل كافة مخططات التوقيع الرسمية
            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
            enableV4Signing = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }

    buildFeatures {
        compose = true
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    // Jetpack Compose & Material 3
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.ui)
    implementation(libs.androidx.ui.graphics)
    implementation(libs.androidx.ui.tooling.preview)
    implementation(libs.androidx.material3)
    implementation(libs.androidx.material.icons.extended)
    implementation(libs.androidx.navigation.compose)

    // AndroidX Lifecycle & Activity
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)

    // AndroidX Media3 (ExoPlayer)
    val media3Version = "1.5.1"
    implementation("androidx.media3:media3-exoplayer:$media3Version")
    implementation("androidx.media3:media3-ui:$media3Version")
    implementation("androidx.media3:media3-session:$media3Version")
    implementation("androidx.media3:media3-datasource-okhttp:$media3Version")
    implementation("androidx.media3:media3-extractor:$media3Version")

    // Networking (Retrofit & OkHttp)
    val retrofitVersion = "2.11.0"
    implementation("com.squareup.retrofit2:retrofit:$retrofitVersion")
    implementation("com.squareup.retrofit2:converter-kotlinx-serialization:$retrofitVersion")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")

    // Room Database
    val roomVersion = "2.6.1"
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // DataStore Preferences
    implementation("androidx.datastore:datastore-preferences:1.1.2")

    // Dependency Injection (Hilt)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation("androidx.hilt:hilt-navigation-compose:1.2.0")
    implementation("androidx.hilt:hilt-work:1.2.0")

    // Image Loading (Coil)
    implementation("io.coil-kt.coil3:coil-compose:3.0.4")
    implementation("io.coil-kt.coil3:coil-network-okhttp:3.0.4")

    // Background Downloads (WorkManager)
    implementation("androidx.work:work-runtime-ktx:2.10.0")

    // QR Code Scanning (Google Play Services Code Scanner)
    implementation("com.google.android.gms:play-services-code-scanner:16.1.0")
}
```

### 12.2 ملف تكوين أمان الشبكة `app/src/main/res/xml/network_security_config.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- السماح بحركة مرور HTTP المحلية (Cleartext) للشبكات المنزلية والـ Localhost -->
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
            <!-- شهادة Root لـ ARN Technology الموثقة ذاتياً -->
            <certificates src="@raw/arn_root_cert" />
        </trust-anchors>
    </base-config>

    <!-- تخصيص لنطاقات الشبكات الخاصة المنزلية -->
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="true">localhost</domain>
        <domain includeSubdomains="true">127.0.0.1</domain>
        <domain includeSubdomains="true">192.168.1.1</domain>
    </domain-config>
</network-security-config>
```

### 12.3 إعدادات `AndroidManifest.xml`
```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- الأذونات الشبكية والوسائط -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
    
    <!-- تشغيل الوسائط في الخلفية والتنزيلات -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:name=".ArnStreamApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="ARN Stream"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.ArnStream"
        android:networkSecurityConfig="@xml/network_security_config"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|uiMode"
            android:supportsPictureInPicture="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- خدمة تشغيل الصوتيات والقرآن في الخلفية -->
        <service
            android:name=".playback.service.ArnPlaybackService"
            android:exported="false"
            android:foregroundServiceType="mediaPlayback">
            <intent-filter>
                <action android:name="androidx.media3.session.MediaSessionService" />
            </intent-filter>
        </service>

    </application>
</manifest>
```

---

## 🤖 13. تعليمات موجهة لـ AI Studio لبناء المشروع بالكامل

عند تغذية هذا الملف لـ **Google AI Studio** أو أي مساعد برمجي ذكي، يمكنك توجيهه بالصيغة التالية:

> **أمر التنفيذ البرمجي:**  
> "بناءً على وثيقة البناء الشاملة أعلاه لمنصة **ARN Stream**، قم بإنشاء تطبيق أندرويد متكامل بلغة **Kotlin** وبواجهات **Jetpack Compose** الحديثة.  
> 1. التزم بالهوية البصرية والرقمية المحددة في القسم الثاني: اسم الشركة (ARN Technology)، وتطوير وبرمجة (عبده رجب نصار)، وأزرار التواصل الاجتماعي الدائرية، والشعار ثلاثي الأبعاد، والتوقيع الرقمي للحزمة.  
> 2. ابنِ كائنات الـ Models، ومحرك اكتشاف الخادم المزدوج (SSDP Multicast و Subnet Scanner)، ومساعد مسح رمز الـ QR عبر Google Play Services Code Scanner.  
> 3. قم ببناء طبقة الشبكة `Retrofit` و `OkHttp` مع `AuthInterceptor` وخدمة الـ WebSocket للتواصل اللحظي للريموت كنترول.  
> 4. قم ببناء مشغل الوسائط `AndroidX Media3 ExoPlayer` مع دعم الترجمات والدبلجة وواجهة تحكم سينمائية زجاجية باللمس والإيماءات، وخدمة التشغيل في الخلفية `ArnPlaybackService`.  
> 5. ابنِ واجهات المستخدم بكامل فخامة التصميم الزجاجي الداكن الداعم للغة العربية (RTL) مع مصفوفة الألوان المحددة لكل مكتبة، وشاشة الريموت كنترول التفاعلية، وشاشة التنزيلات بدون إنترنت.  
> 6. حافظ على حقوق الملكية الفكرية: حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة."

---
*تم إعداد هذا التوثيق المعماري الفائق ليكون المرجع الشامل والنهائي لتوليد وتطوير تطبيق أندرويد لمنصة ARN Stream.*

