// ─────────────────────────────────────────────────────────────────────────
// Privacy Policy and Terms of Use — the text of /privacy and /terms, in
// English and formal Arabic. Facts here must match the code: what the
// database stores (supabase/sql), what goes to third parties (Vercel,
// Supabase, Google sign-in and Analytics, Anthropic for AI Insights), and
// that calculation inputs are not stored unless a project is saved.
// Update LEGAL_UPDATED whenever a section changes.
// ─────────────────────────────────────────────────────────────────────────

import { SITE } from './site'

export const LEGAL_UPDATED = { en: '25 October 2026', ar: '25 أكتوبر 2026' }

export interface LegalSection { h: string; p?: string[]; list?: string[] }
export interface LegalDoc { kicker: string; title: string; updated: string; intro: string; sections: LegalSection[] }

const N = SITE.name
const MAIL = SITE.contact.email
const OWNER = SITE.owner

export const PRIVACY: Record<'en' | 'ar', LegalDoc> = {
  en: {
    kicker: 'Legal',
    title: 'Privacy Policy',
    updated: 'Last updated',
    intro: `This policy explains what ${N} collects, why, and what you can do about it. In short: the data you analyze is not stored unless you save the project yourself, and we never sell personal data.`,
    sections: [
      { h: 'Who we are', p: [`${N} is run by ${OWNER}, a quality engineer based in Egypt. For any privacy question or request, write to ${MAIL}.`] },
      {
        h: 'What we collect',
        list: [
          'Account: your email address, name and optional profile photo. With Google sign-in we receive the name, email and photo of your Google account.',
          'Plan: whether your account is on the free plan or Pro.',
          'Saved projects: the inputs and results of the analyses you choose to save (Pro).',
          'Report branding: the name, job title, company, logo and signature options you enter for your reports (Pro). A logo is stored at a link that can be opened by anyone who has it, so it can be printed on your reports.',
          'AI Insights use: the date, the tool and the size of each request, to apply the daily limit. Not the data itself.',
          'Usage statistics: Google Analytics records the pages you visit, your device and browser, your approximate location and actions such as export clicks.',
          'Technical data: your IP address is used for a short time to protect the service against abuse (request limits). We do not keep it.',
        ],
      },
      { h: 'The data you analyze', p: ['When you run a tool, the numbers you enter are sent to our server, calculated and returned to your screen. They are not stored and not used for anything else unless you save the project yourself.'] },
      { h: 'AI Insights', p: ['If you use AI Insights (Pro), the numbers of that analysis are sent to Anthropic, the provider of the AI model, to write the text. Your name and email are not sent. Anthropic processes the request under its own commercial terms.'] },
      {
        h: 'Who processes data for us',
        list: [
          'Vercel: hosts the website and runs the calculations.',
          'Supabase: accounts, sign-in, saved projects, report branding and logos.',
          'Google: Google sign-in (if you choose it) and Google Analytics.',
          'Anthropic: AI Insights (Pro only).',
          'A payment provider, once paid plans open: card details are handled by the provider and never reach us.',
        ],
        p: ['These providers may process data outside Egypt. We share with them only what is needed for the service, and we never sell personal data.'],
      },
      { h: 'Cookies and browser storage', p: ['A cookie keeps you signed in. Your theme and language choices are kept in your browser. Google Analytics sets its own cookies; you can block them in your browser settings or with a blocking extension, and the tools keep working.'] },
      { h: 'How long we keep data', p: ['Account data stays while your account exists. Saved projects and logos stay until you delete them or your account is deleted. Google Analytics keeps statistics according to its own retention settings.'] },
      {
        h: 'Your choices and rights',
        list: [
          'Delete saved projects and your logo at any time from your account page.',
          `Ask for a copy of your data, a correction, or the deletion of your account by writing to ${MAIL}. We reply within 30 days.`,
          'Use the tools without an account: no account data is collected then.',
        ],
      },
      { h: 'Security', p: ['Connections use HTTPS, and each account can read only its own saved projects and settings. No online service is perfectly secure, so keep your password private.'] },
      { h: 'Children', p: [`${N} is a professional tool and is not intended for anyone under 16.`] },
      { h: 'Changes to this policy', p: ['If this policy changes, the date at the top changes too. Significant changes will be announced on the site.'] },
      { h: 'Contact', p: [`Questions or requests: ${MAIL}.`] },
    ],
  },
  ar: {
    kicker: 'قانوني',
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث',
    intro: `توضح هذه السياسة ما يجمعه ${N} ولماذا، وما الذي يمكنك فعله حياله. باختصار: لا تُحفظ البيانات التي تحللها إلا إذا حفظت المشروع بنفسك، ولا نبيع البيانات الشخصية أبدًا.`,
    sections: [
      { h: 'من نحن', p: [`يدير ${N} المهندس ${OWNER}، مهندس جودة مقيم في مصر. لأي سؤال أو طلب يتعلق بالخصوصية، راسلنا على ${MAIL}.`] },
      {
        h: 'ما الذي نجمعه',
        list: [
          'الحساب: بريدك الإلكتروني واسمك وصورة شخصية اختيارية. وعند الدخول بحساب Google نستلم اسم حسابك في Google وبريده وصورته.',
          'الخطة: هل حسابك على الخطة المجانية أم Pro.',
          'المشاريع المحفوظة: مدخلات ونتائج التحليلات التي تختار حفظها (Pro).',
          'هوية التقرير: الاسم والوظيفة والشركة والشعار وخيارات التوقيع التي تُدخلها لتقاريرك (Pro). يُحفظ الشعار على رابط يمكن لمن يملكه فتحه، حتى يُطبع على تقاريرك.',
          'استخدام AI Insights: تاريخ كل طلب والأداة وحجمه، لتطبيق الحد اليومي، وليس البيانات نفسها.',
          'إحصاءات الاستخدام: يسجّل Google Analytics الصفحات التي تزورها وجهازك ومتصفحك وموقعك التقريبي وأفعالًا مثل الضغط على التصدير.',
          'بيانات تقنية: يُستخدم عنوان IP لفترة قصيرة لحماية الخدمة من إساءة الاستخدام (حدود الطلبات)، ولا نحتفظ به.',
        ],
      },
      { h: 'البيانات التي تحللها', p: ['عند تشغيل أي أداة تُرسل الأرقام التي تُدخلها إلى خادمنا، فتُحسب وتعود إلى شاشتك. لا تُحفظ ولا تُستخدم في أي غرض آخر إلا إذا حفظت المشروع بنفسك.'] },
      { h: 'AI Insights', p: ['إذا استخدمت AI Insights (Pro) تُرسل أرقام ذلك التحليل إلى Anthropic، مزوّد نموذج الذكاء الاصطناعي، لكتابة النص. لا يُرسل اسمك ولا بريدك، وتعالج Anthropic الطلب وفق شروطها التجارية.'] },
      {
        h: 'من يعالج البيانات لصالحنا',
        list: [
          'Vercel: استضافة الموقع وتشغيل الحسابات.',
          'Supabase: الحسابات وتسجيل الدخول والمشاريع المحفوظة وهوية التقرير والشعارات.',
          'Google: تسجيل الدخول بحساب Google (إن اخترته) و Google Analytics.',
          'Anthropic: خدمة AI Insights (في Pro فقط).',
          'مزوّد الدفع عند إطلاق الخطط المدفوعة: يتولى المزوّد بيانات البطاقة ولا تصل إلينا أبدًا.',
        ],
        p: ['قد يعالج هؤلاء المزودون البيانات خارج مصر. لا نشاركهم إلا ما تحتاجه الخدمة، ولا نبيع البيانات الشخصية أبدًا.'],
      },
      { h: 'ملفات تعريف الارتباط وتخزين المتصفح', p: ['يُبقيك ملف تعريف ارتباط مسجّلًا للدخول، وتُحفظ اختياراتك للمظهر واللغة في متصفحك. يضع Google Analytics ملفاته الخاصة، ويمكنك حظرها من إعدادات المتصفح أو بإضافة حظر، وتظل الأدوات تعمل.'] },
      { h: 'مدة الاحتفاظ بالبيانات', p: ['تبقى بيانات الحساب ما دام الحساب موجودًا. وتبقى المشاريع المحفوظة والشعارات حتى تحذفها أو يُحذف حسابك. ويحتفظ Google Analytics بالإحصاءات وفق إعداداته الخاصة.'] },
      {
        h: 'اختياراتك وحقوقك',
        list: [
          'احذف المشاريع المحفوظة وشعارك في أي وقت من صفحة حسابك.',
          `اطلب نسخة من بياناتك أو تصحيحها أو حذف حسابك بمراسلتنا على ${MAIL}، ونرد خلال 30 يومًا.`,
          'استخدم الأدوات دون حساب، وحينها لا تُجمع أي بيانات حساب.',
        ],
      },
      { h: 'الأمان', p: ['تتم الاتصالات عبر HTTPS، ولا يستطيع أي حساب قراءة إلا مشاريعه وإعداداته. لا توجد خدمة إلكترونية آمنة تمامًا، فاحرص على سرية كلمة المرور.'] },
      { h: 'الأطفال', p: [`${N} أداة مهنية غير موجهة لمن هم دون 16 عامًا.`] },
      { h: 'التغييرات على هذه السياسة', p: ['إذا تغيّرت هذه السياسة يتغيّر التاريخ في أعلاها، وسنعلن التغييرات الجوهرية على الموقع.'] },
      { h: 'التواصل', p: [`للأسئلة أو الطلبات: ${MAIL}.`] },
    ],
  },
}

