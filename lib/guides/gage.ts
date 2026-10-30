import type { ToolGuide } from './types'

// Example = the published worked example of AIAG MSA 4th ed. (golden set
// GR00: 3 appraisers × 10 parts × 3 trials, no tolerance), asserted by
// tests/golden/gage/check.mts:
//   Average & Range: EV 0.20188 · AV 0.22963 · GRR 0.30575 · PV 1.10456 ·
//     %GRR 26.68 % · ndc 5
//   ANOVA: EV 0.199933 · AV 0.226838 · GRR 0.302373 · PV 1.042327 ·
//     %GRR 27.9 % · ndc 4 · interaction p 0.974 (not significant)
// No formulas, constants or internal rules on the page (see ./types.ts).

export const GAGE_GUIDE: ToolGuide = {
  en: {
    title: 'About the Gage R&R study',
    sections: [
      {
        h: 'What it tells you',
        blocks: [
          { p: 'A Gage R&R (repeatability and reproducibility) study tells you how much of the variation you see comes from the measurement system rather than from the parts. Several appraisers measure the same parts several times. Repeatability (EV) is the variation when the same appraiser measures the same part again; reproducibility (AV) is the difference between appraisers.' },
          { p: 'Run it before you trust a control chart or a capability study: a noisy gauge can hide real changes or create false ones. A common layout is 3 appraisers, 10 parts covering the process range, and 2 or 3 trials.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'Both methods of the AIAG MSA manual, 4th edition, are available: Average & Range and ANOVA. The study gives %GRR of the total variation and, when you enter the tolerance, of the tolerance, the number of distinct categories (ndc), and a verdict against the manual’s acceptance guidelines. The calculation reproduces the worked example printed in the manual.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The worked example printed in the AIAG MSA manual: 3 appraisers, 10 parts, 3 trials each, no tolerance.' },
          { table: [
            ['Result', 'Average & Range', 'ANOVA'],
            ['EV (repeatability)', '0.20188', '0.19993'],
            ['AV (reproducibility)', '0.22963', '0.22684'],
            ['GRR', '0.30575', '0.30237'],
            ['PV (part variation)', '1.10456', '1.04233'],
            ['%GRR of total variation', '26.7%', '27.9%'],
            ['ndc', '5', '4'],
          ] },
          { p: 'Both methods put the gauge in the “may be acceptable” band, depending on the application. Reproducibility is slightly larger than repeatability, so appraiser training or a clearer measuring method is the first place to look.' },
        ],
      },
    ],
    references: [
      'AIAG, Measurement Systems Analysis (MSA) Reference Manual, 4th edition.',
    ],
  },
  ar: {
    title: 'عن دراسة Gage R&R',
    sections: [
      {
        h: 'ماذا تخبرك',
        blocks: [
          { p: 'دراسة Gage R&R (التكرارية وإعادة الإنتاج) تخبرك بمقدار التباين الذي يأتي من نظام القياس لا من القطع نفسها. يقيس عدة مُقيّمين القطع نفسها عدة مرات. التكرارية (EV) هي التباين عندما يعيد المُقيّم نفسه قياس القطعة نفسها، وإعادة الإنتاج (AV) هي الفرق بين المُقيّمين.' },
          { p: 'نفّذها قبل أن تعتمد على خريطة تحكم أو دراسة قدرة: جهاز القياس كثير التشويش قد يخفي تغيرات حقيقية أو يصنع تغيرات غير موجودة. والترتيب الشائع 3 مُقيّمين و10 قطع تغطي مدى العملية و2 أو 3 محاولات.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'تتوفر الطريقتان الواردتان في دليل AIAG MSA الطبعة الرابعة: Average & Range وANOVA. وتعطيك الدراسة %GRR من التباين الكلي، ومن التفاوت عند إدخاله، وعدد الفئات المميزة (ndc)، وحكمًا وفق إرشادات القبول في الدليل. والحساب يعيد إنتاج المثال المحلول المنشور في الدليل.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'المثال المحلول المنشور في دليل AIAG MSA: ‏3 مُقيّمين و10 قطع و3 محاولات لكل منهم، بدون تفاوت.' },
          { table: [
            ['النتيجة', 'Average & Range', 'ANOVA'],
            ['EV (التكرارية)', '0.20188', '0.19993'],
            ['AV (إعادة الإنتاج)', '0.22963', '0.22684'],
            ['GRR', '0.30575', '0.30237'],
            ['PV (تباين القطع)', '1.10456', '1.04233'],
            ['%GRR من التباين الكلي', '26.7%', '27.9%'],
            ['ndc', '5', '4'],
          ] },
          { p: 'الطريقتان تضعان الجهاز في نطاق «قد يكون مقبولًا» حسب التطبيق. وإعادة الإنتاج أكبر قليلًا من التكرارية، لذلك تدريب المُقيّمين أو توضيح طريقة القياس هو أول ما يُراجع.' },
        ],
      },
    ],
    references: [
      'AIAG, Measurement Systems Analysis (MSA) Reference Manual, 4th edition.',
    ],
  },
}
