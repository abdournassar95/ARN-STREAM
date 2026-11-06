# إشعار طرف ثالث — Jellyfin Web

هذا المجلد يحتوي نسخة مبنية (build) من **Jellyfin Web**، وهو مشروع مفتوح المصدر
مرخّص تحت **GNU GPL v2.0** (أو أي إصدار لاحق حسب ما ينص عليه المشروع الأصلي).

- المشروع الأصلي: https://github.com/jellyfin/jellyfin-web
- الترخيص: https://github.com/jellyfin/jellyfin-web/blob/master/LICENSE
- المصدر الكامل: متاح في المستودع أعلاه.

هذه النسخة تُقدَّم كعميل ويب متوافق مع واجهة Jellyfin التي يوفّرها خادم ARN Stream،
وهي **عمل مستقل** عن كود ARN Stream. عند إعادة توزيع هذه الملفات (أو تعديلها) يجب
الالتزام بشروط GPLv2: إتاحة الكود المصدري المقابل، والحفاظ على إشعارات الحقوق.

إن كنت تستخدم ARN Stream تجارياً ولا ترغب في الالتزام بـ GPL، احذف هذا المجلد
(سيظهر مسار `/jellyfin` برسالة 503) أو استضف jellyfin-web منفصلاً واضبط
`JELLYFIN_WEB_DIST` للإشارة إليه.

---

Third-party notice: this directory contains a prebuilt copy of **Jellyfin Web**
(GPL-2.0). ARN Stream's own code is a separate work. Redistribution of these
files must comply with GPL-2.0 (source availability + attribution).
