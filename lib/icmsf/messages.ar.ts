// Arabic translation of lib/icmsf/messages.ts — must stay in exact
// structural sync with that file (same keys, same function signatures).
// Technical terms (Case, n, c, m, M, ICMSF, Codex, OC curve) stay
// untranslated per project convention (see AGENTS notes / messages.ar.ts
// for AQL).

import type { IcmsfMessages } from './messages';

export const messagesAr: IcmsfMessages = {
  // Header
  appTitle: 'خطة عينات ICMSF الميكروبيولوجية',
  appSubtitle:
    'اختيار Case بحسب ICMSF · خطة عينات n/c/m/M · منحنى Operating Characteristic — منهجية متوافقة مع Codex Alimentarius CAC/GL 21',
  darkModeToggleOn: '🌙 داكن',
  darkModeToggleOff: '☀️ فاتح',

  // Step 0 — Test method type
  step0Title: 'الخطوة 0 — ما نوع الاختبار الذي تجريه؟',
  testTypeLabel: 'نوع طريقة الاختبار',
  testTypeHelp:
    'هذا ليس إعدادًا إضافيًا — هو الذي يحدد بنية خطة العينات المطبّقة، ويُظهر أدناه فقط درجات الخطورة ' +
    'الممكنة لهذا النوع من الاختبار.',
  testTypes: {
    qualitative:
      'Qualitative — كشف وجود/عدم وجود (مثل Salmonella وListeria وShigella). النتيجة: موجب أو سالب في وزن ' +
      'عينة ثابت (مثل /25g). دائمًا خطة 2-class — n وc وm فقط، بدون M.',
    quantitative:
      'Quantitative — عدّ (Enumeration) (مثل Total Plate Count وColiforms وعدّ Staph aureus). النتيجة: ' +
      'CFU/g أو CFU/ml. دائمًا خطة 3-class — n وc وm وM.',
  } as Record<'qualitative' | 'quantitative', string>,
  testTypeRequired: 'اختر نوع طريقة الاختبار لعرض درجات الخطورة المرتبطة به.',

  // Step 1 — Case selector wizard
  step1Title: 'الخطوة 1 — تحديد Case خطة العينات',
  hazardLevelLabel: 'درجة الخطورة الصحية',
  hazardLevelHelp: 'ما مدى خطورة الكائن الدقيق الذي تفحص من أجله، وإلى أي مدى يمكن أن ينتشر؟',
  hazardLevels: {
    utility: 'لا يوجد خطر صحي مباشر — لأغراض العمر التخزيني/الفساد فقط',
    low: 'خطر منخفض وغير مباشر (كائن دقيق مؤشر)',
    moderate_limited: 'خطر متوسط ومباشر — انتشار محدود',
    moderate_extensive: 'خطر متوسط ومباشر — احتمال انتشار واسع',
    severe: 'خطر شديد ومباشر',
  } as Record<'utility' | 'low' | 'moderate_limited' | 'moderate_extensive' | 'severe', string>,

  conditionEffectLabel: 'الظروف بعد أخذ العينة (التخزين، المناولة، التوزيع)',
  conditionEffectHelp: 'هل المناولة الطبيعية بعد أخذ العينة ستقلل الخطر، أم تُبقيه كما هو، أم قد تزيده؟',
  conditionEffects: {
    reduce: 'الظروف تقلل الخطر (مثل الطهي أو المعالجة اللاحقة)',
    none: 'الظروف لا تغيّر الخطر',
    increase: 'الظروف قد تزيد الخطر (مثل سوء التحكم في درجة الحرارة، أو منتج جاهز للأكل بدون خطوة قتل ميكروبي لاحقة)',
  } as Record<'reduce' | 'none' | 'increase', string>,

  resolvedCaseLabel: (caseNumber: number) => `Case ${caseNumber}`,
  planClassLabel: (planClass: 2 | 3) => (planClass === 2 ? 'خطة 2-class' : 'خطة 3-class'),
  planClassDescription: (planClass: 2 | 3) =>
    planClass === 2 ? 'كشف وجود/عدم وجود (Qualitative) — بدون M' : 'عدّ (Quantitative) — n/c/m/M كاملة',
  sampleSizeLabel: 'n (عدد وحدات العينة)',
  acceptNumberLabel: 'c (الحد الأقصى المسموح من الوحدات غير المطابقة/الحدية)',

  // Step 2 — limits
  step2Title: 'الخطوة 2 — إدخال الحدود الميكروبيولوجية',
  step2Help:
    'قيمتا m وM لا يتم استخراجهما تلقائيًا — أدخل القيم من المعيار الذي تعمل به ' +
    '(Codex، معيار وطني مثل EOS، أو مواصفة عميل خاصة).',
  mLabel: 'm (الحد الفاصل بين المقبول والحدي)',
  MLabel: 'M (الحد الفاصل بين الحدي وغير المقبول — لخطط 3-class فقط)',
  mHelp: 'خطة 2-class: أي وحدة أعلى من m تُعتبر غير مطابقة. خطة 3-class: الوحدات الأقل من m مقبولة.',
  MHelp: 'لخطط 3-class فقط. الوحدات الأعلى من M غير مقبولة دائمًا، بغض النظر عن c.',
  MNotApplicable: 'غير مستخدمة — هذه خطة 2-class',
  unitPlaceholder: 'مثال: لكل جرام، لكل سم²',

  // Step 3 — results
  step3Title: 'الخطوة 3 — خطة العينات',
  planSummary: (n: number, c: number) => `اختبر ${n} وحدة عينة. ارفض الدفعة إذا كانت أكثر من ${c} وحدة غير مطابقة.`,
  threeClassSummary: (n: number, c: number) =>
    `اختبر ${n} وحدة عينة. ارفض الدفعة إذا تجاوزت أي وحدة قيمة M، و/أو إذا تجاوزت أكثر من ${c} وحدة قيمة m.`,

  // OC curve
  ocCurveTitle: 'منحنى Operating Characteristic (OC)',
  ocCurveSubtitle: 'احتمالية قبول الدفعة عند نسبة معينة من الوحدات غير المطابقة الفعلية',
  ocCurveUnavailable3Class:
    'لا يُعرض منحنى OC لخطط 3-class. منهجية ICMSF/NAP تتعامل مع احتمالية القبول لخطط 3-class ' +
    'كسطح ثلاثي الأبعاد (نسبة غير المطابق ونسبة الحدي معًا)، وليس منحنى واحد بسيط — استخدم خطة n/c/m/M أعلاه مباشرة.',
  ocCurveXAxisLabel: 'النسبة الفعلية غير المطابقة في الدفعة (%)',
  ocCurveYAxisLabel: 'احتمالية القبول (%)',
  consumerRiskCalculatorTitle: 'فحص مخاطرة محددة',
  consumerRiskInputLabel: 'لو كانت هذه النسبة % من الدفعة غير مطابقة فعليًا...',
  consumerRiskOutputLabel: (pct: number, paPct: number) =>
    `...فإن هذه الخطة ستظل تقبل الدفعة بنسبة ${paPct}% من المرات.`,

  // Export panel
  exportSectionTitle: 'تصدير',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'تقرير خطة عينات ICMSF الميكروبيولوجية',

  // Errors / notes
  incompleteSelection: 'اختر درجة الخطورة وتأثير الظروف لتحديد Case المناسب.',
  limitsRequiredForOcNote:
    'منحنى OC يعتمد فقط على n وc، وليس على m/M — يمكنك عرضه فور اختيار Case من نوع 2-class.',

  methodologyNote:
    'اختيار Case يتبع جدول ICMSF Table 6-1 (خطط العينات المقترحة لتركيبات درجات الخطورة الصحية وظروف الاستخدام)، ' +
    'وتم التحقق منه بشكل مستقل مقابل نسخة National Academies Press لنفس الجدول. منحنى OC يستخدم النموذج الاحتمالي ' +
    'ذو الحدين (Binomial) لخطط 2-class، وهو نفس الأسلوب الذي تستخدمه ICMSF نفسها. هذه الأداة لا توفر قيم m وM — ' +
    'أدخل القيم من المعيار المعمول به لديك.',

  footerNote:
    'اختيار Case: منهجية ICMSF Table 6-1، تم التحقق منها من مصادر مستقلة متعددة. متوافقة مع مبادئ ' +
    'Codex Alimentarius CAC/GL 21. ليست بديلاً عن المعيار الميكروبيولوجي الوطني أو الخاص بالعميل المعمول به لديك.',
};
