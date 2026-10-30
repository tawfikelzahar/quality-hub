import type { ToolGuide } from './types'

// Examples = each page's "Try an example" data (lib/spc/examples.ts), run
// through lib/spc/calculator.ts with the page's default tests:
//   I-MR  DS01 → CL 24.167 · UCL 25.098 · LCL 23.236 · MR̄ 0.35 · MR UCL 1.144 ·
//         Cp 1.07 · Cpk 0.90 · Pp 1.29 · Ppk 1.08 (all in minitab.test.mts 'DS01')
//   X̄-R   DS04 → X̿ 73.9991 · UCL 74.0115 · LCL 73.9867 · R̄ 0.02152 · R UCL 0.04550 ·
//         Cp 1.81 · Cpk 1.77 · Pp 1.83 · Ppk 1.80 (all in 'DS04')
//   X̄-S   DS06 → X̿ 5.0230 · UCL 5.0673 · LCL 4.9788 · S̄ 0.04538 · S UCL 0.07788 ·
//         S LCL 0.01287 · Pp 1.59 · Ppk 1.58 (in 'DS06') · Cp 1.60 · Cpk 1.59
//         (site calculation, pooled SD / c4) · no signals on any of the three.
// Constants recovered from the limits: n = 5 → A2 0.577 · D3 0 · D4 2.114;
// n = 10 → A3 0.975 · B3 0.284 · B4 1.716 (Montgomery Appendix VI).

const REFS_EN = [
  'Montgomery, D. C., Introduction to Statistical Quality Control (control chart constants and limits).',
  'AIAG, Statistical Process Control (SPC) Reference Manual, 2nd edition (Cp, Cpk, Pp, Ppk).',
  'Nelson, L. S. (1984), “The Shewhart Control Chart: Tests for Special Causes”, Journal of Quality Technology.',
  'Results are tested against reference datasets analysed in specialised statistical software.',
]
const REFS_AR = [
  'Montgomery, D. C., Introduction to Statistical Quality Control (ثوابت وحدود خرائط التحكم).',
  'AIAG, Statistical Process Control (SPC) Reference Manual, 2nd edition (Cp وCpk وPp وPpk).',
  'Nelson, L. S. (1984), “The Shewhart Control Chart: Tests for Special Causes”, Journal of Quality Technology.',
  'النتائج مختبرة مقابل مجموعات بيانات مرجعية محللة في برامج إحصائية متخصصة.',
]

const CAP_EN = 'Capability: Cp = (USL − LSL) ÷ 6σ within and Cpk = the smaller of (USL − mean) ÷ 3σ and (mean − LSL) ÷ 3σ. Pp and Ppk use the same formulas with σ overall, the ordinary standard deviation of all readings. Normality is checked with the Anderson-Darling test.'
const CAP_AR = 'القدرة: Cp = (USL − LSL) ÷ 6σ within، وCpk هو الأصغر بين (USL − المتوسط) ÷ 3σ و(المتوسط − LSL) ÷ 3σ. ويُحسب Pp وPpk بالمعادلات نفسها باستخدام σ overall، وهو الانحراف المعياري العادي لكل القراءات. وتُفحص طبيعية البيانات باختبار Anderson-Darling.'

