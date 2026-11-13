// ─────────────────────────────────────────────────────────────────────────
// Privacy Policy and Terms of Use — the text of /privacy and /terms, in
// English and formal Arabic. Kept short and general on purpose, but every
// statement must stay true to the code: calculation inputs are not stored
// unless a project is saved, nothing is sold, AI Insights sends only the
// numbers of the analysis to the AI provider, deletion is by email.
// REFUND (/refund-policy) must match lib/pricing.ts and what the Pro usage
// log records (supabase/sql/011_pro_usage.sql, lib/proUsage.ts).
// Update LEGAL_UPDATED whenever a section changes.
// ─────────────────────────────────────────────────────────────────────────

import { SITE } from './site'

export const LEGAL_UPDATED = { en: '13 November 2026', ar: '13 نوفمبر 2026' }

export interface LegalSection { id: string; h: string; p?: string[]; list?: string[] }
export interface LegalDoc {
  kicker: string
  title: string
  updated: string
  intro: string
  toc: string
  sections: LegalSection[]
  questionTitle: string
  questionText: string
}

const N = SITE.name
const MAIL = SITE.contact.email

export const PRIVACY: Record<'en' | 'ar', LegalDoc> = {
  en: {
    kicker: 'Legal',
    title: 'Privacy Policy',
    updated: 'Effective and last updated',
    intro: `How ${N} handles your data, in plain words. The short version: the data you analyze is not stored unless you save the project yourself, and we never sell personal data.`,
    toc: 'Contents',
    sections: [
      { id: 'scope', h: 'Scope', p: [`This policy covers the ${N} website, its tools, accounts and reports. Outside services you reach from the site have their own policies.`] },
      { id: 'collect', h: 'What we collect', p: ['Your account details (email, name and an optional photo, or the details of your Google account if you sign in with Google), your plan, the mobile number you enter when you pay, the projects and report settings you choose to save, and general usage statistics that help us improve the site.'] },
      { id: 'analysis', h: 'The data you analyze', p: ['The numbers you enter are sent to our server only to calculate the results and show them to you. They are not stored and not used for anything else unless you save the project yourself.'] },
      { id: 'ai', h: 'AI features', p: ['When you use an AI feature, the numbers of that analysis are sent to our AI provider to write the text. Your name and email are not sent.'] },
      { id: 'use', h: 'How we use data', p: ['To run the tools and your account, keep the service secure, apply plan limits, answer your messages and improve the site. We do not sell personal data.'] },
      { id: 'providers', h: 'Service providers', p: ['We rely on trusted providers for hosting, accounts and storage, sign-in, analytics, AI features and payments. They receive only what the service needs, and some may operate outside Egypt. Card details are handled by the payment provider and never reach us. The mobile number you enter at checkout is passed to the payment provider to process the payment, and we keep it to contact you.'] },
      { id: 'cookies', h: 'Cookies and browser storage', p: ['We use a cookie to keep you signed in, browser storage for your theme and language, and analytics cookies. You can block analytics cookies in your browser and the tools keep working.'] },
      { id: 'retention', h: 'How long we keep data', p: ['Account data is kept while your account exists. Saved projects and logos are kept until you delete them or your account is deleted.'] },
      { id: 'rights', h: 'Security and your rights', p: ['Connections are encrypted and each account can reach only its own data.', `You can delete saved projects and your logo from your account page at any time, and ask for a copy, a correction or the deletion of your account at ${MAIL}. We reply within 30 days.`] },
      { id: 'age', h: 'Minimum age', p: [`${N} is a professional tool for people aged 18 and over.`] },
      { id: 'changes', h: 'Changes', p: ['When this policy changes we update the date above, and we announce significant changes on the site.'] },
    ],
    questionTitle: 'Have a question?',
    questionText: `Write to ${MAIL} and we will reply.`,
  },
  ar: {
    kicker: 'قانوني',
    title: 'سياسة الخصوصية',
    updated: 'تاريخ السريان وآخر تحديث',
    intro: `كيف يتعامل ${N} مع بياناتك، بكلمات واضحة. باختصار: لا تُحفظ البيانات التي تحللها إلا إذا حفظت المشروع بنفسك، ولا نبيع البيانات الشخصية أبدًا.`,
    toc: 'المحتويات',
    sections: [
      { id: 'scope', h: 'النطاق', p: [`تشمل هذه السياسة موقع ${N} وأدواته والحسابات والتقارير. أما الخدمات الخارجية التي تصل إليها من الموقع فلها سياساتها الخاصة.`] },
      { id: 'collect', h: 'ما الذي نجمعه', p: ['بيانات حسابك (البريد الإلكتروني والاسم وصورة اختيارية، أو بيانات حساب Google إذا سجّلت الدخول به)، وخطتك، ورقم الجوال الذي تدخله عند الدفع، والمشاريع وإعدادات التقارير التي تختار حفظها، وإحصاءات استخدام عامة تساعدنا على تحسين الموقع.'] },
      { id: 'analysis', h: 'البيانات التي تحللها', p: ['تُرسل الأرقام التي تُدخلها إلى خادمنا لحساب النتائج وعرضها عليك فقط، ولا تُحفظ ولا تُستخدم في أي غرض آخر إلا إذا حفظت المشروع بنفسك.'] },
      { id: 'ai', h: 'مزايا الذكاء الاصطناعي', p: ['عند استخدام إحدى مزايا الذكاء الاصطناعي تُرسل أرقام ذلك التحليل إلى مزوّد الذكاء الاصطناعي لكتابة النص، ولا يُرسل اسمك ولا بريدك.'] },
      { id: 'use', h: 'كيف نستخدم البيانات', p: ['لتشغيل الأدوات وحسابك، والحفاظ على أمان الخدمة، وتطبيق حدود الخطط، والرد على رسائلك، وتحسين الموقع. ولا نبيع البيانات الشخصية.'] },
      { id: 'providers', h: 'مزودو الخدمة', p: ['نعتمد على مزودين موثوقين للاستضافة والحسابات والتخزين وتسجيل الدخول والإحصاءات ومزايا الذكاء الاصطناعي والدفع. لا يتلقون إلا ما تحتاجه الخدمة، وقد يعمل بعضهم خارج مصر. ويتولى مزوّد الدفع بيانات البطاقة ولا تصل إلينا أبدًا. ورقم الجوال الذي تدخله عند الدفع يُرسل إلى مزوّد الدفع لإتمام العملية، ونحتفظ به للتواصل معك.'] },
      { id: 'cookies', h: 'ملفات تعريف الارتباط وتخزين المتصفح', p: ['نستخدم ملف تعريف ارتباط لإبقائك مسجّلًا للدخول، وتخزين المتصفح لاختيارك للمظهر واللغة، وملفات تعريف ارتباط للإحصاءات. يمكنك حظر ملفات الإحصاءات من متصفحك وتظل الأدوات تعمل.'] },
      { id: 'retention', h: 'مدة الاحتفاظ بالبيانات', p: ['نحتفظ ببيانات الحساب ما دام الحساب موجودًا، وبالمشاريع المحفوظة والشعارات حتى تحذفها أو يُحذف حسابك.'] },
      { id: 'rights', h: 'الأمان وحقوقك', p: ['الاتصالات مشفّرة، ولا يصل أي حساب إلا إلى بياناته.', `يمكنك حذف المشاريع المحفوظة وشعارك من صفحة حسابك في أي وقت، وطلب نسخة من بياناتك أو تصحيحها أو حذف حسابك عبر ${MAIL}، ونرد خلال 30 يومًا.`] },
      { id: 'age', h: 'الحد الأدنى للعمر', p: [`${N} أداة مهنية لمن هم في سن 18 عامًا فأكثر.`] },
      { id: 'changes', h: 'التغييرات', p: ['عند تغيير هذه السياسة نحدّث التاريخ أعلاه، ونعلن التغييرات الجوهرية على الموقع.'] },
    ],
    questionTitle: 'لديك سؤال؟',
    questionText: `راسلنا على ${MAIL} وسنرد عليك.`,
  },
}

