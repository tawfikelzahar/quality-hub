import type { ToolGuide } from './types'

// Simple regression example = the page's "Try an example" (Temperature →
// Strength, 11 rows, predict at 158) through lib/regression/model.ts,
// re-checked with scipy.stats.linregress: Strength = 17.369 + 0.25564 ×
// Temperature · R² 99.72 % · R²adj 99.68 % · R²pred 99.59 % · S 0.2388 ·
// p slope 9.1e-13 · fit at 158 = 57.760 · 95 % PI 57.180 – 58.339.
// Multiple regression example = the page's example (Speed, Hardness →
// SurfaceFinish, 11 rows, predict at 1250 / 40), re-checked with numpy
// least squares: 4.6612 − 0.0015987 Speed − 0.018963 Hardness · R² 99.25 % ·
// R²adj 99.06 % · R²pred 98.38 % · p 5.0e-8 / 8.3e-6 · VIF 1.50 ·
// fit 1.904 · 95 % PI 1.735 – 2.074.
// DOE example = the page's example, Montgomery Example 6.1 (plasma etch, 2³,
// 2 replicates) through lib/doe/calculator.ts, asserted by
// tests/golden/doe/check.mts: effects A −101.625 · B 7.375 · C 306.125 ·
// AB −24.875 · AC −153.625 · BC −2.125 · ABC 5.625 · p A 0.0027 · C 0.0000012 ·
// AC 0.00019 · others ≥ 0.33 · R² 96.6 % · R²adj 93.6 % · mean 776.06.
// Effect of A at each level of C from the cell means: C low +52 · C high −255.25
// (= A ∓ AC: −101.625 + 153.625 and −101.625 − 153.625).

const REG_REFS_EN = [
  'Montgomery, D. C., Peck, E. A. and Vining, G. G., Introduction to Linear Regression Analysis.',
  'NIST Statistical Reference Datasets (StRD), linear regression: the calculation reproduces the certified values.',
]
const REG_REFS_AR = [
  'Montgomery, D. C., Peck, E. A. and Vining, G. G., Introduction to Linear Regression Analysis.',
  'NIST Statistical Reference Datasets (StRD) للانحدار الخطي: الحساب يعيد إنتاج القيم المعتمدة.',
]
const REG_METHOD_EN = [
  'Least squares, solved by QR decomposition. Each coefficient is tested with t and the whole model with F, using exact distributions.',
  'R² is the share of the variation in Y the model explains; R²(adj) corrects it for the number of predictors; R²(pred), from PRESS, shows how well the model predicts rows it was not fitted on. A large gap between R² and R²(pred) is a warning of over-fitting.',
  'Residual checks: normality of the residuals (Anderson-Darling), unusual observations (standardised residual beyond ±2, or leverage above 3p ÷ n), and four residual plots.',
  'Prediction: the confidence interval is for the average Y at those X values; the prediction interval is for one new observation, so it is wider. Predicting outside the range of the data is flagged.',
]
const REG_METHOD_AR = [
  'المربعات الصغرى، وتُحل بتحليل QR. ويُختبر كل معامل بـ t والنموذج كله بـ F باستخدام التوزيعات الدقيقة.',
  'R² نسبة التباين في Y التي يفسرها النموذج، وR²(adj) يصححها حسب عدد المتغيرات، وR²(pred) المحسوب من PRESS يوضح قدرة النموذج على التنبؤ بصفوف لم يُبنَ عليها. والفرق الكبير بين R² وR²(pred) تحذير من الإفراط في التوفيق.',
  'فحص البواقي: طبيعية البواقي (Anderson-Darling)، والمشاهدات غير المعتادة (باقٍ معياري خارج ±2 أو leverage أكبر من 3p ÷ n)، وأربعة رسوم للبواقي.',
  'التنبؤ: فترة الثقة لمتوسط Y عند قيم X هذه، وفترة التنبؤ لمشاهدة واحدة جديدة لذلك هي أوسع. ويُنبَّه عند التنبؤ خارج مدى البيانات.',
]

