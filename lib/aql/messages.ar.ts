// Arabic translation of lib/aql/messages.ts — must stay in exact structural
// sync with that file (same keys, same function signatures). The `from`/`to`
// fields inside switchingRules are intentionally left in English: page.tsx
// compares them (rule.to === 'Tightened' / 'Discontinue' / 'Reduced') to
// pick a badge color, so translating them would break that logic. Only the
// user-visible `badge`/`condition`/`why` text is translated.

import type { AqlMessages } from './messages';

export const messagesAr: AqlMessages = {
  // Header
  appTitle: 'حاسبة خطة عينات AQL',
  appSubtitle: 'ISO 2859-1 / ANSI ASQ Z1.4 — خطط العينة المفردة',
  darkModeToggleOn: '🌙 داكن',
  darkModeToggleOff: '☀️ فاتح',
  exportCsv: 'تصدير CSV',

  // Inputs
  lotSizeLabel: 'حجم الدفعة',
  lotSizeHelp: (min: number) => `إجمالي الوحدات في الدفعة (الحد الأدنى ${min})`,
  inspectionLevelLabel: 'مستوى الفحص',
  inspectionTypeLabel: 'نوع الفحص',
  codeLetterLabel: 'حرف الرمز',
  codeLetterValue: (letter: string) => letter,
  codeLetterUnavailable: '—',

  // Defect table
  defectClassLabel: 'فئة العيب',
  aqlPercentLabel: 'AQL %',
  requiredSampleLabel: 'العينة المطلوبة (n)',
  actualSampleLabel: 'العينة الفعلية (n)',
  sampleSizeLabel: 'العينة (n)',
  acceptNumberLabel: 'Ac',
  rejectNumberLabel: 'Re',
  noDataPlaceholder: '—',
  addDefectClass: '+ إضافة فئة عيب',
  addInspectionStage: '+ إضافة مرحلة فحص',
  removeStage: 'حذف المرحلة',

  // Export panel
  exportSectionTitle: 'تصدير',
  exportCsvButton: 'CSV',
  exportExcelButton: 'Excel',
  exportPngButton: 'PNG',
  exportPdfButton: 'PDF',
  pdfReportTitle: 'تقرير خطة عينات AQL',

  // Inspection types (dropdown options)
  inspectionTypes: {
    Normal: 'فحص عادي',
    Tightened: 'فحص مشدد',
    Reduced: 'فحص مخفف',
  } as Record<'Normal' | 'Tightened' | 'Reduced', string>,

  // Errors / notes
  lotSizeTooSmall: (min: number) => `يجب أن يكون حجم الدفعة ${min} أو أكثر.`,
  codeLetterNotFound: 'تعذّر تحديد حرف رمز لحجم الدفعة هذا.',

  noVerifiedDataWarning: (defectName: string) =>
    `⚠ ${defectName}: لا تتوفر حاليًا بيانات خطة عينات مُتحقَّق منها لقيمة AQL هذه. ` +
    `هذا النطاق من AQL لم يُؤكَّد بعد مقابل مصدر رسمي.`,

  /**
   * Shown when the plan's required sample size is >= the lot size.
   * Per ISO 2859-1: "If the sample size equals or exceeds the lot size,
   * carry out 100% inspection."
   */
  fullLotInspectionNote: (requiredSampleSize: number, lotSize: number) =>
    requiredSampleSize === lotSize
      ? `⚠️ حجم العينة المطلوب يساوي حجم الدفعة (${lotSize}). لذلك سيتم فحص الدفعة بالكامل.`
      : `⚠️ حجم العينة المطلوب (${requiredSampleSize}) يتجاوز حجم الدفعة (${lotSize}). ` +
        `لذلك سيتم فحص الدفعة بالكامل (${lotSize} وحدة).`,

  fullLotInspectionShortLabel: 'فحص الدفعة بالكامل (100%)',

  /**
   * Shown when no direct plan exists for the requested code letter/AQL
   * combination and the ISO switching rule redirected to a different
   * code letter's plan.
   */
  switchNote: (fromLetter: string, toLetter: string, sampleSize: number) =>
    `لا توجد خطة مباشرة لحرف الرمز ${fromLetter} عند قيمة AQL هذه — تم استخدام حرف الرمز ${toLetter} ` +
    `(n=${sampleSize}) وفقًا لقاعدة التبديل في ISO 2859-1.`,

  // Switching rules guide (ISO 2859-1 clause 9.3) — collapsible panel
  switchingRulesToggleShow: 'متى تُبدَّل بين العادي / المشدد / المخفف؟ ▾',
  switchingRulesToggleHide: 'متى تُبدَّل بين العادي / المشدد / المخفف؟ ▴',
  switchingRulesIntro:
    'جداول AQL تفترض سلسلة مستمرة من الدفعات من مورّد واحد، ومنتج واحد، وعملية إنتاج واحدة — ' +
    'وليست حسابًا لمرة واحدة. يتوقع المعيار أن تنتقل بين هذه الحالات الثلاث مع ورود نتائج الدفعات:',
  switchingRules: [
    {
      from: 'Normal',
      to: 'Tightened',
      badge: 'عادي ← مشدد',
      condition: '2 من أصل 5 دفعات متتالية (أو أقل) غير مقبولة',
      why: 'يشير إلى أن العملية قد تكون تنزلق تحت مستوى AQL — الخطط المشددة تحتاج عيوبًا أقل لقبول الدفعة.',
    },
    {
      from: 'Tightened',
      to: 'Normal',
      badge: 'مشدد ← عادي',
      condition: '5 دفعات متتالية مقبولة',
      why: 'الجودة تعافت؛ العودة إلى أخذ العينات القياسي.',
    },
    {
      from: 'Tightened',
      to: 'Discontinue',
      badge: 'مشدد ← إيقاف الفحص',
      condition: '5 دفعات متتالية غير مقبولة أثناء الفحص المشدد',
      why: 'وفقًا للمعيار، يجب إيقاف فحص العينات حتى يُصلح المورّد العملية — فحص 100% أو إجراء تصحيحي، وليس مزيدًا من أخذ العينات.',
    },
    {
      from: 'Normal',
      to: 'Reduced',
      badge: 'عادي ← مخفف',
      condition:
        'نقاط التبديل ≥ 30 (تقريبًا: عدة دفعات متتالية تجتاز بشكل مريح)، والإنتاج مستقر، والفحص المخفف مرغوب فيه',
      why: 'الجودة الجيدة المستمرة تكسب حجم عينة أصغر — تكلفة فحص أقل.',
    },
    {
      from: 'Reduced',
      to: 'Normal',
      badge: 'مخفف ← عادي',
      condition: 'أي دفعة غير مقبولة، أو أصبح الإنتاج غير منتظم',
      why: 'الفحص المخفف له معايير أخف، لذا أي إخفاق واحد يعيد العملية فورًا إلى الفحص العادي الكامل.',
    },
  ],
  switchingRulesNote:
    'هذا ملخص مبسّط للبند 9.3 من ISO 2859-1. تتبّع نقاط التبديل الجارية لكل مورّد/منتج عبر عدة دفعات ' +
    'ميزة منفصلة — هذه الحاسبة تحسب خطة واحدة في كل مرة.',

  footerNote:
    'مبني على ISO 2859-1 / ANSI ASQ Z1.4. نطاق AQL المدعوم: 0.010% – 6.5%. تُطبَّق قواعد التبديل ' +
    'تلقائيًا عند عدم وجود خطة مباشرة لتركيبة حرف الرمز/AQL معينة.',
};