export const TERMS: Record<'en' | 'ar', LegalDoc> = {
  en: {
    kicker: 'Legal',
    title: 'Terms of Use',
    updated: 'Effective and last updated',
    intro: `The rules for using ${N}, written to be practical rather than dense. By using the site you accept these terms and the Privacy Policy.`,
    toc: 'Contents',
    sections: [
      { id: 'agreement', h: 'Agreement and eligibility', p: ['You must be 18 or over. If you use the site for a company, you confirm that you may accept these terms on its behalf.'] },
      { id: 'service', h: 'The service', p: [`${N} provides quality statistics tools in the browser. Calculations are free; some features need a free account or a paid plan.`] },
      { id: 'account', h: 'Your account', p: ['Keep your details accurate and your password private. You are responsible for activity under your account.'] },
      { id: 'results', h: 'Results and your responsibility', p: ['The tools follow published methods and are checked against reference results, but they support decisions; they do not make them. You are responsible for your data, for choosing the right method and for the quality decisions you take.'] },
      { id: 'ai', h: 'AI features', p: ['AI-written text may contain mistakes and does not replace professional judgment. Review it before you rely on it. Usage limits may apply.'] },
      { id: 'plans', h: 'Plans and payments', p: ['Pro is paid once, by card, for 1 month, 3 months or 1 year, at the prices on the Pricing page. It does not renew automatically. Refunds and cancellation follow the Refund & Cancellation Policy.', 'Prices may change. A change never affects a period you have already paid for.'] },
      { id: 'content', h: 'Your data and our content', p: [`Your data and the reports you generate are yours to use, including with customers and auditors. The site, its software, design and the ${N} brand are ours and may not be copied or resold.`] },
      { id: 'conduct', h: 'Prohibited use', list: ['Automated bulk requests or getting around usage limits.', 'Copying, reverse engineering or reselling the tools or reports.', 'Unlawful content, or attempts to disrupt the service or reach other accounts.'] },
      { id: 'termination', h: 'Suspension and termination', p: ['We may suspend or close accounts that break these terms. You may stop using the service and ask us to delete your account at any time.'] },
      { id: 'changes-service', h: 'Third parties and changes', p: ['The service relies on outside providers and may change over time. We do not guarantee uninterrupted availability.'] },
      { id: 'liability', h: 'Warranties and liability', p: ['The service is provided as is. To the extent the law allows, we are not liable for indirect losses such as rejected lots, recalls or lost production. Your mandatory rights under the law are not affected.'] },
      { id: 'law', h: 'Law and disputes', p: ['These terms are governed by the laws of Egypt. We will first try to settle any dispute in good faith.'] },
      { id: 'changes', h: 'Changes to these terms', p: ['We will post updates here with a new date. If you disagree with a change, stop using the service.'] },
    ],
    questionTitle: 'Have a question?',
    questionText: `Write to ${MAIL} and we will reply.`,
  },
  ar: {
    kicker: 'قانوني',
    title: 'شروط الاستخدام',
    updated: 'تاريخ السريان وآخر تحديث',
    intro: `قواعد استخدام ${N}، مكتوبة لتكون عملية وواضحة. باستخدامك للموقع فإنك توافق على هذه الشروط وعلى سياسة الخصوصية.`,
    toc: 'المحتويات',
    sections: [
      { id: 'agreement', h: 'الموافقة والأهلية', p: ['يجب أن يكون عمرك 18 عامًا فأكثر. وإذا استخدمت الموقع لصالح شركة فإنك تؤكد أن لك صلاحية قبول هذه الشروط نيابة عنها.'] },
      { id: 'service', h: 'الخدمة', p: [`يقدّم ${N} أدوات إحصاء الجودة في المتصفح. الحسابات مجانية، وتحتاج بعض المزايا إلى حساب مجاني أو خطة مدفوعة.`] },
      { id: 'account', h: 'حسابك', p: ['حافظ على صحة بياناتك وسرية كلمة المرور، فأنت مسؤول عما يحدث تحت حسابك.'] },
      { id: 'results', h: 'النتائج ومسؤوليتك', p: ['تتبع الأدوات طرقًا منشورة ومُتحقَّقًا منها على نتائج مرجعية، لكنها تدعم القرار ولا تتخذه. أنت المسؤول عن بياناتك واختيار الطريقة المناسبة وقرارات الجودة التي تتخذها.'] },
      { id: 'ai', h: 'مزايا الذكاء الاصطناعي', p: ['قد يحتوي النص المكتوب بالذكاء الاصطناعي على أخطاء، ولا يغني عن الحكم المهني، فراجعه قبل الاعتماد عليه. وقد تنطبق حدود للاستخدام.'] },
      { id: 'plans', h: 'الخطط والمدفوعات', p: ['تُدفع باقة Pro مرة واحدة بالبطاقة لمدة شهر أو 3 أشهر أو سنة، بالأسعار المنشورة في صفحة الأسعار، ولا تتجدد تلقائيًا. ويخضع الاسترداد والإلغاء لسياسة الاسترجاع والإلغاء.', 'قد تتغير الأسعار، ولا يؤثر أي تغيير على مدة سبق أن دفعت مقابلها.'] },
      { id: 'content', h: 'بياناتك ومحتوانا', p: [`بياناتك والتقارير التي تنشئها ملك لك، ويمكنك استخدامها مع عملائك والمدققين. أما الموقع وبرمجياته وتصميمه وعلامة ${N} فمملوكة لنا ولا يجوز نسخها أو إعادة بيعها.`] },
      { id: 'conduct', h: 'الاستخدام المحظور', list: ['الطلبات الآلية بكميات كبيرة أو تجاوز حدود الاستخدام.', 'نسخ الأدوات أو التقارير أو الهندسة العكسية لها أو إعادة بيعها.', 'المحتوى المخالف للقانون، أو محاولة تعطيل الخدمة أو الوصول إلى حسابات الآخرين.'] },
      { id: 'termination', h: 'الإيقاف والإنهاء', p: ['يجوز لنا إيقاف أو إغلاق الحسابات المخالفة لهذه الشروط. ويمكنك التوقف عن استخدام الخدمة وطلب حذف حسابك في أي وقت.'] },
      { id: 'changes-service', h: 'الأطراف الخارجية والتغييرات', p: ['تعتمد الخدمة على مزودين خارجيين وقد تتغير بمرور الوقت، ولا نضمن توفرها دون انقطاع.'] },
      { id: 'liability', h: 'الضمانات والمسؤولية', p: ['تُقدَّم الخدمة كما هي. وبالقدر الذي يسمح به القانون لا نتحمل المسؤولية عن الخسائر غير المباشرة مثل رفض الدفعات أو سحب المنتجات أو فقد الإنتاج، دون المساس بحقوقك الإلزامية بموجب القانون.'] },
      { id: 'law', h: 'القانون والنزاعات', p: ['تخضع هذه الشروط لقوانين جمهورية مصر العربية، وسنسعى أولًا إلى حل أي نزاع بحسن نية.'] },
      { id: 'changes', h: 'التغييرات على هذه الشروط', p: ['سننشر التحديثات هنا بتاريخ جديد، وإذا لم توافق على تغيير ما فتوقف عن استخدام الخدمة.'] },
    ],
    questionTitle: 'لديك سؤال؟',
    questionText: `راسلنا على ${MAIL} وسنرد عليك.`,
  },
}

