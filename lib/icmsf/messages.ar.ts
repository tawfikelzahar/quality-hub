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
  testTypeHelp: 'يحدد بنية خطة العينات (2-class أو 3-class) ويُظهر أدناه فقط درجات الخطورة المطابقة.',
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
  planTableCaseHeader: 'Case',
  planTablePlanHeader: 'الخطة',
  planTableNHeader: 'n',
  planTableCHeader: 'c',
  planTableMLetter: 'm',
  planTableMDescription: '(الحد الحدّي)',
  planTableBigMLetter: 'M',
  planTableBigMDescription: '(الحد غير المقبول)',

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

  // Extended risk analysis — Three-class OC curve (تحليل إضافي، ليس جزءًا
  // من ICMSF Table 6-1 / Codex CAC/GL 21 نفسها؛ انظر complianceDisclaimer)
  threeClassRiskAnalysisTitle: 'تحليل مخاطر إضافي لهذه الخطة 3-class',
  threeClassRiskAnalysisIntro:
    'لا يُعرّف ICMSF/Table 6-1 منحنى OC واحد لخطط 3-class (انظر الملاحظة أدناه). هذا القسم تحليل إحصائي ' +
    'إضافي — وليس جزءًا من منهجية ICMSF أو Codex نفسها — يُحاكي أداء هذه الخطة إذا كان مستوى التلوث في ' +
    'الدفعة يتبع توزيعًا لوغاريتميًا طبيعيًا (وهو الافتراض المعتاد في تقييم مخاطر الميكروبيولوجيا الكمية). ' +
    'قيم m وM من الخطوة 2 (المُدخلة كـ CFU/g أو CFU/ml) يتم تحويلها تلقائيًا لمقياس log10 لهذا النموذج. ' +
    'استخدمه كمؤشر داعم إضافي لاتخاذ القرار، وليس كمتطلب امتثال.',
  threeClassRiskAnalysisNeedsLimits:
    'أدخل m وM في الخطوة 2 (كـ CFU/g أو CFU/ml، أكبر من صفر) لعرض هذا التحليل.',
  threeClassRiskAnalysisToggle: 'عرض تحليل المخاطر الإضافي (منحنى OC ثلاثي الفئة)',
  sdConcentrationLabel: 'الانحراف المعياري للتركيز، مقياس log10 ( SD )',
  sdConcentrationHelp:
    'مدى تفاوت التركيز بين الدفعات أو الوحدات، على مقياس log10. لو مش عارف القيمة، القيمة الابتدائية ' +
    'الشائعة لكثير من المنتجات الغذائية تتراوح بين 0.6–1.0 — لكن استخدم بياناتك التاريخية الخاصة لو متوفرة.',
  threeClassOcCurveXAxisLabel: 'متوسط تركيز الدفعة (مقياس log10)',
  threeClassPointOfInterestLabel: 'متوسط التركيز، مقياس log10 — نقطة الاهتمام',
  threeClassArithmeticMeanLabel: 'المتوسط الحسابي',
  threeClassPAcceptableLabel: 'P(Conc ≤ m) — مقبول',
  threeClassPMarginalLabel: 'P(m < Conc ≤ M) — حدّي',
  threeClassPUnacceptableLabel: 'P(Conc > M) — غير مقبول',
  threeClassCheckPointTitle: 'تحقق من نقطة معينة',
  threeClassCheckPointLabel: 'عند متوسط التركيز هذا (log10)...',
  pAcceptLabel: 'P(accept)',

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
    'وتم التحقق منه بشكل مستقل مقابل نسخة National Academies Press لنفس الجدول. منحنى OC لخطط 2-class يستخدم ' +
    'النموذج الاحتمالي ذو الحدين (Binomial)، وهو نفس الأسلوب الذي تستخدمه ICMSF نفسها. هذه الأداة لا توفر ' +
    'قيم m وM — أدخل القيم من المعيار المعمول به لديك.',
  threeClassMethodologyNote:
    'منحنى OC ثلاثي الفئة الإضافي أعلاه يستخدم نموذج WHO/FAO FOSTAT اللوغاريتمي الطبيعي (FAO/WHO ' +
    'Microbiological Risk Assessment Series No. 24, 2016) — وهو ليس جزءًا من ICMSF Table 6-1 أو Codex ' +
    'CAC/GL 21. قيم m وM (المُدخلة كـ CFU/g أو CFU/ml في الخطوة 2) تُحوَّل لمقياس log10 لهذا النموذج.',

  complianceDisclaimerTitle: 'ما الذي يُعتبر متطلب امتثال هنا وما الذي لا يُعتبر',
  complianceDisclaimer:
    'اختيار Case (n/c من ICMSF Table 6-1) متوافق مع منهجية Codex Alimentarius CAC/GL 21. منحنى ' +
    'Operating Characteristic — لخطط 2-class و3-class على حد سواء — أداة تحليل مخاطر إضافية، وليست ' +
    'متطلبًا من ICMSF أو Codex أو أي معيار آخر. لا يوجد معيار يطلب حساب أو مراجعة منحنى OC كجزء من اعتماد ' +
    'خطة العينات. استخدم هذه الأداة للاسترشاد في قرارك — وهي لا تحل محل مراجعة متخصص سلامة غذاء مؤهل أو ' +
    'المعايير التنظيمية وتلك الخاصة بالعميل المعمول بها لديك.',

  footerNote:
    'اختيار Case: منهجية ICMSF Table 6-1، تم التحقق منها من مصادر مستقلة متعددة، ومتوافقة مع مبادئ ' +
    'Codex Alimentarius CAC/GL 21. منحنى OC (2-class و3-class) أداة تحليل مخاطر إضافية، وليست جزءًا من ' +
    'منهجية ICMSF/Codex نفسها. ليست بديلاً عن المعيار الميكروبيولوجي الوطني أو الخاص بالعميل المعمول به ' +
    'لديك، أو عن مراجعة متخصص مؤهل.',
};