export const IMR_GUIDE: ToolGuide = {
  en: {
    title: 'About the I-MR chart',
    sections: [
      {
        h: 'When to use it',
        blocks: [
          { p: 'The Individuals and Moving Range (I-MR) chart is for one measurement at a time: one part per hour, one batch result, one reading per shift. The I chart plots each reading against its control limits; the MR chart plots the difference between consecutive readings, which shows how much the process moves from one reading to the next.' },
          { p: 'Enter the readings in production order. Twenty to 25 readings are a sensible minimum for judging stability, and 30 or more for capability. If you measure several parts per sample, use the X̄-R or X̄-S chart instead.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'MR = |reading − previous reading|; MR̄ is their average. σ within = MR̄ ÷ 1.128 (d2 for a moving range of 2).',
            'I chart: centre line = mean of the readings, limits = mean ± 2.66 × MR̄ (that is ± 3σ within).',
            'MR chart: centre line = MR̄, upper limit = 3.267 × MR̄, lower limit 0.',
            'Tests for special causes: Test 1 (one point beyond 3σ) and Test 2 (9 points in a row on one side of the centre line) on the I chart, Test 1 on the MR chart. Every point that fails is listed.',
            CAP_EN,
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 15 readings, specification 23.0 to 25.0.' },
          { table: [
            ['Result', 'Value'],
            ['I chart', 'CL 24.167 · UCL 25.098 · LCL 23.236'],
            ['MR chart', 'MR̄ 0.35 · UCL 1.144'],
            ['Tests for special causes', 'No signals: stable'],
            ['Cp · Cpk', '1.07 · 0.90'],
            ['Pp · Ppk', '1.29 · 1.08'],
          ] },
          { p: 'Check the UCL by hand: 24.167 + 2.66 × 0.35 = 25.098. The process is stable, but Cp is already below 1.33, so the spread has to come down before centring alone can make it capable.' },
        ],
      },
    ],
    references: REFS_EN,
  },
  ar: {
    title: 'عن مخطط I-MR',
    sections: [
      {
        h: 'متى تستخدمه',
        blocks: [
          { p: 'مخطط القراءات الفردية والمدى المتحرك (I-MR) مخصص لقياس واحد في كل مرة: قطعة كل ساعة، أو نتيجة دفعة، أو قراءة في كل وردية. مخطط I يرسم كل قراءة مقابل حدود التحكم، ومخطط MR يرسم الفرق بين كل قراءتين متتاليتين، فيوضح مقدار تحرك العملية من قراءة إلى التالية.' },
          { p: 'أدخل القراءات بترتيب الإنتاج. من 20 إلى 25 قراءة حد أدنى معقول للحكم على الاستقرار، و30 أو أكثر للقدرة. وإذا كنت تقيس عدة قطع في كل عينة فاستخدم مخطط X̄-R أو X̄-S.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'MR = |القراءة − القراءة السابقة|، وMR̄ متوسطها. σ within = MR̄ ÷ 1.128 (قيمة d2 لمدى متحرك من قراءتين).',
            'مخطط I: الخط المركزي = متوسط القراءات، والحدود = المتوسط ± 2.66 × MR̄ (أي ± 3σ within).',
            'مخطط MR: الخط المركزي = MR̄، والحد الأعلى = 3.267 × MR̄، والحد الأدنى 0.',
            'اختبارات الأسباب الخاصة: Test 1 (نقطة خارج 3σ) وTest 2 (9 نقاط متتالية في جهة واحدة من الخط المركزي) على مخطط I، وTest 1 على مخطط MR. وتُعرض كل نقطة مخالفة.',
            CAP_AR,
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 15 قراءة، والمواصفة من 23.0 إلى 25.0.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['مخطط I', 'CL 24.167 · UCL 25.098 · LCL 23.236'],
            ['مخطط MR', 'MR̄ 0.35 · UCL 1.144'],
            ['اختبارات الأسباب الخاصة', 'لا توجد إشارات: مستقرة'],
            ['Cp · Cpk', '1.07 · 0.90'],
            ['Pp · Ppk', '1.29 · 1.08'],
          ] },
          { p: 'تحقق من UCL يدويًا: 24.167 + 2.66 × 0.35 = 25.098. العملية مستقرة، لكن Cp نفسه أقل من 1.33، لذلك يجب تقليل التشتت أولًا لأن التمركز وحده لن يجعلها قادرة.' },
        ],
      },
    ],
    references: REFS_AR,
  },
}

