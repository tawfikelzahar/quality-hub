// ─────────────────────────────────────────────────────────────────────────
// 5 Whys: the analysis as data, the structural review, and the example.
//
// No statistics here. The review only checks the STRUCTURE of the
// analysis (empty answers, branches without a root cause, a root cause
// found very early, answers that blame a person, root causes without an
// action), as automotive problem-solving guides (AIAG CQI-20, 8D) ask.
// It never judges whether a cause is technically right — that is the
// team's call.
// ─────────────────────────────────────────────────────────────────────────

export type TrackId = 'occ' | 'det'

export interface WhyNode {
  id: string
  text: string
  root?: boolean
  children: WhyNode[]
}

export interface Problem {
  statement: string
  where: string
  when: string
  extent: string
}

export interface Action {
  action: string
  owner: string
  due: string
}

export interface FiveWhys {
  problem: Problem
  occ: WhyNode[]
  det: WhyNode[]
  detOn: boolean
  /** keyed by the root-cause node id */
  actions: Record<string, Action>
}

export const EMPTY: FiveWhys = {
  problem: { statement: '', where: '', when: '', extent: '' },
  occ: [],
  det: [],
  detOn: true,
  actions: {},
}

let seq = 0
export const newId = () => `n${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`

/** Every branch from a top answer down to a node with no children: [node at Why 1, …, last node] */
export function paths(nodes: WhyNode[]): WhyNode[][] {
  const out: WhyNode[][] = []
  const walk = (n: WhyNode, trail: WhyNode[]) => {
    const t = [...trail, n]
    if (n.children.length === 0) out.push(t)
    else n.children.forEach(c => walk(c, t))
  }
  nodes.forEach(n => walk(n, []))
  return out
}

/** Depth-first list with each node's Why number (1 = first why) */
export function flatten(nodes: WhyNode[]): { node: WhyNode; level: number }[] {
  const out: { node: WhyNode; level: number }[] = []
  const walk = (n: WhyNode, level: number) => {
    out.push({ node: n, level })
    n.children.forEach(c => walk(c, level + 1))
  }
  nodes.forEach(n => walk(n, 1))
  return out
}

/** Root causes in reading order, with their track and Why number */
export function rootCauses(a: FiveWhys): { node: WhyNode; level: number; track: TrackId }[] {
  const tracks: TrackId[] = a.detOn ? ['occ', 'det'] : ['occ']
  return tracks.flatMap(track => flatten(a[track]).filter(x => x.node.root).map(x => ({ ...x, track })))
}

// Words that put the cause on a person rather than on the process
const BLAME = [
  'operator error', 'human error', 'operator mistake', 'careless', 'carelessness', 'negligence', 'lazy', 'forgot', 'not paying attention', "didn't pay attention", 'did not pay attention',
  'خطأ العامل', 'خطأ بشري', 'خطأ المشغل', 'إهمال', 'اهمال', 'نسي', 'سهو', 'عدم انتباه', 'عدم تركيز', 'غلطة العامل', 'غلط العامل', 'تهاون',
]
export function blameWord(text: string): string | null {
  const t = text.toLowerCase()
  return BLAME.find(w => t.includes(w)) ?? null
}

export type ReviewItem =
  | { kind: 'problem' }
  | { kind: 'empty' }
  | { kind: 'det_empty' }
  | { kind: 'blank' | 'open' | 'shallow' | 'deep' | 'no_action' | 'action_owner'; track: TrackId; level: number }
  | { kind: 'blame'; track: TrackId; level: number; word: string }

export function review(a: FiveWhys): ReviewItem[] {
  const out: ReviewItem[] = []
  if (!a.problem.statement.trim()) out.push({ kind: 'problem' })
  if (a.occ.length === 0) out.push({ kind: 'empty' })
  if (a.detOn && a.det.length === 0) out.push({ kind: 'det_empty' })
  const tracks: TrackId[] = a.detOn ? ['occ', 'det'] : ['occ']
  for (const track of tracks) {
    for (const { node, level } of flatten(a[track])) {
      if (!node.text.trim()) out.push({ kind: 'blank', track, level })
      const w = blameWord(node.text)
      if (w) out.push({ kind: 'blame', track, level, word: w })
    }
    for (const p of paths(a[track])) {
      const last = p[p.length - 1]
      const level = p.length
      if (!last.root) {
        if (last.text.trim()) out.push({ kind: 'open', track, level })
        continue
      }
      if (level <= 2) out.push({ kind: 'shallow', track, level })
      if (level >= 8) out.push({ kind: 'deep', track, level })
      const act = a.actions[last.id]
      if (!act || !act.action.trim()) out.push({ kind: 'no_action', track, level })
      else if (!act.owner.trim() || !act.due) out.push({ kind: 'action_owner', track, level })
    }
  }
  return out
}

// ── Example: oil filter gasket leak at an automotive customer ──────────────
type Ex = { t: string; root?: boolean; c?: Ex[] }
const build = (e: Ex[], ids: string[]): WhyNode[] =>
  e.map(x => {
    const id = `ex${ids.length}`
    ids.push(id)
    return { id, text: x.t, root: x.root, children: build(x.c ?? [], ids) }
  })

