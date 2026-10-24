import { calcOEE, lossTime, validate, type OEEInputs } from './calc'
import { fixed } from '../stats/format'

// ─────────────────────────────────────────────────────────────────────────
// "What to work on first" card for the OEE tool (roadmap O4). Pro only, so
// it is written here on the server (/api/oee/insight) — the formulas are
// public and run in the browser, the advice is the part worth keeping.
// The numbers come from lib/oee/calc.ts, the same code the page uses.
// Advice follows standard TPM practice: rank losses by time, attack the
// largest first (stop reasons and SMED for downtime, short stops and the
// real ideal cycle for speed, defect Pareto for quality).
// ─────────────────────────────────────────────────────────────────────────

export type LossKind = 'downtime' | 'speed' | 'quality'
type Factor = 'availability' | 'performance' | 'quality'

export interface OEEInsight {
  biggest: LossKind
  en: string
  ar: string
}

const BENCH: Record<Factor, number> = { availability: 90, performance: 95, quality: 99.9 }
const FACTOR_OF: Record<LossKind, Factor> = { downtime: 'availability', speed: 'performance', quality: 'quality' }

const n1 = (v: number) => fixed(v, 1)
const int = (v: number) => Math.round(v).toLocaleString('en-US')
// Arabic text keeps Western digits, like the rest of the site
const ltr = (s: string) => `⁦${s}⁩`