export const XBAR_R_GUIDE: ToolGuide = {
  en: {
    title: 'About the X̄-R chart',
    sections: [
      {
        h: 'When to use it',
        blocks: [
          { p: 'The X̄-R chart is for samples of 2 to 8 parts taken together (subgroups), for example 5 consecutive parts every hour. The X̄ chart follows the subgroup averages, which shows whether the process centre moves; the R chart follows the range inside each subgroup, which shows whether the short-term spread changes.' },
          { p: 'Keep the subgroup size the same throughout and take each subgroup close together in time, so the variation inside it is only the short-term noise. Twenty to 25 subgroups are a sensible minimum. With 9 or more parts per subgroup use the X̄-S chart.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'X̄ chart: centre line X̿ = the average of the subgroup means, limits = X̿ ± A2 × R̄.',
            'R chart: centre line R̄ = the average range, limits D3 × R̄ and D4 × R̄. For n = 5: A2 = 0.577, D3 = 0, D4 = 2.114.',
            'Tests for special causes: Tests 1 and 2 and Test 7 (15 points in a row within 1σ) on the X̄ chart, Test 1 on the R chart.',
            'σ within for capability: the pooled standard deviation of the subgroups divided by c4, which uses all the readings rather than only the extremes of each subgroup.',
            CAP_EN,
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 25 subgroups of 5 parts, specification 73.95 to 74.05.' },
          { table: [
            ['Result', 'Value'],
            ['X̄ chart', 'X̿ 73.9991 · UCL 74.0115 · LCL 73.9867'],
            ['R chart', 'R̄ 0.02152 · UCL 0.04550 · LCL 0'],
            ['Tests for special causes', 'No signals: stable'],
            ['Cp · Cpk', '1.81 · 1.77'],
            ['Pp · Ppk', '1.83 · 1.80'],
          ] },
          { p: 'Check the X̄ limits by hand: 0.577 × 0.02152 = 0.0124, so 73.9991 ± 0.0124. The process is stable and well centred, and Cpk 1.77 is above both 1.33 and 1.67.' },
        ],
      },
    ],
    references: REFS_EN,
  },
  ar: {
    title: 'عن مخطط X̄-R',
    sections: [
      {
        h: 'متى تستخدمه',
        blocks: [
          { p: 'مخطط X̄-R مخصص للعينات من 2 إلى 8 قطع تؤخذ معًا (مجموعات فرعية)، مثل 5 قطع متتالية كل ساعة. مخطط X̄ يتابع متوسطات المجموعات فيوضح هل يتحرك مركز العملية، ومخطط R يتابع المدى داخل كل مجموعة فيوضح هل يتغير التشتت قصير المدى.' },
          { p: 'حافظ على حجم المجموعة ثابتًا، وخذ كل مجموعة في وقت متقارب حتى يكون التباين داخلها هو التشويش قصير المدى فقط. من 20 إلى 25 مجموعة حد أدنى معقول. ومع 9 قطع فأكثر في المجموعة استخدم مخطط X̄-S.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'مخطط X̄: الخط المركزي X̿ = متوسط متوسطات المجموعات، والحدود = X̿ ± A2 × R̄.',
            'مخطط R: الخط المركزي R̄ = متوسط المدى، والحدود D3 × R̄ وD4 × R̄. وعند n = 5: ‏A2 = 0.577 وD3 = 0 وD4 = 2.114.',
            'اختبارات الأسباب الخاصة: Test 1 وTest 2 وTest 7 (15 نقطة متتالية داخل 1σ) على مخطط X̄، وTest 1 على مخطط R.',
            'σ within للقدرة: الانحراف المعياري المجمّع للمجموعات مقسومًا على c4، وهو يستخدم كل القراءات وليس أطراف كل مجموعة فقط.',
            CAP_AR,
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 25 مجموعة من 5 قطع، والمواصفة من 73.95 إلى 74.05.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['مخطط X̄', 'X̿ 73.9991 · UCL 74.0115 · LCL 73.9867'],
            ['مخطط R', 'R̄ 0.02152 · UCL 0.04550 · LCL 0'],
            ['اختبارات الأسباب الخاصة', 'لا توجد إشارات: مستقرة'],
            ['Cp · Cpk', '1.81 · 1.77'],
            ['Pp · Ppk', '1.83 · 1.80'],
          ] },
          { p: 'تحقق من حدود X̄ يدويًا: 0.577 × 0.02152 = 0.0124، أي 73.9991 ± 0.0124. العملية مستقرة ومتمركزة جيدًا، وCpk يساوي 1.77 أي أعلى من 1.33 و1.67.' },
        ],
      },
    ],
    references: REFS_AR,
  },
}

