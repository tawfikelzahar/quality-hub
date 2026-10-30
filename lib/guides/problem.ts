import type { ToolGuide } from './types'

// Descriptive example = the page's "Try an example" data (30 readings),
// run through lib/descriptive/stats.ts and re-checked with SciPy/NumPy:
//   mean 25.0091 · s 0.10232 · CI mean 24.9709 – 25.0473 · median 25.028 ·
//   Q1 24.94725 · Q3 25.07675 (Weibull / (n+1)p) · CI s 0.0815 – 0.1376 ·
//   skewness −0.431 · AD 0.374, p 0.395 · no outliers
// Pareto example = the page's example (42 / 28 / 15 / 9 / 6) through
// lib/pareto/calc.ts: vital few = 3 categories reaching 85 %; cumulative
// 42 / 70 / 85 / 94 / 100; one category left after 95 % keeps its name.

export const DESCRIPTIVE_GUIDE: ToolGuide = {
  en: {
    title: 'About Descriptive Statistics',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Paste one column of measurements and get the numbers that describe it: centre (mean and median), spread (standard deviation, variance, range, IQR, coefficient of variation), shape (skewness and kurtosis), confidence intervals, a normality test, and a histogram with a box plot under it.' },
          { p: 'It is the first look at any data set: before a capability study, to compare a sample with a specification, or to check whether the data are normal enough for the method you want to use next.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'Standard deviation with n − 1. Confidence interval for the mean: mean ± t × s ÷ √n.',
            'Quartiles at position (n + 1)p with interpolation, the convention of the specialised statistical packages (Excel’s QUARTILE gives slightly different values).',
            'Confidence interval for the median: Hettmansperger and Sheather (1986), interpolated between order statistics. Below 6 values no 95% interval exists.',
            'Confidence interval for the standard deviation from the exact chi-square distribution.',
            'Skewness G1 and kurtosis G2, the bias-corrected pair (the same as Excel SKEW and KURT).',
            'Normality: Anderson-Darling test. A p-value below 0.05 means the data are probably not normal.',
          ] },
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
            ['Skewness', '−0.43'],
            ['Anderson-Darling', 'A² 0.374 · p 0.395'],
          ] },
          { p: 'The p-value of 0.395 gives no reason to reject normality, so normal-based methods such as Cpk are reasonable. The median sits a little above the mean and the skewness is slightly negative: a few low readings pull the mean down. The interval for the mean is about ±0.038, which tells you how precisely 30 readings locate the process centre.' },
        ],
      },
    ],
    references: [
      'Hettmansperger, T. P. and Sheather, S. J. (1986), “Confidence intervals based on interpolated order statistics”, Statistics & Probability Letters.',
      'Hyndman, R. J. and Fan, Y. (1996), “Sample quantiles in statistical packages”, The American Statistician (type 6 quartiles).',
      'Anderson, T. W. and Darling, D. A. (1952); Montgomery, D. C., Introduction to Statistical Quality Control.',
      'Every value is checked against an independent statistical library.',
    ],
  },
  ar: {
    title: 'عن الإحصاء الوصفي',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الصق عمودًا واحدًا من القياسات واحصل على الأرقام التي تصفه: المركز (المتوسط والوسيط)، والتشتت (الانحراف المعياري والتباين والمدى وIQR ومعامل الاختلاف)، والشكل (الالتواء والتفلطح)، وفترات الثقة، واختبار الطبيعية، ومدرج تكراري تحته مخطط صندوقي.' },
          { p: 'هي النظرة الأولى على أي مجموعة بيانات: قبل دراسة القدرة، أو لمقارنة عينة بالمواصفة، أو للتأكد من أن البيانات طبيعية بما يكفي للطريقة التي تريد استخدامها بعد ذلك.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'الانحراف المعياري بقسمة n − 1. وفترة الثقة للمتوسط: المتوسط ± t × s ÷ √n.',
            'الربيعيات عند الموضع (n + 1)p مع الاستكمال، وهي طريقة البرامج الإحصائية المتخصصة (دالة QUARTILE في Excel تعطي قيمًا مختلفة قليلًا).',
            'فترة الثقة للوسيط: طريقة Hettmansperger وSheather ‏(1986) بالاستكمال بين القيم المرتبة. ومع أقل من 6 قيم لا توجد فترة 95%.',
            'فترة الثقة للانحراف المعياري من توزيع chi-square الدقيق.',
            'الالتواء G1 والتفلطح G2، وهما الصيغتان المصححتان للتحيز (نفس SKEW وKURT في Excel).',
            'الطبيعية: اختبار Anderson-Darling. وقيمة p أقل من 0.05 تعني أن البيانات غالبًا ليست طبيعية.',
          ] },
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
            ['الالتواء', '−0.43'],
            ['Anderson-Darling', 'A² 0.374 · p 0.395'],
          ] },
          { p: 'قيمة p ‏(0.395) لا تعطي سببًا لرفض الطبيعية، لذلك الطرق المبنية على التوزيع الطبيعي مثل Cpk مناسبة. والوسيط أعلى قليلًا من المتوسط والالتواء سالب قليلًا: بعض القراءات المنخفضة تسحب المتوسط لأسفل. وفترة المتوسط نحو ±0.038، وهي توضح بأي دقة تحدد 30 قراءة مركز العملية.' },
        ],
      },
    ],
    references: [
      'Hettmansperger, T. P. and Sheather, S. J. (1986), “Confidence intervals based on interpolated order statistics”, Statistics & Probability Letters.',
      'Hyndman, R. J. and Fan, Y. (1996), “Sample quantiles in statistical packages”, The American Statistician (ربيعيات النوع 6).',
      'Anderson, T. W. and Darling, D. A. (1952); Montgomery, D. C., Introduction to Statistical Quality Control.',
      'كل قيمة متحقق منها مقابل مكتبة إحصائية مستقلة.',
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
          { p: 'A Pareto chart sorts problem categories (defect types, causes, complaint reasons, downtime reasons) from the largest to the smallest and draws the cumulative percentage line over the bars. It shows the “vital few” categories that account for most of the problem, so you fix those first instead of spreading effort over everything.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'Categories are sorted by count, largest first. Percent = count ÷ total; the cumulative percent adds them up in that order.',
            'Vital few: the categories up to and including the first one whose cumulative percent reaches 80%, judged on the unrounded value (79.6% does not count as 80%).',
            '“Other”: once the cumulative percent passes 95% (you can change it or switch it off), the remaining small categories are combined into one “Other” bar drawn last. A single leftover category keeps its own name.',
            'The same category typed twice is counted once with the counts added; empty names and zero counts are left out.',
          ] },
          { p: 'The 80/20 split is a rule of thumb, not a law. Use the chart to choose where to start, and count by cost or severity instead of frequency when one type of defect matters much more than another.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: 100 rejected parts in five defect types.' },
          { table: [
            ['Category', 'Count', '%', 'Cumulative %'],
            ['Dimensional error', '42', '42', '42'],
            ['Surface defect', '28', '28', '70'],
            ['Wrong material', '15', '15', '85'],
            ['Assembly fault', '9', '9', '94'],
            ['Packaging damage', '6', '6', '100'],
          ] },
          { p: 'The vital few are the first three categories: together they are 85% of the rejects. After Assembly fault the cumulative is 94%, so only one category is left and it keeps its name instead of becoming “Other”.' },
        ],
      },
    ],
    references: [
      'Juran, J. M., Quality Control Handbook (the Pareto principle in quality).',
      'Montgomery, D. C., Introduction to Statistical Quality Control (Pareto chart).',
      'Tested with hand-calculated cases, including ties, duplicate names and the “Other” bar.',
    ],
  },
  ar: {
    title: 'عن مخطط Pareto',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'مخطط Pareto يرتب فئات المشكلة (أنواع العيوب أو الأسباب أو أسباب الشكاوى أو التوقفات) من الأكبر إلى الأصغر، ويرسم خط النسبة التراكمية فوق الأعمدة. وهو يوضح الفئات القليلة المهمة (Vital few) التي تمثل معظم المشكلة، فتعالجها أولًا بدلًا من توزيع الجهد على كل شيء.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'تُرتب الفئات حسب العدد من الأكبر. النسبة = العدد ÷ الإجمالي، والنسبة التراكمية تجمعها بالترتيب نفسه.',
            'الفئات القليلة المهمة: الفئات حتى أول فئة تصل نسبتها التراكمية إلى 80% وتشملها، بالقيمة غير المقربة (79.6% لا تُحسب 80%).',
            'فئة Other: بعد أن تتجاوز النسبة التراكمية 95% (يمكنك تغييرها أو إيقافها) تُجمع الفئات الصغيرة المتبقية في عمود واحد باسم Other يُرسم في النهاية. وإذا بقيت فئة واحدة فقط تحتفظ باسمها.',
            'الفئة المكتوبة مرتين تُحسب مرة واحدة مع جمع العددين، وتُستبعد الأسماء الفارغة والأعداد الصفرية.',
          ] },
          { p: 'تقسيم 80/20 قاعدة تقريبية وليس قانونًا. استخدم المخطط لتحديد من أين تبدأ، واستخدم التكلفة أو الخطورة بدل التكرار عندما يكون نوع من العيوب أهم بكثير من غيره.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: 100 قطعة مرفوضة في خمسة أنواع من العيوب.' },
          { table: [
            ['الفئة', 'العدد', '%', '% التراكمية'],
            ['Dimensional error', '42', '42', '42'],
            ['Surface defect', '28', '28', '70'],
            ['Wrong material', '15', '15', '85'],
            ['Assembly fault', '9', '9', '94'],
            ['Packaging damage', '6', '6', '100'],
          ] },
          { p: 'الفئات القليلة المهمة هي الثلاث الأولى: تمثل معًا 85% من المرفوضات. وبعد Assembly fault تصل النسبة التراكمية إلى 94%، فتبقى فئة واحدة فقط تحتفظ باسمها ولا تتحول إلى Other.' },
        ],
      },
    ],
    references: [
      'Juran, J. M., Quality Control Handbook (مبدأ Pareto في الجودة).',
      'Montgomery, D. C., Introduction to Statistical Quality Control (مخطط Pareto).',
      'مختبر بحالات محسوبة يدويًا، منها القيم المتساوية والأسماء المكررة وعمود Other.',
    ],
  },
}
