import type { ToolGuide } from './types'

// ICMSF example = the page's "Try an example" (hazard "low" = Indicator,
// conditions no change, count mode, m 100, M 1000 CFU/g, results 40 / 250 /
// 90 / 600 / 1500) through lib/icmsf/calculator.ts: Case 5 · 3-class · n 5 ·
// c 2 · units acceptable / marginal / acceptable / marginal / defective ·
// decision reject (over_M).
// Owner's decision (30 Oct 2026): the Case table (Table 6-1) is NOT shown in
// the guide — choosing the plan is the tool's job, and the table is from a
// published book.
// Stability example = the page's example (3 batches, assay %, 0–24 months,
// LSL 95.0, long-term room storage, accelerated: no significant change)
// through lib/stability/calc.ts + shelfLifeClaim: slopes poolable, intercepts
// not → common slope −0.1666 %/month · shelf life A2401 31.9 · A2402 34.6 ·
// A2403 30.0 months · ICH Q1E limit 36 → claim 30 months (data).

export const ICMSF_GUIDE: ToolGuide = {
  en: {
    title: 'About the ICMSF microbiological sampling plans',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'The ICMSF sampling plans decide whether a food lot is acceptable from microbiological tests on a small number of sample units. The plan gets stricter as the hazard of the organism grows, and as the handling expected after sampling makes it more likely to grow. You choose the hazard and what happens to the food afterwards; the tool gives the plan, then decides the lot from your results, with the operating characteristic (OC) curve and, for Pro, the risk at each mean concentration.' },
          { p: 'You set the limits m and M yourself from your national or customer standard; the tool does not supply them.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'Plans follow the ICMSF Cases, checked against the published table, with hazard categories and example organisms from the ICMSF Cases concept. The risk curve uses the model of the FAO/WHO sampling tool. The tool supports, but does not replace, your national or customer standard and the judgement of a food safety professional.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: an indicator organism counted in CFU/g, no change in conditions, m = 100 and M = 1000.' },
          { table: [
            ['Result', 'Value'],
            ['Plan', 'Case 5: 3-class, n 5, c 2'],
            ['Results (CFU/g)', '40 · 250 · 90 · 600 · 1500'],
            ['Units', '2 acceptable · 2 marginal · 1 above M'],
            ['Decision', 'Lot rejected'],
          ] },
          { p: 'The two marginal units are within the plan’s allowance, but the lot is rejected because one unit (1500) is above M.' },
        ],
      },
    ],
    references: [
      'ICMSF, Microorganisms in Foods 2: Sampling for Microbiological Analysis.',
      'ICMSF, The ICMSF Cases concept (2020).',
      'FAO/WHO, Microbiological Risk Assessment Series 24 (2016).',
    ],
  },
  ar: {
    title: 'عن خطط عينات ICMSF الميكروبيولوجية',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'خطط عينات ICMSF تحكم على قبول دفعة غذاء من الاختبارات الميكروبيولوجية على عدد قليل من وحدات العينة. وتصبح الخطة أشد كلما زاد خطر الكائن، وكلما زادت احتمالية نموه بسبب طريقة التداول المتوقعة بعد أخذ العينة. تختار درجة الخطر وما سيحدث للغذاء بعد ذلك، فتعطيك الأداة الخطة ثم تحكم على الدفعة من نتائجك، مع منحنى OC، ومنحنى المخاطر حسب متوسط التركيز في Pro.' },
          { p: 'تحدد الحدين m وM بنفسك من المواصفة الوطنية أو مواصفة العميل، فالأداة لا تقدمهما.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'الخطط وفق حالات ICMSF ومتحقق منها مقابل الجدول المنشور، وفئات الخطر وأمثلة الكائنات من ICMSF Cases concept. ومنحنى المخاطر يستخدم نموذج أداة FAO/WHO لخطط العينات. والأداة تساعدك ولا تغني عن المواصفة الوطنية أو مواصفة العميل وعن تقدير مختص سلامة الغذاء.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: كائن دالّ (Indicator) يُعد بوحدة CFU/g، بلا تغيير في الظروف، وm = 100 وM = 1000.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['الخطة', 'Case 5: 3-class, n 5, c 2'],
            ['النتائج (CFU/g)', '40 · 250 · 90 · 600 · 1500'],
            ['الوحدات', '2 مقبولة · 2 هامشية · 1 فوق M'],
            ['القرار', 'الدفعة مرفوضة'],
          ] },
          { p: 'الوحدتان الهامشيتان داخل المسموح في الخطة، لكن الدفعة رُفضت لأن وحدة واحدة (1500) فوق M.' },
        ],
      },
    ],
    references: [
      'ICMSF, Microorganisms in Foods 2: Sampling for Microbiological Analysis.',
      'ICMSF, The ICMSF Cases concept (2020).',
      'FAO/WHO, Microbiological Risk Assessment Series 24 (2016).',
    ],
  },
}