export const REGRESSION_GUIDE: ToolGuide = {
  en: {
    title: 'About Simple Regression',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Simple linear regression fits a straight line between one input X (for example temperature, pressure, time) and one result Y (strength, thickness, yield). It tells you how much Y changes for each unit of X, whether that relationship is real or could be chance, and what Y to expect at a setting you have not tried.' },
          { p: 'A strong relationship does not prove that X causes Y. Use data from a controlled trial when you can, and check the residual plots before you rely on the line.' },
        ],
      },
      { h: 'How it is calculated', blocks: [{ list: REG_METHOD_EN }] },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: tensile strength measured at 11 temperatures from 120 to 170.' },
          { table: [
            ['Result', 'Value'],
            ['Equation', 'Strength = 17.369 + 0.25564 × Temperature'],
            ['p-value of the slope', '< 0.001'],
            ['R² · R²(adj) · R²(pred)', '99.72% · 99.68% · 99.59%'],
            ['S (typical error)', '0.239'],
            ['Prediction at 158', '57.76 · 95% PI 57.18 to 58.34'],
          ] },
          { p: 'Each extra degree adds about 0.256 to the strength. R²(pred) is almost the same as R², so the line predicts new points as well as it fits these ones. A single new part made at 158 should measure between 57.18 and 58.34 in 95% of cases.' },
        ],
      },
    ],
    references: REG_REFS_EN,
  },
  ar: {
    title: 'عن الانحدار البسيط',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الانحدار الخطي البسيط يوفّق خطًا مستقيمًا بين مدخل واحد X (مثل الحرارة أو الضغط أو الزمن) ونتيجة واحدة Y (المتانة أو السُمك أو العائد). ويخبرك بمقدار تغير Y مع كل وحدة من X، وهل هذه العلاقة حقيقية أم قد تكون صدفة، وما قيمة Y المتوقعة عند إعداد لم تجربه.' },
          { p: 'العلاقة القوية لا تثبت أن X سبب Y. استخدم بيانات من تجربة مضبوطة كلما أمكن، وراجع رسوم البواقي قبل الاعتماد على الخط.' },
        ],
      },
      { h: 'كيف تتم الحسابات', blocks: [{ list: REG_METHOD_AR }] },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: متانة الشد مقيسة عند 11 درجة حرارة من 120 إلى 170.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['المعادلة', 'Strength = 17.369 + 0.25564 × Temperature'],
            ['قيمة p للميل', '< 0.001'],
            ['R² · R²(adj) · R²(pred)', '99.72% · 99.68% · 99.59%'],
            ['S (الخطأ المعتاد)', '0.239'],
            ['التنبؤ عند 158', '57.76 · فترة تنبؤ 95% من 57.18 إلى 58.34'],
          ] },
          { p: 'كل درجة إضافية تزيد المتانة بنحو 0.256. وR²(pred) يكاد يساوي R²، لذلك يتنبأ الخط بالنقاط الجديدة بالدقة نفسها التي يوفّق بها هذه النقاط. والقطعة الجديدة المنتجة عند 158 يُتوقع أن تكون بين 57.18 و58.34 في 95% من الحالات.' },
        ],
      },
    ],
    references: REG_REFS_AR,
  },
}

