import type { ToolGuide } from './types'

// OEE example = the page's "Try an example" (480 min planned, 0 breaks,
// 52 min downtime, 6.0 s ideal cycle, 3,800 total, 3,650 good) through
// lib/oee/calc.ts, re-checked by hand: A 89.17 % · P 88.79 % · Q 96.05 % ·
// OEE 76.04 % ("typical", 60–85) · losses 52 / 48 / 15 min · 150 parts.
// DPMO example = the page's three processes through lib/dpmo/calc.ts and
// SciPy: 3,000 → 4.25σ · 15,000 → 3.67σ · 1,458.3 → 4.48σ · overall
// 55 ÷ 12,800 = 4,296.9 DPMO → 4.13σ.
// No formulas on the page (see ./types.ts).

export const OEE_GUIDE: ToolGuide = {
  en: {
    title: 'About the OEE calculator',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Overall Equipment Effectiveness (OEE) shows how much of the planned production time turned into good parts at the ideal speed. It splits the loss into three: Availability (the machine stopped), Performance (it ran slower than the ideal cycle) and Quality (it made parts that were not good first time). The calculator also turns each loss into minutes and parts, so you can see where the time went and which loss to attack first.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'OEE follows the definition of Nakajima and the Japan Institute of Plant Maintenance (TPM), and the result is compared with the world-class levels for each factor. The calculation is tested against a published worked example.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: an 8-hour shift (480 min), 52 min of unplanned stops, ideal cycle 6.0 s, 3,800 parts made, 3,650 good.' },
          { table: [
            ['Result', 'Value', 'Loss'],
            ['Availability', '89.17%', '52 min stopped'],
            ['Performance', '88.79%', '48 min of slow running'],
            ['Quality', '96.05%', '150 parts (15 min)'],
            ['OEE', '76.04%', 'Typical, room to improve'],
          ] },
          { p: 'The two biggest losses, stops and slow running, are almost equal, so both are worth a look before quality.' },
        ],
      },
    ],
    references: [
      'Nakajima, S., Introduction to TPM: Total Productive Maintenance.',
    ],
  },
  ar: {
    title: 'عن حاسبة OEE',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الفاعلية الكلية للمعدات (OEE) توضح كم من وقت الإنتاج المخطط تحوّل إلى قطع جيدة بالسرعة المثالية. وتقسم الفاقد إلى ثلاثة: التوفر Availability (توقف الماكينة)، والأداء Performance (عملت أبطأ من الزمن المثالي)، والجودة Quality (أنتجت قطعًا غير جيدة من أول مرة). كما تحوّل الحاسبة كل فاقد إلى دقائق وقطع لترى أين ذهب الوقت وأي فاقد تبدأ به.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'OEE وفق تعريف Nakajima ومعهد JIPM الياباني (TPM)، وتُقارن النتيجة بالمستويات العالمية لكل عامل. والحساب مختبر مقابل مثال محلول منشور.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: وردية 8 ساعات (480 دقيقة)، و52 دقيقة توقفات غير مخططة، وزمن دورة مثالي 6.0 ثوانٍ، و3,800 قطعة منتجة منها 3,650 جيدة.' },
          { table: [
            ['النتيجة', 'القيمة', 'الفاقد'],
            ['Availability', '89.17%', '52 دقيقة توقف'],
            ['Performance', '88.79%', '48 دقيقة تشغيل بطيء'],
            ['Quality', '96.05%', '150 قطعة (15 دقيقة)'],
            ['OEE', '76.04%', 'نموذجي مع مجال للتحسين'],
          ] },
          { p: 'أكبر خسارتين، التوقفات والتشغيل البطيء، متساويتان تقريبًا، لذلك تستحقان المراجعة قبل الجودة.' },
        ],
      },
    ],
    references: [
      'Nakajima, S., Introduction to TPM: Total Productive Maintenance.',
    ],
  },
}

export const DPMO_GUIDE: ToolGuide = {
  en: {
    title: 'About the DPMO and Sigma level calculator',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'DPMO (defects per million opportunities) puts processes of different complexity on one scale: a part with 12 places where a defect can happen is not compared directly with a part that has 4. The calculator gives DPU, DPMO, the yield and the Sigma level for each process, and one combined figure for all of them.' },
          { p: 'Define the opportunities carefully and keep the definition fixed: counting more opportunities lowers DPMO without any real improvement.' },
        ],
      },
      {
        h: 'Method',
        blocks: [
          { p: 'The Sigma level uses the long-term convention of the published Six Sigma conversion tables, and the combined figure pools all processes correctly rather than averaging their sigma levels. The calculation is tested against the conversion table and a worked example.' },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: three processes.' },
          { table: [
            ['Process', 'Units', 'Opportunities / unit', 'Defects', 'DPMO', 'Sigma'],
            ['Assembly line A', '500', '12', '18', '3,000', '4.25'],
            ['Welding cell B', '200', '10', '30', '15,000', '3.67'],
            ['Packing C', '1,200', '4', '7', '1,458', '4.48'],
            ['All processes', '1,900', '', '55', '4,297', '4.13'],
          ] },
          { p: 'Welding cell B has the most defects per opportunity and the lowest sigma, so it is the first target, even though Packing C makes more units.' },
        ],
      },
    ],
    references: [
      'Six Sigma sigma-level conversion table (1.5σ shift convention).',
    ],
  },
  ar: {
    title: 'عن حاسبة DPMO ومستوى Sigma',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'DPMO (العيوب لكل مليون فرصة) يضع العمليات المختلفة في درجة تعقيدها على مقياس واحد: فالقطعة التي فيها 12 موضعًا يمكن أن يحدث فيه عيب لا تُقارن مباشرة بقطعة فيها 4 مواضع. وتعطي الحاسبة DPU وDPMO والعائد ومستوى Sigma لكل عملية، ورقمًا مجمعًا واحدًا لها كلها.' },
          { p: 'حدّد الفرص بعناية وثبّت التعريف: زيادة عدد الفرص تخفض DPMO دون أي تحسن حقيقي.' },
        ],
      },
      {
        h: 'طريقة الحساب',
        blocks: [
          { p: 'مستوى Sigma وفق العرف طويل المدى في جداول تحويل Six Sigma المنشورة، والرقم المجمع يجمع العمليات بالطريقة الصحيحة لا بأخذ متوسط مستويات Sigma. والحساب مختبر مقابل جدول التحويل ومثال محلول.' },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: ثلاث عمليات.' },
          { table: [
            ['العملية', 'الوحدات', 'الفرص لكل وحدة', 'العيوب', 'DPMO', 'Sigma'],
            ['Assembly line A', '500', '12', '18', '3,000', '4.25'],
            ['Welding cell B', '200', '10', '30', '15,000', '3.67'],
            ['Packing C', '1,200', '4', '7', '1,458', '4.48'],
            ['كل العمليات', '1,900', '', '55', '4,297', '4.13'],
          ] },
          { p: 'خلية اللحام B فيها أكبر عدد عيوب لكل فرصة وأقل Sigma، لذلك هي الهدف الأول رغم أن Packing C تنتج وحدات أكثر.' },
        ],
      },
    ],
    references: [
      'جدول تحويل مستوى Sigma في Six Sigma (عرف إزاحة 1.5σ).',
    ],
  },
}
