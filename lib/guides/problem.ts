import type { ToolGuide } from './types'

// Descriptive example = the page's "Try an example" data (30 readings),
// run through lib/descriptive/stats.ts and re-checked with SciPy/NumPy:
//   mean 25.0091 · s 0.10232 · CI mean 24.9709 – 25.0473 · median 25.028 ·
//   Q1 24.94725 · Q3 25.07675 · CI s 0.0815 – 0.1376 · AD 0.374, p 0.395
// Pareto example = the page's example (42 / 28 / 15 / 9 / 6) through
// lib/pareto/calc.ts: vital few = 3 categories reaching 85 %; cumulative
// 42 / 70 / 85 / 94 / 100.
// No formulas or internal rules on the page (see ./types.ts).

export const DESCRIPTIVE_GUIDE: ToolGuide = {
  en: {
    title: 'About Descriptive Statistics',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Paste one column of measurements and get the numbers that describe it: centre (mean and median), spread (standard deviation, variance, range, IQR, coefficient of variation), shape (skewness and kurtosis), confidence intervals for the mean, median and standard deviation, a normality test, and a histogram with a box plot under it.' },
          { p: 'It is the first look at any data set: before a capability study, to compare a sample with a specification, or to check whether the data are normal enough for the method you want to use next.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'Each statistic uses the convention of the specialised statistical packages, so quartiles and skewness can differ slightly from Excel. Normality is checked with the Anderson-Darling test. Every value is checked against an independent statistical library.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 30 readings around 25.0.' },
          { table: [
            ['Result', 'Value'],
            ['Mean · 95% CI', '25.0091 · 24.9709 to 25.0473'],
            ['Standard deviation · 95% CI', '0.1023 · 0.0815 to 0.1376'],
            ['Median', '25.028'],
            ['Q1 · Q3', '24.947 · 25.077'],
            ['Normality (Anderson-Darling)', 'p 0.395'],
          ] },
          { p: 'The p-value gives no reason to reject normality, so normal-based methods such as Cpk are reasonable. The median sits a little above the mean: a few low readings pull the mean down.' },
        ],
      },
    ],
    references: [
      'Montgomery, D. C., Introduction to Statistical Quality Control.',
      'Anderson, T. W. and Darling, D. A. (1952), Annals of Mathematical Statistics.',
    ],
  },
  ar: {
    title: 'عن الإحصاء الوصفي',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الصق عمودًا واحدًا من القياسات واحصل على الأرقام التي تصفه: المركز (المتوسط والوسيط)، والتشتت (الانحراف المعياري والتباين والمدى وIQR ومعامل الاختلاف)، والشكل (الالتواء والتفلطح)، وفترات الثقة للمتوسط والوسيط والانحراف المعياري، واختبار الطبيعية، ومدرج تكراري تحته مخطط صندوقي.' },
          { p: 'هي النظرة الأولى على أي مجموعة بيانات: قبل دراسة القدرة، أو لمقارنة عينة بالمواصفة، أو للتأكد من أن البيانات طبيعية بما يكفي للطريقة التي تريد استخدامها بعد ذلك.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'كل مقياس يتبع طريقة البرامج الإحصائية المتخصصة، لذلك قد تختلف الربيعيات والالتواء قليلًا عن Excel. وتُفحص الطبيعية باختبار Anderson-Darling. وكل قيمة متحقق منها مقابل مكتبة إحصائية مستقلة.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 30 قراءة حول 25.0.' },
          { table: [
            ['النتيجة', 'القيمة'],
            ['المتوسط · فترة ثقة 95%', '25.0091 · من 24.9709 إلى 25.0473'],
            ['الانحراف المعياري · فترة ثقة 95%', '0.1023 · من 0.0815 إلى 0.1376'],
            ['الوسيط', '25.028'],
            ['Q1 · Q3', '24.947 · 25.077'],
            ['الطبيعية (Anderson-Darling)', 'p 0.395'],
          ] },
          { p: 'قيمة p لا تعطي سببًا لرفض الطبيعية، لذلك الطرق المبنية على التوزيع الطبيعي مثل Cpk مناسبة. والوسيط أعلى قليلًا من المتوسط: بعض القراءات المنخفضة تسحب المتوسط لأسفل.' },
        ],
      },
    ],
    references: [
      'Montgomery, D. C., Introduction to Statistical Quality Control.',
      'Anderson, T. W. and Darling, D. A. (1952), Annals of Mathematical Statistics.',
    ],
  },
}

export const PARETO_GUIDE: ToolGuide = {
  en: {
    title: 'About the Pareto chart',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'A Pareto chart sorts problem categories (defect types, causes, complaint reasons, downtime reasons) from the largest to the smallest and draws the cumulative percentage line over the bars. It shows the “vital few” categories that account for most of the problem, so you fix those first instead of spreading effort over everything. Small categories at the end can be grouped into one “Other” bar.' },
          { p: 'The 80/20 split is a rule of thumb, not a law. Use the chart to choose where to start, and count by cost or severity instead of frequency when one type of defect matters much more than another.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'The chart follows the classic Pareto analysis used in quality management, and is tested with hand-calculated cases, including ties and repeated category names.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 100 rejected parts in five defect types.' },
          { table: [
            ['Category', 'Count', 'Cumulative %'],
            ['Dimensional error', '42', '42'],
            ['Surface defect', '28', '70'],
            ['Wrong material', '15', '85'],
            ['Assembly fault', '9', '94'],
            ['Packaging damage', '6', '100'],
          ] },
          { p: 'The vital few are the first three categories: together they are 85% of the rejects, so that is where the improvement effort should start.' },
        ],
      },
    ],
    references: [
      'Juran, J. M., Quality Control Handbook.',
      'Montgomery, D. C., Introduction to Statistical Quality Control.',
    ],
  },
  ar: {
    title: 'عن مخطط Pareto',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'مخطط Pareto يرتب فئات المشكلة (أنواع العيوب أو الأسباب أو أسباب الشكاوى أو التوقفات) من الأكبر إلى الأصغر، ويرسم خط النسبة التراكمية فوق الأعمدة. وهو يوضح الفئات القليلة المهمة (Vital few) التي تمثل معظم المشكلة، فتعالجها أولًا بدلًا من توزيع الجهد على كل شيء. ويمكن جمع الفئات الصغيرة في آخر المخطط في عمود واحد باسم Other.' },
          { p: 'تقسيم 80/20 قاعدة تقريبية وليس قانونًا. استخدم المخطط لتحديد من أين تبدأ، واستخدم التكلفة أو الخطورة بدل التكرار عندما يكون نوع من العيوب أهم بكثير من غيره.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'المخطط يتبع تحليل Pareto التقليدي المستخدم في إدارة الجودة، ومختبر بحالات محسوبة يدويًا، منها القيم المتساوية وأسماء الفئات المكررة.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 100 قطعة مرفوضة في خمسة أنواع من العيوب.' },
          { table: [
            ['الفئة', 'العدد', '% التراكمية'],
            ['Dimensional error', '42', '42'],
            ['Surface defect', '28', '70'],
            ['Wrong material', '15', '85'],
            ['Assembly fault', '9', '94'],
            ['Packaging damage', '6', '100'],
          ] },
          { p: 'الفئات القليلة المهمة هي الثلاث الأولى: تمثل معًا 85% من المرفوضات، فمنها يبدأ جهد التحسين.' },
        ],
      },
    ],
    references: [
      'Juran, J. M., Quality Control Handbook.',
      'Montgomery, D. C., Introduction to Statistical Quality Control.',
    ],
  },
}