export function buildOEEInsight(i: OEEInputs): OEEInsight | null {
  if (validate(i)) return null
  const r = calcOEE(i)
  if (!r) return null
  const lt = lossTime(i, r)

  const losses: { kind: LossKind; min: number; pct: number }[] = [
    { kind: 'downtime', min: lt.downtimeMin, pct: r.downtimeLoss },
    { kind: 'speed', min: lt.speedMin, pct: r.speedLoss },
    { kind: 'quality', min: lt.qualityMin, pct: r.qualityLoss },
  ]
  // Largest by minutes; ties keep the order downtime → speed → quality
  const top = losses.reduce((a, b) => (b.min > a.min ? b : a))

  const value: Record<Factor, number> = { availability: r.availability, performance: r.performanceCapped, quality: r.quality }
  const gaps = (Object.keys(BENCH) as Factor[])
    .map(f => ({ f, gap: BENCH[f] - value[f] }))
    .filter(g => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)
  // Second point: the factor furthest under its benchmark, if it is not the one already covered
  const other = gaps.find(g => g.f !== FACTOR_OF[top.kind])

  const partsDown = (lt.downtimeMin * 60) / i.cycleTime
  const cycle = String(Number(fixed(i.cycleTime, 3)))

  if (top.min <= 0) {
    return {
      biggest: top.kind,
      en: 'No loss was recorded in this shift: every planned minute produced good parts at the ideal rate. Check that the ideal cycle time is the design rate of the machine and that every stop was logged.',
      ar: 'لم تُسجَّل أي خسارة في هذه الوردية، فكل دقيقة مخططة أنتجت قطعًا سليمة بالمعدل المثالي. تأكد أن زمن الدورة المثالي هو المعدل التصميمي للماكينة وأن كل توقف سُجِّل.',
    }
  }

  const en: string[] = []
  const ar: string[] = []

  if (gaps.length === 0) {
    en.push(`All three factors meet their world-class benchmarks (A 90%, P 95%, Q 99.9%). The largest remaining loss is ${LOSS_EN[top.kind]} at ${n1(top.min)} minutes; keep logging losses so a drop shows early.`)
    ar.push(`العوامل الثلاثة تحقق المعايير العالمية ${ltr('(A 90% · P 95% · Q 99.9%)')}. أكبر خسارة متبقية هي ${LOSS_AR[top.kind]} بمقدار ${ltr(n1(top.min))} دقيقة، واستمر في تسجيل الخسائر حتى يظهر أي تراجع مبكرًا.`)
    return { biggest: top.kind, en: en.join(' '), ar: ar.join(' ') }
  }

  if (top.kind === 'downtime') {
    en.push(`Downtime took ${n1(lt.downtimeMin)} minutes (${n1(top.pct)}% of planned time), the largest loss — about ${int(partsDown)} parts not made.`)
    en.push('Log each stop with its reason (breakdown, changeover, waiting for material or an operator), rank the reasons by minutes and work on the top one first. If changeovers lead, a SMED study usually brings the quickest gain; if breakdowns lead, find the root cause and add the fix to preventive maintenance.')
    ar.push(`استهلك التوقف ${ltr(n1(lt.downtimeMin))} دقيقة ${ltr(`(${n1(top.pct)}%)`)} من الوقت المخطط، وهو أكبر خسارة، أي نحو ${ltr(int(partsDown))} قطعة لم تُنتَج.`)
    ar.push('سجّل كل توقف مع سببه (عطل، تغيير إعداد، انتظار خامة أو عامل)، ورتّب الأسباب حسب الدقائق وابدأ بالسبب الأول. إذا كان تغيير الإعداد في المقدمة فدراسة SMED تعطي غالبًا أسرع تحسن، وإذا كانت الأعطال في المقدمة فابحث عن السبب الجذري وأضف الحل إلى الصيانة الوقائية.')
  } else if (top.kind === 'speed') {
    en.push(`Running slower than the ideal rate cost ${n1(lt.speedMin)} minutes (${n1(top.pct)}% of planned time), the largest loss — about ${int(lt.speedParts)} parts not made.`)
    en.push(`Compare the actual cycle time with the ideal ${cycle} s and record the short stops that never reach the downtime log. Make sure the ideal cycle is the design rate of the machine, not a past average, so the loss is measured against the real limit.`)
    ar.push(`أدى العمل بأبطأ من المعدل المثالي إلى خسارة ${ltr(n1(lt.speedMin))} دقيقة ${ltr(`(${n1(top.pct)}%)`)} من الوقت المخطط، وهي أكبر خسارة، أي نحو ${ltr(int(lt.speedParts))} قطعة لم تُنتَج.`)
    ar.push(`قارن زمن الدورة الفعلي بالزمن المثالي ${ltr(`${cycle} s`)}، وسجّل التوقفات القصيرة التي لا تصل إلى سجل التوقف. وتأكد أن زمن الدورة المثالي هو المعدل التصميمي للماكينة لا متوسطًا سابقًا، حتى تُقاس الخسارة على الحد الحقيقي.`)
  } else {
    en.push(`Rejects took ${n1(lt.qualityMin)} minutes of ideal production time (${n1(top.pct)}% of planned time), the largest loss — ${int(lt.qualityParts)} parts rejected.`)
    en.push('Separate start-up rejects from rejects during steady production, then rank the defect types and start with the largest. Count reworked parts as rejects so first-pass quality stays honest.')
    ar.push(`استهلكت القطع المرفوضة ${ltr(n1(lt.qualityMin))} دقيقة من زمن الإنتاج المثالي ${ltr(`(${n1(top.pct)}%)`)} من الوقت المخطط، وهي أكبر خسارة، بعدد ${ltr(int(lt.qualityParts))} قطعة مرفوضة.`)
    ar.push('افصل مرفوضات بدء التشغيل عن مرفوضات الإنتاج المستقر، ثم رتّب أنواع العيوب وابدأ بأكبرها. واحسب القطع المعاد تشغيلها ضمن المرفوضات حتى تبقى جودة المرور الأول صادقة.')
  }

  if (other) {
    en.push(`${FACTOR_EN[other.f]} is also ${n1(other.gap)} points under its ${BENCH[other.f]}% benchmark: ${TIP_EN[other.f]}.`)
    ar.push(`كما أن ${FACTOR_AR[other.f]} أقل من المعيار ${ltr(`${BENCH[other.f]}%`)} بفارق ${ltr(n1(other.gap))} نقطة، لذا ${TIP_AR[other.f]}.`)
  }

  return { biggest: top.kind, en: en.join(' '), ar: ar.join(' ') }
}

const LOSS_EN: Record<LossKind, string> = { downtime: 'downtime', speed: 'speed loss', quality: 'quality loss' }
const LOSS_AR: Record<LossKind, string> = { downtime: 'التوقف', speed: 'خسارة السرعة', quality: 'خسارة الجودة' }
const FACTOR_EN: Record<Factor, string> = { availability: 'Availability', performance: 'Performance', quality: 'Quality' }
// Same words as the page's cards (التوافر / الأداء / الجودة)
const FACTOR_AR: Record<Factor, string> = { availability: 'التوافر', performance: 'الأداء', quality: 'الجودة' }
const TIP_EN: Record<Factor, string> = {
  availability: 'track stop reasons and changeover time',
  performance: 'record short stops and compare the actual cycle with the ideal',
  quality: 'rank the defect types and separate start-up rejects',
}
const TIP_AR: Record<Factor, string> = {
  availability: 'تابع أسباب التوقف وزمن تغيير الإعداد',
  performance: 'سجّل التوقفات القصيرة وقارن الدورة الفعلية بالمثالية',
  quality: 'رتّب أنواع العيوب وافصل مرفوضات بدء التشغيل',
}
