// ─────────────────────────────────────────────────────────────────────────
// Copy for the /verification page and the home trust strip (EN / AR).
//
// Rules (owner's decisions): name the published references, never the
// specialised software (say "specialised statistical software"); no formulas,
// constants or full reference tables; check counts and the date come from
// lib/verification/results.json (scripts/validation-summary.mjs), never typed
// here. Every example below is a value the golden tests assert — change one
// only together with its test.
// ─────────────────────────────────────────────────────────────────────────
import results from './results.json'

export type SuiteId = keyof typeof results.suites
export const VERIFICATION = results as { ranAt: string; total: number; suites: Record<SuiteId, number> }

type Lang = 'en' | 'ar'
type T = Record<Lang, string>

export interface VerifiedTool {
  suite: SuiteId
  /** tool pages the card covers */
  hrefs: string[]
  name: T
  refs: string[]
  checked: T
  /** a published / reference result and the site's result for it */
  example?: { label: T; value: string }
}

export const VERIFIED_TOOLS: VerifiedTool[] = [
  {
    suite: 'spc',
    hrefs: ['/spc', '/imr-chart', '/xbar-r-chart', '/xbar-s-chart'],
    name: { en: 'SPC Engine and control charts (I-MR, X̄-R, X̄-S)', ar: 'SPC Engine ومخططات الضبط (I-MR و X̄-R و X̄-S)' },
    refs: ['AIAG SPC', 'Montgomery'],
    checked: {
      en: 'Variable control charts: control limits, tests for special causes, Cp, Cpk, Pp, Ppk, Cpm, PPM and the normality test, compared value by value with specialised statistical software on 11 datasets. The SPC Engine and the three chart pages are checked to give identical numbers.',
      ar: 'مخططات المتغيرات: حدود الضبط واختبارات الأسباب الخاصة و Cp و Cpk و Pp و Ppk و Cpm و PPM واختبار التوزيع الطبيعي، مقارنةً قيمةً بقيمة مع برامج إحصائية متخصصة على 11 مجموعة بيانات. ونتحقق من أن SPC Engine وصفحات المخططات الثلاث تعطي الأرقام نفسها.',
    },
  },
  {
    suite: 'gage',
    hrefs: ['/gage-rr'],
    name: { en: 'Gage R&R', ar: 'Gage R&R' },
    refs: ['AIAG MSA 4th ed.'],
    checked: {
      en: 'Both methods (Average & Range and ANOVA) against the manual’s worked example, and 7 studies (the manual’s example among them) compared with specialised statistical software: variance components, % study variation, % tolerance, ndc, F and P.',
      ar: 'الطريقتان (Average & Range و ANOVA) مقابل المثال المحلول في الدليل، و7 دراسات (منها مثال الدليل) مقارنة مع برامج إحصائية متخصصة: مكونات التباين، و% تباين الدراسة، و% التفاوت، و ndc، و F و P.',
    },
    example: { label: { en: 'AIAG MSA worked example (ANOVA)', ar: 'المثال المحلول في AIAG MSA (ANOVA)' }, value: '%GRR 27.9% · ndc 4' },
  },
  {
    suite: 'descriptive',
    hrefs: ['/descriptive'],
    name: { en: 'Descriptive Statistics', ar: 'الإحصاء الوصفي' },
    refs: ['Hettmansperger & Sheather', 'Anderson-Darling'],
    checked: {
      en: 'Every value of the graphical summary — quartiles, skewness, kurtosis, normality test and the confidence intervals for the mean, median and standard deviation — on 7 datasets from 3 to 100 readings, compared with specialised statistical software and an independent statistical library.',
      ar: 'كل قيم الملخص البياني — الربيعات والالتواء والتفرطح واختبار التوزيع الطبيعي وفترات الثقة للمتوسط والوسيط والانحراف المعياري — على 7 مجموعات بيانات من 3 إلى 100 قراءة، مقارنةً مع برامج إحصائية متخصصة ومكتبة إحصائية مستقلة.',
    },
    example: { label: { en: 'Readings 1 to 10 · 95% CI for the median', ar: 'القراءات من 1 إلى 10 · فترة ثقة الوسيط 95%' }, value: '2.6577 – 8.3423' },
  },
  {
    suite: 'pareto',
    hrefs: ['/pareto'],
    name: { en: 'Pareto Chart', ar: 'مخطط Pareto' },
    refs: ['80/20'],
    checked: {
      en: 'Cumulative percentages, the vital few and grouping into “Other”, on hand-worked cases including the borderline ones (79.6% is not 80%).',
      ar: 'النسب التراكمية والقلة الحيوية وتجميع الفئات في «أخرى»، على حالات محسوبة يدويًا منها الحالات الحدّية (79.6% ليست 80%).',
    },
    example: { label: { en: 'Cumulative 50.0 / 79.6 / 91.6 / 100', ar: 'التراكمي 50.0 / 79.6 / 91.6 / 100' }, value: 'vital few = 3' },
  },
  {
    suite: 'regression',
    hrefs: ['/regression', '/multiregression'],
    name: { en: 'Simple and Multiple Regression', ar: 'الانحدار البسيط والمتعدد' },
    refs: ['NIST StRD', 'Montgomery, Peck & Vining'],
    checked: {
      en: 'Coefficients, standard errors, ANOVA and R² against the certified values of the U.S. National Institute of Standards and Technology, and p-values, intervals, VIF and residual diagnostics against an independent statistical library.',
      ar: 'المعاملات والأخطاء المعيارية وجدول ANOVA و R² مقابل القيم المعتمدة من المعهد الوطني الأمريكي للمعايير والتقنية (NIST)، وقيم p والفترات و VIF وتشخيصات البواقي مقابل مكتبة إحصائية مستقلة.',
    },
    example: { label: { en: 'NIST Longley dataset · certified R²', ar: 'بيانات Longley من NIST · قيمة R² المعتمدة' }, value: 'R² 0.995479' },
  },
  {
    suite: 'doe',
    hrefs: ['/doe'],
    name: { en: 'Design of Experiments (2^k full factorial)', ar: 'تصميم التجارب (عاملي كامل 2^k)' },
    refs: ['Montgomery, DOE ch. 6'],
    checked: {
      en: 'Effects, sums of squares, F and p with replicates, Lenth’s method without replicates, R², R²(pred) and the equation in your units, on the textbook’s worked examples, compared with published results and an independent statistical library.',
      ar: 'التأثيرات ومجاميع المربعات و F و p مع التكرار، وطريقة Lenth دون تكرار، و R² و R²(pred) والمعادلة بوحداتك، على الأمثلة المحلولة في المرجع، مقارنةً مع نتائج منشورة ومكتبة إحصائية مستقلة.',
    },
    example: { label: { en: 'Montgomery Example 6.2 (filtration rate)', ar: 'مثال Montgomery 6.2 (معدل الترشيح)' }, value: 'effect A 21.625 · PSE 2.625' },
  },
  {
    suite: 'aql',
    hrefs: ['/aql'],
    name: { en: 'AQL Sampling Plan', ar: 'خطة عينات AQL' },
    refs: ['ISO 2859-1:2026'],
    checked: {
      en: 'The sample-size code letters and every cell of the normal, tightened and reduced master tables that the tool uses (AQL 0.010 to 6.5), read from the 2026 edition, plus the standard’s Annex A examples.',
      ar: 'حروف حجم العينة، وكل خانة تستخدمها الأداة في الجداول الرئيسية للفحص العادي والمشدد والمخفف (AQL من 0.010 إلى 6.5) كما في إصدار 2026، إضافةً إلى أمثلة الملحق A.',
    },
    example: { label: { en: 'Tightened inspection · letter J · AQL 0.40', ar: 'الفحص المشدد · الحرف J · AQL 0.40' }, value: 'L · n 200 · Ac 1 · Re 2' },
  },
  {
    suite: 'icmsf',
    hrefs: ['/icmsf'],
    name: { en: 'ICMSF Sampling Plan', ar: 'خطة عينات ICMSF' },
    refs: ['ICMSF Table 6-1'],
    checked: {
      en: 'All 15 cases of the table, the lot decision from unit results, and the risk curve against a published ICMSF example.',
      ar: 'الحالات الخمس عشرة في الجدول، وقرار الدفعة من نتائج الوحدات، ومنحنى المخاطر مقابل مثال منشور من ICMSF.',
    },
    example: { label: { en: 'Published example (Case 11)', ar: 'المثال المنشور (Case 11)' }, value: '≈ 30 CFU/g → rejected 95%' },
  },
  {
    suite: 'oee',
    hrefs: ['/oee'],
    name: { en: 'OEE Calculator', ar: 'حاسبة OEE' },
    refs: ['Nakajima / JIPM'],
    checked: {
      en: 'Availability, performance, quality, OEE and the loss breakdown, on a published worked example and a hand-checked case.',
      ar: 'التوافر والأداء والجودة و OEE وتوزيع الخسائر، على مثال محلول منشور وحالة محسوبة يدويًا.',
    },
    example: { label: { en: 'Published worked example', ar: 'مثال محلول منشور' }, value: 'OEE 74.79%' },
  },
  {
    suite: 'dpmo',
    hrefs: ['/dpmo'],
    name: { en: 'DPMO & Sigma Calculator', ar: 'حاسبة DPMO & Sigma' },
    refs: ['Six Sigma (1.5σ shift)'],
    checked: {
      en: 'DPU, DPO, DPMO, yield and sigma level against the published conversion table from 2σ to 6σ and a published worked example.',
      ar: 'DPU و DPO و DPMO والعائد ومستوى Sigma مقابل جدول التحويل المنشور من 2σ إلى 6σ ومثال محلول منشور.',
    },
    example: { label: { en: 'Published example', ar: 'المثال المنشور' }, value: 'DPMO 210,722 → 2.30σ' },
  },
  {
    suite: 'stability',
    hrefs: ['/stability'],
    name: { en: 'Stability Study', ar: 'دراسة الثبات' },
    refs: ['ICH Q1E', 'ICH Q1A(R2)'],
    checked: {
      en: 'Model choice between batches, the one-sided confidence bound and the shelf life from the data, on published potency data, and the extrapolation limits ICH Q1E allows, checked against the guideline text.',
      ar: 'اختيار النموذج بين الدفعات، وحد الثقة أحادي الجانب، والعمر من البيانات، على بيانات فعالية منشورة، وحدود الاستقراء التي تسمح بها ICH Q1E مراجعةً على نص الإرشاد.',
    },
    example: { label: { en: 'LeBlond et al. (2011) potency data', ar: 'بيانات الفعالية لـ LeBlond وآخرين (2011)' }, value: '26.22 months' },
  },
]

