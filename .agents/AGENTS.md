# تعليمات التعامل مع مساحة العمل الخاصة بشركة ARN Technology (المطور: عبده رجب نصار)

## معلومات عامة عن المطور والشركة:
- **اسم الشركة:** ARN Technology وتطوير وبرمجة عبده رجب نصار.
- **الهوية:** الشركة تهتم بالتصميم الأنيق (الداكن والشفاف/الزجاجي Dark Glassmorphism) مع التركيز العالي على تجربة المستخدم (UI/UX) وجمالية الألوان.
- **المكدس الأساسي المعتمد لواجهات سطح المكتب:** Electron.js (مع HTML5 / Modern Vanilla CSS3 Glassmorphism / JavaScript / Node.js) هو المعيار الأساسي والرسمي لبناء واجهات مشاريع ARN Technology القادمة وتحويل وتحديث المشاريع الحالية، مع دعم وصيانة مشاريع Python/PyQt6 السابقة.
- **اللغة المفضلة للتواصل والأكواد:** اللغة العربية في التعليقات ورسائل واجهة المستخدم افتراضياً (RTL)، بينما الأكواد البرمجية تتبع معايير التسمية الإنجليزية النظيفة مع توفير إمكانية التبديل للغة الإنجليزية في الواجهة.

## تفاصيل التواصل الاجتماعي (للاستخدام في نوافذ "حول البرنامج" وغيرها):
- **WhatsApp:** +201556710314 (Link: https://wa.me/201556710314)
- **Telegram:** ABDOURNASSAR95 (Link: https://t.me/ABDOURNASSAR95)
- **Facebook:** abdouragab.nassar (Link: https://www.facebook.com/abdouragab.nassar)
- **Messenger:** abdouragab.nassar (Link: https://m.me/abdouragab.nassar)

## القواعد النمطية والبرمجية المتبعة في مشاريع ARN:
1. **أزرار التواصل الاجتماعي:**
   - يجب أن تكون دائرية (`border-radius: 25px`).
   - تعتمد على أيقونات محفوظة محلياً في مجلد `assets/icons/`.
   - خلفية شفافة وتتغير إلى لون داكن مميز (`#1e293b`) عند التمرير (Hover).
   - يتم فتح الروابط باستخدام `QDesktopServices.openUrl(QUrl("..."))`.

2. **نافذة "حول البرنامج" (About Dialog):**
   - تصميم منبثق `QDialog`، خلفية داكنة (`#0f172a`).
   - نص حقوق الملكية: "حقوق النشر (c) 2026 لشركة ARN Technology. جميع الحقوق محفوظة."
   - اسم المبرمج: "تطوير وبرمجة: عبده رجب نصار" بلون أخضر مميز (`#10b981`).
   - يتم تخصيص عنوان النافذة حسب اسم كل مشروع (مثلاً: `ARN - Shutdown Panel`، `ARN - WinOptiClean`).

3. **حقوق الملكية في المجلدات:**
   - يضاف ملف `LICENSE` في المجلد الرئيسي لكل مشروع لضمان حقوق ARN Technology ومنع النسخ والتعديل.

4. **الأيقونات والهوية البصرية:**
   - كل مجلد مشروع له أيقونة ثلاثية الأبعاد (3D) مخصصة بصيغة `.ico` تعبر عن طبيعة عمله، ويتم تطبيقها عبر ملف `desktop.ini`.
   - استخدام الوضع الداكن هو الأساس (ألوان زرقاء، رمادية داكنة، ولمسات إضاءة خفيفة).

5. **إدارة مسارات الموارد والتعامل مع PyInstaller (`_internal` & Arabic Paths):**
   - في دالة `get_resource_path`، يجب دائماً استبدال الشَرَط المائلة العادية بالشرط الأمامية باستخدام `.replace('\\', '/')` لتجنب فشل قراءة محرك `Qt` للملفات على Windows عند وجود أحرف عربية أو فراغات في مسار المجلد.
   - عند استدعاء الأيقونات من مجلد `assets` في واجهة PyQt6 (مثل اللوجو وأيقونات السوشيال ميديا)، يفضّل دائماً تحميلها أولاً عبر `QPixmap(get_resource_path(...))` أو تغليفها بـ `QIcon(QPixmap(...))` لضمان فك الترميز وقراءة صور PNG بدقة في التجميع النهائي داخل مجلد `_internal/`.
   - في حزمة Inno Setup (`.iss`)، يجب إدراج `WorkingDir: "{app}"` لكافة العناصر في قسمي `[Icons]` و `[Run]`، وضبط رابط الأيقونة للاختصارات ليكون `{app}\_internal\assets\icon.ico` أو `{app}\{#MyAppExeName}` مباشرة.

6. **نظام النسخة الواحدة (Single Instance Application / System Tray):**
   - التطبيقات التي يتم تصغيرها لصندوق الإشعارات (System Tray) يجب أن تحتوي على آلية منع التكرار باستخدام `QLocalServer` و `QLocalSocket` من مكتبة `PyQt6.QtNetwork`.
   - يتم محاورة السيرفر المحلي باسم مخصص (مثل `ARN_ProjectName_SingleInstance_Server`)؛ عند اكتشاف نسخة عاملة مسبقاً، ترسل النسخة الجديدة إشعار `WAKEUP` لإظهار النافذة الحالية على سطح المكتب ثم تغلق النسخة الجديدة نفسها صمتاً وبدون أي مضاعفات.
   - يجب تضمين `'PyQt6.QtNetwork'` في قائمة `hiddenimports` في ملف PyInstaller `.spec`.

7. **التوقيع الرقمي المعتمد، الطابع الزمني RFC-3161، وتخطي حماية Smart App Control:**
   - **شهادة ARN Technology:** يجب دائماً استخدام شهادة التوقيع الرقمي لـ ARN Technology (الموجودة في `e:\مشاريعي\ARN_Cert` أو مخزن `Cert:\CurrentUser\My`) وختم كافة الملفات التنفيذية والحزم بها.
   - **إلزامية الطابع الزمني (RFC-3161 Timestamping):** لتفادي حظر **Windows 11 Smart App Control** و SmartScreen، **يُمنع منعاً باتاً** التوقيع بدون خادم طابع زمني معتمد بخوارزمية SHA256 (`-HashAlgorithm SHA256`). يجب استخدام خادم DigiCert كخيار أول مع بدائل موثوقة:
     - `http://timestamp.digicert.com`
     - `http://timestamp.sectigo.com`
     - `http://tsa.starfieldtech.com`
     ويجب التحقق برمجياً من أن حقل `TimeStamperCertificate` غير فارغ بعد التوقيع.
   - **إزالة قيود علامة الويب (Unblock-File):** بعد الانتهاء من التجميع وتوقيع الحزمة، يجب على سكريبت البناء تشغيل `Unblock-File` على ملف التثبيت المولد في كافة مسارات التوزيع (`dist\setup`، ومجلد `E:\`، و `E:\اصداراتي`) لإزالة تدفق `Zone.Identifier`.
   - **مزامنة الشهادة وتوثيقها محلياً:** في سكريبت التجميع `build_and_sign.ps1`، يتم دائماً تصدير الشهادة إلى `.\cert\ARN_Technology_Root.cer` وزرعها في مخزني `Root` و `TrustedPublisher` لحساب `CurrentUser`.
   - **زرع الشهادة للعميل النهائي عبر Inno Setup:** في قسم `[Run]` لملف `.iss`، يجب إدراج أوامر التوثيق الصامتة التالية قبل تشغيل التطبيق:
     ```ini
     Filename: "certutil.exe"; Parameters: "-addstore -f ""Root"" ""{app}\cert\ARN_Technology_Root.cer"""; StatusMsg: "جاري توثيق شهادة أمان ARN Technology..."; Flags: runhidden waituntilterminated
     Filename: "certutil.exe"; Parameters: "-addstore -f ""TrustedPublisher"" ""{app}\cert\ARN_Technology_Root.cer"""; StatusMsg: "جاري توثيق ناشر التطبيق في قائمة الناشرين الموثوقين..."; Flags: runhidden waituntilterminated
     Filename: "{app}\{#MyAppExeName}"; Description: "{cm:RunProgram}"; WorkingDir: "{app}"; Flags: nowait postinstall skipifsilent
     ```
   - **تنظيف بيئة البناء:** تنظيف مجلدات البناء (`dist`, `build`, `Output`, `__pycache__`) بالكامل قبل التجميع لضمان بناء نسخة نظيفة 100%.

8. **معايير ملفات التشغيل والـ Launchers (تجنب أخطاء ترميز CMD):**
   - يُمنع منعاً باتاً تسمية ملفات `.bat` بأسماء عربية أو استخدام أحرف غير ASCII داخل كود ملفات الباتش لتفادي انهيار مفسر `cmd.exe` في ويندوز (تجزئة الكلمات والأوامر مثل `'cho' is not recognized`).
   - يجب دائماً تضمين `chcp 65001 >nul` في بداية ملف الباتش، وتفويض التنفيذ لسكربت PowerShell عبر:
     `PowerShell -NoProfile -ExecutionPolicy Bypass -File ".\Run-DesktopApp.ps1"`
   - النصوص العربية ورسائل الواجهة توضع داخل ملفات الواجهة (HTML/JS/JSON) حيث يتم فك ترميز UTF-8 أصلياً.

9. **إدارة ملفات JSON ومعالجة UTF-8 BOM في تطبيقات Electron/Node.js:**
   - عند قراءة أي ملف JSON من مسار المشروع عبر `fs.readFileSync`، يجب دائماً تجريد بايتات الـ BOM باستخدام `.replace(/^\uFEFF/, '').trim()` قبل تمريره إلى `JSON.parse()` لتفادي استثناء `SyntaxError: Unexpected token '﻿'`.
   - أوامر استعلام حزم النظام (`Get-AppxPackage`) يجب أن تحتوي على مسار احتياطي (Fallback) بحيث تعمل بسلاسة تحت وضع المستخدم العادي ووضع المسؤول دون إلقاء استثناءات تمنع تحميل بيانات الواجهة.

10. **معايير الواجهات الحديثة لمشاريع ARN (Electron.js Glassmorphism Architecture):**
    - **الهيكل الموحد لمشاريع سطح المكتب:**
      - `DesktopApp/main.js`: المعالج الرئيسي (Main Process)، إدارة النوافذ، استدعاء أوامر النظام (IPC)، تشغيل الروابط الخارجية بأمان عبر `shell.openExternal`.
      - `DesktopApp/preload.js`: جسر الحماية وعزل السياق الصارم (`contextIsolation: true`, `nodeIntegration: false`) وتمرير الوظائف حصراً عبر `contextBridge.exposeInMainWorld('api', {...})`.
      - `DesktopApp/renderer/`: يضم ملفات العرض:
        - `index.html`: بنية HTML5 دلالية تدعم الاتجاه العربي الأصلي (`dir="rtl"`).
        - `styles.css`: نظام تصميم متكامل بنمط الزجاج الداكن (**Dark Glassmorphism**) يعتمد المتغيرات اللونية: الخلفية العميقة (`#0b0f19`)، والبطاقات الزجاجية (`#0f172a` مع شفافية وحدود دقيقة)، وأزرار التمرير (`#1e293b`)، ولمسات إضاءة سماوية وخضراء (`#38bdf8`, `#10b981`)، وخط **Cairo** للعربية و **JetBrains Mono** للأكواد.
        - `app.js`: إدارة الحالة التفاعلية، دعم اللغات (عربي/إنجليزي)، والاشتراك في بث السجلات اللحظية.
        - `assets/icons/`: الأيقونات المحلية للسوشيال ميديا وأيقونة البرنامج بصيغة `.ico` و `.png`.
    - **محركات الأوامر الخلفية:** أي مهام نظامية أو سكربتات (PowerShell / Python / CLI) يتم تشغيلها كعمليات منفصلة عبر `child_process.spawn` مع بث المخرجات لحظياً (Real-time Log Streaming) إلى شاشة Terminal داخل الواجهة دون تجميد التطبيق.
    - **مشغلات الإقلاع (Launchers):** استخدام ثنائية ملف `Run-DesktopApp.bat` (نظيف من ترميز CMD بـ `chcp 65001`) مع `Run-DesktopApp.ps1` لتشغيل ملف `electron.exe` تلقائياً بصلاحيات المسؤول (UAC RunAs) مع مسار احتياطي للتشغيل العادي.

هذه القواعد يجب اتباعها بصرامة في أي مشاريع حالية أو مستقبلية يتم إنشاؤها داخل مساحة العمل `e:\مشاريعي` لضمان استقرار وتوحيد هوية مشاريع ARN Technology.




# 🧠 معرفتي عني – ملفي التقني الشخصي

> هذا الملف يلخص كل ما أعرفه عن نفسي كمبرمج، لغاتي، أدواتي، طريقة تفكيري، ومجالات اهتمامي.  
> أستخدمه كـ مرجع سريع عند التخطيط لمشروع جديد أو مراجعة مساري المهني.

---

## 📌 من أنا تقنياً؟

- **المجال الأساسي**: تطوير الويب (Backend + Frontend)
- **الخبرة**: مستوى متوسط – أطمح لأن أصبح Full-Stack محترف
- **اللغة المفضلة**: JavaScript / Python (أختار حسب المشروع)
- **طريقة التعلم**: تعلم بالمشاريع، وأفضل التوثيق الجيد
- **الهدف**: بناء أنظمة قابلة للتطوير، كتابة كود نظيف، وفهم عميق للأدوات التي استخدمها

---

## 🧰 لغات البرمجة التي أعرفها

| اللغة | مستوى الإتقان | آخر استخدمتها |
|-------|---------------|----------------|
| JavaScript | ⭐⭐⭐⭐ (جيد جداً) | مشاريع React / Node.js |
| Python | ⭐⭐⭐⭐ (جيد جداً) | أتمتة، تحليل بيانات، Backend |
| HTML / CSS | ⭐⭐⭐⭐⭐ (متقدم) | تصميم واجهات وتجارب مستخدم |
| SQL | ⭐⭐⭐ (متوسط) | استعلامات، تصميم قواعد بيانات |
| C# / Java | ⭐⭐ (أساسي) | دراسياً فقط |

---

## ⚙️ الأدوات والتقنيات التي أستخدمها

### 🖥️ Backend
- Node.js (Express, NestJS)
- Django / Flask (Python)
- REST APIs / GraphQL (أساسيات)
- JWT، OAuth2، إدارة الجلسات

### 🎨 Frontend
- React.js + Next.js
- Tailwind CSS / Bootstrap
- State Management (Redux, Zustand)
- استهلاك APIs

### 🗄️ قواعد البيانات
- PostgreSQL / MySQL
- MongoDB (أساسيات)
- Firebase (للنماذج السريعة)

### 🛠️ أدوات التطوير
- Git & GitHub (فرعيات، Pull Requests)
- Docker (حاويات أساسية)
- Postman / Insomnia (اختبار APIs)
- VS Code + إضافات مفيدة

### ☁️ سحابة ونشر
- Vercel / Netlify (للمشاريع الصغيرة)
- AWS (EC2, S3 – أساسيات)
- معرفة بـ CI/CD (GitHub Actions)

---

## 📚 الكتب والدورات التي أثّرت في مساري

- **Eloquent JavaScript** – لفهم عميق للغة
- **You Don't Know JS** – لتفاصيل JavaScript المخفية
- **Python Crash Course** – للبداية السريعة
- **Clean Code** – لكتابة كود مقروء
- دورات: **CS50**, **The Odin Project**, **FreeCodeCamp**

---

## 🧩 المشاريع التي أنجزتها

1. **مدونة شخصية** – Next.js + Tailwind + Markdown  
2. **لوحة تحكم لإدارة مهام** – React + Node.js + PostgreSQL  
3. **بوت تلغرام** – Python لأتمتة الردود وجلب البيانات  
4. **متجر إلكتروني (وهمي)** – Django + Stripe API (للتعلم)

---

## 🧠 نقاط قوتي كـ مبرمج

- ✅ فهم أساسيات CS (خوارزميات، هياكل بيانات)
- ✅ كتابة كود نظيف ومعياري (ESLint, Prettier)
- ✅ حل المشكلات (Problem Solving)
- ✅ البحث الذاتي وعزل الأخطاء (Debugging)
- ✅ توثيق الشيفرة لنفسي وللآخرين

---

## 🧩 نقاط أريد تطويرها

- ⚠️ تحسين أداء التطبيقات (Performance Optimization)
- ⚠️ تعلم TypeScript بشكل احترافي
- ⚠️ الخوارزميات المتقدمة (لمقابلات العمل)
- ⚠️ أمن التطبيقات (OWASP Top 10)
- ⚠️ تطبيقات الهجينة (React Native / Flutter – مستقبلاً)

---

## 💡 مبادئي في البرمجة

> “اكتب الكود وكأنه سيتم صيانته من قبل شخص عنيف يعرف عنوان منزلك.” – مجازاً

- **القراءة أهم من السرعة**: أفضل كود مفهوم على كود مختصر ومعقّد
- **التجربة خير معلم**: لا أخاف من كسر الأشياء
- **التواضع التقني**: أعرف أنني لا أعرف كل شيء، وأتعلم يومياً

---

## 🎯 أهدافي القادمة (الـ 6 أشهر)

- [ ] إطلاق مشروع Full-Stack متكامل (SaaS بسيط)
- [ ] الحصول على شهادة AWS Practitioner أو Developer Associate
- [ ] المساهمة في مشروع مفتوح المصدر (Open Source Contribution)
- [ ] كتابة مقالات تقنية على مدونتي (على الأقل 3 مقالات)
- [ ] تعلم TypeScript بشكل احترافي واستخدامه في مشروع حقيقي

---

## 🌐 أين تجدني؟

- **GitHub**: [github.com/yourusername](https://github.com/yourusername)
- **LinkedIn**: [linkedin.com/in/yourprofile](https://linkedin.com/in/yourprofile)
- **مدونتي التقنية**: [yourblog.dev](https://yourblog.dev)
- **تويتر / X**: [@yourhandle](https://twitter.com/yourhandle)

---

## 🧾 خاتمة

هذا الملف ليس جامداً، بل يتطور معي. كلما تعلمت شيئاً جديداً أو أنجزت مشروعاً، سأعود لأحدثه.  
الهدف منه أن يكون **مرآتي التقنية**، لا واجهتي المزيفة.

---

📅 آخر تحديث: سبتمبر 2026  
✍️ أعدته لنفسي – لأن التذكير بالمسار أهم من الوصول بسرعة.