export const MULTIREGRESSION_GUIDE: ToolGuide = {
  en: {
    title: 'About Multiple Regression',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Multiple regression explains one result Y with several inputs at once (up to 10). Each coefficient is the effect of its input while the others are held constant, so you can see which settings really matter and predict Y for a combination of settings.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            ...REG_METHOD_EN,
            'Multicollinearity: the VIF of each input shows how much it overlaps with the others. Above 5 deserves a look and above 10 means the coefficients are unreliable, even when R² is high.',
            'The ANOVA table gives the adjusted sum of squares, F and p for each input, that is its contribution after all the others are in the model.',
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: surface finish (roughness) from 11 runs at different cutting speeds and material hardness.' },
          { table: [
            ['Result', 'Value'],
            ['Equation', 'SurfaceFinish = 4.661 − 0.0015987 × Speed − 0.018963 × Hardness'],
            ['p-values', 'Speed < 0.001 · Hardness < 0.001'],
            ['VIF', '1.50 for both'],
            ['R² · R²(adj) · R²(pred)', '99.25% · 99.06% · 98.38%'],
            ['Prediction at Speed 1250, Hardness 40', '1.904 · 95% PI 1.735 to 2.074'],
          ] },
          { p: 'Both inputs matter: each extra 100 in speed lowers the roughness by about 0.16, and each extra unit of hardness by about 0.019, with the other held constant. A VIF of 1.50 means the two inputs overlap only a little, so their separate effects can be trusted.' },
        ],
      },
    ],
    references: REG_REFS_EN,
  },
  ar: {
    title: 'عن الانحدار المتعدد',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الانحدار المتعدد يفسر نتيجة واحدة Y بعدة مدخلات معًا (حتى 10). وكل معامل هو أثر مدخله مع تثبيت المدخلات الأخرى، فترى أي الإعدادات مؤثرة فعلًا وتتنبأ بقيمة Y لمجموعة إعدادات.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            ...REG_METHOD_AR,
            'التداخل الخطي: قيمة VIF لكل مدخل توضح مقدار تداخله مع الآخرين. أكبر من 5 تستحق المراجعة، وأكبر من 10 تعني أن المعاملات غير موثوقة حتى لو كان R² مرتفعًا.',
            'جدول ANOVA يعطي مجموع المربعات المعدل وF وp لكل مدخل، أي إسهامه بعد دخول كل المدخلات الأخرى في النموذج.',
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: خشونة السطح من 11 تشغيلة بسرعات قطع وصلادة خامة مختلفة.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['المعادلة', 'SurfaceFinish = 4.661 − 0.0015987 × Speed − 0.018963 × Hardness'],
            ['قيم p', 'Speed < 0.001 · Hardness < 0.001'],
            ['VIF', '1.50 للاثنين'],
            ['R² · R²(adj) · R²(pred)', '99.25% · 99.06% · 98.38%'],
            ['التنبؤ عند Speed 1250 وHardness 40', '1.904 · فترة تنبؤ 95% من 1.735 إلى 2.074'],
          ] },
          { p: 'المدخلان مؤثران: كل زيادة 100 في السرعة تخفض الخشونة بنحو 0.16، وكل وحدة صلادة إضافية تخفضها بنحو 0.019، مع تثبيت الآخر. وVIF يساوي 1.50 يعني أن تداخل المدخلين قليل، لذلك يمكن الوثوق بأثر كل منهما.' },
        ],
      },
    ],
    references: REG_REFS_AR,
  },
}

