import type { ToolGuide } from './types'

// ICMSF example = the page's "Try an example" (hazard "low" = Indicator,
// conditions no change, count mode, m 100, M 1000 CFU/g, results 40 / 250 /
// 90 / 600 / 1500) through lib/icmsf/calculator.ts: Case 5 · 3-class · n 5 ·
// c 2 · units acceptable / marginal / acceptable / marginal / defective ·
// decision reject (over_M). Case table printed from lib/icmsf/tables.ts
// (checked cell by cell against Table 6-1, tests/golden/icmsf).
// Stability example = the page's example (3 batches, assay %, 0–24 months,
// LSL 95.0, long-term room storage, accelerated: no significant change)
// through lib/stability/calc.ts + shelfLifeClaim: slopes p 0.671 (poolable),
// intercepts p 7e-10 (not) → common slope −0.1666 %/month, own intercepts ·
// one-sided 95 % · shelf life A2401 31.9 · A2402 34.6 · A2403 30.0 months ·
// ICH Q1E 2.4 limit min(2 × 24, 24 + 12) = 36 → claim 30 months (data).

export const ICMSF_GUIDE: ToolGuide = {
  en: {
    title: 'About the ICMSF microbiological sampling plans',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'The ICMSF sampling plans decide whether a food lot is acceptable from microbiological tests on a few sample units. The plan gets stricter as the hazard grows and as the expected handling after sampling makes it more likely to grow. You choose the hazard of the organism and what happens to the food afterwards; the tool gives the Case, the number of units n and the acceptance number c, then decides the lot from your results.' },
          { p: 'You set the limits m and M yourself from your national or customer standard; the tool does not supply them.' },
        ],
      },
      {
        h: 'How the plan is chosen',
        blocks: [
          { table: [
            ['Hazard (examples)', 'Conditions reduce', 'No change', 'Conditions increase'],
            ['Utility (total viable count, yeasts and moulds)', 'Case 1: n 5, c 3', 'Case 2: n 5, c 2', 'Case 3: n 5, c 1'],
            ['Indicator (coliforms, Enterobacteriaceae)', 'Case 4: n 5, c 3', 'Case 5: n 5, c 2', 'Case 6: n 5, c 1'],
            ['Moderate (S. aureus, B. cereus)', 'Case 7: n 5, c 2', 'Case 8: n 5, c 1', 'Case 9: n 10, c 1'],
            ['Serious (Salmonella)', 'Case 10: n 5, c 0', 'Case 11: n 10, c 0', 'Case 12: n 20, c 0'],
            ['Severe (E. coli O157:H7)', 'Case 13: n 15, c 0', 'Case 14: n 30, c 0', 'Case 15: n 60, c 0'],
          ] },
          { list: [
            'Cases 1 to 9 are 3-class plans for counts: a unit up to m is acceptable, between m and M marginal, above M defective. The lot is accepted when no unit is above M and at most c units are marginal.',
            'Cases 10 to 15 are 2-class plans with c = 0: a lot is rejected if any unit is positive (presence / absence), or above m for a count.',
            'The OC curve shows the chance of accepting a lot for each true share of bad units. A risk curve against the mean concentration uses the lognormal model of the FAO/WHO tool (Pro).',
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: an indicator organism counted in CFU/g, no change in conditions, m = 100 and M = 1000.' },
          { table: [
            ['Plan', 'Case 5: 3-class, n 5, c 2'],
            ['Results (CFU/g)', '40 · 250 · 90 · 600 · 1500'],
            ['Units', '2 acceptable · 2 marginal · 1 above M'],
            ['Decision', 'Lot rejected'],
          ] },
          { p: 'Two marginal units are within c = 2, so on their own they would pass. The lot is rejected because one unit (1500) is above M, and any unit above M rejects a 3-class plan whatever the others show.' },
        ],
      },
    ],
    references: [
      'ICMSF, Microorganisms in Foods 2: Sampling for Microbiological Analysis (1974), Table 6-1 (Cases 1 to 15), as reprinted by the US National Academies (1985); checked cell by cell.',
      'ICMSF, The ICMSF Cases concept (2020): hazard categories and example organisms.',
      'FAO/WHO, Microbiological Risk Assessment Series 24 (2016): lognormal model for the risk curve.',
      'The tool supports, but does not replace, your national or customer standard and the judgement of a food safety professional.',
    ],
  },
  ar: {
    title: 'عن خطط عينات ICMSF الميكروبيولوجية',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'خطط عينات ICMSF تحكم على قبول دفعة غذاء من الاختبارات الميكروبيولوجية على عدد قليل من وحدات العينة. وتصبح الخطة أشد كلما زاد خطر الكائن وكلما زادت احتمالية نموه بسبب طريقة التداول المتوقعة بعد أخذ العينة. تختار خطر الكائن وما سيحدث للغذاء بعد ذلك، فتعطيك الأداة الحالة Case وعدد الوحدات n ورقم القبول c، ثم تحكم على الدفعة من نتائجك.' },
          { p: 'تحدد الحدين m وM بنفسك من المواصفة الوطنية أو مواصفة العميل، فالأداة لا تقدمهما.' },
        ],
      },
      {
        h: 'كيف تُختار الخطة',
        blocks: [
          { table: [
            ['الخطر (أمثلة)', 'الظروف تقلل الخطر', 'بلا تغيير', 'الظروف تزيد الخطر'],
            ['Utility ‏(العد الكلي، الخمائر والفطريات)', 'Case 1: n 5, c 3', 'Case 2: n 5, c 2', 'Case 3: n 5, c 1'],
            ['Indicator ‏(Coliforms، Enterobacteriaceae)', 'Case 4: n 5, c 3', 'Case 5: n 5, c 2', 'Case 6: n 5, c 1'],
            ['Moderate ‏(S. aureus، B. cereus)', 'Case 7: n 5, c 2', 'Case 8: n 5, c 1', 'Case 9: n 10, c 1'],
            ['Serious ‏(Salmonella)', 'Case 10: n 5, c 0', 'Case 11: n 10, c 0', 'Case 12: n 20, c 0'],
            ['Severe ‏(E. coli O157:H7)', 'Case 13: n 15, c 0', 'Case 14: n 30, c 0', 'Case 15: n 60, c 0'],
          ] },
          { list: [
            'الحالات من 1 إلى 9 خطط ثلاثية الفئات للعدّ: الوحدة حتى m مقبولة، وبين m وM هامشية، وفوق M معيبة. وتُقبل الدفعة إذا لم تتجاوز أي وحدة M وكان عدد الوحدات الهامشية c أو أقل.',
            'الحالات من 10 إلى 15 خطط ثنائية الفئات مع c = 0: تُرفض الدفعة إذا كانت أي وحدة موجبة (وجود أو غياب)، أو فوق m في العدّ.',
            'منحنى OC يوضح احتمال قبول الدفعة لكل نسبة حقيقية من الوحدات السيئة. ومنحنى المخاطر حسب متوسط التركيز يستخدم النموذج اللوغاريتمي الطبيعي لأداة FAO/WHO ‏(Pro).',
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: كائن دالّ (Indicator) يُعد بوحدة CFU/g، بلا تغيير في الظروف، وm = 100 وM = 1000.' },
          { table: [
            ['الخطة', 'Case 5: ثلاثية الفئات، n 5، c 2'],
            ['النتائج (CFU/g)', '40 · 250 · 90 · 600 · 1500'],
            ['الوحدات', '2 مقبولة · 2 هامشية · 1 فوق M'],
            ['القرار', 'الدفعة مرفوضة'],
          ] },
          { p: 'الوحدتان الهامشيتان داخل c = 2، فلو كانتا وحدهما لقُبلت الدفعة. لكنها رُفضت لأن وحدة واحدة (1500) فوق M، وأي وحدة فوق M ترفض الخطة ثلاثية الفئات مهما كانت بقية النتائج.' },
        ],
      },
    ],
    references: [
      'ICMSF, Microorganisms in Foods 2: Sampling for Microbiological Analysis (1974), Table 6-1 (الحالات من 1 إلى 15)، كما أعادت نشره US National Academies ‏(1985)، ومتحقق منه خلية بخلية.',
      'ICMSF, The ICMSF Cases concept (2020): فئات الخطر وأمثلة الكائنات.',
      'FAO/WHO, Microbiological Risk Assessment Series 24 (2016): النموذج اللوغاريتمي الطبيعي لمنحنى المخاطر.',
      'الأداة تساعدك ولا تغني عن المواصفة الوطنية أو مواصفة العميل وعن تقدير مختص سلامة الغذاء.',
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
          { p: 'A stability study estimates how long a product stays within its specification in storage. You enter the results of each batch at each time point (for example assay at 0, 3, 6, 9, 12, 18 and 24 months); the tool fits a regression line, finds when its confidence bound meets the specification limit, and gives the shelf life you can claim under ICH Q1E.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'Shelf life = the earliest time at which the 95% confidence bound of the mean regression line meets the acceptance limit. One limit uses a one-sided bound; a lower and an upper limit use a two-sided bound.',
            'Batches are combined only when the data allow it: the slopes are tested first, then the intercepts, at α = 0.25 (ANCOVA). The result is one line for all batches, a common slope with a starting point per batch, or a separate line for each batch, and the shortest shelf life is used.',
            'Extrapolation beyond the data follows ICH Q1E sections 2.4 and 2.5. Room temperature: up to twice the time covered and no more than 12 months beyond it when the accelerated study shows no significant change; 1.5 times and no more than 6 months beyond when the accelerated condition changes but the intermediate does not; no extrapolation when the intermediate changes too. Refrigerator: 1.5 times and no more than 6 months beyond with no significant change at accelerated, otherwise none. Freezer: none.',
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: assay (%) of 3 batches from 0 to 24 months, lower limit 95.0%, long-term room temperature storage, no significant change at accelerated.' },
          { table: [
            ['Result', 'Value'],
            ['Same slope? · Same start?', 'Yes (p 0.671) · No (p < 0.001)'],
            ['Model', 'Common slope −0.167% per month, own start per batch'],
            ['Shelf life by batch', 'A2401 31.9 · A2402 34.6 · A2403 30.0 months'],
            ['Most that ICH Q1E allows', 'min(2 × 24, 24 + 12) = 36 months'],
            ['Shelf life to claim', '30 months'],
          ] },
          { p: 'The batches lose assay at the same rate but start at different levels, so they share a slope and keep their own intercepts. Batch A2403 starts lowest and reaches the limit first, at 30.0 months. That is 6 months beyond the 24 months of data, within the 36 months ICH Q1E allows, so 30 months can be claimed.' },
        ],
      },
    ],
    references: [
      'ICH Q1E, Evaluation for Stability Data, sections 2.4 and 2.5 and Appendix B (statistical approaches).',
      'ICH Q1A(R2), definition of significant change at the accelerated and intermediate conditions.',
      'Tested against published worked examples, including LeBlond (2011).',
    ],
  },
  ar: {
    title: 'عن دراسة الثبات (مدة الصلاحية)',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'دراسة الثبات تقدّر المدة التي يبقى فيها المنتج داخل مواصفته أثناء التخزين. تُدخل نتائج كل دفعة عند كل نقطة زمنية (مثل المحتوى Assay عند 0 و3 و6 و9 و12 و18 و24 شهرًا)، فتوفّق الأداة خط انحدار، وتحدد متى يلتقي حد الثقة له بحد المواصفة، وتعطيك مدة الصلاحية التي يمكن اعتمادها وفق ICH Q1E.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'مدة الصلاحية = أقرب زمن يلتقي فيه حد الثقة 95% لمتوسط خط الانحدار بحد القبول. ومع حد واحد يُستخدم حد ثقة من جانب واحد، ومع حدين أدنى وأعلى يُستخدم حد من جانبين.',
            'لا تُدمج الدفعات إلا إذا سمحت البيانات بذلك: تُختبر الميول أولًا ثم نقاط البداية عند α = 0.25 ‏(ANCOVA). والنتيجة خط واحد لكل الدفعات، أو ميل مشترك مع نقطة بداية لكل دفعة، أو خط منفصل لكل دفعة، ويُعتمد أقصر عمر.',
            'الاستقراء بعد البيانات يتبع البندين 2.4 و2.5 من ICH Q1E. حرارة الغرفة: حتى ضعف المدة المغطاة وبحد أقصى 12 شهرًا بعدها إذا لم تُظهر الدراسة المعجّلة تغيرًا معنويًا، و1.5 ضعف وبحد أقصى 6 أشهر إذا تغيرت المعجّلة ولم تتغير الوسيطة، وبدون استقراء إذا تغيرت الوسيطة أيضًا. الثلاجة: 1.5 ضعف وبحد أقصى 6 أشهر إذا لم يحدث تغير معنوي في المعجّلة، وإلا فلا استقراء. المجمد: بدون استقراء.',
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: المحتوى (%) لثلاث دفعات من 0 إلى 24 شهرًا، والحد الأدنى 95.0%، وتخزين طويل المدى في حرارة الغرفة، دون تغير معنوي في الدراسة المعجّلة.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['ميل واحد؟ · بداية واحدة؟', 'نعم (p 0.671) · لا (p < 0.001)'],
            ['النموذج', 'ميل مشترك −0.167% شهريًا ونقطة بداية لكل دفعة'],
            ['مدة الصلاحية لكل دفعة', 'A2401 ‏31.9 · A2402 ‏34.6 · A2403 ‏30.0 شهرًا'],
            ['أقصى ما يسمح به ICH Q1E', 'min(2 × 24, 24 + 12) = 36 شهرًا'],
            ['المدة التي تُعتمد', '30 شهرًا'],
          ] },
          { p: 'الدفعات تفقد المحتوى بالمعدل نفسه لكنها تبدأ عند مستويات مختلفة، لذلك تشترك في الميل وتحتفظ كل منها بنقطة بدايتها. والدفعة A2403 تبدأ الأقل فتصل إلى الحد أولًا عند 30.0 شهرًا، أي بعد 24 شهرًا من البيانات بستة أشهر، وهذا داخل الـ 36 شهرًا التي يسمح بها ICH Q1E، فيمكن اعتماد 30 شهرًا.' },
        ],
      },
    ],
    references: [
      'ICH Q1E, Evaluation for Stability Data, البندان 2.4 و2.5 والملحق B (الطرق الإحصائية).',
      'ICH Q1A(R2)، تعريف التغير المعنوي في الظروف المعجّلة والوسيطة.',
      'مختبرة مقابل أمثلة محلولة منشورة، منها LeBlond ‏(2011).',
    ],
  },
}
