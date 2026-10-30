import type { ToolGuide } from './types'

// OEE example = the page's "Try an example" (480 min planned, 0 breaks,
// 52 min downtime, 6.0 s ideal cycle, 3,800 total, 3,650 good) through
// lib/oee/calc.ts, re-checked by hand: run 428 min · A 89.17 % · P 88.79 % ·
// Q 96.05 % · OEE 76.04 % ("typical", 60–85) · losses 10.83 / 10.00 / 3.13 %
// = 52 / 48 / 15 min · 150 rejected parts · 76.04 + 10.83 + 10.00 + 3.13 = 100.
// DPMO example = the page's three processes through lib/dpmo/calc.ts and
// SciPy: 3,000 → 4.25σ · 15,000 → 3.67σ · 1,458.3 → 4.48σ · overall
// 55 ÷ 12,800 = 4,296.9 DPMO → 4.13σ.

export const OEE_GUIDE: ToolGuide = {
  en: {
    title: 'About the OEE calculator',
    sections: [
      {
        h: 'What it does',
        blocks: [
          { p: 'Overall Equipment Effectiveness (OEE) shows how much of the planned production time turned into good parts at the ideal speed. It splits the loss into three: Availability (the machine stopped), Performance (it ran slower than the ideal cycle) and Quality (it made parts that were not good first time). The calculator also turns each loss into minutes and parts, so you can see where the time went.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'Availability = run time ÷ (planned time − planned breaks), where run time = planned time − breaks − unplanned downtime.',
            'Performance = ideal cycle time × total parts ÷ run time. Above 100% means the ideal cycle time is too slow, so the calculator stops and asks you to check it rather than cutting it to 100%.',
            'Quality = good parts (first pass, without rework) ÷ total parts.',
            'OEE = Availability × Performance × Quality. The three losses are shown as shares of the planned time, so OEE plus the losses adds up to 100%.',
            'Bands used on the result: 85% or more world class, 60% to 85% typical with room to improve, 40% to 60% below average, below 40% significant losses. World-class targets for each factor: Availability 90%, Performance 95%, Quality 99.9%.',
          ] },
        ],
      },
      {
        h: 'Worked example',
        blocks: [
          { p: 'The data behind “Try an example”: an 8-hour shift (480 min), no planned breaks, 52 min of unplanned stops, ideal cycle 6.0 s, 3,800 parts made, 3,650 good.' },
          { table: [
            ['Result', 'Value', 'Loss'],
            ['Availability', '89.17%', '52 min stopped (10.83%)'],
            ['Performance', '88.79%', '48 min of slow running (10.00%)'],
            ['Quality', '96.05%', '150 parts = 15 min (3.13%)'],
            ['OEE', '76.04%', 'Typical (60% to 85%)'],
          ] },
          { p: 'Check: 428 min of run time could have made 4,280 parts at 6 s, but 3,800 were made, so 480 parts (48 min) were lost to speed. The two biggest losses, stops and slow running, are almost equal, so both are worth a look before quality.' },
        ],
      },
    ],
    references: [
      'Nakajima, S., Introduction to TPM: Total Productive Maintenance (JIPM): OEE definition and world-class targets.',
      'Tested against a published worked example (Availability 88.81%, Performance 86.11%, Quality 97.80%, OEE 74.79%).',
    ],
  },
  ar: {
    title: 'عن حاسبة OEE',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'الفاعلية الكلية للمعدات (OEE) توضح كم من وقت الإنتاج المخطط تحوّل إلى قطع جيدة بالسرعة المثالية. وتقسم الفاقد إلى ثلاثة: التوفر Availability (توقف الماكينة)، والأداء Performance (عملت أبطأ من الزمن المثالي)، والجودة Quality (أنتجت قطعًا غير جيدة من أول مرة). كما تحوّل الحاسبة كل فاقد إلى دقائق وقطع لترى أين ذهب الوقت.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'Availability = زمن التشغيل ÷ (الزمن المخطط − الاستراحات المخططة)، حيث زمن التشغيل = الزمن المخطط − الاستراحات − التوقفات غير المخططة.',
            'Performance = زمن الدورة المثالي × إجمالي القطع ÷ زمن التشغيل. وإذا تجاوز 100% فهذا يعني أن زمن الدورة المثالي أبطأ من الحقيقي، لذلك تتوقف الحاسبة وتطلب مراجعته بدلًا من قصّه إلى 100%.',
            'Quality = القطع الجيدة (من أول مرة وبدون إعادة تشغيل) ÷ إجمالي القطع.',
            'OEE = Availability × Performance × Quality. وتظهر الخسائر الثلاث كنسب من الزمن المخطط، فيكون مجموع OEE والخسائر 100%.',
            'التصنيف المستخدم: 85% فأكثر مستوى عالمي، ومن 60% إلى 85% نموذجي مع مجال للتحسين، ومن 40% إلى 60% أقل من المتوسط، وأقل من 40% خسائر كبيرة. والأهداف العالمية لكل عامل: Availability ‏90% وPerformance ‏95% وQuality ‏99.9%.',
          ] },
        ],
      },
      {
        h: 'مثال محلول',
        blocks: [
          { p: 'هذه بيانات زر «جرّب مثالًا»: وردية 8 ساعات (480 دقيقة)، بدون استراحات مخططة، و52 دقيقة توقفات غير مخططة، وزمن دورة مثالي 6.0 ثوانٍ، و3,800 قطعة منتجة منها 3,650 جيدة.' },
          { table: [
            ['النتيجة', 'القيمة', 'الفاقد'],
            ['Availability', '89.17%', '52 دقيقة توقف (10.83%)'],
            ['Performance', '88.79%', '48 دقيقة تشغيل بطيء (10.00%)'],
            ['Quality', '96.05%', '150 قطعة = 15 دقيقة (3.13%)'],
            ['OEE', '76.04%', 'نموذجي (من 60% إلى 85%)'],
          ] },
          { p: 'للتحقق: 428 دقيقة تشغيل كانت تكفي لإنتاج 4,280 قطعة بزمن 6 ثوانٍ، لكن أُنتجت 3,800، أي ضاعت 480 قطعة (48 دقيقة) بسبب السرعة. وأكبر خسارتين، التوقفات والتشغيل البطيء، متساويتان تقريبًا، لذلك تستحقان المراجعة قبل الجودة.' },
        ],
      },
    ],
    references: [
      'Nakajima, S., Introduction to TPM: Total Productive Maintenance (JIPM): تعريف OEE والأهداف العالمية.',
      'مختبرة مقابل مثال محلول منشور (Availability ‏88.81% وPerformance ‏86.11% وQuality ‏97.80% وOEE ‏74.79%).',
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
          { p: 'DPMO (defects per million opportunities) puts processes of different complexity on one scale: a part with 12 places where a defect can happen is not compared directly with a part that has 4. The calculator gives DPU, DPMO, the yield per opportunity and the Sigma level for each process, and a combined figure for all of them.' },
        ],
      },
      {
        h: 'How it is calculated',
        blocks: [
          { list: [
            'DPU = defects ÷ units. DPO = defects ÷ (units × opportunities per unit). DPMO = DPO × 1,000,000.',
            'Yield = 1 − DPO, per opportunity.',
            'Sigma level = Φ⁻¹(1 − DPO) + 1.5, the long-term convention with the 1.5σ shift used in Six Sigma conversion tables (3.4 DPMO = 6σ).',
            'Several processes: the overall figure adds all defects and all opportunities (Σ defects ÷ Σ opportunities). Averaging the sigma levels of the processes is not a valid way to combine them.',
            'Define opportunities carefully and keep the definition fixed: counting more opportunities lowers DPMO without any real improvement.',
          ] },
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
            ['All processes', '1,900', '12,800 in total', '55', '4,297', '4.13'],
          ] },
          { p: 'Welding cell B has the most defects per opportunity and the lowest sigma, so it is the first target, even though Packing C makes more units. Overall: 55 ÷ 12,800 = 0.0043, that is 4,297 DPMO.' },
        ],
      },
    ],
    references: [
      'Published Six Sigma conversion table (2σ to 6σ, 1.5σ shift).',
      'Pooled DPMO for several processes: Σ defects ÷ Σ opportunities.',
      'Tested against the conversion table and a worked example (210,722 DPMO = 2.30σ).',
    ],
  },
  ar: {
    title: 'عن حاسبة DPMO ومستوى Sigma',
    sections: [
      {
        h: 'ماذا تفعل الأداة',
        blocks: [
          { p: 'DPMO (العيوب لكل مليون فرصة) يضع العمليات المختلفة في درجة تعقيدها على مقياس واحد: فالقطعة التي فيها 12 موضعًا يمكن أن يحدث فيه عيب لا تُقارن مباشرة بقطعة فيها 4 مواضع. وتعطي الحاسبة DPU وDPMO والعائد لكل فرصة ومستوى Sigma لكل عملية، ورقمًا مجمعًا لها كلها.' },
        ],
      },
      {
        h: 'كيف تتم الحسابات',
        blocks: [
          { list: [
            'DPU = العيوب ÷ الوحدات. وDPO = العيوب ÷ (الوحدات × الفرص لكل وحدة). وDPMO = DPO × 1,000,000.',
            'العائد Yield = 1 − DPO لكل فرصة.',
            'مستوى Sigma = Φ⁻¹(1 − DPO) + 1.5، وهو العرف طويل المدى مع إزاحة 1.5σ المستخدم في جداول تحويل Six Sigma ‏(3.4 DPMO = 6σ).',
            'عدة عمليات: الرقم الإجمالي يجمع كل العيوب وكل الفرص (Σ العيوب ÷ Σ الفرص). وأخذ متوسط مستويات Sigma للعمليات ليس طريقة صحيحة لجمعها.',
            'حدّد الفرص بعناية وثبّت التعريف: زيادة عدد الفرص تخفض DPMO دون أي تحسن حقيقي.',
          ] },
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
            ['كل العمليات', '1,900', '12,800 إجمالًا', '55', '4,297', '4.13'],
          ] },
          { p: 'خلية اللحام B فيها أكبر عدد عيوب لكل فرصة وأقل Sigma، لذلك هي الهدف الأول رغم أن Packing C تنتج وحدات أكثر. والإجمالي: 55 ÷ 12,800 = 0.0043، أي 4,297 DPMO.' },
        ],
      },
    ],
    references: [
      'جدول تحويل Six Sigma المنشور (من 2σ إلى 6σ، إزاحة 1.5σ).',
      'DPMO المجمّع لعدة عمليات: Σ العيوب ÷ Σ الفرص.',
      'مختبرة مقابل جدول التحويل ومثال محلول (210,722 DPMO = 2.30σ).',
    ],
  },
}
