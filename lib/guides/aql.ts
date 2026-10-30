import type { ToolGuide } from './types'

// Example = the tool's "Try an example" data: lot 1000, level II, normal
// inspection; Critical AQL 0.065 found 0 · Major 2.5 found 3 · Minor 4.0
// found 9. Checked with lib/aql/calculator.ts (computeRow + decide) and
// against tests/golden/aql/iso2859-1-2026.json (Table 1 row 501–1200 → J at
// level II; Table 2 row J: 0.065 = light grey → L (n 200, Ac 0), 2.5 = Ac 5,
// 4.0 = Ac 7). Minor: 9 ≥ Re 8 → not accepted, so the lot is not accepted.

export const AQL_GUIDE: ToolGuide = {
  en: {
    title: 'About the AQL sampling plan calculator',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Acceptance sampling decides whether to accept a lot by inspecting a sample instead of every item. This calculator reads the single sampling plans of ISO 2859-1:2026: from the lot size and the inspection level it finds the code letter and the sample size, and for each defect class (for example Critical, Major and Minor, each with its own AQL) it gives the acceptance number Ac and the rejection number Re. Enter how many nonconforming items you found and it gives the decision for each class and for the lot.' },
          { p: 'AQL (acceptance quality limit) is the worst quality level, in percent nonconforming or nonconformities per 100 items, that is tolerable as a process average over a continuing series of lots. It is not a promise that every accepted lot is that good.' },
        ],
      },
      {
        h: 'How the plan is found',
        blocks: [
          { list: [
            'Table 1: lot size and inspection level (general levels I, II, III or special levels S-1 to S-4) give the code letter. Level II is the usual choice.',
            'Tables 2, 3 and 4: the code letter gives the sample size for normal, tightened or reduced inspection, and the AQL column gives Ac and Re.',
            'When a table cell is shaded, the plan comes from another row of the same column, so the class uses another code letter and its sample size. The calculator follows the 2026 shading and tells you when this happens.',
            'If the sample size is equal to or larger than the lot, the whole lot is inspected.',
            'Decision (clause 11.2): found ≤ Ac, the class is acceptable; found ≥ Re, it is not. The lot is not accepted if any class is not accepted.',
            'Switching between normal, tightened, reduced and skip-lot inspection follows clauses 9.3 to 9.5; the rules are listed on this page under the results.',
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: a lot of 1,000 items, general inspection level II, normal inspection. Table 1 gives code letter J, sample size 80.' },
          { table: [
            ['Class', 'AQL', 'Letter', 'n', 'Ac', 'Re', 'Found', 'Decision'],
            ['Critical', '0.065', 'L', '200', '0', '1', '0', 'Accepted'],
            ['Major', '2.5', 'J', '80', '5', '6', '3', 'Accepted'],
            ['Minor', '4.0', 'J', '80', '7', '8', '9', 'Not accepted'],
          ] },
          { p: 'At AQL 0.065 the cell for letter J is shaded, so the Critical class moves down to letter L and needs a sample of 200, not 80. Minor defects reached the rejection number (9 ≥ 8), so the lot is not accepted even though Critical and Major passed.' },
        ],
      },
    ],
    references: [
      'ISO 2859-1:2026, Sampling procedures for inspection by attributes, Part 1: Table 1 (code letters), Tables 2 to 4 (single sampling plans), clauses 9.3 to 9.5 (switching rules) and 11.2 (acceptability).',
      'Every cell of Tables 1 to 4 used by the calculator is checked against the standard.',
    ],
  },
  ar: {
    title: 'عن حاسبة خطة عينات AQL',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الفحص بالعينات يقرر قبول الدفعة أو رفضها بفحص عينة منها بدلًا من فحص كل الوحدات. تقرأ هذه الحاسبة خطط العينة الواحدة في معيار ISO 2859-1:2026، فمن حجم الدفعة ومستوى الفحص تحدد حرف الكود وحجم العينة، ولكل فئة عيوب (مثل Critical وMajor وMinor ولكل منها AQL خاص بها) تعطي رقم القبول Ac ورقم الرفض Re. وعندما تُدخل عدد الوحدات غير المطابقة التي وجدتها تعطيك القرار لكل فئة وللدفعة كلها.' },
          { p: 'AQL (حد الجودة المقبول) هو أسوأ مستوى جودة، كنسبة مئوية للوحدات غير المطابقة أو عدد حالات عدم المطابقة لكل 100 وحدة، يمكن قبوله كمتوسط للعملية على سلسلة مستمرة من الدفعات. وهو ليس ضمانًا بأن كل دفعة مقبولة بهذه الجودة.' },
        ],
      },
      {
        h: 'كيف تُحدد الخطة',
        blocks: [
          { list: [
            'الجدول 1: حجم الدفعة ومستوى الفحص (المستويات العامة I وII وIII أو المستويات الخاصة من S-1 إلى S-4) يحددان حرف الكود. والمستوى II هو الاختيار المعتاد.',
            'الجداول 2 و3 و4: حرف الكود يحدد حجم العينة في الفحص العادي (Normal) أو المشدد (Tightened) أو المخفف (Reduced)، وعمود AQL يحدد Ac وRe.',
            'عندما تكون الخانة مظللة تأتي الخطة من صف آخر في العمود نفسه، فتستخدم الفئة حرف كود آخر وحجم عينته. وتتبع الحاسبة تظليل نسخة 2026 وتنبهك عند حدوث ذلك.',
            'إذا كان حجم العينة مساويًا لحجم الدفعة أو أكبر منه تُفحص الدفعة كلها.',
            'القرار (البند 11.2): إذا كان العدد ≤ Ac فالفئة مقبولة، وإذا كان ≥ Re فهي مرفوضة. وتُرفض الدفعة إذا رُفضت أي فئة.',
            'التحويل بين الفحص العادي والمشدد والمخفف وSkip-lot يتبع البنود 9.3 إلى 9.5، والقواعد مكتوبة في هذه الصفحة تحت النتائج.',
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: دفعة من 1,000 وحدة، مستوى الفحص العام II، فحص عادي. الجدول 1 يعطي حرف الكود J وحجم عينة 80.' },
          { table: [
            ['الفئة', 'AQL', 'الحرف', 'n', 'Ac', 'Re', 'العدد', 'القرار'],
            ['Critical', '0.065', 'L', '200', '0', '1', '0', 'مقبولة'],
            ['Major', '2.5', 'J', '80', '5', '6', '3', 'مقبولة'],
            ['Minor', '4.0', 'J', '80', '7', '8', '9', 'مرفوضة'],
          ] },
          { p: 'عند AQL 0.065 تكون خانة الحرف J مظللة، فتنتقل فئة Critical إلى الحرف L وتحتاج عينة من 200 وحدة لا 80. وعيوب Minor وصلت إلى رقم الرفض (9 ≥ 8)، لذلك تُرفض الدفعة رغم قبول فئتي Critical وMajor.' },
        ],
      },
    ],
    references: [
      'ISO 2859-1:2026, Sampling procedures for inspection by attributes, Part 1: الجدول 1 (حروف الكود)، والجداول 2 إلى 4 (خطط العينة الواحدة)، والبنود 9.3 إلى 9.5 (قواعد التحويل) و11.2 (القبول).',
      'كل خانة في الجداول 1 إلى 4 تستخدمها الحاسبة متحقق منها مقابل المعيار.',
    ],
  },
}
