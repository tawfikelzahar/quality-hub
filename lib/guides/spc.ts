import type { ToolGuide } from './types'

// Example = the tool's "Try an example" data (30 readings, LSL 23, USL 25),
// golden dataset DS12. Every number below is asserted by
// tests/golden/minitab.test.mts (check 'DS12'): CL 24.213 · UCL 25.085 ·
// LCL 23.342 · Cp 1.15 · Cpk 0.90 · Pp 1.08 · Ppk 0.85 · within PPM 3391.23.
// Spread used = 6 × 0.290413 / 2 = 87 % (the screen's capability sentence).
// No formulas on the page (see ./types.ts).

export const SPC_GUIDE: ToolGuide = {
  en: {
    title: 'About Mizan SPC',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Mizan SPC answers the two questions every process review starts with: is the process stable (in statistical control), and is it capable of meeting the specification? Paste your readings and the tool picks the right control chart for your subgroup size, checks it for special causes, and gives Cp, Cpk, Pp and Ppk with the expected parts per million outside the limits, plus a sentence that says whether to reduce variation or re-centre.' },
          { p: 'Use it for measurements such as length, weight, torque or pressure (I-MR, X̄-R and X̄-S charts), and for counts of defective parts or defects (p, np, c and u charts).' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'Control limits, tests for special causes and capability indices follow the AIAG SPC manual and Montgomery. The results are tested against reference data sets analysed in specialised statistical software, and normality is checked before capability is reported. Read stability first: capability numbers from an unstable process do not predict the next batch.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 30 individual readings with a specification of 23.0 to 25.0.' },
          { table: [
            ['Result', 'Value'],
            ['Chart', 'I-MR'],
            ['Centre line and limits', '24.213 · UCL 25.085 · LCL 23.342'],
            ['Tests for special causes', 'No signals: stable'],
            ['Cp · Cpk', '1.15 · 0.90'],
            ['Pp · Ppk', '1.08 · 0.85'],
            ['Expected outside the limits', 'about 3,391 PPM'],
          ] },
          { p: 'The process is stable but not capable against the common 1.33 target. The spread alone uses 87% of the tolerance, so the main job is to reduce variation; the mean also sits a little above the middle of the tolerance.' },
        ],
      },
    ],
    references: [
      'AIAG, Statistical Process Control (SPC) Reference Manual, 2nd edition.',
      'Montgomery, D. C., Introduction to Statistical Quality Control.',
      'Nelson, L. S. (1984), “The Shewhart Control Chart: Tests for Special Causes”, Journal of Quality Technology.',
    ],
  },
  ar: {
    title: 'عن Mizan SPC',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'تجيب Mizan SPC عن السؤالين اللذين تبدأ بهما أي مراجعة لعملية إنتاج: هل العملية مستقرة (تحت السيطرة الإحصائية)، وهل هي قادرة على تحقيق المواصفة؟ الصق قراءاتك فتختار الأداة خريطة التحكم المناسبة لحجم المجموعة، وتفحصها بحثًا عن الأسباب الخاصة، وتعطيك Cp وCpk وPp وPpk مع العدد المتوقع خارج الحدود لكل مليون قطعة، وجملة توضح هل تحتاج إلى تقليل التشتت أم إعادة التمركز.' },
          { p: 'استخدمها للقياسات مثل الطول والوزن والعزم والضغط (خرائط I-MR وX̄-R وX̄-S)، ولعدّ القطع المعيبة أو العيوب (خرائط p وnp وc وu).' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'حدود التحكم واختبارات الأسباب الخاصة ومؤشرات القدرة وفق دليل AIAG SPC وMontgomery. والنتائج مختبرة مقابل مجموعات بيانات مرجعية محللة في برامج إحصائية متخصصة، وتُفحص طبيعية البيانات قبل عرض القدرة. اقرأ الاستقرار أولًا: أرقام القدرة من عملية غير مستقرة لا تتنبأ بالدفعة القادمة.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 30 قراءة فردية بمواصفة من 23.0 إلى 25.0.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['الخريطة', 'I-MR'],
            ['الخط المركزي والحدود', '24.213 · UCL 25.085 · LCL 23.342'],
            ['اختبارات الأسباب الخاصة', 'لا توجد إشارات: مستقرة'],
            ['Cp · Cpk', '1.15 · 0.90'],
            ['Pp · Ppk', '1.08 · 0.85'],
            ['المتوقع خارج الحدود', 'نحو 3,391 PPM'],
          ] },
          { p: 'العملية مستقرة لكنها غير قادرة مقارنة بالهدف الشائع 1.33. التشتت وحده يستهلك 87% من التفاوت، لذلك المهمة الأساسية تقليل التشتت، كما أن المتوسط أعلى قليلًا من منتصف التفاوت.' },
        ],
      },
    ],
    references: [
      'AIAG, Statistical Process Control (SPC) Reference Manual, 2nd edition.',
      'Montgomery, D. C., Introduction to Statistical Quality Control.',
      'Nelson, L. S. (1984), “The Shewhart Control Chart: Tests for Special Causes”, Journal of Quality Technology.',
    ],
  },
}
