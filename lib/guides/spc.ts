import type { ToolGuide } from './types'

// Example = the tool's "Try an example" data (15 readings, LSL 23, USL 25),
// golden dataset DS01. Every number below is asserted by
// tests/golden/minitab.test.mts (check 'DS01'): CL 24.167 · UCL 25.098 ·
// LCL 23.236 · MR̄ 0.35 · MR UCL 1.144 · σ within 0.310284 · σ overall
// 0.258199 · Cp 1.07 · Cpk 0.90 · Pp 1.29 · Ppk 1.08 · within PPM 3703.70.
// Spread used = 6 × 0.310284 / 2 = 93 % (the screen's capability sentence).

export const SPC_GUIDE: ToolGuide = {
  en: {
    title: 'About SPC Engine',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'SPC Engine answers the two questions every process review starts with: is the process stable (in statistical control), and is it capable of meeting the specification? You paste your readings, and the tool picks the right control chart, runs the tests for special causes, and calculates Cp, Cpk, Pp and Ppk with the expected parts per million (PPM) outside the limits.' },
          { p: 'Use it for measurements such as length, weight, torque or pressure (variable data), and for counts of defective parts or defects (attribute data, p, np, c and u charts).' },
        ],
      },
      {
        h: 'Which chart it uses',
        blocks: [
          { table: [
            ['Subgroup size (n)', 'Chart', 'σ for the chart limits'],
            ['1 (one reading at a time)', 'I-MR', 'MR̄ ÷ 1.128'],
            ['2 to 8', 'X̄-R', 'R̄ ÷ d2'],
            ['9 or more', 'X̄-S', 'S̄ ÷ c4'],
          ] },
          { p: 'Ranges lose efficiency as subgroups grow, so from 9 parts per subgroup the standard deviation (S) chart is used instead of the range (R) chart.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'Control limits sit at the centre line ± 3σ of the plotted statistic. For an I chart that is X̄ ± 2.66 × MR̄; the MR chart upper limit is 3.267 × MR̄.',
            'Tests for special causes by default: Test 1 (one point beyond 3σ) and Test 2 (9 points in a row on one side of the centre line) on the I and X̄ charts, Test 7 (15 points in a row within 1σ) on the X̄ chart, and Test 1 on the MR, R and S charts. All 8 Nelson tests are available as an option. Every point that fails a test is listed, not only the first.',
            'σ within (short term) comes from MR̄ ÷ 1.128 for individual readings, and from the pooled standard deviation of the subgroups divided by c4 for subgroups. It gives Cp and Cpk.',
            'σ overall (long term) is the ordinary sample standard deviation of all readings. It gives Pp and Ppk.',
            'Cp = (USL − LSL) ÷ 6σ within. Cpk = the smaller of (USL − mean) ÷ 3σ and (mean − LSL) ÷ 3σ, so it falls when the process is off centre. Pp and Ppk use σ overall in the same formulas.',
            'Normality is checked with the Anderson-Darling test. Capability is still shown for non-normal data, with a warning, because the PPM estimates assume a normal distribution.',
          ] },
          { p: 'Read stability first. Signals on the chart mean something in the process changed, and capability numbers from an unstable process do not predict the next batch.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 15 individual readings with a specification of 23.0 to 25.0.' },
          { table: [
            ['Result', 'Value'],
            ['Chart', 'I-MR (n = 1)'],
            ['Centre line and limits (I chart)', '24.167 · UCL 25.098 · LCL 23.236'],
            ['MR̄ and MR chart UCL', '0.35 · 1.144'],
            ['Tests for special causes', 'No signals: stable'],
            ['σ within · σ overall', '0.3103 · 0.2582'],
            ['Cp · Cpk', '1.07 · 0.90'],
            ['Pp · Ppk', '1.29 · 1.08'],
            ['Expected outside the limits (within)', 'about 3,704 PPM'],
          ] },
          { p: 'The process is stable but not capable against the common 1.33 target. The spread alone (6σ within) uses 93% of the tolerance, so even perfectly centred it would stay below 1.33: the main job is to reduce variation. The mean also sits 0.167 above the middle of the tolerance, which lowers Cpk from 1.07 to 0.90.' },
        ],
      },
    ],
    references: [
      'Montgomery, D. C., Introduction to Statistical Quality Control (control chart constants and limits).',
      'AIAG, Statistical Process Control (SPC) Reference Manual, 2nd edition (Cp, Cpk, Pp, Ppk).',
      'Nelson, L. S. (1984), “The Shewhart Control Chart: Tests for Special Causes”, Journal of Quality Technology.',
      'Results are tested against reference datasets analysed in specialised statistical software.',
    ],
  },
  ar: {
    title: 'عن SPC Engine',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'تجيب SPC Engine عن السؤالين اللذين تبدأ بهما أي مراجعة لعملية إنتاج: هل العملية مستقرة (تحت السيطرة الإحصائية)، وهل هي قادرة على تحقيق المواصفة؟ تلصق قراءاتك، فتختار الأداة خريطة التحكم المناسبة، وتطبق اختبارات الأسباب الخاصة، وتحسب Cp وCpk وPp وPpk مع العدد المتوقع من القطع خارج الحدود لكل مليون (PPM).' },
          { p: 'استخدمها للقياسات مثل الطول والوزن والعزم والضغط (بيانات متغيرة)، ولعدّ القطع المعيبة أو العيوب (بيانات وصفية، خرائط p وnp وc وu).' },
        ],
      },
      {
        h: 'أي خريطة تستخدم',
        blocks: [
          { table: [
            ['حجم المجموعة (n)', 'الخريطة', 'σ لحدود الخريطة'],
            ['1 (قراءة واحدة في كل مرة)', 'I-MR', 'MR̄ ÷ 1.128'],
            ['من 2 إلى 8', 'X̄-R', 'R̄ ÷ d2'],
            ['9 فأكثر', 'X̄-S', 'S̄ ÷ c4'],
          ] },
          { p: 'تقل كفاءة المدى (Range) كلما كبرت المجموعة، لذلك تُستخدم خريطة الانحراف المعياري S بدل خريطة المدى R ابتداءً من 9 قطع في المجموعة.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'حدود التحكم عند الخط المركزي ± 3σ للقيمة المرسومة. في خريطة I تساوي X̄ ± 2.66 × MR̄، والحد الأعلى لخريطة MR يساوي 3.267 × MR̄.',
            'اختبارات الأسباب الخاصة الافتراضية: Test 1 (نقطة خارج 3σ) وTest 2 (9 نقاط متتالية في جهة واحدة من الخط المركزي) على خريطتي I وX̄، وTest 7 (15 نقطة متتالية داخل 1σ) على خريطة X̄، وTest 1 على خرائط MR وR وS. ويمكن تشغيل اختبارات Nelson الثمانية كلها كخيار. وتُعرض كل نقطة تخالف أي اختبار، لا أول نقطة فقط.',
            'σ within (قصير المدى) من MR̄ ÷ 1.128 للقراءات الفردية، ومن الانحراف المعياري المجمّع للمجموعات مقسومًا على c4 للمجموعات. ومنه يُحسب Cp وCpk.',
            'σ overall (طويل المدى) هو الانحراف المعياري العادي لكل القراءات. ومنه يُحسب Pp وPpk.',
            'Cp = (USL − LSL) ÷ 6σ within. وCpk هو الأصغر بين (USL − المتوسط) ÷ 3σ و(المتوسط − LSL) ÷ 3σ، لذلك ينخفض عندما تبتعد العملية عن المنتصف. ويُحسب Pp وPpk بالمعادلات نفسها باستخدام σ overall.',
            'تُفحص طبيعية البيانات باختبار Anderson-Darling. وتظهر القدرة حتى مع البيانات غير الطبيعية مع تحذير، لأن تقديرات PPM تفترض التوزيع الطبيعي.',
          ] },
          { p: 'اقرأ الاستقرار أولًا. وجود إشارات على الخريطة يعني أن شيئًا في العملية تغيّر، وأرقام القدرة من عملية غير مستقرة لا تتنبأ بالدفعة القادمة.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 15 قراءة فردية بمواصفة من 23.0 إلى 25.0.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['الخريطة', 'I-MR (n = 1)'],
            ['الخط المركزي والحدود (خريطة I)', '24.167 · UCL 25.098 · LCL 23.236'],
            ['MR̄ والحد الأعلى لخريطة MR', '0.35 · 1.144'],
            ['اختبارات الأسباب الخاصة', 'لا توجد إشارات: مستقرة'],
            ['σ within · σ overall', '0.3103 · 0.2582'],
            ['Cp · Cpk', '1.07 · 0.90'],
            ['Pp · Ppk', '1.29 · 1.08'],
            ['المتوقع خارج الحدود (within)', 'نحو 3,704 PPM'],
          ] },
          { p: 'العملية مستقرة لكنها غير قادرة مقارنة بالهدف الشائع 1.33. التشتت وحده (6σ within) يستهلك 93% من التفاوت، فحتى لو كانت العملية في المنتصف تمامًا لبقيت تحت 1.33، لذلك المهمة الأساسية تقليل التشتت. كما أن المتوسط أعلى من منتصف التفاوت بمقدار 0.167، وهذا يخفض Cpk من 1.07 إلى 0.90.' },
        ],
      },
    ],
    references: [
      'Montgomery, D. C., Introduction to Statistical Quality Control (ثوابت وحدود خرائط التحكم).',
      'AIAG, Statistical Process Control (SPC) Reference Manual, 2nd edition (Cp وCpk وPp وPpk).',
      'Nelson, L. S. (1984), “The Shewhart Control Chart: Tests for Special Causes”, Journal of Quality Technology.',
      'النتائج مختبرة مقابل مجموعات بيانات مرجعية محللة في برامج إحصائية متخصصة.',
    ],
  },
}
