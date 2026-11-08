import type { ToolGuide } from './types'

// "About 5 Whys" under the tool. No calculation, so no numbers to check;
// the example is the page's own "Try an example" (lib/fiveWhys/model.ts).

const REFS = [
  'Ohno, T. (1988), Toyota Production System: Beyond Large-Scale Production.',
  'AIAG, CQI-20 Effective Problem Solving Practitioner Guide.',
  'VDA, 8D – Problem Solving in 8 Disciplines.',
]

export const FIVE_WHYS_GUIDE: ToolGuide = {
  en: {
    title: 'About 5 Whys',
    sub: 'When to use it · good practice · worked example · references',
    sections: [
      {
        h: 'When to use it',
        blocks: [
          { p: '5 Whys finds the root cause of a problem by asking “why?” again and again, each answer becoming the next question, until you reach a cause in the process that you can fix. It fits problems with a clear chain of cause and effect: a customer complaint, a defect escape, a breakdown.' },
          { p: 'Automotive customers expect two chains: why the problem happened, and why it was not detected before it reached them. The page asks both by default.' },
        ],
      },
      {
        h: 'Good practice',
        blocks: [
          { list: [
            'Start from facts: what happened, where, when and how many.',
            'Five is a guide, not a rule. Stop when fixing the cause would stop the problem coming back.',
            'When an answer has more than one cause, open a second branch.',
            'If an answer blames a person, ask why the process allowed it.',
            'Read each chain back from the root cause with “therefore”: if every step makes sense, the logic holds.',
            'Give every root cause an action, an owner and a date.',
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The example behind “Try an example”: 12 oil filters leaked at the gasket during the customer engine test. The occurrence chain leads to two root causes (dies missing from the preventive maintenance plan, and an incoming inspection plan never reviewed after a material change); the detection chain leads to one (no start-up check of the leak-test settings after maintenance). Each has its own action.' },
        ],
      },
    ],
    references: REFS,
  },
  ar: {
    title: 'عن \u20665 Whys\u2069',
    sub: 'متى تستخدمها · ممارسات جيدة · مثال محلول · المراجع',
    sections: [
      {
        h: 'متى تستخدمها',
        blocks: [
          { p: 'تصل 5 Whys إلى السبب الجذري للمشكلة بطرح سؤال «لماذا؟» مرة بعد مرة، وكل إجابة تصبح السؤال التالي، حتى تصل إلى سبب في العملية يمكنك إصلاحه. وتناسب المشكلات ذات السلسلة الواضحة من السبب والنتيجة: شكوى عميل، أو عيب تسرب، أو عطل.' },
          { p: 'يتوقع عملاء السيارات سلسلتين: لماذا حدثت المشكلة، ولماذا لم تُكتشف قبل أن تصل إليهم. وتطرح الصفحة الاثنتين افتراضيًا.' },
        ],
      },
      {
        h: 'ممارسات جيدة',
        blocks: [
          { list: [
            'ابدأ بالحقائق: ماذا حدث، وأين، ومتى، وكم.',
            'الرقم خمسة إرشاد لا قاعدة. توقف عندما يمنع إصلاح السبب تكرار المشكلة.',
            'إذا كان للإجابة أكثر من سبب فافتح فرعًا ثانيًا.',
            'إذا ألقت إجابة اللوم على شخص فاسأل لماذا سمحت العملية بذلك.',
            'اقرأ كل سلسلة من السبب الجذري صعودًا مع «لذلك»: إذا كانت كل خطوة منطقية فالتحليل سليم.',
            'حدد لكل سبب جذري إجراءً ومسؤولًا وتاريخًا.',
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'المثال في زر «جرّب بمثال»: تسريب من الجوان في 12 فلتر زيت أثناء اختبار المحرك لدى العميل. تقود سلسلة الحدوث إلى سببين جذريين (الإسطمبات خارج خطة الصيانة الوقائية، وخطة فحص الاستلام لم تُراجع بعد تغيير الخامة)، وتقود سلسلة عدم الاكتشاف إلى سبب واحد (لا يوجد فحص لإعدادات اختبار التسريب عند بدء التشغيل بعد الصيانة). ولكل منها إجراؤه.' },
        ],
      },
    ],
    references: REFS,
  },
}
