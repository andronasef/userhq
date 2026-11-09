// Auto-generated Guide Registry
import { buildGuidePackage } from "./factory";
import type { GuideLocalePackage, GuideHeaderInfo, NavGroup, QuickLink } from "./types";

export const GUIDE_PACKAGES: Record<string, GuideLocalePackage> = {
  "en": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "User Guide & API Reference",
        "title": "UserHQ Platform & API Guide",
        "subtitle": "Everything you need to organize customer feedback, prioritize feature requests, publish public roadmaps, and automate your workflows.",
        "searchPlaceholder": "Search topics..."
    },
    "groups": [
        "Getting Started",
        "Triage & Feedback",
        "Portals & Roadmaps",
        "Appearance & Alerts",
        "Automation & API"
    ],
    "items": {
        "overview": "Overview & Structure",
        "rolesPermissions": "Roles & Permissions",
        "requestsInbox": "Requests (All Boards)",
        "commentsAttention": "Comments & Needs Attention",
        "authorLocation": "Author Contact & Location",
        "customerPortals": "Public Customer Portals",
        "roadmapChangelog": "Roadmap & Release Notes",
        "faqSystem": "Self-Serve FAQ",
        "themesPush": "Themes & Web Push Alerts",
        "apiOverview": "API Auth & Rate Limits",
        "swaggerExplorer": "Interactive API Explorer",
        "webhooksHmac": "Webhooks & HMAC Signatures"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "Requests Inbox",
            "description": "Triage customer feature requests across all your products."
        },
        "commentsAttention": {
            "title": "Comments Inbox",
            "description": "Needs Attention queue and team conversation threads."
        },
        "swaggerExplorer": {
            "title": "Interactive API Explorer",
            "description": "Test endpoints, copy schemas, and generate code snippets."
        },
        "webhooksHmac": {
            "title": "Webhooks & HMAC",
            "description": "Real-time event delivery and SHA-256 signatures."
        }
    }
},
    "<!-- section: overview -->\n## Overview & Structure\n\nUserHQ helps your team collect and act on feedback from your customers. Here is how your workspace is structured:\n\n<cards>\n- **1. Workspace**: Your team's central home. Houses your team members, billing, API keys, webhooks, and the unified feedback inbox across all your products.\n- **2. Products**: The individual apps or services you build (e.g. Web App, iOS App, API). Each product has its own feedback board, roadmap, changelog, categories, and custom branding.\n- **3. Customer Portals**: The branded portal your users visit to submit ideas, upvote feature requests, track your public roadmap, and read release announcements.\n</cards>\n\n<!-- section: roles-permissions -->\n## Roles & Team Permissions\n\nCollaborate with your entire team while maintaining control over workspace settings:\n\n<cards>\n- **Workspace Owner**: Full workspace control: manage subscriptions, invite admins, create API keys, configure webhooks, and transfer ownership.\n- **Workspace Admin**: Can manage products, triage feedback, reply officially to customers, manage roadmap cards, and publish release notes.\n- **Workspace Member**: Can view feedback submissions, participate in internal team discussions, and track customer feature requests.\n</cards>\n\n<!-- section: requests-inbox -->\n## Requests (All Boards) & Triage\n\nLocated at `/dashboard/[ws]/requests`, the unified Requests inbox brings together all customer submissions from every product into a single high-performance triage view.\n\n<cards>\n- **Multi-Dimension Filtering**: Filter instantly by Product, Status Phase (Backlog, In Progress, Completed), Category, Keyword search, and Date ranges.\n- **Fast Status Updates**: Move items between stages (Under Review, Planned, In Progress, Completed) with one click. Customers who upvoted the request are notified automatically.\n</cards>\n\n<!-- section: comments-attention -->\n## Comments & Needs Attention Inbox\n\nLocated at `/dashboard/[ws]/comments`, this inbox acts like a responsive customer support desk for your feedback threads.\n\n### Workflow Stages\n\n<stages>\n- **Needs Attention**: Any customer comment that has not received an official team response. Highlighted with amber indicators so customer inquiries are never overlooked.\n- **Handled**: Automatically cleared from the attention queue as soon as a team member replies with an official badge, or manually marked as handled.\n</stages>\n\n<!-- section: author-location -->\n## Author Contact & Location Insights\n\nTo give your team valuable context on who is submitting feedback, request and comment cards in your dashboard display author details:\n\n- **Direct Email Reach-Out**: Click the mailto button next to the author's name to quickly contact them for user interviews or follow-up questions.\n- **Geographic Context**: View the customer's approximate location (e.g. `London, United Kingdom [GB]`) to understand geographic usage trends.\n- **Privacy by Design**: Author email addresses and locations are strictly visible to workspace team members and are never displayed on public customer portals.\n\n<!-- section: customer-portals -->\n## Public Customer Portals\n\nEvery product in your workspace can have its own public portal at `/[ws]/[product]`.\n\n<cards>\n- **Modular Feature Toggles**: Independently enable or disable the Feedback Board, Roadmap, Changelog, or FAQ per product based on what you are ready to share.\n- **Custom Branding & Colors**: Customize your portal with your logo, brand name, and custom accent color to create a seamless extension of your app.\n- **Multi-Language & RTL**: Support 13 languages with automatic visitor detection, language pickers, and localized entry authoring across Roadmap, Changelog, and FAQ.\n- **Changing the Default Language**: Existing translations are promoted into the main fields and the previous text is kept as a translation. Review the preview counts first; entries without a translation keep their current text.\n- **User Badges**: Recognize customers with badges shown beside their names on posts and comments. Assign them manually or by attribution rules matched from signed or unsigned links, and browse them in the product users directory.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## Roadmap Planning & Release Notes\n\n<cards>\n- **Interactive Roadmap**: Organize feature development into visual columns (e.g. Under Consideration, Planned, In Progress). Link customer feedback directly to roadmap cards so subscribers stay informed as features advance.\n- **Changelog & Release Announcements**: Publish release notes tagged with categories (New Feature, Improvement, Bug Fix). Publishing a release note automatically closes the loop with customers who requested linked features.\n</cards>\n\n<!-- section: faq-system -->\n## Self-Serve FAQ Knowledge Base\n\nAdd frequently asked questions organized into categories on your product portal. Giving customers instant answers reduces duplicate feature submissions and common support requests.\n\n<!-- section: themes-push -->\n## Themes & Web Push Alerts\n\nUserHQ includes four themes: **System**, **Light**, **Dark** (deep navy), and **Charcoal** (neutral near-black). Team members can also enable browser Web Push notifications in `/account` to receive instant alerts when customers submit new feedback or comments.\n\n<!-- section: api-overview -->\n## Automation API & Authentication\n\nConnect external systems, CI/CD pipelines, Slack, Discord, Linear, GitHub, or custom internal dashboards using the UserHQ REST Automation API.\n\n### Authentication Header\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **Rate Limits**: Generous 120 requests/minute allowance per API key with automatic token-bucket throttling.\n- **Scoped Permissions**: Keys can be scoped to specific products and granted read/write permissions for specific resources.\n</cards>\n\n<!-- section: swagger-explorer -->\n## Interactive API Explorer\n\nTest endpoints, inspect parameters, view request and response schemas, and generate instant code snippets in cURL, TypeScript, and Python.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Webhooks & HMAC Signature Verification\n\nUserHQ delivers real-time HTTP POST events whenever requests are created, status changes occur, or comments arrive. Every delivery includes a secure HMAC-SHA256 signature in the `x-userhq-signature` header.\n\n### Node.js / Express HMAC Verification Example\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "ar": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "دليل الاستخدام ومرجع الـ API",
        "title": "دليل منصة UserHQ وواجهة البرمجة (API)",
        "subtitle": "كل ما تحتاجه لتنظيم ملاحظات العملاء، وتحديد أولويات الطلبات، ونشر خرائط الطريق العامة، وأتمتة مسارات العمل.",
        "searchPlaceholder": "البحث في الموضوعات..."
    },
    "groups": [
        "البداية والتهيئة",
        "الفرز والآراء",
        "البوابات وخريطة الطريق",
        "المظهر والتنبيهات",
        "الأتمتة وواجهة البرمجة (API)"
    ],
    "items": {
        "overview": "نظرة عامة والهيكل",
        "rolesPermissions": "الأدوار والصلاحيات",
        "requestsInbox": "صندوق الطلبات الموحد",
        "commentsAttention": "التعليقات والمحادثات",
        "authorLocation": "بيانات وتواصل أصحاب الطلبات",
        "customerPortals": "بوابات العملاء العامة",
        "roadmapChangelog": "خريطة الطريق وسجل التحديثات",
        "faqSystem": "الأسئلة الشائعة الذاتية",
        "themesPush": "السمات وتنبيهات الويب",
        "apiOverview": "المصادقة وحدود الطلبات",
        "swaggerExplorer": "مستعرض الـ API التفاعلي",
        "webhooksHmac": "الـ Webhooks وتوقيعات HMAC"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "صندوق الطلبات",
            "description": "فرز ومتابعة طلبات الميزات لعملائك عبر كل المنتجات."
        },
        "commentsAttention": {
            "title": "صندوق التعليقات",
            "description": "طابور الملاحظات التي تحتاج انتباهاً ومحادثات الفريق."
        },
        "swaggerExplorer": {
            "title": "مستعرض API التفاعلي",
            "description": "تجربة الـ endpoints ونسخ المخططات وتوليد الأكواد."
        },
        "webhooksHmac": {
            "title": "الـ Webhooks و HMAC",
            "description": "تسليم الأحداث المباشرة وتوقيعات SHA-256 الآمنة."
        }
    }
},
    "<!-- section: overview -->\n## نظرة عامة وهيكل مساحة العمل\n\nتساعد منصة UserHQ فريقك على جمع آراء وملاحظات العملاء واتخاذ قرارات التطوير بناءً عليها. إليك كيفية تنظيم مساحة العمل:\n\n<cards>\n- **1. مساحة العمل (Workspace)**: المقر المركزي لفريقك. يضم أعضاء الفريق، وإدارة الاشتراكات، ومفاتيح API، وإعدادات الـ Webhooks، وصندوق الوارد الموحد للطلبات والملاحظات عبر جميع منتجاتك.\n- **2. المنتجات (Products)**: التطبيقات أو الخدمات المستقلة التي تطورها (مثل تطبيق الويب، تطبيق iOS، واجهة البرمجة API). لكل منتج لوحة ملاحظات، وخريطة طريق، وسجل تحديثات، وتصنيفات، وهوية بصرية مخصصة.\n- **3. بوابات العملاء (Customer Portals)**: البوابة العامة التي يزورها عملاؤك لتقديم المقترحات والتصويت على الميزات ومتابعة تقدم خريطة الطريق والاطلاع على أحدث التحديثات.\n</cards>\n\n<!-- section: roles-permissions -->\n## الأدوار وصلاحيات الفريق\n\nتعاون بسلاسة مع جميع أعضاء فريقك مع الحفاظ على التحكم الكامل في إعدادات مساحة العمل:\n\n<cards>\n- **مالك مساحة العمل (Workspace Owner)**: تحكم كامل وشامل: إدارة الاشتراكات والفوترة، ودعوة المسؤولين، وإنشاء مفاتيح API، وإعداد الـ Webhooks، وإمكانية نقل الملكية.\n- **مسؤول مساحة العمل (Workspace Admin)**: صلاحيات إدارة المنتجات، وفرز الملاحظات والطلبات، والرد الرسمي على العملاء، وإدارة بطاقات خريطة الطريق، ونشر سجل التحديثات.\n- **عضو مساحة العمل (Workspace Member)**: استعراض الطلبات والملاحظات، والمشاركة في النقاشات الداخلية بين أعضاء الفريق، ومتابعة متطلبات العملاء.\n</cards>\n\n<!-- section: requests-inbox -->\n## صندوق الطلبات الموحد والفرز\n\nيقع في المسار `/dashboard/[ws]/requests`، ويجمع كافة مقترحات وطلبات العملاء من جميع المنتجات في واجهة فرز وتصنيف واحدة فائقة السرعة.\n\n<cards>\n- **تصفية متعددة الأبعاد**: فلترة فورية حسب المنتج، ومرحلة الحالة (قيد الانتظار، قيد التنفيذ، مكتمل)، والتصنيف، والبحث بالكلمات المفتاحية، والنطاقات الزمنية.\n- **تحديثات سريعة للحالة**: نقل العناصر بين المراحل (قيد المراجعة، مخطط له، قيد التطوير، مكتمل) بنقرة واحدة. يتم إشعار العملاء الذين صوتوا للطلب تلقائياً.\n</cards>\n\n<!-- section: comments-attention -->\n## صندوق التعليقات والملاحظات التي تحتاج انتباهاً\n\nيقع في المسار `/dashboard/[ws]/comments`، ويعمل كمركز دعم متكامل وسريع الاستجابة لمحادثات ومشاركات العملاء.\n\n### مراحل العمل\n\n<stages>\n- **تحتاج انتباهاً (Needs Attention)**: أي تعليق من عميل لم يتلقَ رداً رسمياً من الفريق بعد. يتم تمييزه بمؤشر كهرماني واضح لضمان عدم إغفال أي استفسار أو مشكلة.\n- **تم التعامل معها (Handled)**: تُزال تلقائياً من قائمة الاهتمام بمجرد رد أحد أعضاء الفريق بشارة رسمية، أو يمكن تحديدها يدوياً كـ \"تمت المعالجة\".\n</stages>\n\n<!-- section: author-location -->\n## بيانات وتواصل أصحاب الطلبات والموقع الجغرافي\n\nلتزويد فريقك بسياق قيّم حول هوية صاحب الطلب أو الملاحظة، تعرض بطاقات الطلبات والتعليقات تفاصيل صاحب المشاركة:\n\n- **التواصل المباشر عبر البريد**: انقر على زر البريد الإلكتروني بجوار اسم الكاتب للتواصل السريع معه لإجراء مقابلات المستخدمين أو طرح أسئلة متابعة.\n- **السياق الجغرافي**: عرض الموقع التقريبي للعميل (مثل `London, United Kingdom [GB]`) لفهم اتجاهات الاستخدام والتوزيع الجغرافي.\n- **الخصوصية أولاً (Privacy by Design)**: عناوين البريد الإلكتروني والمواقع الجغرافية مرئية فقط لأعضاء فريق مساحة العمل ولا تظهر أبداً على البوابات العامة للعملاء.\n\n<!-- section: customer-portals -->\n## بوابات العملاء العامة\n\nيمكن أن يحصل كل منتج في مساحة عملك على بوابة عامة مخصصة على المسار `/[ws]/[product]`.\n\n<cards>\n- **مفاتيح الميزات المرنة**: تفعيل أو تعطيل لوحة المقترحات، أو خريطة الطريق، أو سجل التحديثات، أو الأسئلة الشائعة بشكل مستقل لكل منتج بناءً على جاهزيتك للمشاركة.\n- **هوية بصرية وألوان مخصصة**: تخصيص البوابة بشعارك، واسم علامتك التجارية، ولون التمييز الخاص بك لتكون امتداداً سلساً لتطبيقك.\n- **دعم متعدد اللغات و RTL**: دعم 13 لغة مع الكشف التلقائي عن لغة الزائر، ومحددات اللغة، وإمكانية كتابة محتوى مترجم عبر خريطة الطريق والتحديثات والأسئلة الشائعة.\n- **تغيير اللغة الافتراضية**: يتم ترقية الترجمات الحالية إلى الحقول الأساسية مع الاحتفاظ بالنص السابق كترجمة بديلة، مع معاينة فورية قبل الحفظ.\n- **شارات المستخدمين**: تكريم العملاء بشارات تظهر بجوار أسمائهم على المنشورات والتعليقات، وتعيينها يدوياً أو بقواعد الإحالة وتصفح دليل مستخدمي المنتج.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## خريطة الطريق وسجل التحديثات\n\n<cards>\n- **خريطة طريق تفاعلية**: تنظيم تطوير الميزات في أعمدة مرئية (مثل قيد الدراسة، مخطط له، قيد التطوير). ربط ملاحظات العملاء مباشرة ببطاقات الخريطة لإبقاء المشتركين على اطلاع دائم.\n- **سجل التحديثات وإعلانات الإصدارات**: نشر ملاحظات الإصدار مصنفة (ميزة جديدة، تحسينات، إصلاح أخطاء). يؤدي نشر التحديث تلقائياً إلى إغلاق الدورة مع العملاء الذين طلبوا تلك الميزات.\n</cards>\n\n<!-- section: faq-system -->\n## قاعدة معرفة الأسئلة الشائعة الذاتية\n\nأضف أسئلة متكررة منظمة في أقسام محددة على بوابة منتجك. تقديم إجابات فورية للعملاء يقلل من تكرار تقديم نفس الاقتراحات ويوفر وقت الدعم الفني.\n\n<!-- section: themes-push -->\n## السمات وتنبيهات إشعارات الويب (Web Push)\n\nتتضمن منصة UserHQ أربع سمات: **تلقائي (حسب النظام)**، **فاتح (Light)**، **داكن كحلي (Dark)**، و**فحمي محايد (Charcoal)**. يمكن لأعضاء الفريق أيضاً تفعيل إشعارات الويب من خلال صفحة `/account` لتلقي تنبيهات فورية عند قيام العملاء بإرسال ملاحظات أو تعليقات جديدة.\n\n<!-- section: api-overview -->\n## واجهة برمجة التطبيقات للأتمتة (API) والمصادقة\n\nاربط أنظمتك الخارجية، وخطوط CI/CD، وتطبيقات Slack، Discord، Linear، GitHub، أو لوحات التحكم الداخلية عبر UserHQ REST Automation API.\n\n### ترويسة المصادقة (Authentication Header)\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **معدل استهلاك الطلبات**: حد سخي يبلغ 120 طلباً في الدقيقة لكل مفتاح API مع تنظيم آلي لمنع الإفراط (Token-Bucket Throttling).\n- **صلاحيات مخصصة النطاق**: إمكانية قصر المفاتيح على منتجات محددة مع منح أذونات قراءة/كتابة لموارد معينة.\n</cards>\n\n<!-- section: swagger-explorer -->\n## مستعرض API التفاعلي\n\nاختبر نقاط النهاية (Endpoints)، وتفقد المعاملات، واعرض مخططات الطلبات والاستجابات، وأنشئ مقتطفات برمجية جاهزة بـ cURL و TypeScript و Python فورياً.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## الـ Webhooks والتحقق من توقيع HMAC\n\nترسل UserHQ أحداث HTTP POST فورية عند إنشاء الطلبات أو تغير حالتها أو وصول تعليقات جديدة. تتضمن كل حمولة توقيع HMAC-SHA256 آمناً في ترويسة `x-userhq-signature`.\n\n### مثال التحقق من توقيع HMAC في Node.js / Express\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "de": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "Benutzerhandbuch & API-Referenz",
        "title": "UserHQ Plattform- & API-Handbuch",
        "subtitle": "Alles, was Sie brauchen, um Kundenfeedback zu organisieren, Feature-Anfragen zu priorisieren, öffentliche Roadmaps zu veröffentlichen und Workflows zu automatisieren.",
        "searchPlaceholder": "Themen durchsuchen..."
    },
    "groups": [
        "Erste Schritte",
        "Triage & Feedback",
        "Portale & Roadmaps",
        "Erscheinungsbild & Benachrichtigungen",
        "Automatisierung & API"
    ],
    "items": {
        "overview": "Übersicht & Struktur",
        "rolesPermissions": "Rollen & Berechtigungen",
        "requestsInbox": "Anfragen (Alle Boards)",
        "commentsAttention": "Kommentare & Handlungsbedarf",
        "authorLocation": "Autorenkontakt & Standort",
        "customerPortals": "Öffentliche Kundenportale",
        "roadmapChangelog": "Roadmap & Release-Notes",
        "faqSystem": "Self-Service FAQ",
        "themesPush": "Designs & Web-Push-Alerts",
        "apiOverview": "API-Authentifizierung & Limits",
        "swaggerExplorer": "Interaktiver API-Explorer",
        "webhooksHmac": "Webhooks & HMAC-Signaturen"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "Anfragen-Posteingang",
            "description": "Kunden-Feature-Anfragen produktübergreifend triagieren."
        },
        "commentsAttention": {
            "title": "Kommentare-Posteingang",
            "description": "Warteschlange für Handlungsbedarf und Teamdiskussionen."
        },
        "swaggerExplorer": {
            "title": "Interaktiver API-Explorer",
            "description": "Endpunkte testen, Schemas einsehen und Code generieren."
        },
        "webhooksHmac": {
            "title": "Webhooks & HMAC",
            "description": "Echtzeit-Ereignisübertragung und sichere SHA-256-Signaturen."
        }
    }
},
    "<!-- section: overview -->\n## Übersicht & Struktur\n\nUserHQ hilft Ihrem Team, Feedback von Ihren Kunden zu sammeln und darauf zu reagieren. So ist Ihr Arbeitsbereich aufgebaut:\n\n<cards>\n- **1. Workspace (Arbeitsbereich)**: Die zentrale Anlaufstelle Ihres Teams. Beherbergt Ihre Teammitglieder, Abrechnung, API-Schlüssel, Webhooks und den einheitlichen Feedback-Posteingang für alle Ihre Produkte.\n- **2. Products (Produkte)**: Die einzelnen Apps oder Dienste, die Sie entwickeln (z. B. Web-App, iOS-App, API). Jedes Produkt hat sein eigenes Feedback-Board, seine eigene Roadmap, sein Changelog, Kategorien und individuelles Branding.\n- **3. Customer Portals (Kundenportale)**: Das gebrandete Portal, das Ihre Benutzer besuchen, um Ideen einzureichen, über Feature-Anfragen abzustimmen, Ihre öffentliche Roadmap zu verfolgen und Release-Ankündigungen zu lesen.\n</cards>\n\n<!-- section: roles-permissions -->\n## Rollen & Teamberechtigungen\n\nArbeiten Sie nahtlos mit Ihrem gesamten Team zusammen und behalten Sie gleichzeitig die volle Kontrolle über die Einstellungen des Arbeitsbereichs:\n\n<cards>\n- **Workspace Owner (Inhaber)**: Vollständige Kontrolle: Abonnements verwalten, Administratoren einladen, API-Schlüssel erstellen, Webhooks konfigurieren und Eigentümerschaft übertragen.\n- **Workspace Admin (Administrator)**: Kann Produkte verwalten, Feedback triagieren, Kunden offiziell antworten, Roadmap-Karten verwalten und Versionshinweise veröffentlichen.\n- **Workspace Member (Mitglied)**: Kann Feedback-Einsendungen einsehen, an internen Teamdiskussionen teilnehmen und Kundenanfragen verfolgen.\n</cards>\n\n<!-- section: requests-inbox -->\n## Feedback-Anfragen & Triage\n\nUnter `/dashboard/[ws]/requests` vereint der einheitliche Posteingang alle Kundeneinsendungen aus jedem Produkt in einer einzigen, leistungsstarken Triage-Ansicht.\n\n<cards>\n- **Mehrdimensionale Filterung**: Filtern Sie sofort nach Produkt, Statusphase (Backlog, In Bearbeitung, Abgeschlossen), Kategorie, Stichwortsuche und Datumsbereichen.\n- **Schnelle Statusaktualisierungen**: Verschieben Sie Einträge mit einem Klick zwischen Phasen (Wird geprüft, Geplant, In Bearbeitung, Abgeschlossen). Kunden, die für die Anfrage gestimmt haben, werden automatisch benachrichtigt.\n</cards>\n\n<!-- section: comments-attention -->\n## Kommentare & Handlungsbedarf-Posteingang\n\nUnter `/dashboard/[ws]/comments` dient dieser Posteingang als reaktionsschneller Support-Desk für Ihre Feedback-Diskussionen.\n\n### Workflow-Phasen\n\n<stages>\n- **Needs Attention (Handlungsbedarf)**: Jeder Kundenkommentar, der noch keine offizielle Antwort vom Team erhalten hat. Mit bernsteinfarbenen Indikatoren hervorgehoben, damit keine Anfrage übersehen wird.\n- **Handled (Erledigt)**: Wird automatisch aus der Aufmerksamkeits-Warteschlange entfernt, sobald ein Teammitglied mit einem offiziellen Abzeichen antwortet, oder manuell als erledigt markiert.\n</stages>\n\n<!-- section: author-location -->\n## Autorenkontakt & Standort-Einblicke\n\nUm Ihrem Team wertvollen Kontext darüber zu geben, wer Feedback einreicht, zeigen die Anfragen- und Kommentarkarten in Ihrem Dashboard Autorendetails an:\n\n- **Direkte Kontaktaufnahme per E-Mail**: Klicken Sie auf den Mail-Button neben dem Namen des Autors, um ihn direkt für Benutzerinterviews oder Rückfragen zu kontaktieren.\n- **Geografischer Kontext**: Sehen Sie den ungefähren Standort des Kunden (z. B. `London, United Kingdom [GB]`), um geografische Nutzungsmuster zu verstehen.\n- **Datenschutzorientiertes Design**: E-Mail-Adressen und Standorte von Autoren sind ausschließlich für Mitglieder des Workspace-Teams sichtbar und werden niemals auf öffentlichen Portalen angezeigt.\n\n<!-- section: customer-portals -->\n## Öffentliche Kundenportale\n\nJedes Produkt in Ihrem Arbeitsbereich kann ein eigenes öffentliches Portal unter `/[ws]/[product]` haben.\n\n<cards>\n- **Modulare Funktionsschalter**: Aktivieren oder deaktivieren Sie Feedback-Board, Roadmap, Changelog oder FAQ unabhängig voneinander pro Produkt.\n- **Individuelles Branding & Farben**: Passen Sie Ihr Portal mit Ihrem Logo, Markennamen und einer benutzerdefinierten Akzentfarbe an.\n- **Mehrsprachigkeit & RTL**: Unterstützung für 13 Sprachen mit automatischer Besuchererkennung, Sprachauswahl und lokalisierter Inhaltserstellung.\n- **Standardsprache ändern**: Bestehende Übersetzungen werden in die Hauptfelder übernommen und der vorherige Text bleibt als Übersetzung erhalten.\n- **Benutzerabzeichen**: Zeichnen Sie Kunden mit Abzeichen neben ihren Namen bei Beiträgen und Kommentaren aus. Weisen Sie diese manuell oder über Attributionsregeln zu.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## Roadmap-Planung & Release-Notes\n\n<cards>\n- **Interaktive Roadmap**: Organisieren Sie die Funktionsentwicklung in visuellen Spalten (z. B. In Prüfung, Geplant, In Entwicklung). Verknüpfen Sie Feedback direkt mit Roadmap-Karten.\n- **Changelog & Release-Ankündigungen**: Veröffentlichen Sie nach Kategorien geordnete Versionshinweise (Neue Funktion, Verbesserung, Fehlerbehebung). Schließen Sie automatisch den Kreis zu Kunden.\n</cards>\n\n<!-- section: faq-system -->\n## Self-Service FAQ Wissensdatenbank\n\nFügen Sie häufig gestellte Fragen in thematischen Kategorien auf Ihrem Produktportal hinzu. Direkte Antworten reduzieren doppelte Feature-Einsendungen und Support-Tickets.\n\n<!-- section: themes-push -->\n## Designs & Web-Push-Benachrichtigungen\n\nUserHQ bietet vier Designs: **System**, **Hell**, **Dunkel** (Tiefes Marineblau) und **Anthrazit** (neutrales Fast-Schwarz). Teammitglieder können in `/account` Web-Push-Benachrichtigungen aktivieren.\n\n<!-- section: api-overview -->\n## Automatisierungs-API & Authentifizierung\n\nVerbinden Sie externe Systeme, CI/CD-Pipelines, Slack, Discord, Linear, GitHub oder interne Dashboards über die UserHQ REST-Automatisierungs-API.\n\n### Authentifizierungs-Header\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **Rate Limits**: Großzügiges Kontingent von 120 Anfragen pro Minute pro API-Schlüssel mit automatischer Token-Bucket-Drosselung.\n- **Berechtigungsumfang**: Schlüssel können auf bestimmte Produkte beschränkt und mit Lese-/Schreibberechtigungen für bestimmte Ressourcen versehen werden.\n</cards>\n\n<!-- section: swagger-explorer -->\n## Interaktiver API-Explorer\n\nTesten Sie Endpunkte, untersuchen Sie Parameter, prüfen Sie Anfrage-/Antwort-Schemas und generieren Sie sofort Code-Snippets in cURL, TypeScript und Python.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Webhooks & HMAC-Signaturverifizierung\n\nUserHQ sendet HTTP-POST-Ereignisse in Echtzeit, wenn Anfragen erstellt werden, Statusänderungen auftreten oder Kommentare eingehen. Jede Übertragung enthält eine sichere HMAC-SHA256-Signatur im Header `x-userhq-signature`.\n\n### Node.js / Express HMAC-Verifizierungsbeispiel\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "es": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "Guía de usuario y referencia de API",
        "title": "Guía de plataforma y API de UserHQ",
        "subtitle": "Todo lo que necesita para organizar los comentarios de los clientes, priorizar solicitudes de funciones, publicar hojas de ruta públicas y automatizar flujos de trabajo.",
        "searchPlaceholder": "Buscar temas..."
    },
    "groups": [
        "Primeros pasos",
        "Clasificación y comentarios",
        "Portales y hojas de ruta",
        "Apariencia y alertas",
        "Automatización y API"
    ],
    "items": {
        "overview": "Descripción general y estructura",
        "rolesPermissions": "Roles y permisos",
        "requestsInbox": "Solicitudes (Todos los tableros)",
        "commentsAttention": "Comentarios y atención requerida",
        "authorLocation": "Contacto del autor y ubicación",
        "customerPortals": "Portales públicos de clientes",
        "roadmapChangelog": "Hoja de ruta y notas de versión",
        "faqSystem": "Preguntas frecuentes de autoservicio",
        "themesPush": "Temas y alertas Web Push",
        "apiOverview": "Autenticación de API y límites",
        "swaggerExplorer": "Explorador interactivo de API",
        "webhooksHmac": "Webhooks y firmas HMAC"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "Bandeja de solicitudes",
            "description": "Clasifique solicitudes de funciones de clientes en todos sus productos."
        },
        "commentsAttention": {
            "title": "Bandeja de comentarios",
            "description": "Cola de atención requerida e hilos de conversación del equipo."
        },
        "swaggerExplorer": {
            "title": "Explorador interactivo de API",
            "description": "Pruebe endpoints, copie esquemas y genere fragmentos de código."
        },
        "webhooksHmac": {
            "title": "Webhooks y HMAC",
            "description": "Entrega de eventos en tiempo real y firmas SHA-256 seguras."
        }
    }
},
    "<!-- section: overview -->\n## Descripción general y estructura\n\nUserHQ ayuda a su equipo a recopilar y actuar sobre los comentarios de sus clientes. Así está estructurado su espacio de trabajo:\n\n<cards>\n- **1. Workspace (Espacio de trabajo)**: El hogar central de su equipo. Alberga a los miembros de su equipo, facturación, claves de API, webhooks y la bandeja de entrada unificada de comentarios en todos sus productos.\n- **2. Products (Productos)**: Las aplicaciones o servicios individuales que crea (por ejemplo, App Web, App iOS, API). Cada producto tiene su propio tablero de comentarios, hoja de ruta, registro de cambios, categorías y personalización de marca.\n- **3. Customer Portals (Portales de clientes)**: El portal con su marca que visitan sus usuarios para enviar ideas, votar por solicitudes de funciones, seguir su hoja de ruta pública y leer anuncios de versiones.\n</cards>\n\n<!-- section: roles-permissions -->\n## Roles y permisos de equipo\n\nColabore fluidamente con todo su equipo manteniendo el control total sobre la configuración del espacio de trabajo:\n\n<cards>\n- **Workspace Owner (Propietario)**: Control total: administrar suscripciones, invitar administradores, crear claves de API, configurar webhooks y transferir la propiedad.\n- **Workspace Admin (Administrador)**: Puede administrar productos, clasificar comentarios, responder oficialmente a los clientes, gestionar tarjetas de la hoja de ruta y publicar notas de lanzamiento.\n- **Workspace Member (Miembro)**: Puede ver las opiniones enviadas, participar en discusiones internas del equipo y dar seguimiento a las solicitudes de los clientes.\n</cards>\n\n<!-- section: requests-inbox -->\n## Solicitudes y clasificación (Triage)\n\nUbicada en `/dashboard/[ws]/requests`, la bandeja de entrada unificada reúne todas las propuestas de los clientes de cada producto en una sola vista de clasificación de alto rendimiento.\n\n<cards>\n- **Filtrado multidimensional**: Filtre al instante por producto, fase de estado (Pendiente, En progreso, Completado), categoría, búsqueda por palabra clave y rangos de fechas.\n- **Actualizaciones de estado rápidas**: Mueva elementos entre etapas (En revisión, Planificado, En progreso, Completado) con un solo clic. Los clientes que votaron por la solicitud reciben notificaciones automáticas.\n</cards>\n\n<!-- section: comments-attention -->\n## Comentarios y bandeja de atención requerida\n\nUbicada en `/dashboard/[ws]/comments`, esta bandeja de entrada actúa como un servicio de atención receptivo para las conversaciones de comentarios.\n\n### Etapas de flujo de trabajo\n\n<stages>\n- **Needs Attention (Requiere atención)**: Cualquier comentario de cliente que no haya recibido una respuesta oficial del equipo. Resaltado con indicadores ámbar para que nunca se pase por alto ninguna consulta.\n- **Handled (Atendido)**: Se elimina automáticamente de la cola de atención tan pronto como un miembro del equipo responde con una insignia oficial, o se marca manualmente como atendido.\n</stages>\n\n<!-- section: author-location -->\n## Contacto de autores e información geográfica\n\nPara darle a su equipo un contexto valioso sobre quién envía comentarios, las tarjetas de solicitudes y comentarios muestran detalles del autor:\n\n- **Contacto directo por correo electrónico**: Haga clic en el botón de correo junto al nombre del autor para contactarlo rápidamente para entrevistas o preguntas de seguimiento.\n- **Contexto geográfico**: Vea la ubicación aproximada del cliente (por ejemplo, `London, United Kingdom [GB]`) para comprender las tendencias geográficas de uso.\n- **Privacidad por diseño**: Las direcciones de correo y ubicaciones de los autores solo son visibles para los miembros del equipo y nunca se muestran en los portales públicos.\n\n<!-- section: customer-portals -->\n## Portales públicos de clientes\n\nCada producto en su espacio de trabajo puede tener su propio portal público en `/[ws]/[product]`.\n\n<cards>\n- **Interruptores modulares de funciones**: Habilite o deshabilite de forma independiente el tablero de comentarios, la hoja de ruta, el registro de cambios o las preguntas frecuentes por producto.\n- **Identidad visual y colores personalizados**: Personalice su portal con su logotipo, nombre de marca y un color de acento personalizado.\n- **Multilingüe y RTL**: Compatibilidad con 13 idiomas con detección automática del visitante, selector de idioma y redacción de contenido localizado.\n- **Cambio de idioma predeterminado**: Las traducciones existentes se promocionan a los campos principales y el texto anterior se conserva como traducción.\n- **Insignias de usuario**: Reconozca a los clientes con insignias junto a sus nombres en publicaciones y comentarios, asignadas manualmente o mediante reglas de atribución.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## Planificación de hoja de ruta y notas de lanzamiento\n\n<cards>\n- **Hoja de ruta interactiva**: Organice el desarrollo en columnas visuales (por ejemplo, En consideración, Planificado, En progreso). Vincule comentarios directamente a las tarjetas.\n- **Changelog y notas de versión**: Publique anuncios etiquetados por categoría (Nueva función, Mejora, Corrección). Notifique automáticamente a los clientes que solicitaron esas funciones.\n</cards>\n\n<!-- section: faq-system -->\n## Base de conocimientos de preguntas frecuentes\n\nAgregue preguntas frecuentes organizadas por categorías en el portal de su producto. Dar respuestas inmediatas reduce consultas repetidas y solicitudes comunes de soporte.\n\n<!-- section: themes-push -->\n## Temas visuales y alertas Web Push\n\nUserHQ incluye cuatro temas: **Sistema**, **Claro**, **Oscuro** (azul marino profundo) y **Carboncillo** (casi negro neutro). Los miembros del equipo pueden activar alertas Web Push en `/account`.\n\n<!-- section: api-overview -->\n## API de automatización y autenticación\n\nConecte sistemas externos, pipelines CI/CD, Slack, Discord, Linear, GitHub o paneles internos mediante la API REST de automatización de UserHQ.\n\n### Encabezado de autenticación\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **Límites de velocidad**: Generoso límite de 120 solicitudes por minuto por clave de API con control de flujo automático por token-bucket.\n- **Permisos con alcance**: Las claves se pueden delimitar a productos específicos y conceder permisos de lectura/escritura a recursos específicos.\n</cards>\n\n<!-- section: swagger-explorer -->\n## Explorador interactivo de API\n\nPruebe endpoints, examine parámetros, revise esquemas de solicitud/respuesta y genere fragmentos de código listos para cURL, TypeScript y Python.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Webhooks y verificación de firma HMAC\n\nUserHQ entrega eventos HTTP POST en tiempo real cuando se crean solicitudes, cambian estados o llegan comentarios. Cada entrega incluye una firma HMAC-SHA256 en el encabezado `x-userhq-signature`.\n\n### Ejemplo de verificación HMAC en Node.js / Express\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "fr": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "Guide d utilisation & Référence API",
        "title": "Guide de la plateforme & API UserHQ",
        "subtitle": "Tout ce dont vous avez besoin pour organiser les retours clients, prioriser les demandes, publier des feuilles de route publiques et automatiser vos flux de travail.",
        "searchPlaceholder": "Rechercher des sujets..."
    },
    "groups": [
        "Mise en route",
        "Triage & Retours",
        "Portails & Feuilles de route",
        "Apparence & Alertes",
        "Automatisation & API"
    ],
    "items": {
        "overview": "Aperçu & Structure",
        "rolesPermissions": "Rôles & Permissions",
        "requestsInbox": "Demandes (Tous les tableaux)",
        "commentsAttention": "Commentaires & Attention requise",
        "authorLocation": "Contact auteur & Localisation",
        "customerPortals": "Portails clients publics",
        "roadmapChangelog": "Feuille de route & Changelog",
        "faqSystem": "FAQ en libre-service",
        "themesPush": "Thèmes & Alertes Web Push",
        "apiOverview": "Authentification API & Limites",
        "swaggerExplorer": "Explorateur d API interactif",
        "webhooksHmac": "Webhooks & Signatures HMAC"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "Boîte des demandes",
            "description": "Triez les demandes de fonctionnalités clients sur tous vos produits."
        },
        "commentsAttention": {
            "title": "Boîte des commentaires",
            "description": "File d attente d attention requise et fils de discussion d équipe."
        },
        "swaggerExplorer": {
            "title": "Explorateur d API interactif",
            "description": "Testez les endpoints, copiez les schémas et générez du code."
        },
        "webhooksHmac": {
            "title": "Webhooks & HMAC",
            "description": "Livraison d événements en temps réel et signatures SHA-256 sécurisées."
        }
    }
},
    "<!-- section: overview -->\n## Aperçu & Structure\n\nUserHQ aide votre équipe à recueillir les avis de vos clients et à agir en conséquence. Voici comment s'organise votre espace de travail :\n\n<cards>\n- **1. Workspace (Espace de travail)** : Le centre de contrôle de votre équipe. Il regroupe vos collaborateurs, la facturation, les clés API, les webhooks et la boîte de réception unifiée de retours pour tous vos produits.\n- **2. Products (Produits)** : Les applications ou services individuels que vous développez (ex. Application Web, Application iOS, API). Chaque produit dispose de son propre tableau de retours, d'une feuille de route, d'un changelog, de catégories et d'une identité visuelle propre.\n- **3. Customer Portals (Portails clients)** : Le portail personnalisé que vos utilisateurs consultent pour proposer des idées, voter pour des fonctionnalités, suivre votre feuille de route publique et lire les annonces de versions.\n</cards>\n\n<!-- section: roles-permissions -->\n## Rôles & Permissions d'équipe\n\nCollaborez facilement avec toute votre équipe tout en conservant un contrôle absolu sur les paramètres de l'espace de travail :\n\n<cards>\n- **Workspace Owner (Propriétaire)** : Contrôle total : gestion des abonnements, invitation d'administrateurs, création de clés API, configuration des webhooks et transfert de propriété.\n- **Workspace Admin (Administrateur)** : Peut gérer les produits, trier les retours, répondre officiellement aux clients, gérer les cartes de la feuille de route et publier des notes de version.\n- **Workspace Member (Membre)** : Peut consulter les suggestions, participer aux discussions internes de l'équipe et suivre les demandes des clients.\n</cards>\n\n<!-- section: requests-inbox -->\n## Demandes & Triage\n\nSituée à l'adresse `/dashboard/[ws]/requests`, la boîte de réception unifiée rassemble toutes les contributions des clients de chaque produit dans une vue de triage optimisée.\n\n<cards>\n- **Filtrage multidimensionnel** : Filtrez instantanément par produit, phase d'avancement (Backlog, En cours, Terminé), catégorie, recherche textuelle et plages de dates.\n- **Mises à jour rapides d'état** : Déplacez les éléments d'une phase à l'autre (À l'étude, Planifié, En développement, Terminé) en un clic. Les clients ayant voté pour la demande sont avertis automatiquement.\n</cards>\n\n<!-- section: comments-attention -->\n## Commentaires & Boîte d'attention requise\n\nSituée à `/dashboard/[ws]/comments`, cette boîte de réception fonctionne comme un centre de support réactif pour toutes vos discussions.\n\n### Étapes du flux de travail\n\n<stages>\n- **Needs Attention (Attention requise)** : Tout commentaire client n'ayant pas encore reçu de réponse officielle de l'équipe. Mis en avant par des indicateurs ambrés pour qu'aucune question ne soit négligée.\n- **Handled (Traité)** : Retiré automatiquement de la file d'attente dès qu'un membre de l'équipe publie une réponse officielle, ou marqué manuellement comme traité.\n</stages>\n\n<!-- section: author-location -->\n## Contact auteur & Localisation géographique\n\nPour offrir à votre équipe un contexte précieux sur les personnes soumettant des retours, les cartes de demandes et de commentaires affichent des détails utiles :\n\n- **Prise de contact directe par email** : Cliquez sur le bouton email à côté du nom de l'auteur pour le contacter directement pour des entretiens utilisateurs ou des précisions.\n- **Contexte géographique** : Consultez la localisation approximative du client (ex. `London, United Kingdom [GB]`) pour comprendre les tendances d'usage régional.\n- **Confidentialité dès la conception** : Les adresses email et coordonnées géographiques sont réservées aux membres de l'équipe et ne sont jamais visibles sur les portails publics.\n\n<!-- section: customer-portals -->\n## Portails clients publics\n\nChaque produit de votre espace de travail peut disposer de son propre portail public sur `/[ws]/[product]`.\n\n<cards>\n- **Modules de fonctionnalités activables** : Activez ou désactivez de manière indépendante le tableau d'idées, la feuille de route, le changelog ou la FAQ par produit.\n- **Image de marque & Couleurs personnalisées** : Personnalisez votre portail avec votre logo, votre nom de marque et une couleur d'accentuation sur mesure.\n- **Support multilingue & RTL** : Prise en charge de 13 langues avec détection automatique du visiteur, sélecteur de langue et rédaction de contenu traduit.\n- **Changement de langue par défaut** : Les traductions existantes sont promues dans les champs principaux et le texte précédent est conservé comme traduction.\n- **Badges utilisateurs** : Valorisez les clients avec des badges à côté de leur nom, attribués manuellement ou via des règles d'attribution automatique.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## Feuille de route & Notes de version\n\n<cards>\n- **Feuille de route interactive** : Organisez les fonctionnalités en colonnes visuelles (ex. À l'étude, Planifié, En cours). Liez directement les retours des clients aux cartes.\n- **Changelog & Annonces de versions** : Publiez des notes de version catégorisées (Nouvelle fonctionnalité, Amélioration, Correctif de bug). Informez immédiatement les utilisateurs demandeurs.\n</cards>\n\n<!-- section: faq-system -->\n## Base de connaissances FAQ en libre-service\n\nAjoutez des questions fréquentes organisées en catégories sur votre portail produit. Offrir des réponses immédiates réduit les soumissions en double et désengorge votre support.\n\n<!-- section: themes-push -->\n## Thèmes & Notifications Web Push\n\nUserHQ propose quatre thèmes : **Système**, **Clair**, **Sombre** (bleu marine profond) et **Anthracite** (proche du noir neutre). Les membres de l'équipe peuvent activer les alertes Web Push dans `/account`.\n\n<!-- section: api-overview -->\n## API d'automatisation & Authentification\n\nConnectez vos outils externes, vos pipelines CI/CD, Slack, Discord, Linear, GitHub ou vos tableaux de bord internes avec l'API REST UserHQ.\n\n### En-tête d'authentification\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **Limites de requêtes** : Limite généreuse de 120 requêtes par minute par clé API avec régulation automatique par token-bucket.\n- **Permissions ciblées** : Les clés peuvent être limitées à des produits particuliers et dotées de droits de lecture/écriture sélectifs.\n</cards>\n\n<!-- section: swagger-explorer -->\n## Explorateur d'API interactif\n\nTestez les endpoints, explorez les paramètres, inspectez les schémas de requête et réponse, et générez des exemples de code cURL, TypeScript et Python en un clic.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Webhooks & Vérification de signature HMAC\n\nUserHQ diffuse des événements HTTP POST en temps réel lors de la création de demandes, changements d'état ou publication de commentaires. Chaque envoi contient une signature sécurisée HMAC-SHA256 dans l'en-tête `x-userhq-signature`.\n\n### Exemple de vérification HMAC en Node.js / Express\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "ja": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "ユーザーガイド＆APIリファレンス",
        "title": "UserHQ プラットフォーム＆APIガイド",
        "subtitle": "顧客フィードバックの整理、要望の優先順位付け、公開ロードマップの発行、ワークフローの自動化に必要なすべてがここにあります。",
        "searchPlaceholder": "トピックを検索..."
    },
    "groups": [
        "はじめに",
        "トリアージと要望",
        "ポータルとロードマップ",
        "外観と通知",
        "自動化とAPI"
    ],
    "items": {
        "overview": "概要と構造",
        "rolesPermissions": "役割と権限",
        "requestsInbox": "要望一覧（全ボード）",
        "commentsAttention": "コメントと要対応",
        "authorLocation": "投稿者連絡先と位置情報",
        "customerPortals": "公開カスタマーポータル",
        "roadmapChangelog": "ロードマップとリリースノート",
        "faqSystem": "セルフサービスFAQ",
        "themesPush": "テーマとWeb Push通知",
        "apiOverview": "API認証とレート制限",
        "swaggerExplorer": "インタラクティブAPIエクスプローラー",
        "webhooksHmac": "WebhookとHMAC署名"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "要望受信トレイ",
            "description": "全プロダクト横断でユーザーからの機能要望をトリアージ。"
        },
        "commentsAttention": {
            "title": "コメント受信トレイ",
            "description": "要対応キューとチームディスカッションスレッド。"
        },
        "swaggerExplorer": {
            "title": "インタラクティブAPIエクスプローラー",
            "description": "エンドポイントテスト、スキーマ確認、コードスニペット生成。"
        },
        "webhooksHmac": {
            "title": "WebhookとHMAC",
            "description": "リアルタイムイベント配信と安全なSHA-256署名検証。"
        }
    }
},
    "<!-- section: overview -->\n## 概要とワークスペース構造\n\nUserHQは、チームがユーザーからのフィードバックを収集し、迅速に対応できるよう支援します。ワークスペースの構成は以下の通りです：\n\n<cards>\n- **1. Workspace（ワークスペース）**：チームの中核拠点。チームメンバー、請求管理、APIキー、Webhook、全製品横断のフィードバック受信トレイを統合管理します。\n- **2. Products（プロダクト）**：開発・提供する個々のアプリやサービス（例：Webアプリ、iOSアプリ、API）。製品ごとに個別のフィードバックボード、ロードマップ、チェンジログ、カテゴリー、ブランド設定を持ちます。\n- **3. Customer Portals（カスタマーポータル）**：ユーザーがアイデアを投稿し、機能要望に投票し、公開ロードマップを確認し、リリース告知を読むためのブランドポータルです。\n</cards>\n\n<!-- section: roles-permissions -->\n## 役割とチーム権限\n\nワークスペースの重要設定に対する安全な管理を保ちながら、チーム全体でスムーズにコラボレーションできます：\n\n<cards>\n- **Workspace Owner（オーナー）**：全権限：サブスクリプション管理、管理者の招待、APIキーの作成、Webhookの設定、所有権の譲渡。\n- **Workspace Admin（管理者）**：製品設定の管理、フィードバックのトリアージ、ユーザーへの公式返信、ロードマップカードの管理、リリースノートの公開。\n- **Workspace Member（メンバー）**：投稿されたフィードバックの閲覧、チーム内ディスカッションへの参加、ユーザー要望のトラッキング。\n</cards>\n\n<!-- section: requests-inbox -->\n## 要望一覧（全ボード）とトリアージ\n\n`/dashboard/[ws]/requests` にある統合受信トレイでは、全プロダクトに寄せられたユーザーからの投稿をひとつの高性能なトリアージビューに集約します。\n\n<cards>\n- **多次元フィルター**：プロダクト、ステータスフェーズ（バックログ、進行中、完了）、カテゴリー、キーワード検索、日付範囲で即座に絞り込み。\n- **スピーディなステータス変更**：ワンクリックでフェーズを移動（検討中、計画済み、開発中、完了）。投票したユーザーには自動で通知が届きます。\n</cards>\n\n<!-- section: comments-attention -->\n## コメントと要対応（Needs Attention）受信トレイ\n\n`/dashboard/[ws]/comments` にあるこの受信トレイは、フィードバックスレッドに対する迅速なサポートデスクとして機能します。\n\n### ワークフローステージ\n\n<stages>\n- **Needs Attention（要対応）**：チームからの公式返信がまだ行われていないユーザーコメント。アンバーカラーのインジケーターで強調表示され、見落としを防ぎます。\n- **Handled（対応済み）**：チームメンバーが公式バッジ付きで返信すると自動で要対応キューから外れます。手動で対応済みに切り替えることも可能です。\n</stages>\n\n<!-- section: author-location -->\n## 投稿者連絡先と位置情報のインサイト\n\nフィードバックを投稿したユーザーの背景を把握できるように、リクエストカードやコメントカードには投稿者の詳細情報が表示されます：\n\n- **メールでのダイレクト連絡**：投稿者名の横にあるメールアイコンをクリックして、ユーザーインタビューやヒアリングの連絡を迅速に行えます。\n- **地理的コンテキスト**：ユーザーのおおよその所在地（例：`London, United Kingdom [GB]`）を確認し、地域別の利用傾向を把握できます。\n- **プライバシー配慮の設計**：投稿者のメールアドレスや所在地はワークスペースのチームメンバーにのみ表示され、公開ポータルに露出することはありません。\n\n<!-- section: customer-portals -->\n## 公開カスタマーポータル\n\nワークスペース内のすべてのプロダクトは、`/[ws]/[product]` に専用の公開ポータルを持つことができます。\n\n<cards>\n- **モジュール式機能切り替え**：フィードバックボード、ロードマップ、チェンジログ、FAQの各機能をプロダクトごとに個別に有効化・無効化できます。\n- **カスタムブランディングとテーマカラー**：ロゴ、ブランド名、カスタムアクセントカラーを設定し、サービスの世界観に合わせたデザインを構築できます。\n- **多言語対応とRTL**：訪問者言語の自動検出、言語セレクター、13言語での多言語コンテンツ作成に対応しています。\n- **デフォルト言語の切り替え**：既存の翻訳がメインフィールドに引き上げられ、元のテキストは代替翻訳として保持されます。\n- **ユーザーバッジ**：投稿やコメントの横にバッジを表示して主要ユーザーを認知できます。手動または属性ルールで自動付与できます。\n</cards>\n\n<!-- section: roadmap-changelog -->\n## ロードマップ計画とリリースノート\n\n<cards>\n- **インタラクティブ・ロードマップ**：機能開発の進捗を視覚的なカラム（検討中、計画済み、進行中など）で整理し、ユーザーのフィードバックを直接カードに紐付けます。\n- **チェンジログとリリース発表**：カテゴリー別（新機能、改善、不具合修正）のリリースノートを公開し、要望を出したユーザーへ自動で完了報告を行えます。\n</cards>\n\n<!-- section: faq-system -->\n## セルフサービスFAQナレッジベース\n\nプロダクトポータルにカテゴリー分けされたよくある質問を追加できます。即座に疑問を解消することで、重複した要望や一般的な問い合わせを削減します。\n\n<!-- section: themes-push -->\n## テーマとWeb Push通知\n\nUserHQには4つのテーマが用意されています：**システム連動**、**ライト**、**ダーク**（ディープネイビー）、**チャコール**（ニュートラルなブラック）。チームメンバーは `/account` でWeb Push通知を有効化できます。\n\n<!-- section: api-overview -->\n## 自動化APIと認証\n\nUserHQ REST Automation APIを使用して、外部システム、CI/CDパイプライン、Slack、Discord、Linear、GitHub、社内ダッシュボードと連携できます。\n\n### 認証ヘッダー\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **レート制限**：APIキーあたり毎分120リクエストの十分なクォータをトークンバケット方式で提供します。\n- **スコープ権限**：キーを特定のプロダクトに限定し、特定リソースへの読み取り／書き込み権限を細かく制御できます。\n</cards>\n\n<!-- section: swagger-explorer -->\n## インタラクティブAPIエクスプローラー\n\nブラウザ上でエンドポイントのテスト、パラメータの確認、リクエスト／レスポンススキーマの調査、cURL・TypeScript・Pythonのコードスニペット生成が即座に行えます。\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## WebhookとHMAC署名検証\n\nUserHQは、リクエストの作成、ステータス変更、コメント投稿時にリアルタイムでHTTP POSTイベントを配信します。すべての配信には `x-userhq-signature` ヘッダーに安全なHMAC-SHA256署名が含まれます。\n\n### Node.js / Express HMAC署名検証サンプル\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "ko": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "사용자 가이드 및 API 레퍼런스",
        "title": "UserHQ 플랫폼 및 API 가이드",
        "subtitle": "고객 피드백 수집 및 우선순위 지정, 공개 로드맵 게시, 워크플로 자동화에 필요한 모든 가이드를 확인하세요.",
        "searchPlaceholder": "주제 검색..."
    },
    "groups": [
        "시작하기",
        "트리아지 및 피드백",
        "포털 및 로드맵",
        "화면 및 알림",
        "자동화 및 API"
    ],
    "items": {
        "overview": "개요 및 구조",
        "rolesPermissions": "역할 및 권한",
        "requestsInbox": "요청 받은편지함 (모든 보드)",
        "commentsAttention": "댓글 및 주의 필요",
        "authorLocation": "작성자 연락처 및 위치 정보",
        "customerPortals": "공개 고객 포털",
        "roadmapChangelog": "로드맵 및 릴리스 노트",
        "faqSystem": "셀프서비스 FAQ",
        "themesPush": "테마 및 웹 푸시 알림",
        "apiOverview": "API 인증 및 속도 제한",
        "swaggerExplorer": "인터랙티브 API 탐색기",
        "webhooksHmac": "웹훅 및 HMAC 서명"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "요청 받은편지함",
            "description": "모든 제품의 고객 기능 요청을 신속하게 분류하고 관리합니다."
        },
        "commentsAttention": {
            "title": "댓글 받은편지함",
            "description": "주의가 필요한 피드백 큐 및 팀 내부 대화 스레드."
        },
        "swaggerExplorer": {
            "title": "인터랙티브 API 탐색기",
            "description": "엔드포인트 테스트, 스키마 확인 및 코드 생성."
        },
        "webhooksHmac": {
            "title": "웹훅 및 HMAC",
            "description": "실시간 이벤트 전송 및 안전한 SHA-256 서명."
        }
    }
},
    "<!-- section: overview -->\n## 개요 및 워크스페이스 구조\n\nUserHQ는 팀이 고객 피드백을 수집하고 신속하게 대응할 수 있도록 지원합니다. 워크스페이스의 기본 구성은 다음과 같습니다:\n\n<cards>\n- **1. Workspace (워크스페이스)**: 팀의 핵심 본부입니다. 팀 멤버, 결제, API 키, 웹훅, 그리고 모든 제품을 아우르는 통합 피드백 받은편지함을 관리합니다.\n- **2. Products (제품)**: 팀이 개발하는 개별 애플리케이션 또는 서비스(예: 웹 앱, iOS 앱, API)입니다. 각 제품마다 고유한 피드백 보드, 로드맵, 변경 로그, 카테고리, 브랜딩을 가집니다.\n- **3. Customer Portals (고객 포털)**: 사용자가 아이디어를 제안하고, 기능 요청에 투표하며, 공개 로드맵을 확인하고, 릴리스 공지를 확인할 수 있는 전용 브랜드 포털입니다.\n</cards>\n\n<!-- section: roles-permissions -->\n## 역할 및 팀 권한\n\n워크스페이스 설정에 대한 강력한 보안을 유지하면서 팀 전체와 원활하게 협업할 수 있습니다:\n\n<cards>\n- **Workspace Owner (소유자)**: 완전한 제어 권한: 구독 관리, 관리자 초대, API 키 생성, 웹훅 구성 및 소유권 이전.\n- **Workspace Admin (관리자)**: 제품 관리, 피드백 분류(트리아지), 고객에 대한 공식 답변 작성, 로드맵 카드 관리, 릴리스 노트 발행.\n- **Workspace Member (멤버)**: 제출된 피드백 열람, 팀 내부 토론 참여, 고객 요청 트래킹.\n</cards>\n\n<!-- section: requests-inbox -->\n## 피드백 요청(모든 보드) 및 분류(Triage)\n\n`/dashboard/[ws]/requests`에 위치한 통합 받은편지함은 모든 제품의 고객 피드백을 단일 고성능 분류 화면으로 모아줍니다.\n\n<cards>\n- **다차원 필터링**: 제품, 상태 단계(백로그, 진행 중, 완료), 카테고리, 키워드 검색, 기간별로 즉시 필터링합니다.\n- **빠른 상태 업데이트**: 클릭 한 번으로 단계(검토 중, 계획됨, 개발 중, 완료)를 전환할 수 있으며, 투표한 고객에게 자동으로 알림이 전송됩니다.\n</cards>\n\n<!-- section: comments-attention -->\n## 댓글 및 집중 관리(Needs Attention) 받은편지함\n\n`/dashboard/[ws]/comments`에 위치한 이 받은편지함은 피드백 대화에 신속하게 대응하는 고객 지원 데스크 역할을 합니다.\n\n### 워크플로 단계\n\n<stages>\n- **Needs Attention (주의 필요)**: 팀의 공식 답변을 아직 받지 못한 고객 댓글입니다. 주황색 표시기로 강조되어 어떤 문의도 놓치지 않습니다.\n- **Handled (처리 완료)**: 팀 멤버가 공식 배지로 답변을 작성하면 큐에서 자동으로 제거되며, 수동으로 처리 완료 처리할 수도 있습니다.\n</stages>\n\n<!-- section: author-location -->\n## 작성자 연락처 및 위치 정보 인사이트\n\n피드백을 제출한 사용자에 대한 맥락을 파악할 수 있도록 요청 및 댓글 카드에 작성자 상세 정보가 표시됩니다:\n\n- **직접 이메일 연락**: 작성자 이름 옆의 이메일 버튼을 클릭하여 사용자 인터뷰나 추가 질문을 신속하게 진행할 수 있습니다.\n- **지리적 위치 파악**: 고객의 대략적인 위치(예: `London, United Kingdom [GB]`)를 확인하여 지역별 사용 트렌드를 분석할 수 있습니다.\n- **개인정보 보호 설계**: 작성자의 이메일 주소와 위치 정보는 워크스페이스 팀 멤버에게만 공개되며, 공개 포털에는 절대 노출되지 않습니다.\n\n<!-- section: customer-portals -->\n## 공개 고객 포털\n\n워크스페이스 내의 모든 제품은 `/[ws]/[product]`에서 자체 공개 포털을 운영할 수 있습니다.\n\n<cards>\n- **모듈식 기능 토글**: 제품별 준비 상태에 따라 피드백 보드, 로드맵, 변경 로그, FAQ를 독립적으로 활성화하거나 비활성화할 수 있습니다.\n- **맞춤형 브랜딩 및 색상**: 로고, 브랜드 이름, 맞춤형 강조 색상을 설정하여 제품과 자연스럽게 어우러지는 디자인을 완성합니다.\n- **다국어 및 RTL 지원**: 방문자 언어 자동 감지, 언어 선택기, 13개 언어로 현지화된 콘텐츠 작성을 지원합니다.\n- **기본 언어 변경**: 기존 번역이 기본 필드로 승격되고 이전 텍스트는 대체 번역으로 안전하게 보존됩니다.\n- **사용자 배지**: 게시물과 댓글 옆에 배지를 표시하여 주요 고객을 인정하고 우대할 수 있습니다.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## 로드맵 계획 및 릴리스 노트\n\n<cards>\n- **인터랙티브 로드맵**: 기능 개발 과정을 시각적 컬럼(검토 중, 계획됨, 진행 중 등)으로 정리하고 피드백을 카드에 직접 연결합니다.\n- **변경 로그 및 릴리스 공지**: 카테고리별(신규 기능, 개선, 버그 수정) 릴리스 노트를 발행하고 제안 고객에게 자동으로 완료 알림을 제공합니다.\n</cards>\n\n<!-- section: faq-system -->\n## 셀프서비스 FAQ 지식 베이스\n\n제품 포털에 카테고리별로 자주 묻는 질문을 추가하세요. 즉각적인 답변을 제공하면 중복 문의와 고객 지원 부담을 줄일 수 있습니다.\n\n<!-- section: themes-push -->\n## 테마 및 웹 푸시 알림\n\nUserHQ는 네 가지 테마를 지원합니다: **시스템**, **라이트**, **다크**(딥 네이비), **차콜**(차분한 그레이블랙). 팀 멤버는 `/account`에서 브라우저 웹 푸시 알림을 켤 수 있습니다.\n\n<!-- section: api-overview -->\n## 자동화 API 및 인증\n\nUserHQ REST Automation API를 통해 외부 시스템, CI/CD 파이프라인, Slack, Discord, Linear, GitHub 또는 내부 대시보드를 연결하세요.\n\n### 인증 헤더\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **요청 속도 제한**: API 키당 분당 120회 요청의 넉넉한 한도를 제공하며 토큰 버킷 방식으로 매끄럽게 조절됩니다.\n- **범위 기반 권한**: 키를 특정 제품으로 제한하고 리소스별 읽기/쓰기 권한을 정밀하게 제어할 수 있습니다.\n</cards>\n\n<!-- section: swagger-explorer -->\n## 인터랙티브 API 탐색기\n\n엔드포인트를 직접 테스트하고, 매개변수와 요청/응답 스키마를 확인하며, cURL, TypeScript, Python 코드 스니펫을 바로 생성할 수 있습니다.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## 웹훅 및 HMAC 서명 검증\n\nUserHQ는 요청 생성, 상태 변경, 새 댓글 등록 시 실시간 HTTP POST 이벤트를 전송합니다. 모든 전송에는 `x-userhq-signature` 헤더에 안전한 HMAC-SHA256 서명이 포함됩니다.\n\n### Node.js / Express HMAC 서명 검증 예시\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "pt": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "Guia do Usuário e Referência de API",
        "title": "Guia da Plataforma e API do UserHQ",
        "subtitle": "Tudo o que você precisa para organizar feedbacks de clientes, priorizar solicitações de recursos, publicar roadmaps públicos e automatizar fluxos de trabalho.",
        "searchPlaceholder": "Pesquisar tópicos..."
    },
    "groups": [
        "Primeiros Passos",
        "Triagem e Feedback",
        "Portais e Roadmaps",
        "Aparência e Alertas",
        "Automação e API"
    ],
    "items": {
        "overview": "Visão Geral e Estrutura",
        "rolesPermissions": "Funções e Permissões",
        "requestsInbox": "Solicitações (Todos os quadros)",
        "commentsAttention": "Comentários e Atenção Necessária",
        "authorLocation": "Contato do Autor e Localização",
        "customerPortals": "Portais Públicos de Clientes",
        "roadmapChangelog": "Roadmap e Notas de Lançamento",
        "faqSystem": "FAQ de Autoatendimento",
        "themesPush": "Temas e Alertas Web Push",
        "apiOverview": "Autenticação de API e Limites",
        "swaggerExplorer": "Explorador Interativo de API",
        "webhooksHmac": "Webhooks e Assinaturas HMAC"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "Caixa de Solicitações",
            "description": "Faça a triagem de solicitações de recursos em todos os seus produtos."
        },
        "commentsAttention": {
            "title": "Caixa de Comentários",
            "description": "Fila de atenção necessária e discussões da equipe."
        },
        "swaggerExplorer": {
            "title": "Explorador Interativo de API",
            "description": "Teste endpoints, copie esquemas e gere trechos de código."
        },
        "webhooksHmac": {
            "title": "Webhooks e HMAC",
            "description": "Entrega de eventos em tempo real e assinaturas SHA-256 seguras."
        }
    }
},
    "<!-- section: overview -->\n## Visão Geral e Estrutura\n\nO UserHQ ajuda sua equipe a coletar e agir sobre o feedback dos seus clientes. Veja como seu espaço de trabalho está estruturado:\n\n<cards>\n- **1. Workspace (Espaço de trabalho)**: O centro de comando da sua equipe. Reúne membros da equipe, faturamento, chaves de API, webhooks e a caixa de entrada unificada de feedback de todos os seus produtos.\n- **2. Products (Produtos)**: Os aplicativos ou serviços individuais que você desenvolve (ex.: Web App, App iOS, API). Cada produto possui seu próprio painel de feedback, roadmap, changelog, categorias e personalização de marca.\n- **3. Customer Portals (Portais de clientes)**: O portal com sua marca que seus usuários acessam para enviar ideias, votar em sugestões de recursos, acompanhar o roadmap público e ler anúncios de lançamentos.\n</cards>\n\n<!-- section: roles-permissions -->\n## Funções e Permissões de Equipe\n\nColabore de forma integrada com toda a equipe enquanto mantém o controle total sobre as configurações do espaço de trabalho:\n\n<cards>\n- **Workspace Owner (Proprietário)**: Controle total: gerenciar assinaturas, convidar administradores, criar chaves de API, configurar webhooks e transferir propriedade.\n- **Workspace Admin (Administrador)**: Pode gerenciar produtos, fazer triagem de feedback, responder oficialmente a clientes, gerenciar cartões do roadmap e publicar notas de lançamento.\n- **Workspace Member (Membro)**: Pode visualizar sugestões de feedback, participar de discussões internas da equipe e acompanhar solicitações de clientes.\n</cards>\n\n<!-- section: requests-inbox -->\n## Solicitações de Feedback e Triagem\n\nLocalizada em `/dashboard/[ws]/requests`, a caixa de entrada unificada reúne todos os envios de clientes de cada produto em uma visualização de triagem de alto desempenho.\n\n<cards>\n- **Filtragem Multidimensional**: Filtre instantaneamente por produto, estágio de status (Backlog, Em andamento, Concluído), categoria, busca por palavra-chave e intervalos de datas.\n- **Atualizações Rápidas de Status**: Mova itens entre as fases (Em análise, Planejado, Em desenvolvimento, Concluído) com um clique. Os clientes que votaram na solicitação são notificados automaticamente.\n</cards>\n\n<!-- section: comments-attention -->\n## Comentários e Fila de Atenção Necessária\n\nLocalizada em `/dashboard/[ws]/comments`, esta caixa de entrada funciona como uma central de suporte ágil para todas as discussões de feedback.\n\n### Etapas do Fluxo de Trabalho\n\n<stages>\n- **Needs Attention (Requer atenção)**: Qualquer comentário de cliente que ainda não tenha recebido uma resposta oficial da equipe. Destacado em âmbar para que nenhuma dúvida seja esquecida.\n- **Handled (Resolvido)**: Removido automaticamente da fila de atenção assim que um membro da equipe responde com um selo oficial, ou marcado manualmente como resolvido.\n</stages>\n\n<!-- section: author-location -->\n## Contato do Autor e Informações Geográficas\n\nPara fornecer à sua equipe um contexto valioso sobre quem envia sugestões, os cartões de solicitações e comentários exibem detalhes do autor:\n\n- **Contato Direto por E-mail**: Clique no botão de e-mail ao lado do nome do autor para entrar em contato diretamente para entrevistas ou perguntas de acompanhamento.\n- **Contexto Geográfico**: Veja a localização aproximada do cliente (ex.: `London, United Kingdom [GB]`) para entender as tendências geográficas de uso.\n- **Privacidade por Design**: Os endereços de e-mail e localizações são visíveis exclusivamente para os membros da equipe e nunca são exibidos nos portais públicos.\n\n<!-- section: customer-portals -->\n## Portais Públicos de Clientes\n\nCada produto no seu espaço de trabalho pode ter seu próprio portal público em `/[ws]/[product]`.\n\n<cards>\n- **Recursos Modulares**: Ative ou desative de forma independente o Painel de Feedback, Roadmap, Changelog ou FAQ por produto conforme sua necessidade.\n- **Identidade Visual e Cores Personalizadas**: Personalize seu portal com seu logotipo, nome de marca e uma cor de destaque personalizada.\n- **Suporte Multilíngue e RTL**: Suporte para 13 idiomas com detecção automática do visitante, seletores de idioma e redação de conteúdo traduzido.\n- **Alteração do Idioma Padrão**: As traduções existentes são promovidas para os campos principais e o texto anterior é mantido como tradução.\n- **Distintivos de Usuário**: Reconheça clientes com distintivos ao lado de seus nomes em postagens e comentários, atribuídos manualmente ou por regras de rastreamento.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## Planejamento de Roadmap e Notas de Lançamento\n\n<cards>\n- **Roadmap Interativo**: Organize o desenvolvimento em colunas visuais (ex.: Em avaliação, Planejado, Em andamento). Vincule sugestões diretamente aos cartões do roadmap.\n- **Changelog e Anúncios**: Publique notas de versão categorizadas (Novo recurso, Melhoria, Correção de bug). Feche o ciclo automaticamente com os clientes solicitantes.\n</cards>\n\n<!-- section: faq-system -->\n## Base de Conhecimento FAQ de Autoatendimento\n\nAdicione perguntas frequentes organizadas em categorias no portal do seu produto. Respostas imediatas reduzem solicitações duplicadas e tickets comuns de suporte.\n\n<!-- section: themes-push -->\n## Temas e Notificações Web Push\n\nO UserHQ oferece quatro temas: **Sistema**, **Claro**, **Escuro** (azul-marinho profundo) e **Carvão** (quase preto neutro). Membros da equipe podem ativar notificações Web Push em `/account`.\n\n<!-- section: api-overview -->\n## API de Automação e Autenticação\n\nConecte sistemas externos, pipelines de CI/CD, Slack, Discord, Linear, GitHub ou painéis internos através da API REST de Automação do UserHQ.\n\n### Cabeçalho de Autenticação\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **Limites de Requisição**: Limite generoso de 120 requisições por minuto por chave de API com controle de fluxo automático por token-bucket.\n- **Permissões por Escopo**: As chaves podem ser restritas a produtos específicos e receber permissões selecionadas de leitura/escrita.\n</cards>\n\n<!-- section: swagger-explorer -->\n## Explorador Interativo de API\n\nTeste endpoints, examine parâmetros, visualize esquemas de solicitação e resposta e gere trechos de código instantâneos em cURL, TypeScript e Python.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Webhooks e Verificação de Assinatura HMAC\n\nO UserHQ entrega eventos HTTP POST em tempo real quando solicitações são criadas, status mudam ou comentários chegam. Cada envio inclui uma assinatura segura HMAC-SHA256 no cabeçalho `x-userhq-signature`.\n\n### Exemplo de Verificação HMAC em Node.js / Express\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "ru": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "Руководство пользователя и справочник API",
        "title": "Руководство по платформе и API UserHQ",
        "subtitle": "Всё необходимое для сбора отзывов клиентов, приоритизации запросов, публикации публичных дорожных карт и автоматизации рабочих процессов.",
        "searchPlaceholder": "Поиск по разделам..."
    },
    "groups": [
        "Начало работы",
        "Сортировка и отзывы",
        "Порталы и дорожные карты",
        "Оформление и уведомления",
        "Автоматизация и API"
    ],
    "items": {
        "overview": "Обзор и структура",
        "rolesPermissions": "Роли и права",
        "requestsInbox": "Запросы (Все доски)",
        "commentsAttention": "Комментарии и внимание",
        "authorLocation": "Контакты автора и локация",
        "customerPortals": "Клиентские порталы",
        "roadmapChangelog": "Дорожная карта и релизы",
        "faqSystem": "База знаний FAQ",
        "themesPush": "Темы и Web Push",
        "apiOverview": "Аутентификация API и лимиты",
        "swaggerExplorer": "Интерактивный обозреватель API",
        "webhooksHmac": "Вебхуки и подписи HMAC"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "Входящие запросы",
            "description": "Сортируйте запросы функций по всем продуктам в едином окне."
        },
        "commentsAttention": {
            "title": "Входящие комментарии",
            "description": "Очередь требующих внимания сообщений и треды команды."
        },
        "swaggerExplorer": {
            "title": "Интерактивный обозреватель API",
            "description": "Тестируйте эндпоинты, копируйте схемы и создавайте код."
        },
        "webhooksHmac": {
            "title": "Вебхуки и HMAC",
            "description": "Доставка событий в реальном времени и подписи SHA-256."
        }
    }
},
    "<!-- section: overview -->\n## Обзор и структура\n\nUserHQ помогает вашей команде собирать отзывы клиентов и принимать обоснованные решения. Вот как устроено ваше рабочее пространство:\n\n<cards>\n- **1. Workspace (Рабочее пространство)**: Главный центр вашей команды. Здесь находятся участники, биллинг, API-ключи, вебхуки и единый входящий ящик отзывов по всем продуктам.\n- **2. Products (Продукты)**: Отдельные приложения или сервисы, которые вы создаете (например, веб-приложение, iOS-приложение, API). У каждого продукта своя доска отзывов, дорожная карта, список изменений, категории и фирменный стиль.\n- **3. Customer Portals (Клиентские порталы)**: Брендированный портал, на который заходят ваши пользователи, чтобы предложить идеи, проголосовать за функции, следить за дорожной картой и читать анонсы релизов.\n</cards>\n\n<!-- section: roles-permissions -->\n## Роли и права команды\n\nСотрудничайте со всей командой, сохраняя полный контроль над настройками рабочего пространства:\n\n<cards>\n- **Workspace Owner (Владелец)**: Полный контроль: управление подписками, приглашение администраторов, создание API-ключей, настройка вебхуков и передача владения.\n- **Workspace Admin (Администратор)**: Управление продуктами, сортировка отзывов, официальные ответы клиентам, управление карточками дорожной карты и публикация релизов.\n- **Workspace Member (Участник)**: Просмотр поступивших отзывов, участие во внутренних обсуждениях команды и отслеживание запросов клиентов.\n</cards>\n\n<!-- section: requests-inbox -->\n## Запросы отзывов и сортировка (Triage)\n\nРаздел `/dashboard/[ws]/requests` объединяет все клиентские запросы из каждого продукта в единый высокопроизводительный интерфейс сортировки.\n\n<cards>\n- **Многомерная фильтрация**: Мгновенный фильтр по продукту, статусу (Бэклог, В работе, Завершено), категории, ключевым словам и диапазонам дат.\n- **Быстрое обновление статусов**: Перемещайте запросы между этапами (На рассмотрении, Запланировано, В работе, Завершено) в один клик с автоматическим уведомлением проголосовавших клиентов.\n</cards>\n\n<!-- section: comments-attention -->\n## Комментарии и раздел «Требует внимания»\n\nВходящий ящик `/dashboard/[ws]/comments` работает как оперативная служба поддержки для всех обсуждений и отзывов.\n\n### Этапы рабочего процесса\n\n<stages>\n- **Needs Attention (Требует внимания)**: Любой комментарий клиента, на который еще не дан официальный ответ команды. Подсвечивается янтарным индикатором, чтобы ни один вопрос не был забыт.\n- **Handled (Обработано)**: Автоматически удаляется из очереди внимания после ответа члена команды с официальным бейджем или отмечается вручную.\n</stages>\n\n<!-- section: author-location -->\n## Контакты авторов и геолокация\n\nЧтобы предоставить команде ценный контекст о пользователях, карточки запросов и комментариев отображают информацию об авторе:\n\n- **Прямая связь по почте**: Нажмите кнопку отправки письма рядом с именем автора, чтобы связаться с ним для интервью или уточнения деталей.\n- **Географический контекст**: Просматривайте примерное местоположение клиента (например, `London, United Kingdom [GB]`), чтобы анализировать региональные тренды.\n- **Конфиденциальность**: Email-адреса и геолокация доступны исключительно участникам команды и никогда не показываются на публичных порталах.\n\n<!-- section: customer-portals -->\n## Публичные клиентские порталы\n\nКаждый продукт в вашем рабочем пространстве может иметь собственный публичный портал по адресу `/[ws]/[product]`.\n\n<cards>\n- **Модульные переключатели функций**: Включайте или отключайте доску отзывов, дорожную карту, список изменений или базу FAQ для каждого продукта отдельно.\n- **Фирменный стиль и цвета**: Настройте портал с помощью логотипа, названия бренда и уникального акцентного цвета.\n- **Мультиязычность и RTL**: Поддержка 13 языков с автоматическим определением языка посетителя, выбором языка и локализованным созданием контента.\n- **Смена основного языка**: Существующие переводы переносятся в основные поля, а предыдущий текст сохраняется как перевод.\n- **Бейджи пользователей**: Выделяйте клиентов специальными бейджами возле имени, назначенными вручную или правилами атрибуции.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## Дорожная карта и журнал обновлений\n\n<cards>\n- **Интерактивная дорожная карта**: Организуйте развитие функций в наглядные колонки (На рассмотрении, Запланировано, В разработке). Связывайте отзывы с карточками.\n- **Changelog и анонсы релизов**: Публикуйте структурированные заметки о выпусках (Новая функция, Улучшение, Исправление ошибок) с автоматическим уведомлением клиентов.\n</cards>\n\n<!-- section: faq-system -->\n## База знаний и частые вопросы (FAQ)\n\nДобавляйте частые вопросы, распределенные по категориям, на портал продукта. Мгновенные ответы сокращают число повторных запросов и разгружают команду.\n\n<!-- section: themes-push -->\n## Темы оформления и Web Push уведомления\n\nВ UserHQ доступны четыре темы: **Системная**, **Светлая**, **Темная** (глубокий синий) и **Угольная** (нейтральный графит). Участники команды могут включить Web Push в `/account`.\n\n<!-- section: api-overview -->\n## API автоматизации и аутентификация\n\nИнтегрируйте внешние системы, CI/CD-пайплайны, Slack, Discord, Linear, GitHub или внутренние дашборды с помощью REST Automation API UserHQ.\n\n### Заголовок аутентификации\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **Лимиты запросов**: Щедрый лимит в 120 запросов в минуту на каждый API-ключ с автоматическим троттлингом (token-bucket).\n- **Разделение прав**: Ключи можно ограничить конкретными продуктами и настроить индивидуальные права на чтение/запись.\n</cards>\n\n<!-- section: swagger-explorer -->\n## Интерактивный обозреватель API\n\nТестируйте эндпоинты, проверяйте параметры, изучайте схемы запросов и ответов и генерируйте готовые фрагменты кода для cURL, TypeScript и Python.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Вебхуки и проверка подписи HMAC\n\nUserHQ отправляет события HTTP POST в режиме реального времени при создании запросов, смене статусов или добавлении комментариев. Каждая доставка содержит безопасную подпись HMAC-SHA256 в заголовке `x-userhq-signature`.\n\n### Пример проверки HMAC на Node.js / Express\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "zh": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "用户指南与 API 参考",
        "title": "UserHQ 平台与 API 使用指南",
        "subtitle": "组织客户反馈、规划功能优先级、发布公开路线图与实现工作流自动化的完整指南。",
        "searchPlaceholder": "搜索指南主题..."
    },
    "groups": [
        "快速入门",
        "分流与反馈",
        "门户与路线图",
        "外观与推送",
        "自动化与 API"
    ],
    "items": {
        "overview": "概览与结构",
        "rolesPermissions": "角色与权限",
        "requestsInbox": "需求收件箱（全部看板）",
        "commentsAttention": "评论与待处理事项",
        "authorLocation": "提交者联系与地理分布",
        "customerPortals": "公开客户门户",
        "roadmapChangelog": "路线图与更新日志",
        "faqSystem": "自助式 FAQ",
        "themesPush": "主题与 Web Push 通知",
        "apiOverview": "API 鉴权与速率限制",
        "swaggerExplorer": "交互式 API 资源管理器",
        "webhooksHmac": "Webhooks 与 HMAC 签名"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "需求收件箱",
            "description": "跨所有产品集中分流并管理客户提出的功能需求。"
        },
        "commentsAttention": {
            "title": "评论收件箱",
            "description": "待处理事项队列与团队协作讨论线程。"
        },
        "swaggerExplorer": {
            "title": "交互式 API 资源管理器",
            "description": "在线测试接口、查看数据结构并一键生成调用代码。"
        },
        "webhooksHmac": {
            "title": "Webhooks 与 HMAC",
            "description": "实时事件推送投递与安全的 SHA-256 签名校验。"
        }
    }
},
    "<!-- section: overview -->\n## 概览与结构\n\nUserHQ 帮助您的团队收集并有效处理来自客户的反馈意见。以下是工作区的核心结构：\n\n<cards>\n- **1. Workspace（工作区）**：团队的中央中枢。管理团队成员、账单计费、API 密钥、Webhooks 以及跨所有产品的统一反馈收件箱。\n- **2. Products（产品）**：您构建的独立应用或服务（例如 Web 应用、iOS 应用、API）。每个产品都有独立的反馈面板、路线图、更新日志、分类以及品牌定制。\n- **3. Customer Portals（客户门户）**：带有品牌标识的公开门户，用户可在其中提交建议、为功能需求投票、关注公开路线图并查看版本发布公告。\n</cards>\n\n<!-- section: roles-permissions -->\n## 团队角色与权限控制\n\n在保持对工作区设置完全掌控的同时，与整个团队顺畅协作：\n\n<cards>\n- **Workspace Owner（所有者）**：最高控制权：管理订阅计费、邀请管理员、生成 API 密钥、配置 Webhooks 以及转移所有权。\n- **Workspace Admin（管理员）**：管理产品配置、分流与归类反馈、以官方身份回复客户、管理路线图卡片以及发布更新日志。\n- **Workspace Member（成员）**：查看客户反馈提案、参与团队内部讨论并跟进客户需求。\n</cards>\n\n<!-- section: requests-inbox -->\n## 需求提案与分流处理（Triage）\n\n位于 `/dashboard/[ws]/requests`，统一需求收件箱将所有产品的客户提交整合到一个高效的分流看板中。\n\n<cards>\n- **多维度筛选**：按产品、状态阶段（待办、进行中、已完成）、分类、关键词搜索和日期范围即时筛选。\n- **快速状态流转**：一键在不同阶段间切换（评估中、已规划、开发中、已完成），系统会自动通知为该需求投票的客户。\n</cards>\n\n<!-- section: comments-attention -->\n## 评论与待处理收件箱\n\n位于 `/dashboard/[ws]/comments`，此收件箱相当于一个快速响应的客户支持中心。\n\n### 工作流阶段\n\n<stages>\n- **Needs Attention（需要关注）**：尚未收到团队官方回复的客户评论。以琥珀色高亮指示器标识，确保不错过任何客户疑问。\n- **Handled（已处理）**：团队成员发布官方回复后自动移出关注队列，或支持手动标记为已处理。\n</stages>\n\n<!-- section: author-location -->\n## 提交者联系与地理洞察\n\n为了向团队提供关于反馈来源的深度背景，需求和评论卡片会展示提交者详细信息：\n\n- **直接邮件沟通**：点击提交者姓名旁的邮件图标，即可发起沟通、预约用户访谈或进行需求追问。\n- **地理分布洞察**：查看客户的大致地理位置（例如 `London, United Kingdom [GB]`），以便了解区域使用习惯与趋势。\n- **隐私保护设计**：提交者邮箱与地理位置仅对工作区团队成员可见，绝不会公开在外部客户门户上。\n</cards>\n\n<!-- section: customer-portals -->\n## 公开客户门户\n\n工作区中的每个产品都可以在 `/[ws]/[product]` 拥有专属的公开门户。\n\n<cards>\n- **模块化功能开关**：根据当前开放进度，针对各个产品分别开启或关闭反馈面板、路线图、更新日志或常见问题（FAQ）。\n- **自定义品牌与主题色**：上传 Logo、配置品牌名称并挑选自定义强调色，打造与应用无缝融合的视觉体验。\n- **多语言与 RTL 镜像支持**：全面支持 13 种语言，具备访客语言智能检测、语言切换器及本地化内容编辑功能。\n- **默认语言无缝切换**：切换默认语言时，现有翻译自动升级为主字段，旧文本安全归档为翻译。\n- **用户徽章认证**：通过发帖与评论旁的身份徽章认可核心客户，支持手动分配或基于链接归因规则自动发放。\n</cards>\n\n<!-- section: roadmap-changelog -->\n## 路线图规划与版本发布\n\n<cards>\n- **互动式路线图**：将功能进度划分为直观的看板列（评估中、计划中、进行中），并将客户反馈直接关联到卡片上。\n- **更新日志与发布公告**：发布带有分类标签（新功能、改进优化、问题修复）的更新公告，自动闭环通知关注客户。\n</cards>\n\n<!-- section: faq-system -->\n## 自助式 FAQ 知识库\n\n在产品门户上添加按分类组织的常见问题解答。及时答疑能有效减少重复需求提交并降低客服支持压力。\n\n<!-- section: themes-push -->\n## 外观主题与 Web Push 通知\n\nUserHQ 提供四种主题：**跟随系统**、**浅色**、**深蓝**（Deep Navy）与**炭黑**（Charcoal）。团队成员可在 `/account` 中启用浏览器 Web Push 推送，第一时间获悉新反馈与评论。\n\n<!-- section: api-overview -->\n## 自动化 API 与身份鉴权\n\n通过 UserHQ REST Automation API，无缝连接外部系统、CI/CD 流程、Slack、Discord、Linear、GitHub 或内部监控大盘。\n\n### 鉴权请求头（Header）\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **速率限制**：每个 API 密钥享有每分钟 120 次请求的充裕额度，内置令牌桶平滑限流保护。\n- **按范围分配权限**：可将密钥权限限制在指定产品，并精准控制读写资源范围。\n</cards>\n\n<!-- section: swagger-explorer -->\n## 交互式 API 资源管理器\n\n直接在线测试接口、检查参数定义、查看请求与响应 Schema，并一键生成 cURL、TypeScript 与 Python 调用代码。\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Webhooks 与 HMAC 签名验证\n\n当创建需求、更新状态或发表评论时，UserHQ 会实时分发 HTTP POST 事件。每次投递均在 `x-userhq-signature` 请求头中附带安全的 HMAC-SHA256 签名。\n\n### Node.js / Express HMAC 验证示例\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "fil": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "Gabay ng Gumagamit at Sanggunian ng API",
        "title": "Gabay sa Plataporma at API ng UserHQ",
        "subtitle": "Lahat ng kailangan mo upang mag-organisa ng feedback ng customer, mag-prioritize ng mga kahilingan sa feature, mag-publish ng mga pampublikong roadmap, at mag-automate ng mga workflow.",
        "searchPlaceholder": "Maghanap ng mga paksa..."
    },
    "groups": [
        "Pagsisimula",
        "Triage at Feedback",
        "Mga Portal at Roadmap",
        "Hitsura at Mga Alerto",
        "Automation at API"
    ],
    "items": {
        "overview": "Pangkalahatang-ideya at Estruktura",
        "rolesPermissions": "Mga Tungkulin at Pahintulot",
        "requestsInbox": "Mga Kahilingan (Lahat ng Board)",
        "commentsAttention": "Mga Komento at Kailangan ng Pansin",
        "authorLocation": "Pakikipag-ugnayan sa May-akda at Lokasyon",
        "customerPortals": "Mga Pampublikong Portal ng Customer",
        "roadmapChangelog": "Roadmap at Changelog",
        "faqSystem": "Self-Serve FAQ",
        "themesPush": "Mga Tema at Web Push Alerts",
        "apiOverview": "Pagpapatotoo ng API at Mga Limitasyon",
        "swaggerExplorer": "Interaktibong API Explorer",
        "webhooksHmac": "Mga Webhook at HMAC Signatures"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "Inbox ng Kahilingan",
            "description": "I-triage ang mga hiling na feature ng customer sa lahat ng produkto."
        },
        "commentsAttention": {
            "title": "Inbox ng Komento",
            "description": "Pila ng kailangan ng pansin at mga talakayan ng koponan."
        },
        "swaggerExplorer": {
            "title": "Interaktibong API Explorer",
            "description": "Subukan ang mga endpoint, kopyahin ang mga schema, at bumuo ng code."
        },
        "webhooksHmac": {
            "title": "Mga Webhook at HMAC",
            "description": "Real-time na paghahatid ng kaganapan at mga lagda ng SHA-256."
        }
    }
},
    "<!-- section: overview -->\n## Pangkalahatang-ideya at Estruktura\n\nTinutulungan ng UserHQ ang iyong koponan na mangolekta at umaksyon sa feedback mula sa iyong mga customer. Narito kung paano nakaayos ang iyong workspace:\n\n<cards>\n- **1. Workspace**: Ang punong himpilan ng iyong koponan. Narito ang mga miyembro, pagsingil, mga API key, webhook, at ang pinag-isang feedback inbox sa lahat ng iyong produkto.\n- **2. Products (Mga Produkto)**: Ang mga indibidwal na app o serbisyong binuo mo (hal. Web App, iOS App, API). Bawat produkto ay may sariling feedback board, roadmap, changelog, mga kategorya, at sariling branding.\n- **3. Customer Portals (Mga Portal ng Customer)**: Ang branded na portal na binibisita ng iyong mga user para magsumite ng ideya, bumoto sa mga hiling na feature, subaybayan ang pampublikong roadmap, at magbasa ng mga release announcement.\n</cards>\n\n<!-- section: roles-permissions -->\n## Mga Tungkulin at Pahintulot ng Koponan\n\nMakipagtulungan nang maayos sa buong koponan habang pinapanatili ang ganap na kontrol sa mga setting ng workspace:\n\n<cards>\n- **Workspace Owner (May-ari)**: Ganap na kontrol sa workspace: pamahalaan ang mga subscription, mag-imbita ng mga admin, gumawa ng mga API key, mag-configure ng mga webhook, at maglipat ng pagmamay-ari.\n- **Workspace Admin (Admin)**: Maaaring mamahala ng mga produkto, mag-triage ng feedback, opisyal na sumagot sa mga customer, pamahalaan ang mga roadmap card, at mag-publish ng release notes.\n- **Workspace Member (Miyembro)**: Maaaring tumingin ng mga naisumiteng feedback, makilahok sa mga panloob na talakayan ng koponan, at sumubaybay sa mga kahilingan ng customer.\n</cards>\n\n<!-- section: requests-inbox -->\n## Mga Kahilingan at Pag-triage\n\nMatatagpuan sa `/dashboard/[ws]/requests`, pinagsasama-sama ng pinag-isang Requests inbox ang lahat ng isinumite ng mga customer mula sa bawat produkto sa isang mabilis na triage view.\n\n<cards>\n- **Multi-Dimension Filtering**: Salain agad ayon sa Produkto, Yugto ng Katayuan (Backlog, Kasalukuyang Ginagawa, Tapos na), Kategorya, Paghahanap gamit ang keyword, at Saklaw ng petsa.\n- **Mabilis na Pag-update ng Katayuan**: Ilipat ang mga aytem sa mga yugto (Sinusuri, Nakaplano, Ginagawa, Tapos na) sa isang click. Awtomatikong maipaaalam sa mga customer na bumoto sa kahilingan.\n</cards>\n\n<!-- section: comments-attention -->\n## Mga Komento at Inbox ng Nangangailangan ng Pansin\n\nMatatagpuan sa `/dashboard/[ws]/comments`, ang inbox na ito ay gumaganap bilang isang mabilis na customer support desk para sa iyong mga talakayan ng feedback.\n\n### Mga Yugto ng Daloy ng Trabaho\n\n<stages>\n- **Needs Attention (Kailangan ng Pansin)**: Anumang komento ng customer na wala pang opisyal na sagot mula sa koponan. Minamarkahan ng kulay-amber na indicator upang walang makaligtaang katanungan.\n- **Handled (Naasikaso na)**: Awtomatikong naaalis mula sa pila ng pansin kapag sumagot ang isang miyembro ng koponan na may opisyal na badge, o manu-manong minamarkahan bilang naasikaso na.\n</stages>\n\n<!-- section: author-location -->\n## Pakikipag-ugnayan sa May-akda at Impormasyon sa Lokasyon\n\nUpang bigyan ang iyong koponan ng mahalagang konteksto kung sino ang nagsumite ng feedback, nagpapakita ang mga card ng kahilingan at komento ng mga detalye ng may-akda:\n\n- **Direktang Pakikipag-ugnayan sa Email**: I-click ang mail button sa tabi ng pangalan ng may-akda upang mabilis silang makausap para sa mga panayam sa user o mga tanong.\n- **Heograpikong Konteksto**: Tingnan ang tinatayang lokasyon ng customer (hal. `London, United Kingdom [GB]`) upang maunawaan ang mga trend ng paggamit ayon sa rehiyon.\n- **Disenyong Nakalaan sa Privacy**: Ang mga email address at lokasyon ng mga may-akda ay makikita lamang ng mga miyembro ng koponan ng workspace at hindi kailanman ipinapakita sa mga pampublikong portal ng customer.\n\n<!-- section: customer-portals -->\n## Mga Pampublikong Portal ng Customer\n\nBawat produkto sa iyong workspace ay maaaring magkaroon ng sarili nitong pampublikong portal sa `/[ws]/[product]`.\n\n<cards>\n- **Modular Feature Toggles**: Malayang i-enable o i-disable ang Feedback Board, Roadmap, Changelog, o FAQ sa bawat produkto batay sa iyong kahandaan.\n- **Custom Branding at Mga Kulay**: I-customize ang iyong portal gamit ang iyong logo, pangalan ng brand, at custom na accent color para maging seamless na extension ng iyong app.\n- **Multi-Language at RTL**: Suporta para sa 13 wika na may awtomatikong pagtukoy sa bisita, tagapili ng wika, at pagsusulat ng naisalokal na content.\n- **Pagpapalit ng Default na Wika**: Ang mga umiiral na pagsasalin ay itinataas sa mga pangunahing field at ang dating teksto ay pinapanatili bilang pagsasalin.\n- **Mga Badge ng User**: Kilalanin ang mga customer gamit ang mga badge sa tabi ng kanilang pangalan sa mga post at komento, na itinalaga nang manu-mano o sa pamamagitan ng mga panuntunan sa pagpapatungkol.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## Pagpaplano ng Roadmap at Mga Tala sa Paglabas (Changelog)\n\n<cards>\n- **Interaktibong Roadmap**: Isaayos ang pagbuo ng feature sa mga visual na column (hal. Pinag-iisipan, Nakaplano, Ginagawa). Direktang i-link ang feedback ng customer sa mga roadmap card.\n- **Changelog at Mga Anunsyo**: Mag-publish ng mga tala sa paglabas na may mga tag ng kategorya (Bagong Feature, Pagpapabuti, Pag-aayos ng Bug) at awtomatikong ipaalam sa mga humiling na customer.\n</cards>\n\n<!-- section: faq-system -->\n## Self-Serve FAQ Knowledge Base\n\nMagdagdag ng mga madalas itanong na nakaayos sa mga kategorya sa portal ng iyong produkto. Ang pagbibigay ng agarang sagot ay nagbabawas ng mga duplicate na hiling at karaniwang ticket sa suporta.\n\n<!-- section: themes-push -->\n## Mga Tema at Web Push Alert\n\nKasama sa UserHQ ang apat na tema: **System**, **Light**, **Dark** (malalim na navy), at **Charcoal** (neutral na halos itim). Maaari ding i-enable ng mga miyembro ng koponan ang browser Web Push notifications sa `/account`.\n\n<!-- section: api-overview -->\n## Automation API at Pagpapatotoo\n\nIkonekta ang mga panlabas na system, CI/CD pipeline, Slack, Discord, Linear, GitHub, o mga panloob na dashboard gamit ang UserHQ REST Automation API.\n\n### Header ng Pagpapatotoo\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **Mga Limitasyon sa Rate**: Mapagbigay na 120 kahilingan/minuto na allowance bawat API key na may awtomatikong token-bucket throttling.\n- **Mga Naka-scope na Pahintulot**: Ang mga key ay maaaring i-scope sa mga partikular na produkto at bigyan ng mga piling pahintulot sa pagbasa/pagsulat.\n</cards>\n\n<!-- section: swagger-explorer -->\n## Interaktibong API Explorer\n\nSubukan ang mga endpoint, suriin ang mga parameter, tingnan ang mga schema ng kahilingan at tugon, at bumuo ng agarang mga snippet ng code sa cURL, TypeScript, at Python.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Mga Webhook at Pagpapatunay ng Lagda ng HMAC\n\nNaghahatid ang UserHQ ng mga real-time na kaganapan sa HTTP POST sa tuwing may ginagawang mga kahilingan, nagbabago ang katayuan, o dumarating ang mga komento. Bawat paghahatid ay may secure na lagda ng HMAC-SHA256 sa header na `x-userhq-signature`.\n\n### Halimbawa ng Pag-verify ng HMAC sa Node.js / Express\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "hi": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "उपयोगकर्ता गाइड एवं API संदर्भ",
        "title": "UserHQ प्लेटफ़ॉर्म एवं API गाइड",
        "subtitle": "ग्राहकों के फीडबैक को व्यवस्थित करने, सुविधाओं को प्राथमिकता देने, सार्वजनिक रोडमैप प्रकाशित करने और वर्कफ़्लो को स्वचालित करने के लिए आवश्यक सब कुछ।",
        "searchPlaceholder": "विषय खोजें..."
    },
    "groups": [
        "आरंभ करें",
        "छंटाई एवं फीडबैक",
        "पोर्टल एवं रोडमैप",
        "दिखावट एवं अलर्ट",
        "ऑटोमेशन एवं API"
    ],
    "items": {
        "overview": "अवलोकन एवं संरचना",
        "rolesPermissions": "भूमिकाएं और अनुमतियां",
        "requestsInbox": "अनुरोध (सभी बोर्ड)",
        "commentsAttention": "टिप्पणियां एवं ध्यान अपेक्षित",
        "authorLocation": "लेखक संपर्क एवं भौगोलिक स्थिति",
        "customerPortals": "सार्वजनिक ग्राहक पोर्टल",
        "roadmapChangelog": "रोडमैप एवं चेंजलॉग",
        "faqSystem": "सेल्फ़-सर्विस FAQ",
        "themesPush": "थीम्स एवं वेब पुश अलर्ट",
        "apiOverview": "API प्रमाणीकरण एवं सीमाएं",
        "swaggerExplorer": "इंटरैक्टिव API एक्सप्लोरर",
        "webhooksHmac": "वेबहुक एवं HMAC हस्ताक्षर"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "अनुरोध इनबॉक्स",
            "description": "अपने सभी उत्पादों में ग्राहकों के सुविधा अनुरोधों की छंटाई करें।"
        },
        "commentsAttention": {
            "title": "टिप्पणी इनबॉक्स",
            "description": "ध्यान अपेक्षित कतार और टीम वार्तालाप थ्रेड्स।"
        },
        "swaggerExplorer": {
            "title": "इंटरैक्टिव API एक्सप्लोरर",
            "description": "एंडपॉइंट्स का परीक्षण करें, स्कीमा देखें और कोड स्निपेट तैयार करें।"
        },
        "webhooksHmac": {
            "title": "वेबहुक और HMAC",
            "description": "रीयल-टाइम ईवेंट डिलीवरी और सुरक्षित SHA-256 हस्ताक्षर।"
        }
    }
},
    "<!-- section: overview -->\n## अवलोकन एवं संरचना\n\nUserHQ आपकी टीम को ग्राहकों से प्रतिक्रिया (फीडबैक) एकत्र करने और उस पर त्वरित कार्रवाई करने में सहायता करता है। आपके कार्यक्षेत्र (Workspace) की संरचना इस प्रकार है:\n\n<cards>\n- **1. Workspace (कार्यक्षेत्र)**: आपकी टीम का केंद्रीय मुख्यालय। यहां टीम के सदस्य, बिलिंग, API कुंजी, वेबहुक और आपके सभी उत्पादों का एकीकृत फीडबैक इनबॉक्स प्रबंधित होता है।\n- **2. Products (उत्पाद)**: आपके द्वारा निर्मित व्यक्तिगत ऐप्स या सेवाएं (जैसे वेब ऐप, iOS ऐप, API)। प्रत्येक उत्पाद का अपना फीडबैक बोर्ड, रोडमैप, चेंजलॉग, श्रेणियां और ब्रांडिंग होती है।\n- **3. Customer Portals (ग्राहक पोर्टल)**: ब्रांडेड पोर्टल जहां उपयोगकर्ता विचार प्रस्तुत करने, नई सुविधाओं के लिए वोट करने, सार्वजनिक रोडमैप देखने और रिलीज घोषणाएं पढ़ने आते हैं।\n</cards>\n\n<!-- section: roles-permissions -->\n## भूमिकाएं और टीम अनुमतियां\n\nकार्यक्षेत्र सेटिंग्स पर पूर्ण नियंत्रण बनाए रखते हुए अपनी संपूर्ण टीम के साथ सहजता से सहयोग करें:\n\n<cards>\n- **Workspace Owner (मालिक)**: पूर्ण नियंत्रण: सदस्यता और बिलिंग प्रबंधन, व्यवस्थापकों को आमंत्रित करना, API कुंजियां बनाना, वेबहुक कॉन्फ़िगर करना और स्वामित्व हस्तांतरित करना।\n- **Workspace Admin (व्यवस्थापक)**: उत्पादों का प्रबंधन, फीडबैक की छंटाई (Triage), ग्राहकों को आधिकारिक उत्तर देना, रोडमैप कार्ड प्रबंधित करना और रिलीज नोट्स प्रकाशित करना।\n- **Workspace Member (सदस्य)**: फीडबैक प्रविष्टियां देखना, आंतरिक टीम चर्चाओं में भाग लेना और ग्राहकों के अनुरोधों को ट्रैक करना।\n</cards>\n\n<!-- section: requests-inbox -->\n## अनुरोध इनबॉक्स और छंटाई (Triage)\n\n`/dashboard/[ws]/requests` पर स्थित एकीकृत अनुरोध इनबॉक्स हर उत्पाद से आने वाली सभी ग्राहक प्रविष्टियों को एक उच्च-प्रदर्शन छंटाई दृश्य में समेकित करता है।\n\n<cards>\n- **बहु-आयामी फ़िल्टरिंग**: उत्पाद, स्थिति चरण (बैकलॉग, प्रगति पर, पूर्ण), श्रेणी, कीवर्ड खोज और तिथि सीमा के आधार पर तुरंत फ़िल्टर करें।\n- **त्वरित स्थिति परिवर्तन**: एक क्लिक में चरणों (समीक्षाधीन, नियोजित, प्रगति पर, पूर्ण) के बीच आइटम ले जाएं। अनुरोध पर वोट करने वाले ग्राहकों को स्वतः सूचना भेजी जाती है।\n</cards>\n\n<!-- section: comments-attention -->\n## टिप्पणियां और ध्यान अपेक्षित (Needs Attention) इनबॉक्स\n\n`/dashboard/[ws]/comments` पर स्थित यह इनबॉक्स आपकी फीडबैक चर्चाओं के लिए एक उत्तरदायी सहायता डेस्क की तरह कार्य करता है।\n\n### कार्यप्रवाह चरण\n\n<stages>\n- **Needs Attention (ध्यान अपेक्षित)**: ग्राहक की कोई भी टिप्पणी जिसे टीम से आधिकारिक प्रतिक्रिया नहीं मिली है। एम्बर संकेतक के साथ हाइलाइट किया जाता है ताकि कोई भी प्रश्न छूट न जाए।\n- **Handled (निपटारा हो चुका)**: टीम के सदस्य द्वारा आधिकारिक बैज के साथ उत्तर देते ही स्वचालित रूप से कतार से हटा दिया जाता है, या मैन्युअल रूप से निपटा हुआ चिह्नित किया जा सकता है।\n</stages>\n\n<!-- section: author-location -->\n## लेखक संपर्क और भौगोलिक जानकारी\n\nफीडबैक प्रस्तुत करने वाले उपयोगकर्ताओं की बेहतर समझ के लिए अनुरोध और टिप्पणी कार्ड लेखक का विवरण प्रदर्शित करते हैं:\n\n- **सीधा ईमेल संपर्क**: उपयोगकर्ता साक्षात्कार या अनुवर्ती प्रश्नों के लिए लेखक के नाम के बगल में दिए गए मेल बटन पर क्लिक करें।\n- **भौगोलिक संदर्भ**: क्षेत्रीय उपयोग के रुझानों को समझने के लिए ग्राहक का अनुमानित स्थान (उदा. `London, United Kingdom [GB]`) देखें।\n- **गोपनीयता सुरक्षा**: लेखकों के ईमेल पते और स्थान केवल टीम के सदस्यों को दिखाई देते हैं और सार्वजनिक ग्राहक पोर्टल्स पर कभी प्रदर्शित नहीं होते।\n\n<!-- section: customer-portals -->\n## सार्वजनिक ग्राहक पोर्टल\n\nआपके कार्यक्षेत्र के प्रत्येक उत्पाद का `/[ws]/[product]` पर अपना सार्वजनिक पोर्टल हो सकता है।\n\n<cards>\n- **मॉड्यूलर सुविधा टॉगल**: अपनी तैयारी के अनुसार प्रत्येक उत्पाद के लिए फीडबैक बोर्ड, रोडमैप, चेंजलॉग या FAQ को स्वतंत्र रूप से सक्षम या अक्षम करें।\n- **कस्टम ब्रांडिंग और रंग**: अपने लोगो, ब्रांड नाम और एक्सेंट रंग के साथ अपने पोर्टल को अनुकूलित करें।\n- **बहुभाषी और RTL समर्थन**: स्वचालित आगंतुक पहचान, भाषा चयनकर्ता और स्थानीयकृत सामग्री निर्माण के साथ 13 भाषाओं का समर्थन।\n- **डिफ़ॉल्ट भाषा बदलना**: मौजूदा अनुवादों को मुख्य फ़ील्ड में पदोन्नत किया जाता है और पिछले पाठ को अनुवाद के रूप में सहेजा जाता है।\n- **उपयोगकर्ता बैज**: पोस्ट और टिप्पणियों पर ग्राहकों के नाम के बगल में बैज प्रदर्शित करके उन्हें सम्मानित करें।\n</cards>\n\n<!-- section: roadmap-changelog -->\n## रोडमैप योजना और रिलीज नोट्स\n\n<cards>\n- **इंटरैक्टिव रोडमैप**: दृश्य स्तंभों (जैसे विचाराधीन, नियोजित, प्रगति पर) में विकास को व्यवस्थित करें और फीडबैक को सीधे रोडमैप कार्ड से लिंक करें।\n- **चेंजलॉग और घोषणाएं**: श्रेणियों (नई सुविधा, सुधार, बग फिक्स) के साथ रिलीज नोट्स प्रकाशित करें और संबंधित ग्राहकों को स्वतः सूचित करें।\n</cards>\n\n<!-- section: faq-system -->\n## सेल्फ़-सर्विस FAQ ज्ञानकोष\n\nअपने उत्पाद पोर्टल पर श्रेणियों में व्यवस्थित अक्सर पूछे जाने वाले प्रश्न जोड़ें। तत्काल उत्तर देने से डुप्लिकेट अनुरोध और सामान्य समर्थन टिकट काफी कम हो जाते हैं।\n\n<!-- section: themes-push -->\n## थीम्स और वेब पुश अलर्ट\n\nUserHQ चार थीम प्रदान करता है: **सिस्टम**, **लाइट**, **डार्क** (गहरा नेवी), और **चारकोल** (तटस्थ ग्रे-ब्लैक)। टीम के सदस्य `/account` में ब्राउज़र वेब पुश सूचनाएं सक्षम कर सकते हैं।\n\n<!-- section: api-overview -->\n## ऑटोमेशन API और प्रमाणीकरण\n\nUserHQ REST ऑटोमेशन API का उपयोग करके बाहरी सिस्टम, CI/CD पाइपलाइन, Slack, Discord, Linear, GitHub या आंतरिक डैशबोर्ड को कनेक्ट करें।\n\n### प्रमाणीकरण हेडर\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **दर सीमा (Rate Limits)**: प्रति API कुंजी प्रति मिनट 120 अनुरोधों का उदार कोटा (टोकन-बकेट थ्रॉटलिंग के साथ)।\n- **दायरा-आधारित अनुमतियां**: कुंजियों को विशिष्ट उत्पादों तक सीमित किया जा सकता है और विशिष्ट संसाधनों के लिए पढ़ने/लिखने की अनुमतियां दी जा सकती हैं।\n</cards>\n\n<!-- section: swagger-explorer -->\n## इंटरैक्टिव API एक्सप्लोरर\n\nएंडपॉइंट्स का परीक्षण करें, मापदंडों का निरीक्षण करें, अनुरोध/प्रतिक्रिया स्कीमा देखें और cURL, TypeScript और Python में तुरंत कोड स्निपेट तैयार करें।\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## वेबहुक और HMAC हस्ताक्षर सत्यापन\n\nअनुरोध बनने, स्थिति बदलने या टिप्पणियां आने पर UserHQ रीयल-टाइम HTTP POST ईवेंट वितरित करता है। प्रत्येक डिलीवरी में `x-userhq-signature` हेडर में एक सुरक्षित HMAC-SHA256 हस्ताक्षर शामिल होता है।\n\n### Node.js / Express HMAC सत्यापन उदाहरण\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
  "id": buildGuidePackage(
    {
    "header": {
        "breadcrumbHome": "UserHQ",
        "breadcrumbCurrent": "Panduan Pengguna & Referensi API",
        "title": "Panduan Platform & API UserHQ",
        "subtitle": "Semua yang Anda butuhkan untuk mengatur masukan pelanggan, memprioritaskan permintaan fitur, mempublikasikan roadmap publik, dan mengotomatiskan alur kerja.",
        "searchPlaceholder": "Cari topik..."
    },
    "groups": [
        "Memulai",
        "Triase & Masukan",
        "Portal & Roadmap",
        "Tampilan & Peringatan",
        "Otomasi & API"
    ],
    "items": {
        "overview": "Ringkasan & Struktur",
        "rolesPermissions": "Peran & Izin",
        "requestsInbox": "Permintaan (Semua Papan)",
        "commentsAttention": "Komentar & Butuh Perhatian",
        "authorLocation": "Kontak Penulis & Lokasi",
        "customerPortals": "Portal Pelanggan Publik",
        "roadmapChangelog": "Roadmap & Catatan Rilis",
        "faqSystem": "FAQ Mandiri",
        "themesPush": "Tema & Peringatan Web Push",
        "apiOverview": "Otentikasi API & Batasan",
        "swaggerExplorer": "Penjelajah API Interaktif",
        "webhooksHmac": "Webhook & Tanda Tangan HMAC"
    },
    "quickLinks": {
        "requestsInbox": {
            "title": "Kotak Masuk Permintaan",
            "description": "Triase permintaan fitur pelanggan di semua produk Anda."
        },
        "commentsAttention": {
            "title": "Kotak Masuk Komentar",
            "description": "Antrean butuh perhatian dan utas percakapan tim."
        },
        "swaggerExplorer": {
            "title": "Penjelajah API Interaktif",
            "description": "Uji endpoint, salin skema, dan hasilkan cuplikan kode."
        },
        "webhooksHmac": {
            "title": "Webhook & HMAC",
            "description": "Pengiriman peristiwa waktu nyata dan tanda tangan aman SHA-256."
        }
    }
},
    "<!-- section: overview -->\n## Ringkasan & Struktur\n\nUserHQ membantu tim Anda mengumpulkan dan menindaklanjuti masukan (feedback) dari pelanggan. Berikut struktur ruang kerja Anda:\n\n<cards>\n- **1. Workspace (Ruang Kerja)**: Pusat kendali tim Anda. Mengelola anggota tim, penagihan, kunci API, webhook, dan kotak masuk masukan terpadu untuk semua produk Anda.\n- **2. Products (Produk)**: Aplikasi atau layanan terpisah yang Anda kembangkan (mis. Aplikasi Web, Aplikasi iOS, API). Setiap produk memiliki papan masukan, roadmap, changelog, kategori, dan branding tersendiri.\n- **3. Customer Portals (Portal Pelanggan)**: Portal bermerek yang dikunjungi pengguna untuk mengirimkan ide, memberikan suara pada fitur, memantau roadmap publik, dan membaca pengumuman rilis.\n</cards>\n\n<!-- section: roles-permissions -->\n## Peran & Izin Tim\n\nBerkolaborasi dengan lancar bersama seluruh tim sambil mempertahankan kendali penuh atas pengaturan ruang kerja:\n\n<cards>\n- **Workspace Owner (Pemilik)**: Kendali penuh: mengelola langganan, mengundang admin, membuat kunci API, mengonfigurasi webhook, dan mentransfer kepemilikan.\n- **Workspace Admin (Administrator)**: Dapat mengelola produk, memilah masukan, membalas pelanggan secara resmi, mengelola kartu roadmap, dan menerbitkan catatan rilis.\n- **Workspace Member (Anggota)**: Dapat melihat kiriman masukan, berpartisipasi dalam diskusi internal tim, dan melacak permintaan pelanggan.\n</cards>\n\n<!-- section: requests-inbox -->\n## Kotak Masuk Permintaan & Triase\n\nTerletak di `/dashboard/[ws]/requests`, kotak masuk permintaan terpadu mengumpulkan seluruh kiriman pelanggan dari setiap produk ke dalam satu tampilan triase berkinerja tinggi.\n\n<cards>\n- **Penyaringan Multi-Dimensi**: Filter instan berdasarkan Produk, Fase Status (Backlog, Sedang Dikerjakan, Selesai), Kategori, Pencarian kata kunci, dan Rentang tanggal.\n- **Pembaruan Status Cepat**: Pindahkan item antar tahap (Dalam Peninjauan, Direncanakan, Sedang Dikerjakan, Selesai) dengan satu klik. Pelanggan yang memberikan suara akan diberi tahu secara otomatis.\n</cards>\n\n<!-- section: comments-attention -->\n## Komentar & Kotak Masuk Butuh Perhatian\n\nTerletak di `/dashboard/[ws]/comments`, kotak masuk ini berfungsi sebagai meja dukungan yang responsif untuk setiap diskusi masukan Anda.\n\n### Tahapan Alur Kerja\n\n<stages>\n- **Needs Attention (Butuh Perhatian)**: Setiap komentar pelanggan yang belum menerima tanggapan resmi dari tim. Ditandai dengan warna kuning sawo agar tidak ada pertanyaan yang terlewat.\n- **Handled (Ditangani)**: Dihapus secara otomatis dari antrean perhatian segera setelah anggota tim membalas dengan lencana resmi, atau ditandai selesai secara manual.\n</stages>\n\n<!-- section: author-location -->\n## Kontak Penulis & Wawasan Geografis\n\nUntuk memberi tim Anda konteks yang berharga tentang siapa yang mengirimkan masukan, kartu permintaan dan komentar menampilkan detail penulis:\n\n- **Kontak Langsung Melalui Email**: Klik tombol email di samping nama penulis untuk langsung menghubungi mereka untuk wawancara pengguna atau pertanyaan lanjutan.\n- **Konteks Geografis**: Lihat perkiraan lokasi pelanggan (mis. `London, United Kingdom [GB]`) untuk memahami tren penggunaan wilayah.\n- **Privasi Terjamin**: Alamat email dan lokasi penulis hanya dapat dilihat oleh anggota tim dan tidak pernah ditampilkan di portal pelanggan publik.\n\n<!-- section: customer-portals -->\n## Portal Pelanggan Publik\n\nSetiap produk di ruang kerja Anda dapat memiliki portal publik tersendiri di `/[ws]/[product]`.\n\n<cards>\n- **Tombol Fitur Modular**: Aktifkan atau nonaktifkan Papan Masukan, Roadmap, Changelog, atau FAQ secara mandiri per produk sesuai kesiapan Anda.\n- **Branding & Warna Khusus**: Sesuaikan portal dengan logo, nama merek, dan warna aksen pilihan Anda agar selaras dengan aplikasi Anda.\n- **Dukungan Multi-Bahasa & RTL**: Mendukung 13 bahasa dengan deteksi pengunjung otomatis, pemilih bahasa, dan pembuatan konten terlokalisasi.\n- **Mengubah Bahasa Default**: Terjemahan yang ada akan dipromosikan ke bidang utama dan teks sebelumnya disimpan sebagai terjemahan cadangan.\n- **Lencana Pengguna**: Berikan apresiasi kepada pelanggan dengan lencana di samping nama mereka pada postingan dan komentar.\n</cards>\n\n<!-- section: roadmap-changelog -->\n## Perencanaan Roadmap & Catatan Rilis\n\n<cards>\n- **Roadmap Interaktif**: Atur pengembangan fitur dalam kolom visual (mis. Dalam Pertimbangan, Direncanakan, Sedang Dikerjakan). Tautkan masukan langsung ke kartu roadmap.\n- **Changelog & Pengumuman Rilis**: Publikasikan catatan rilis berkategori (Fitur Baru, Peningkatan, Perbaikan Bug) dan beri tahu pelanggan secara otomatis.\n</cards>\n\n<!-- section: faq-system -->\n## Basis Pengetahuan FAQ Mandiri\n\nTambahkan pertanyaan umum yang dikelompokkan ke dalam kategori pada portal produk Anda. Memberikan jawaban langsung mengurangi duplikasi kiriman dan beban tiket dukungan.\n\n<!-- section: themes-push -->\n## Tema & Pemberitahuan Web Push\n\nUserHQ menyediakan empat tema: **Sistem**, **Terang**, **Gelap** (navy pekat), dan **Charcoal** (hampir hitam netral). Anggota tim dapat mengaktifkan notifikasi Web Push di `/account`.\n\n<!-- section: api-overview -->\n## API Otomasi & Otentikasi\n\nHubungkan sistem eksternal, pipeline CI/CD, Slack, Discord, Linear, GitHub, atau dasbor internal menggunakan UserHQ REST Automation API.\n\n### Header Otentikasi\n\n```http\nAuthorization: Bearer uhq_live_xxxxxxxxxxxxxxxxxxxxxxxx\n```\n\n<cards>\n- **Batas Kecepatan (Rate Limits)**: Kuota memadai 120 permintaan/menit per kunci API dengan pembatasan token-bucket otomatis.\n- **Izin Berlingkup**: Kunci dapat dibatasi pada produk tertentu dan diberi izin baca/tulis khusus untuk sumber daya tertentu.\n</cards>\n\n<!-- section: swagger-explorer -->\n## Penjelajah API Interaktif\n\nUji endpoint, periksa parameter, telaah skema permintaan dan respons, serta hasilkan cuplikan kode instan dalam cURL, TypeScript, dan Python.\n\n[component:swagger-explorer]\n\n<!-- section: webhooks-hmac -->\n## Webhook & Verifikasi Tanda Tangan HMAC\n\nUserHQ mengirimkan peristiwa HTTP POST real-time setiap kali permintaan dibuat, status berubah, atau komentar baru masuk. Setiap pengiriman menyertakan tanda tangan aman HMAC-SHA256 pada header `x-userhq-signature`.\n\n### Contoh Verifikasi HMAC di Node.js / Express\n\n```typescript\nimport crypto from \"crypto\";\n\nexport function verifyUserHqWebhook(rawBody: string, signatureHeader: string, secret: string): boolean {\n  const expectedSignature = crypto\n    .createHmac(\"sha256\", secret)\n    .update(rawBody)\n    .digest(\"hex\");\n\n  const expectedHeader = `sha256=${expectedSignature}`;\n  return crypto.timingSafeEqual(\n    Buffer.from(signatureHeader),\n    Buffer.from(expectedHeader)\n  );\n}\n```\n"
  ),
};

export function getGuidePackage(locale: string): GuideLocalePackage {
  return GUIDE_PACKAGES[locale] ?? GUIDE_PACKAGES["en"];
}

export function getGuideMarkdown(locale: string): string {
  return getGuidePackage(locale).markdown;
}

export function getGuideNavSections(locale: string): NavGroup[] {
  return getGuidePackage(locale).nav;
}

export function getGuideHeader(locale: string): GuideHeaderInfo {
  return getGuidePackage(locale).header;
}

export function getGuideQuickLinks(locale: string): QuickLink[] {
  return getGuidePackage(locale).quickLinks;
}