export const XBAR_S_GUIDE: ToolGuide = {
  en: {
    title: 'About the X̄-S chart',
    sections: [
      {
        h: 'When to use it',
        blocks: [
          { p: 'The X̄-S chart is for subgroups of 9 parts or more. The X̄ chart follows the subgroup averages; the S chart follows the standard deviation inside each subgroup. With larger subgroups the standard deviation uses every reading and estimates the spread better than the range, which only looks at the largest and smallest value.' },
          { p: 'Keep the subgroup size constant and take each subgroup close together in time. For 2 to 8 parts per subgroup use the X̄-R chart.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'X̄ chart: centre line X̿, limits = X̿ ± A3 × S̄, where S̄ is the average subgroup standard deviation.',
            'S chart: centre line S̄, limits B3 × S̄ and B4 × S̄. For n = 10: A3 = 0.975, B3 = 0.284, B4 = 1.716.',
            'Tests for special causes: Tests 1, 2 and 7 on the X̄ chart, Test 1 on the S chart.',
            'σ within for capability: the pooled standard deviation of the subgroups divided by c4.',
            CAP_EN,
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 20 subgroups of 10 parts, specification 4.80 to 5.25.' },
          { table: [
            ['Result', 'Value'],
            ['X̄ chart', 'X̿ 5.0230 · UCL 5.0673 · LCL 4.9788'],
            ['S chart', 'S̄ 0.04538 · UCL 0.07788 · LCL 0.01287'],
            ['Tests for special causes', 'No signals: stable'],
            ['Cp · Cpk', '1.60 · 1.59'],
            ['Pp · Ppk', '1.59 · 1.58'],
          ] },
          { p: 'Check the S chart upper limit by hand: 1.716 × 0.04538 = 0.0779. The S chart has a lower limit above zero (B3 > 0 from n = 6), so an unusually small spread inside a subgroup can also show up as a signal.' },
        ],
      },
    ],
    references: REFS_EN,
  },
  ar: {
    title: 'عن مخطط X̄-S',
    sections: [
      {
        h: 'متى تستخدمه',
        blocks: [
          { p: 'مخطط X̄-S مخصص للمجموعات الفرعية من 9 قطع فأكثر. مخطط X̄ يتابع متوسطات المجموعات، ومخطط S يتابع الانحراف المعياري داخل كل مجموعة. ومع المجموعات الكبيرة يستخدم الانحراف المعياري كل القراءات فيقدّر التشتت أفضل من المدى الذي ينظر إلى أكبر قيمة وأصغر قيمة فقط.' },
          { p: 'حافظ على حجم المجموعة ثابتًا وخذ كل مجموعة في وقت متقارب. ومن 2 إلى 8 قطع في المجموعة استخدم مخطط X̄-R.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'مخطط X̄: الخط المركزي X̿، والحدود = X̿ ± A3 × S̄، حيث S̄ متوسط الانحراف المعياري للمجموعات.',
            'مخطط S: الخط المركزي S̄، والحدود B3 × S̄ وB4 × S̄. وعند n = 10: ‏A3 = 0.975 وB3 = 0.284 وB4 = 1.716.',
            'اختبارات الأسباب الخاصة: Test 1 وTest 2 وTest 7 على مخطط X̄، وTest 1 على مخطط S.',
            'σ within للقدرة: الانحراف المعياري المجمّع للمجموعات مقسومًا على c4.',
            CAP_AR,
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 20 مجموعة من 10 قطع، والمواصفة من 4.80 إلى 5.25.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['مخطط X̄', 'X̿ 5.0230 · UCL 5.0673 · LCL 4.9788'],
            ['مخطط S', 'S̄ 0.04538 · UCL 0.07788 · LCL 0.01287'],
            ['اختبارات الأسباب الخاصة', 'لا توجد إشارات: مستقرة'],
            ['Cp · Cpk', '1.60 · 1.59'],
            ['Pp · Ppk', '1.59 · 1.58'],
          ] },
          { p: 'تحقق من الحد الأعلى لمخطط S يدويًا: 1.716 × 0.04538 = 0.0779. ولمخطط S حد أدنى أكبر من الصفر (B3 > 0 ابتداءً من n = 6)، فيظهر أيضًا التشتت الصغير بشكل غير معتاد داخل مجموعة كإشارة.' },
        ],
      },
    ],
    references: REFS_AR,
  },
}