export const DOE_GUIDE: ToolGuide = {
  en: {
    title: 'About Design of Experiments (full factorial)',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'A 2-level full factorial experiment tests every combination of the low and high settings of 2 to 5 factors (2^k runs, optionally replicated). Unlike changing one factor at a time, it measures each factor’s effect and also the interactions, where the effect of one factor depends on the setting of another.' },
          { p: 'The tool builds the run table (with a random run order if you want it), then analyses the results you paste in: which effects are significant, the model equation, and the main-effects and interaction plots.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'Effect = mean response at the high level − mean at the low level. Coefficient = effect ÷ 2 in coded units (−1, +1).',
            'With 2 or more replicates, the error comes from the spread between replicates of the same run, and each term is tested with t (F = t²) at α = 0.05.',
            'With one replicate there is no error term, so Lenth’s method estimates the noise from the small effects, and the Pareto chart shows its margin of error line.',
            'The model equation is given in coded units and in the original units of each factor.',
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example” is Montgomery’s plasma etch experiment: etch rate (Å/min) with factors A gap, B C2F6 flow and C power, 2 replicates, 16 runs.' },
          { table: [
            ['Term', 'Effect', 'p-value'],
            ['C Power', '306.1', '< 0.001'],
            ['AC Gap × Power', '−153.6', '< 0.001'],
            ['A Gap', '−101.6', '0.003'],
            ['AB', '−24.9', '0.325'],
            ['B C2F6 flow', '7.4', '0.764'],
            ['ABC · BC', '5.6 · −2.1', '0.819 · 0.931'],
          ] },
          { p: 'Power has the biggest effect, and gap matters mostly through its interaction with power: at high power a wider gap lowers the etch rate by about 255, while at low power it raises it by about 52, so the two must be set together. Flow (B) has no significant effect and can be set for cost. R² is 96.6% and R²(adj) 93.6%.' },
        ],
      },
    ],
    references: [
      'Montgomery, D. C., Design and Analysis of Experiments, Chapter 6 (2^k factorial designs, Examples 6.1 and 6.2).',
      'Lenth, R. V. (1989), “Quick and easy analysis of unreplicated factorials”, Technometrics.',
      'The calculation reproduces the book’s effects, sums of squares and p-values.',
    ],
  },
  ar: {
    title: 'عن تصميم التجارب (العاملي الكامل)',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'التجربة العاملية الكاملة بمستويين تختبر كل تركيبة من الإعدادات المنخفضة والمرتفعة لعدد من 2 إلى 5 عوامل (2^k تشغيلة مع إمكانية التكرار). وعلى عكس تغيير عامل واحد في كل مرة، تقيس أثر كل عامل وكذلك التداخلات، حين يعتمد أثر عامل على إعداد عامل آخر.' },
          { p: 'تبني الأداة جدول التشغيلات (بترتيب عشوائي إن أردت)، ثم تحلل النتائج التي تلصقها: أي الآثار معنوية، ومعادلة النموذج، ورسوم الآثار الرئيسية والتداخل.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'الأثر = متوسط الاستجابة عند المستوى المرتفع − المتوسط عند المستوى المنخفض. والمعامل = الأثر ÷ 2 بالوحدات المرمزة (−1 و+1).',
            'مع تكرارين أو أكثر يأتي الخطأ من التشتت بين تكرارات التشغيلة نفسها، ويُختبر كل حد بـ t ‏(F = t²) عند α = 0.05.',
            'مع تكرار واحد لا يوجد حد للخطأ، فتقدّر طريقة Lenth التشويش من الآثار الصغيرة، ويعرض مخطط Pareto خط هامش الخطأ.',
            'تظهر معادلة النموذج بالوحدات المرمزة وبالوحدات الأصلية لكل عامل.',
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'بيانات زر «جرّب مثالًا» هي تجربة النقش بالبلازما عند Montgomery: معدل النقش (Å/min) بالعوامل A الفجوة وB تدفق C2F6 وC القدرة، بتكرارين و16 تشغيلة.' },
          { table: [
            ['الحد', 'الأثر', 'قيمة p'],
            ['C القدرة', '306.1', '< 0.001'],
            ['AC الفجوة × القدرة', '−153.6', '< 0.001'],
            ['A الفجوة', '−101.6', '0.003'],
            ['AB', '−24.9', '0.325'],
            ['B تدفق C2F6', '7.4', '0.764'],
            ['ABC · BC', '5.6 · −2.1', '0.819 · 0.931'],
          ] },
          { p: 'القدرة صاحبة الأثر الأكبر، والفجوة تؤثر أساسًا من خلال تداخلها مع القدرة: عند القدرة المرتفعة تخفض زيادة الفجوة معدل النقش بنحو 255، بينما عند القدرة المنخفضة ترفعه بنحو 52، لذلك يجب ضبطهما معًا. والتدفق (B) بلا أثر معنوي ويمكن ضبطه حسب التكلفة. وR² يساوي 96.6% وR²(adj) ‏93.6%.' },
        ],
      },
    ],
    references: [
      'Montgomery, D. C., Design and Analysis of Experiments, Chapter 6 (التصميمات العاملية 2^k، المثالان 6.1 و6.2).',
      'Lenth, R. V. (1989), “Quick and easy analysis of unreplicated factorials”, Technometrics.',
      'الحساب يعيد إنتاج الآثار ومجاميع المربعات وقيم p في الكتاب.',
    ],
  },
}
