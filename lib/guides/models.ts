import type { ToolGuide } from './types'

// Simple regression example = the page's "Try an example" (Temperature →
// Strength, 11 rows, predict at 158) through lib/regression/model.ts,
// re-checked with scipy.stats.linregress: Strength = 14.953 + 0.27236 ×
// Temperature · R² 99.18 % · R²pred 98.80 % · p slope 1.1e-10 · residual
// AD p 0.889 · no unusual observations · fit at 158 = 57.986 · 95 % PI
// 56.935 – 59.038.
// Multiple regression example = the page's example (Speed, Hardness →
// SurfaceFinish, 20 rows, predict at 1250 / 40), re-checked with numpy:
// 4.5643 − 0.0015337 Speed − 0.018489 Hardness · R² 98.53 % · R²pred
// 98.03 % · p 1.2e-15 / 3.1e-11 · VIF 1.02 · AD p 0.968 · no unusual
// observations · fit 1.908 · 95 % PI 1.756 – 2.059.
// DOE example = Montgomery Example 6.1 (plasma etch, 2³, 2 replicates),
// asserted by tests/golden/doe/check.mts: effects C 306.125 · AC −153.625 ·
// A −101.625 · p C 1.2e-6 · AC 1.9e-4 · A 0.0027 · B, AB, BC, ABC ≥ 0.33 ·
// R² 96.6 %. Effect of A at low power +52, at high power −255.25.
// No formulas or internal rules on the page (see ./types.ts).

const REG_REFS = [
  'Montgomery, D. C., Peck, E. A. and Vining, G. G., Introduction to Linear Regression Analysis.',
  'NIST Statistical Reference Datasets (StRD), linear regression.',
]
const REG_METHOD_EN = 'Ordinary least squares, with exact p-values for each coefficient and for the model, R², adjusted R² and predicted R², residual checks with plots, unusual observations, and confidence and prediction intervals for a new setting. The calculation reproduces the certified values of the NIST reference data sets.'
const REG_METHOD_AR = 'المربعات الصغرى العادية، مع قيم p دقيقة لكل معامل وللنموذج، وR² وR² المعدل وR² التنبؤي، وفحص البواقي برسومه، والمشاهدات غير المعتادة، وفترات الثقة والتنبؤ عند إعداد جديد. والحساب يعيد إنتاج القيم المعتمدة لمجموعات بيانات NIST المرجعية.'

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
      { h: 'Method', blocks: [{ p: REG_METHOD_EN }] },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: tensile strength measured at 11 temperatures from 120 to 170.' },
          { table: [
            ['Result', 'Value'],
            ['Equation', 'Strength = 14.953 + 0.27236 × Temperature'],
            ['p-value of the slope', '< 0.001'],
            ['R² · R²(pred)', '99.18% · 98.80%'],
            ['Prediction at 158', '57.99 · 95% PI 56.93 to 59.04'],
          ] },
          { p: 'Each extra degree adds about 0.27 to the strength, the residuals pass the checks, and the line predicts new points almost as well as it fits these ones. A single new part made at 158 should measure between 56.93 and 59.04 in 95% of cases.' },
        ],
      },
    ],
    references: REG_REFS,
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
      { h: 'طريقة الحساب', blocks: [{ p: REG_METHOD_AR }] },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: متانة الشد مقيسة عند 11 درجة حرارة من 120 إلى 170.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['المعادلة', 'Strength = 14.953 + 0.27236 × Temperature'],
            ['قيمة p للميل', '< 0.001'],
            ['R² · R²(pred)', '99.18% · 98.80%'],
            ['التنبؤ عند 158', '57.99 · فترة تنبؤ 95% من 56.93 إلى 59.04'],
          ] },
          { p: 'كل درجة إضافية تزيد المتانة بنحو 0.27، والبواقي تجتاز الفحوص، ويتنبأ الخط بالنقاط الجديدة بدقة تقارب دقة توفيقه لهذه النقاط. والقطعة الجديدة المنتجة عند 158 يُتوقع أن تكون بين 56.93 و59.04 في 95% من الحالات.' },
        ],
      },
    ],
    references: REG_REFS,
  },
}

