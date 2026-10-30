import type { ToolGuide } from './types'

// Examples = each page's "Try an example" data (lib/spc/examples.ts), run
// through lib/spc/calculator.ts with the page's default tests:
//   I-MR  DS01 → CL 24.167 · UCL 25.098 · LCL 23.236 · Cp 1.07 · Cpk 0.90 ·
//         Pp 1.29 · Ppk 1.08 (all in minitab.test.mts 'DS01')
//   X̄-R   DS04 → X̿ 73.9991 · UCL 74.0115 · LCL 73.9867 · R̄ 0.02152 ·
//         Cp 1.81 · Cpk 1.77 · Pp 1.83 · Ppk 1.80 (all in 'DS04')
//   X̄-S   DS06 → X̿ 5.0230 · UCL 5.0673 · LCL 4.9788 · S̄ 0.04538 · Pp 1.59 ·
//         Ppk 1.58 (in 'DS06') · Cp 1.60 · Cpk 1.59 (site calculation)
//   No signals on any of the three. No formulas or constants on the page.

const REFS = [
  'AIAG, Statistical Process Control (SPC) Reference Manual, 2nd edition.',
  'Montgomery, D. C., Introduction to Statistical Quality Control.',
  'Nelson, L. S. (1984), “The Shewhart Control Chart: Tests for Special Causes”, Journal of Quality Technology.',
]

const METHOD_EN = 'Control limits, tests for special causes and capability indices follow the AIAG SPC manual and Montgomery, and the results are tested against reference data sets analysed in specialised statistical software. Normality is checked before capability is reported.'
const METHOD_AR = 'حدود التحكم واختبارات الأسباب الخاصة ومؤشرات القدرة وفق دليل AIAG SPC وMontgomery، والنتائج مختبرة مقابل مجموعات بيانات مرجعية محللة في برامج إحصائية متخصصة. وتُفحص طبيعية البيانات قبل عرض القدرة.'