const EX = {
  en: {
    problem: {
      statement: '12 oil filters leaked at the gasket during the customer engine test',
      where: 'Assembly line 3 · customer engine plant',
      when: 'Lot 2611-07 · week 45',
      extent: '12 of 4,800 filters in the lot (0.25%) · first complaint on this part',
    },
    occ: [{ t: 'The gasket was not fully seated in its groove', c: [
      { t: 'The groove in the base plate was shallower than the drawing (1.62 mm, drawing 1.80 ± 0.05 mm)', c: [
        { t: 'The forming die for the base plate was worn', c: [
          { t: 'The die had run 410,000 strokes with no wear check', c: [
            { t: 'The preventive maintenance plan covers the presses but not the dies', root: true },
          ] },
        ] },
      ] },
      { t: 'The gasket lot was at the thin end of its tolerance', c: [
        { t: 'Incoming inspection checks gasket hardness only, not thickness', c: [
          { t: 'The inspection plan was copied from the previous gasket material and never reviewed', root: true },
        ] },
      ] },
    ] }] as Ex[],
    det: [{ t: 'The 100% leak test did not reject the leaking filters', c: [
      { t: 'The test pressure was 1.5 bar instead of 2.5 bar', c: [
        { t: 'The pressure was lowered during maintenance and not restored', c: [
          { t: 'There is no start-up check of the test settings after maintenance', root: true },
        ] },
      ] },
    ] }] as Ex[],
    actions: [
      { action: 'Add every forming die to the PM plan with a stroke-count wear check every 100,000 strokes', owner: 'Maintenance manager', due: '2026-12-01' },
      { action: 'Add gasket thickness to the incoming inspection plan and review the plan for every material change', owner: 'Supplier quality engineer', due: '2026-11-25' },
      { action: 'Add a start-up check sheet for leak-test pressure, signed by quality after any maintenance', owner: 'Quality engineer', due: '2026-11-20' },
    ],
  },
  ar: {
    problem: {
      statement: 'تسريب من الجوان في 12 فلتر زيت أثناء اختبار المحرك لدى العميل',
      where: 'خط التجميع 3 · مصنع المحركات لدى العميل',
      when: 'الدفعة 2611-07 · الأسبوع 45',
      extent: '12 من 4,800 فلتر في الدفعة (0.25%) · أول شكوى على هذا الصنف',
    },
    occ: [{ t: 'الجوان لم يكن مستقرًا بالكامل في مجراه', c: [
      { t: 'عمق مجرى القاعدة أقل من الرسم (1.62 مم، والرسم 1.80 ± 0.05 مم)', c: [
        { t: 'إسطمبة تشكيل القاعدة كانت متآكلة', c: [
          { t: 'الإسطمبة عملت 410,000 ضربة دون فحص للتآكل', c: [
            { t: 'خطة الصيانة الوقائية تغطي المكابس ولا تغطي الإسطمبات', root: true },
          ] },
        ] },
      ] },
      { t: 'دفعة الجوانات كانت عند الحد الأدنى للسُمك', c: [
        { t: 'فحص الاستلام يقيس صلادة الجوان فقط ولا يقيس السُمك', c: [
          { t: 'خطة الفحص نُسخت من خامة الجوان السابقة ولم تُراجع', root: true },
        ] },
      ] },
    ] }] as Ex[],
    det: [{ t: 'اختبار التسريب 100% لم يرفض الفلاتر المسرّبة', c: [
      { t: 'ضغط الاختبار كان 1.5 بار بدل 2.5 بار', c: [
        { t: 'الضغط خُفّض أثناء الصيانة ولم يُعَد', c: [
          { t: 'لا يوجد فحص لإعدادات الاختبار عند بدء التشغيل بعد الصيانة', root: true },
        ] },
      ] },
    ] }] as Ex[],
    actions: [
      { action: 'إضافة كل إسطمبات التشكيل إلى خطة الصيانة الوقائية مع فحص تآكل كل 100,000 ضربة', owner: 'مدير الصيانة', due: '2026-12-01' },
      { action: 'إضافة سُمك الجوان إلى خطة فحص الاستلام ومراجعة الخطة مع كل تغيير في الخامة', owner: 'مهندس جودة الموردين', due: '2026-11-25' },
      { action: 'نموذج فحص عند بدء التشغيل لضغط اختبار التسريب يوقّعه قسم الجودة بعد أي صيانة', owner: 'مهندس الجودة', due: '2026-11-20' },
    ],
  },
}

export function example(lang: 'en' | 'ar'): FiveWhys {
  const e = EX[lang]
  const ids: string[] = []
  const occ = build(e.occ, ids)
  const det = build(e.det, ids)
  const a: FiveWhys = { problem: { ...e.problem }, occ, det, detOn: true, actions: {} }
  rootCauses(a).forEach((r, i) => { a.actions[r.node.id] = { ...e.actions[i] } })
  return a
}