export const MULTIREGRESSION_GUIDE: ToolGuide = {
  en: {
    title: 'About Multiple Regression',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Multiple regression explains one result Y with several inputs at once (up to 10). Each coefficient is the effect of its input while the others are held constant, so you can see which settings really matter and predict Y for a combination of settings. The tool also warns when inputs overlap so much that their separate effects cannot be trusted.' },
        ],
      },
      { h: 'Method', blocks: [{ p: REG_METHOD_EN }] },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: surface roughness from 20 runs at different cutting speeds and material hardness.' },
          { table: [
            ['Result', 'Value'],
            ['Speed', 'coefficient −0.0015337 · p < 0.001'],
            ['Hardness', 'coefficient −0.018489 · p < 0.001'],
            ['R² · R²(pred)', '98.53% · 98.03%'],
            ['Prediction at Speed 1250, Hardness 40', '1.908 · 95% PI 1.756 to 2.059'],
          ] },
          { p: 'Both inputs matter: each extra 100 in speed lowers the roughness by about 0.15, and each extra unit of hardness by about 0.018, with the other held constant. The two inputs barely overlap, so their separate effects can be trusted.' },
        ],
      },
    ],
    references: REG_REFS,
  },
  ar: {
    title: 'عن الانحدار المتعدد',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الانحدار المتعدد يفسر نتيجة واحدة Y بعدة مدخلات معًا (حتى 10). وكل معامل هو أثر مدخله مع تثبيت المدخلات الأخرى، فترى أي الإعدادات مؤثرة فعلًا وتتنبأ بقيمة Y لمجموعة إعدادات. وتنبهك الأداة أيضًا عندما تتداخل المدخلات لدرجة لا يمكن معها الوثوق بأثر كل منها منفردًا.' },
        ],
      },
      { h: 'طريقة الحساب', blocks: [{ p: REG_METHOD_AR }] },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: خشونة السطح من 20 تشغيلة بسرعات قطع وصلادة خامة مختلفة.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['Speed', 'المعامل −0.0015337 · p < 0.001'],
            ['Hardness', 'المعامل −0.018489 · p < 0.001'],
            ['R² · R²(pred)', '98.53% · 98.03%'],
            ['التنبؤ عند Speed 1250 وHardness 40', '1.908 · فترة تنبؤ 95% من 1.756 إلى 2.059'],
          ] },
          { p: 'المدخلان مؤثران: كل زيادة 100 في السرعة تخفض الخشونة بنحو 0.15، وكل وحدة صلادة إضافية تخفضها بنحو 0.018، مع تثبيت الآخر. وتداخل المدخلين ضئيل، لذلك يمكن الوثوق بأثر كل منهما.' },
        ],
      },
    ],
    references: REG_REFS,
  },
}

export const DOE_GUIDE: ToolGuide = {
  en: {
    title: 'About Design of Experiments (full factorial)',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'A 2-level full factorial experiment tests every combination of the low and high settings of 2 to 5 factors. Unlike changing one factor at a time, it measures each factor’s effect and also the interactions, where the effect of one factor depends on the setting of another.' },
          { p: 'The tool builds the run table (with a random run order if you want it), then analyses the results you paste in: which effects are significant, the model equation in coded and original units, and the main-effects and interaction plots. It works with or without replicates.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'The analysis follows Montgomery’s treatment of 2^k factorial designs, with exact p-values when the runs are replicated and an established method for experiments without replicates. The calculation reproduces the effects, sums of squares and p-values of the book’s worked examples.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example” is Montgomery’s plasma etch experiment: etch rate (Å/min) with factors A gap, B C2F6 flow and C power, 2 replicates, 16 runs.' },
          { table: [
            ['Term', 'Effect', 'Significant?'],
            ['C Power', '306.1', 'Yes'],
            ['AC Gap × Power', '−153.6', 'Yes'],
            ['A Gap', '−101.6', 'Yes'],
            ['B, AB, BC, ABC', 'small', 'No'],
          ] },
          { p: 'Power has the biggest effect, and gap matters mostly through its interaction with power: at high power a wider gap lowers the etch rate sharply, while at low power it raises it slightly, so the two must be set together. Flow has no significant effect and can be set for cost.' },
        ],
      },
    ],
    references: [
      'Montgomery, D. C., Design and Analysis of Experiments, Chapter 6.',
    ],
  },
  ar: {
    title: 'عن تصميم التجارب (العاملي الكامل)',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'التجربة العاملية الكاملة بمستويين تختبر كل تركيبة من الإعدادات المنخفضة والمرتفعة لعدد من 2 إلى 5 عوامل. وعلى عكس تغيير عامل واحد في كل مرة، تقيس أثر كل عامل وكذلك التداخلات، حين يعتمد أثر عامل على إعداد عامل آخر.' },
          { p: 'تبني الأداة جدول التشغيلات (بترتيب عشوائي إن أردت)، ثم تحلل النتائج التي تلصقها: أي الآثار معنوية، ومعادلة النموذج بالوحدات المرمزة والأصلية، ورسوم الآثار الرئيسية والتداخل. وتعمل مع التكرار أو بدونه.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'التحليل وفق معالجة Montgomery للتصميمات العاملية 2^k، بقيم p دقيقة عند تكرار التشغيلات، وطريقة معتمدة للتجارب بدون تكرار. والحساب يعيد إنتاج الآثار ومجاميع المربعات وقيم p في أمثلة الكتاب المحلولة.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'بيانات زر «جرّب مثالًا» هي تجربة النقش بالبلازما عند Montgomery: معدل النقش (Å/min) بالعوامل A الفجوة وB تدفق C2F6 وC القدرة، بتكرارين و16 تشغيلة.' },
          { table: [
            ['الحد', 'الأثر', 'معنوي؟'],
            ['C القدرة', '306.1', 'نعم'],
            ['AC الفجوة × القدرة', '−153.6', 'نعم'],
            ['A الفجوة', '−101.6', 'نعم'],
            ['B وAB وBC وABC', 'صغير', 'لا'],
          ] },
          { p: 'القدرة صاحبة الأثر الأكبر، والفجوة تؤثر أساسًا من خلال تداخلها مع القدرة: عند القدرة المرتفعة تخفض زيادة الفجوة معدل النقش بشدة، وعند القدرة المنخفضة ترفعه قليلًا، لذلك يجب ضبطهما معًا. والتدفق بلا أثر معنوي ويمكن ضبطه حسب التكلفة.' },
        ],
      },
    ],
    references: [
      'Montgomery, D. C., Design and Analysis of Experiments, Chapter 6.',
    ],
  },
}