export const STABILITY_GUIDE: ToolGuide = {
  en: {
    title: 'About the stability study (shelf life)',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'A stability study estimates how long a product stays within its specification in storage. Enter the results of each batch at each time point (for example assay at 0, 3, 6, 9, 12, 18 and 24 months) with the storage condition; the tool decides whether the batches can be combined, estimates the shelf life from the data, and gives the shelf life you can claim, including how far you may go beyond the data.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'The statistical evaluation and the limits on extrapolation follow ICH Q1E, with significant change as defined in ICH Q1A(R2). The calculation is tested against published worked examples.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: assay (%) of 3 batches from 0 to 24 months, lower limit 95.0%, long-term room temperature storage, no significant change at accelerated.' },
          { table: [
            ['Result', 'Value'],
            ['Batches', 'Same rate of loss, different starting levels'],
            ['Shelf life by batch', 'A2401 31.9 · A2402 34.6 · A2403 30.0 months'],
            ['Most that ICH Q1E allows here', '36 months'],
            ['Shelf life to claim', '30 months'],
          ] },
          { p: 'Batch A2403 starts lowest and reaches the limit first, at 30.0 months. That is beyond the 24 months of data but within what ICH Q1E allows for this case, so 30 months can be claimed.' },
        ],
      },
    ],
    references: [
      'ICH Q1E, Evaluation for Stability Data.',
      'ICH Q1A(R2), Stability Testing of New Drug Substances and Products.',
    ],
  },
  ar: {
    title: 'عن دراسة الثبات (مدة الصلاحية)',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'دراسة الثبات تقدّر المدة التي يبقى فيها المنتج داخل مواصفته أثناء التخزين. أدخل نتائج كل دفعة عند كل نقطة زمنية (مثل المحتوى Assay عند 0 و3 و6 و9 و12 و18 و24 شهرًا) مع ظرف التخزين، فتحدد الأداة هل يمكن دمج الدفعات، وتقدّر مدة الصلاحية من البيانات، وتعطيك المدة التي يمكن اعتمادها، بما في ذلك إلى أي مدى يمكن تجاوز البيانات.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'التقييم الإحصائي وحدود الاستقراء وفق ICH Q1E، والتغير المعنوي كما يعرّفه ICH Q1A(R2). والحساب مختبر مقابل أمثلة محلولة منشورة.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: المحتوى (%) لثلاث دفعات من 0 إلى 24 شهرًا، والحد الأدنى 95.0%، وتخزين طويل المدى في حرارة الغرفة، دون تغير معنوي في الدراسة المعجّلة.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['الدفعات', 'معدل فقد واحد ومستويات بداية مختلفة'],
            ['مدة الصلاحية لكل دفعة', 'A2401 ‏31.9 · A2402 ‏34.6 · A2403 ‏30.0 شهرًا'],
            ['أقصى ما يسمح به ICH Q1E هنا', '36 شهرًا'],
            ['المدة التي تُعتمد', '30 شهرًا'],
          ] },
          { p: 'الدفعة A2403 تبدأ الأقل فتصل إلى الحد أولًا عند 30.0 شهرًا. وهذا بعد الـ 24 شهرًا من البيانات لكنه داخل ما يسمح به ICH Q1E لهذه الحالة، فيمكن اعتماد 30 شهرًا.' },
        ],
      },
    ],
    references: [
      'ICH Q1E, Evaluation for Stability Data.',
      'ICH Q1A(R2), Stability Testing of New Drug Substances and Products.',
    ],
  },
}