export const IMR_GUIDE: ToolGuide = {
  en: {
    title: 'About the I-MR chart',
    sections: [
      {
        h: 'When to use it',
        blocks: [
          { p: 'The Individuals and Moving Range (I-MR) chart is for one measurement at a time: one part per hour, one batch result, one reading per shift. The I chart shows each reading against its control limits; the MR chart shows how much the process moves from one reading to the next.' },
          { p: 'Enter the readings in production order. Twenty to 25 readings are a sensible minimum for judging stability, and 30 or more for capability. If you measure several parts per sample, use the X̄-R or X̄-S chart instead.' },
        ],
      },
      { h: 'Method', blocks: [{ p: METHOD_EN }] },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 15 readings, specification 23.0 to 25.0.' },
          { table: [
            ['Result', 'Value'],
            ['I chart', 'CL 24.167 · UCL 25.098 · LCL 23.236'],
            ['Tests for special causes', 'No signals: stable'],
            ['Cp · Cpk', '1.07 · 0.90'],
            ['Pp · Ppk', '1.29 · 1.08'],
          ] },
          { p: 'The process is stable, but Cp is already below 1.33, so the spread has to come down before centring alone can make it capable.' },
        ],
      },
    ],
    references: REFS,
  },
  ar: {
    title: 'عن مخطط I-MR',
    sections: [
      {
        h: 'متى تستخدمه',
        blocks: [
          { p: 'مخطط القراءات الفردية والمدى المتحرك (I-MR) مخصص لقياس واحد في كل مرة: قطعة كل ساعة، أو نتيجة دفعة، أو قراءة في كل وردية. مخطط I يعرض كل قراءة مقابل حدود التحكم، ومخطط MR يعرض مقدار تحرك العملية من قراءة إلى التالية.' },
          { p: 'أدخل القراءات بترتيب الإنتاج. من 20 إلى 25 قراءة حد أدنى معقول للحكم على الاستقرار، و30 أو أكثر للقدرة. وإذا كنت تقيس عدة قطع في كل عينة فاستخدم مخطط X̄-R أو X̄-S.' },
        ],
      },
      { h: 'طريقة الحساب', blocks: [{ p: METHOD_AR }] },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 15 قراءة، والمواصفة من 23.0 إلى 25.0.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['مخطط I', 'CL 24.167 · UCL 25.098 · LCL 23.236'],
            ['اختبارات الأسباب الخاصة', 'لا توجد إشارات: مستقرة'],
            ['Cp · Cpk', '1.07 · 0.90'],
            ['Pp · Ppk', '1.29 · 1.08'],
          ] },
          { p: 'العملية مستقرة، لكن Cp نفسه أقل من 1.33، لذلك يجب تقليل التشتت أولًا لأن التمركز وحده لن يجعلها قادرة.' },
        ],
      },
    ],
    references: REFS,
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
          { p: 'Keep the subgroup size the same throughout and take each subgroup close together in time. Twenty to 25 subgroups are a sensible minimum. With 9 or more parts per subgroup use the X̄-S chart.' },
        ],
      },
      { h: 'Method', blocks: [{ p: METHOD_EN }] },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 25 subgroups of 5 parts, specification 73.95 to 74.05.' },
          { table: [
            ['Result', 'Value'],
            ['X̄ chart', 'X̿ 73.9991 · UCL 74.0115 · LCL 73.9867'],
            ['R chart', 'R̄ 0.02152'],
            ['Tests for special causes', 'No signals: stable'],
            ['Cp · Cpk', '1.81 · 1.77'],
            ['Pp · Ppk', '1.83 · 1.80'],
          ] },
          { p: 'The process is stable and well centred, and Cpk 1.77 is above both 1.33 and 1.67.' },
        ],
      },
    ],
    references: REFS,
  },
  ar: {
    title: 'عن مخطط X̄-R',
    sections: [
      {
        h: 'متى تستخدمه',
        blocks: [
          { p: 'مخطط X̄-R مخصص للعينات من 2 إلى 8 قطع تؤخذ معًا (مجموعات فرعية)، مثل 5 قطع متتالية كل ساعة. مخطط X̄ يتابع متوسطات المجموعات فيوضح هل يتحرك مركز العملية، ومخطط R يتابع المدى داخل كل مجموعة فيوضح هل يتغير التشتت قصير المدى.' },
          { p: 'حافظ على حجم المجموعة ثابتًا وخذ كل مجموعة في وقت متقارب. من 20 إلى 25 مجموعة حد أدنى معقول. ومع 9 قطع فأكثر في المجموعة استخدم مخطط X̄-S.' },
        ],
      },
      { h: 'طريقة الحساب', blocks: [{ p: METHOD_AR }] },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 25 مجموعة من 5 قطع، والمواصفة من 73.95 إلى 74.05.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['مخطط X̄', 'X̿ 73.9991 · UCL 74.0115 · LCL 73.9867'],
            ['مخطط R', 'R̄ 0.02152'],
            ['اختبارات الأسباب الخاصة', 'لا توجد إشارات: مستقرة'],
            ['Cp · Cpk', '1.81 · 1.77'],
            ['Pp · Ppk', '1.83 · 1.80'],
          ] },
          { p: 'العملية مستقرة ومتمركزة جيدًا، وCpk يساوي 1.77 أي أعلى من 1.33 و1.67.' },
        ],
      },
    ],
    references: REFS,
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
      { h: 'Method', blocks: [{ p: METHOD_EN }] },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 20 subgroups of 10 parts, specification 4.80 to 5.25.' },
          { table: [
            ['Result', 'Value'],
            ['X̄ chart', 'X̿ 5.0230 · UCL 5.0673 · LCL 4.9788'],
            ['S chart', 'S̄ 0.04538'],
            ['Tests for special causes', 'No signals: stable'],
            ['Cp · Cpk', '1.60 · 1.59'],
            ['Pp · Ppk', '1.59 · 1.58'],
          ] },
          { p: 'The process is stable and capable, with Cpk 1.59 above the common 1.33 target.' },
        ],
      },
    ],
    references: REFS,
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
      { h: 'طريقة الحساب', blocks: [{ p: METHOD_AR }] },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 20 مجموعة من 10 قطع، والمواصفة من 4.80 إلى 5.25.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['مخطط X̄', 'X̿ 5.0230 · UCL 5.0673 · LCL 4.9788'],
            ['مخطط S', 'S̄ 0.04538'],
            ['اختبارات الأسباب الخاصة', 'لا توجد إشارات: مستقرة'],
            ['Cp · Cpk', '1.60 · 1.59'],
            ['Pp · Ppk', '1.59 · 1.58'],
          ] },
          { p: 'العملية مستقرة وقادرة، وCpk يساوي 1.59 أي أعلى من الهدف الشائع 1.33.' },
        ],
      },
    ],
    references: REFS,
  },
}