const ADDR = SITE.contact.address

export const REFUND: Record<'en' | 'ar', LegalDoc> = {
  en: {
    kicker: 'Legal',
    title: 'Refund & Cancellation Policy',
    updated: 'Effective and last updated',
    intro: `Pro is paid once for the period you choose and never renews by itself, so there is nothing to cancel. If it is not right for you, you can get your money back within 7 days, as long as you have not used Pro yet.`,
    toc: 'Contents',
    sections: [
      { id: 'payment', h: 'How Pro is paid', p: [`Pro is a one-time card payment for 1 month, 3 months or 1 year, at the prices on the Pricing page. The payment is processed by our payment provider; ${N} never sees your card details. Pro starts as soon as the payment is confirmed.`] },
      { id: 'cancel', h: 'Cancellation', p: ['There is no automatic renewal, so you do not need to cancel anything and your card is never charged again unless you renew.', 'If you do not renew, Pro stays active until the end of the period you paid for, then your account returns to Free. Your saved projects and report settings are not deleted and are there again when you renew.'] },
      { id: 'refund', h: 'Refund within 7 days', p: ['You can ask for a full refund within 7 days of your payment, as long as you have not used any Pro feature in that period. Using a Pro feature means any of:'], list: ['Downloading a PDF or Excel report.', 'Running Gage R&R on your own data.', 'Saving a project to your dashboard.', 'Using AI Insights.'] },
      { id: 'once', h: 'One refund per customer', p: ['The 7-day refund is available once per customer.'] },
      { id: 'always', h: 'When we always refund', p: ['Whatever the date or use, we refund in full if:'], list: ['You were charged more than once for the same payment.', 'You paid and Pro was not activated on your account, and we could not fix it.', 'A fault on our side stopped you from using Pro and we could not fix it.'] },
      { id: 'how', h: 'How to ask for a refund', p: [`Email ${MAIL} from the email address of your account, with the date of the payment and its reference number if you have it. We reply within 3 working days.`] },
      { id: 'timing', h: 'How the money is returned', p: ['Refunds go back to the card used for the payment, through our payment provider. Pro ends when the refund is issued. The time it takes to appear in your account depends on your bank.'] },
      { id: 'renew', h: 'Renewing and price changes', p: ['If you renew before your plan ends, the new period starts after your current end date. A founding price stays yours as long as you renew before your plan ends.', 'Prices may change. A change never affects a period you have already paid for.'] },
      { id: 'rights', h: 'Your rights under the law', p: ['This policy does not limit any right you have under the consumer protection laws of Egypt.'] },
      { id: 'contact', h: 'Contact', p: [`${N} · ${ADDR.en} · ${MAIL}`] },
    ],
    questionTitle: 'Have a question?',
    questionText: `Write to ${MAIL} and we will reply.`,
  },
  ar: {
    kicker: 'قانوني',
    title: 'سياسة الاسترجاع والإلغاء',
    updated: 'تاريخ السريان وآخر تحديث',
    intro: 'تُدفع باقة Pro مرة واحدة للمدة التي تختارها ولا تتجدد تلقائيًا، فلا يوجد ما تحتاج إلى إلغائه. وإذا لم تناسبك يمكنك استرداد أموالك خلال 7 أيام ما دمت لم تستخدم Pro بعد.',
    toc: 'المحتويات',
    sections: [
      { id: 'payment', h: 'كيف تُدفع باقة Pro', p: [`باقة Pro دفعة واحدة بالبطاقة لمدة شهر أو 3 أشهر أو سنة، بالأسعار المنشورة في صفحة الأسعار. ويعالج الدفعَ مزوّدُ الدفع، ولا تصل بيانات بطاقتك إلى ${N} أبدًا. وتبدأ Pro فور تأكيد الدفع.`] },
      { id: 'cancel', h: 'الإلغاء', p: ['لا يوجد تجديد تلقائي، فلا تحتاج إلى إلغاء أي شيء، ولا تُخصم أي مبالغ من بطاقتك مرة أخرى إلا إذا جددت بنفسك.', 'إذا لم تجدد تظل Pro فعّالة حتى نهاية المدة التي دفعت مقابلها، ثم يعود حسابك إلى الخطة المجانية. ولا تُحذف مشاريعك المحفوظة وإعدادات تقاريرك، وتجدها عند التجديد.'] },
      { id: 'refund', h: 'الاسترداد خلال 7 أيام', p: ['يمكنك طلب استرداد كامل المبلغ خلال 7 أيام من الدفع، ما دمت لم تستخدم أي ميزة من مزايا Pro خلال هذه المدة. ويُقصد باستخدام مزايا Pro أيٌّ مما يلي:'], list: ['تنزيل تقرير PDF أو Excel.', 'تشغيل Gage R&R على بياناتك.', 'حفظ مشروع في لوحة التحكم.', 'استخدام AI Insights.'] },
      { id: 'once', h: 'استرداد واحد لكل عميل', p: ['يُتاح الاسترداد خلال 7 أيام مرة واحدة لكل عميل.'] },
      { id: 'always', h: 'متى نرد المبلغ دائمًا', p: ['أيًّا كان التاريخ أو الاستخدام، نرد المبلغ كاملًا في الحالات التالية:'], list: ['إذا خُصم منك المبلغ أكثر من مرة عن الدفعة نفسها.', 'إذا دفعت ولم تُفعَّل Pro على حسابك ولم نتمكن من إصلاح ذلك.', 'إذا منعك عطل من جانبنا من استخدام Pro ولم نتمكن من إصلاحه.'] },
      { id: 'how', h: 'كيف تطلب الاسترداد', p: [`راسلنا على ${MAIL} من البريد الإلكتروني لحسابك، مع تاريخ الدفع ورقمه المرجعي إن وُجد، ونرد خلال 3 أيام عمل.`] },
      { id: 'timing', h: 'كيف يُرد المبلغ', p: ['يُرد المبلغ إلى البطاقة التي دفعت بها عن طريق مزوّد الدفع، وتنتهي Pro عند إصدار الاسترداد. وتعتمد المدة اللازمة لظهور المبلغ في حسابك على البنك الذي تتعامل معه.'] },
      { id: 'renew', h: 'التجديد وتغيير الأسعار', p: ['إذا جددت قبل انتهاء باقتك تبدأ المدة الجديدة بعد تاريخ الانتهاء الحالي، ويظل سعر المؤسسين لك ما دمت تجدد قبل انتهاء باقتك.', 'قد تتغير الأسعار، ولا يؤثر أي تغيير على مدة سبق أن دفعت مقابلها.'] },
      { id: 'rights', h: 'حقوقك بموجب القانون', p: ['لا تحدّ هذه السياسة من أي حق مقرر لك بموجب قوانين حماية المستهلك في جمهورية مصر العربية.'] },
      { id: 'contact', h: 'التواصل', p: [`${N} · ${ADDR.ar} · ${MAIL}`] },
    ],
    questionTitle: 'لديك سؤال؟',
    questionText: `راسلنا على ${MAIL} وسنرد عليك.`,
  },
}
