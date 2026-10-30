import type { ToolGuide } from './types'

// Example = the published worked example of AIAG MSA 4th ed. (golden set
// GR00: 3 appraisers × 10 parts × 3 trials, no tolerance). Every value is
// asserted by tests/golden/gage/check.mts:
//   Average & Range (Fig. III-B 16): R̄ 0.3417 · X̄diff 0.4446 · Rp 3.511 ·
//     EV 0.20188 · AV 0.22963 · GRR 0.30575 · PV 1.10456 · TV 1.1461 ·
//     %GRR 26.68 % · ndc 5
//   ANOVA (Appendix A, Tables A 4 / A 5): interaction p 0.974 → pooled ·
//     %GRR 27.9 % · %Contribution GRR 7.8 % · ndc 4
// Constants: K1 = 0.5908 (3 trials), K2 = 0.5231 (3 appraisers), K3 = 0.3146
// (10 parts); 0.3417 × 0.5908 = 0.20188 and 3.511 × 0.3146 = 1.10456.

export const GAGE_GUIDE: ToolGuide = {
  en: {
    title: 'About the Gage R&R study',
    sections: [
      {
        h: 'What it tells you',
        blocks: [
          { p: 'A Gage R&R (repeatability and reproducibility) study tells you how much of the variation you see comes from the measurement system rather than from the parts. Several appraisers measure the same parts several times, without knowing which part is which. Repeatability (EV) is the variation when the same appraiser measures the same part again; reproducibility (AV) is the difference between appraisers.' },
          { p: 'Run it before you trust a control chart or a capability study: if the gauge is too noisy, it can hide real changes or create false ones. A common layout is 3 appraisers, 10 parts covering the process range, and 2 or 3 trials.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'Average & Range method: EV = R̄ × K1, AV = √((X̄diff × K2)² − EV² ÷ (n × r)), GRR = √(EV² + AV²), PV = Rp × K3, TV = √(GRR² + PV²), where n is the number of parts and r the number of trials. R̄ is the average range of the repeat readings, X̄diff the spread of the appraiser averages, and Rp the range of the part averages.',
            'ANOVA method: a two-way analysis of variance (part, appraiser, part × appraiser). When the interaction is not significant (p above 0.05) it is pooled into repeatability. The variance components give EV, AV, GRR and PV, and it also shows an appraiser who measures some parts differently from others.',
            '%GRR = GRR ÷ TV. With a tolerance, %Tolerance = 6 × GRR ÷ (USL − LSL), using 6σ as in the 4th edition.',
            'Number of distinct categories: ndc = 1.41 × PV ÷ GRR, rounded down. It should be 5 or more.',
            'Decision guidelines: under 10% acceptable; 10% to 30% may be acceptable depending on the importance of the application and the cost of the gauge; over 30% unacceptable. The verdict uses %Tolerance when you enter limits, otherwise %GRR of total variation.',
            'Ranges above the R chart UCL (R̄ × D4) are flagged: a reading may be wrong or an appraiser may need to repeat it.',
          ] },
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
          { p: 'Both methods put the gauge in the 10% to 30% band: it may be acceptable, depending on the application. Reproducibility is slightly larger than repeatability, so appraiser training or a clearer method is the first place to look. The part × appraiser interaction is far from significant (p = 0.974), so ANOVA pools it into repeatability.' },
        ],
      },
    ],
    references: [
      'AIAG, Measurement Systems Analysis (MSA) Reference Manual, 4th edition: Chapter III Section B (Average & Range, Fig. III-B 16) and Appendix A (ANOVA, Tables A 4 and A 5).',
      'The calculation reproduces the manual’s worked example for both methods.',
    ],
  },
  ar: {
    title: 'عن دراسة Gage R&R',
    sections: [
      {
        h: 'ماذا تخبرك',
        blocks: [
          { p: 'دراسة Gage R&R (التكرارية وإعادة الإنتاج) تخبرك بمقدار التباين الذي يأتي من نظام القياس لا من القطع نفسها. يقيس عدة مُقيّمين القطع نفسها عدة مرات دون أن يعرفوا أي قطعة يقيسون. التكرارية (EV) هي التباين عندما يعيد المُقيّم نفسه قياس القطعة نفسها، وإعادة الإنتاج (AV) هي الفرق بين المُقيّمين.' },
          { p: 'نفّذها قبل أن تعتمد على خريطة تحكم أو دراسة قدرة: إذا كان جهاز القياس كثير التشويش فقد يخفي تغيرات حقيقية أو يصنع تغيرات غير موجودة. والترتيب الشائع 3 مُقيّمين و10 قطع تغطي مدى العملية و2 أو 3 محاولات.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'طريقة Average & Range: ‏EV = R̄ × K1، وAV = √((X̄diff × K2)² − EV² ÷ (n × r))، وGRR = √(EV² + AV²)، وPV = Rp × K3، وTV = √(GRR² + PV²). حيث n عدد القطع وr عدد المحاولات، وR̄ متوسط مدى القراءات المكررة، وX̄diff الفرق بين متوسطات المُقيّمين، وRp مدى متوسطات القطع.',
            'طريقة ANOVA: تحليل تباين ثنائي (القطعة والمُقيّم والتداخل بينهما). وإذا لم يكن التداخل مؤثرًا (p أكبر من 0.05) يُضم إلى التكرارية. ومكونات التباين تعطي EV وAV وGRR وPV، كما تكشف المُقيّم الذي يقيس بعض القطع بشكل مختلف عن غيرها.',
            '%GRR = GRR ÷ TV. ومع وجود تفاوت: %Tolerance = 6 × GRR ÷ (USL − LSL)، باستخدام 6σ كما في الطبعة الرابعة.',
            'عدد الفئات المميزة: ndc = 1.41 × PV ÷ GRR مع التقريب لأسفل، ويجب أن يكون 5 أو أكثر.',
            'إرشادات القرار: أقل من 10% مقبول، ومن 10% إلى 30% قد يكون مقبولًا حسب أهمية التطبيق وتكلفة الجهاز، وأكثر من 30% غير مقبول. ويعتمد الحكم على %Tolerance عند إدخال الحدود، وإلا على %GRR من التباين الكلي.',
            'تُنبَّه القيم التي يتجاوز مداها UCL لخريطة R ‏(R̄ × D4): قد تكون هناك قراءة خاطئة أو يحتاج المُقيّم إلى إعادتها.',
          ] },
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
          { p: 'الطريقتان تضعان الجهاز في نطاق 10% إلى 30%: قد يكون مقبولًا حسب التطبيق. وإعادة الإنتاج أكبر قليلًا من التكرارية، لذلك تدريب المُقيّمين أو توضيح طريقة القياس هو أول ما يُراجع. والتداخل بين القطعة والمُقيّم بعيد جدًا عن التأثير (p = 0.974)، لذلك تضمه ANOVA إلى التكرارية.' },
        ],
      },
    ],
    references: [
      'AIAG, Measurement Systems Analysis (MSA) Reference Manual, 4th edition: الفصل III القسم B ‏(Average & Range، الشكل III-B 16) والملحق A ‏(ANOVA، الجدولان A 4 وA 5).',
      'الحساب يعيد إنتاج المثال المحلول في الدليل بالطريقتين.',
    ],
  },
}