export const VERIFY_COPY: Record<Lang, {
  kicker: string; title: string; intro: string
  statChecks: string; statTools: string; statRun: string
  howTitle: string; how: { h: string; p: string }[]
  toolsTitle: string; toolsSub: string; checks: string; reference: string; result: string; open: string
  pendingTitle: string; pending: string[]
  closing: string
  stripTitle: string; stripLink: string
}> = {
  en: {
    kicker: 'Verification',
    title: 'Every number is checked against its reference',
    intro: 'A quality result is only worth signing if you can trust how it was calculated. Every tool on this site is checked against published standards, worked examples, hand-checked cases and specialised statistical software, and the checks run again on every change.',
    statChecks: 'automated checks',
    statTools: 'tools verified',
    statRun: 'last full run',
    howTitle: 'How we verify',
    how: [
      { h: 'Published worked examples', p: 'We run the same data as the standard or the textbook, and our result must equal the printed answer at the precision it is printed.' },
      { h: 'An independent second calculation', p: 'The same datasets go through specialised statistical software and independent statistical libraries, and every value is compared one by one.' },
      { h: 'Run again on every change', p: 'All checks run automatically on every update to the site, and a failing check is flagged straight away.' },
    ],
    toolsTitle: 'What is checked, tool by tool',
    toolsSub: 'Check counts come from the latest run, not from a document.',
    checks: 'checks',
    reference: 'Reference result',
    result: 'Our result',
    open: 'Open the tool',
    pendingTitle: 'Still under review',
    pending: [
      'Attribute charts (p, np, c, u) in the SPC Engine have not yet been compared with specialised statistical software.',
      'Cpm (the Taguchi index, shown when you enter a target) matches on our test dataset; one more case is still being confirmed.',
    ],
    closing: 'Found a number that does not match your reference? Tell us with the data and the reference, and we will check it and reply.',
    stripTitle: 'Verified against published standards and specialised statistical software',
    stripLink: 'How we verify',
  },
  ar: {
    kicker: 'التحقق',
    title: 'كل رقم متحقق منه مقابل مرجعه',
    intro: 'نتيجة الجودة لا تستحق توقيعك إلا إذا وثقت في طريقة حسابها. لذلك تُراجَع كل أداة في الموقع مقابل المواصفات المنشورة والأمثلة المحلولة وحالات محسوبة يدويًا والبرامج الإحصائية المتخصصة، وتُعاد هذه الفحوص مع كل تعديل.',
    statChecks: 'فحص آلي',
    statTools: 'أداة متحقق منها',
    statRun: 'آخر تشغيل كامل',
    howTitle: 'كيف نتحقق',
    how: [
      { h: 'الأمثلة المحلولة المنشورة', p: 'نُدخل البيانات نفسها الموجودة في المواصفة أو المرجع، ويجب أن تساوي نتيجتنا الإجابة المطبوعة بالدقة نفسها التي طُبعت بها.' },
      { h: 'حساب ثانٍ مستقل', p: 'تمر مجموعات البيانات نفسها على برامج إحصائية متخصصة ومكتبات إحصائية مستقلة، وتُقارَن كل قيمة على حدة.' },
      { h: 'إعادة الفحص مع كل تعديل', p: 'تعمل كل الفحوص تلقائيًا مع كل تحديث للموقع، وأي فحص لا ينجح يظهر فورًا.' },
    ],
    toolsTitle: 'ما الذي نتحقق منه في كل أداة',
    toolsSub: 'أعداد الفحوص من آخر تشغيل فعلي، لا من مستند مكتوب.',
    checks: 'فحص',
    reference: 'نتيجة المرجع',
    result: 'نتيجتنا',
    open: 'افتح الأداة',
    pendingTitle: 'ما زال قيد المراجعة',
    pending: [
      'مخططات الصفات (p و np و c و u) في SPC Engine لم تُقارَن بعد مع برامج إحصائية متخصصة.',
      'مؤشر Cpm (مؤشر Taguchi الذي يظهر عند إدخال قيمة مستهدفة) مطابق في مجموعة بيانات الاختبار، وما زالت حالة أخرى قيد التأكيد.',
    ],
    closing: 'وجدت رقمًا لا يطابق مرجعك؟ أرسل إلينا البيانات والمرجع، وسنراجعه ونرد عليك.',
    stripTitle: 'متحقق منها مقابل المواصفات المنشورة والبرامج الإحصائية المتخصصة',
    stripLink: 'كيف نتحقق',
  },
}

/** Number of tool pages covered */
export const TOOL_COUNT = new Set(VERIFIED_TOOLS.flatMap(t => t.hrefs)).size

/** Counts with Western digits in both languages, like every number on the site */
export const formatCount = (n: number) => n.toLocaleString('en-US')

export function formatRunDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