export const TERMS: Record<'en' | 'ar', LegalDoc> = {
  en: {
    kicker: 'Legal',
    title: 'Terms of Use',
    updated: 'Last updated',
    intro: `These terms apply to everyone who uses ${N}. By using the site you accept them; if you do not, please do not use the site.`,
    sections: [
      { h: 'The service', p: [`${N} provides quality statistics tools in the browser. Calculations are free for every visitor. CSV and PNG exports need a free account, and some features (such as Gage R&R, PDF and Excel reports and saved projects) need a Pro plan.`] },
      { h: 'Results and your responsibility', p: ['Every tool is built on published methods and checked against reference results. The results are still decision support: you are responsible for the data you enter, for choosing a method that fits your case, and for the quality decisions you take with the results, such as releasing or rejecting a lot. We do not guarantee that a customer or an auditor will accept a given report.'] },
      { h: 'Your account', p: ['Give accurate information, keep your password private and tell us if you think someone else is using your account. You are responsible for what happens under your account.'] },
      {
        h: 'Acceptable use',
        list: [
          'Do not send automated bulk requests or try to get around the request limits.',
          'Do not try to copy, reverse engineer or resell the calculations or the reports.',
          'Do not upload unlawful content or data you have no right to use.',
          'Do not try to disrupt or break into the service or other accounts.',
        ],
      },
      { h: 'Your data and reports', p: ['Your data and the reports you generate are yours. You may use the reports freely, including for your customers and auditors. You allow us to process your data only to provide the service, as described in the Privacy Policy.'] },
      { h: 'Our content', p: [`The site, its software, design, texts and the ${N} brand belong to ${N}. Apart from the reports you generate, you may not copy or reuse them without written permission.`] },
      { h: 'Pro plan and payments', p: ['Pro is not on sale yet. Prices, the billing period, cancellation and the refund policy will be published on this page before paid plans open, and will apply from that date.'] },
      { h: 'Availability and changes', p: ['We work to keep the service available but cannot guarantee it will be uninterrupted. We may add, change or remove features; major changes to paid features will be announced in advance.'] },
      { h: 'No warranty', p: ['The service is provided "as is" and "as available", without warranties of any kind, to the extent the law allows.'] },
      { h: 'Limitation of liability', p: [`To the extent the law allows, ${N} is not liable for indirect or consequential losses, including rejected lots, recalls, lost production or lost profit, resulting from the use of the service. Our total liability is limited to what you paid us in the 12 months before the claim.`] },
      { h: 'Suspension and ending', p: ['We may suspend or close an account that breaks these terms. You may stop using the service at any time and ask us to delete your account.'] },
      { h: 'Governing law', p: ['These terms are governed by the laws of the Arab Republic of Egypt.'] },
      { h: 'Changes to these terms', p: ['If these terms change, the date at the top changes too. Continuing to use the site after a change means you accept the new terms.'] },
      { h: 'Contact', p: [`Questions about these terms: ${MAIL}.`] },
    ],
  },
  ar: {
    kicker: 'قانوني',
    title: 'شروط الاستخدام',
    updated: 'آخر تحديث',
    intro: `تسري هذه الشروط على كل من يستخدم ${N}. باستخدامك للموقع فإنك توافق عليها، وإن لم توافق فيُرجى عدم استخدام الموقع.`,
    sections: [
      { h: 'الخدمة', p: [`يقدّم ${N} أدوات إحصاء الجودة في المتصفح. الحسابات مجانية لكل زائر، ويحتاج تصدير CSV و PNG إلى حساب مجاني، وتحتاج بعض المزايا (مثل Gage R&R وتقارير PDF و Excel والمشاريع المحفوظة) إلى خطة Pro.`] },
      { h: 'النتائج ومسؤوليتك', p: ['كل أداة مبنية على طرق منشورة ومُتحقَّق منها على نتائج مرجعية، ومع ذلك تظل النتائج أداة دعم للقرار: أنت المسؤول عن البيانات التي تُدخلها، وعن اختيار الطريقة المناسبة لحالتك، وعن قرارات الجودة التي تتخذها بناءً على النتائج، مثل قبول دفعة أو رفضها. ولا نضمن أن يقبل العميل أو المدقق تقريرًا بعينه.'] },
      { h: 'حسابك', p: ['قدّم معلومات صحيحة، وحافظ على سرية كلمة المرور، وأبلغنا إذا ظننت أن غيرك يستخدم حسابك. أنت مسؤول عما يحدث تحت حسابك.'] },
      {
        h: 'الاستخدام المقبول',
        list: [
          'لا ترسل طلبات آلية بكميات كبيرة ولا تحاول تجاوز حدود الطلبات.',
          'لا تحاول نسخ الحسابات أو التقارير أو الهندسة العكسية لها أو إعادة بيعها.',
          'لا ترفع محتوى مخالفًا للقانون أو بيانات لا يحق لك استخدامها.',
          'لا تحاول تعطيل الخدمة أو اختراقها أو اختراق حسابات الآخرين.',
        ],
      },
      { h: 'بياناتك وتقاريرك', p: ['بياناتك والتقارير التي تنشئها ملك لك، ويمكنك استخدام التقارير بحرية، بما في ذلك لعملائك والمدققين. وتسمح لنا بمعالجة بياناتك لتقديم الخدمة فقط، كما توضح سياسة الخصوصية.'] },
      { h: 'محتوانا', p: [`الموقع وبرمجياته وتصميمه ونصوصه وعلامة ${N} مملوكة لـ ${N}. وفيما عدا التقارير التي تنشئها، لا يجوز نسخها أو إعادة استخدامها دون إذن كتابي.`] },
      { h: 'خطة Pro والمدفوعات', p: ['باقة Pro غير متاحة للشراء بعد. ستُنشر الأسعار ومدة الفوترة والإلغاء وسياسة الاسترداد في هذه الصفحة قبل إطلاق الخطط المدفوعة، وتسري من ذلك التاريخ.'] },
      { h: 'التوفر والتغييرات', p: ['نعمل على إبقاء الخدمة متاحة، لكن لا نضمن عملها دون انقطاع. وقد نضيف مزايا أو نغيّرها أو نزيلها، وسنعلن مسبقًا عن التغييرات الكبيرة في المزايا المدفوعة.'] },
      { h: 'إخلاء الضمان', p: ['تُقدَّم الخدمة "كما هي" و"حسب التوفر" دون أي ضمانات، بالقدر الذي يسمح به القانون.'] },
      { h: 'حدود المسؤولية', p: [`بالقدر الذي يسمح به القانون، لا يتحمل ${N} المسؤولية عن الخسائر غير المباشرة أو التبعية، ومنها رفض الدفعات أو سحب المنتجات أو فقد الإنتاج أو الأرباح، الناتجة عن استخدام الخدمة. وتقتصر مسؤوليتنا الإجمالية على ما دفعته لنا خلال 12 شهرًا قبل المطالبة.`] },
      { h: 'الإيقاف والإنهاء', p: ['يجوز لنا إيقاف أو إغلاق أي حساب يخالف هذه الشروط. ويمكنك التوقف عن استخدام الخدمة في أي وقت وطلب حذف حسابك.'] },
      { h: 'القانون الحاكم', p: ['تخضع هذه الشروط لقوانين جمهورية مصر العربية.'] },
      { h: 'التغييرات على هذه الشروط', p: ['إذا تغيّرت هذه الشروط يتغيّر التاريخ في أعلاها. واستمرارك في استخدام الموقع بعد التغيير يعني قبولك للشروط الجديدة.'] },
      { h: 'التواصل', p: [`للأسئلة عن هذه الشروط: ${MAIL}.`] },
    ],
  },
}
