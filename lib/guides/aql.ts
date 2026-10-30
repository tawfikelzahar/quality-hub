import type { ToolGuide } from './types'

// Example = the tool's "Try an example" data: lot 1000, level II, normal
// inspection; Critical AQL 0.065 found 0 · Major 2.5 found 3 · Minor 4.0
// found 9. Checked with lib/aql/calculator.ts (computeRow + decide) and
// against tests/golden/aql/iso2859-1-2026.json: code letter J (n 80);
// Critical → letter L (n 200, Ac 0, Re 1) · Major Ac 5 Re 6 · Minor Ac 7 Re 8
// → Minor not accepted, lot not accepted. No tables or rules on the page.

export const AQL_GUIDE: ToolGuide = {
  en: {
    title: 'About the AQL sampling plan calculator',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Acceptance sampling decides whether to accept a lot by inspecting a sample instead of every item. Enter the lot size, the inspection level and the type of inspection (normal, tightened or reduced), give each defect class its own AQL, and the calculator gives the sample size, the acceptance number Ac and the rejection number Re for each class. Enter what you found and it gives the decision for each class and for the lot, with notes for the cases that need attention.' },
          { p: 'AQL (acceptance quality limit) is the worst quality level that is tolerable as a process average over a continuing series of lots. It is not a promise that every accepted lot is that good.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'The plans come from the single sampling tables of the current edition of the standard, ISO 2859-1:2026, checked cell by cell against it, including the cases where a defect class has to use another sample size. The switching rules between normal, tightened, reduced and skip-lot inspection are listed on the page under the results.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: a lot of 1,000 items, general inspection level II, normal inspection.' },
          { table: [
            ['Class', 'AQL', 'Sample (n)', 'Ac', 'Re', 'Found', 'Decision'],
            ['Critical', '0.065', '200', '0', '1', '0', 'Accepted'],
            ['Major', '2.5', '80', '5', '6', '3', 'Accepted'],
            ['Minor', '4.0', '80', '7', '8', '9', 'Not accepted'],
          ] },
          { p: 'The Critical class needs a larger sample than the other two, which the calculator flags. Minor defects reached the rejection number, so the lot is not accepted even though Critical and Major passed.' },
        ],
      },
    ],
    references: [
      'ISO 2859-1:2026, Sampling procedures for inspection by attributes, Part 1.',
    ],
  },
  ar: {
    title: 'عن حاسبة خطة عينات AQL',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الفحص بالعينات يقرر قبول الدفعة أو رفضها بفحص عينة منها بدلًا من فحص كل الوحدات. أدخل حجم الدفعة ومستوى الفحص ونوعه (عادي أو مشدد أو مخفف)، وحدد AQL لكل فئة عيوب، فتعطيك الحاسبة حجم العينة ورقم القبول Ac ورقم الرفض Re لكل فئة. وعندما تُدخل ما وجدته تعطيك القرار لكل فئة وللدفعة كلها، مع ملاحظات للحالات التي تحتاج انتباهًا.' },
          { p: 'AQL (حد الجودة المقبول) هو أسوأ مستوى جودة يمكن قبوله كمتوسط للعملية على سلسلة مستمرة من الدفعات. وهو ليس ضمانًا بأن كل دفعة مقبولة بهذه الجودة.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'الخطط مأخوذة من جداول العينة الواحدة في أحدث إصدار من المعيار ISO 2859-1:2026، ومتحقق منها خانة بخانة، بما في ذلك الحالات التي تستخدم فيها فئة عيوب حجم عينة مختلفًا. وقواعد التحويل بين الفحص العادي والمشدد والمخفف وSkip-lot مكتوبة في هذه الصفحة تحت النتائج.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: دفعة من 1,000 وحدة، مستوى الفحص العام II، فحص عادي.' },
          { table: [
            ['الفئة', 'AQL', 'العينة (n)', 'Ac', 'Re', 'العدد', 'القرار'],
            ['Critical', '0.065', '200', '0', '1', '0', 'مقبولة'],
            ['Major', '2.5', '80', '5', '6', '3', 'مقبولة'],
            ['Minor', '4.0', '80', '7', '8', '9', 'مرفوضة'],
          ] },
          { p: 'فئة Critical تحتاج عينة أكبر من الفئتين الأخريين، وتنبهك الحاسبة لذلك. وعيوب Minor وصلت إلى رقم الرفض، لذلك تُرفض الدفعة رغم قبول فئتي Critical وMajor.' },
        ],
      },
    ],
    references: [
      'ISO 2859-1:2026, Sampling procedures for inspection by attributes, Part 1.',
    ],
  },
}
