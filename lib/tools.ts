import type { TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// Every live tool, grouped by the question a quality engineer is asking.
// This is the reading order everywhere: the tools directory (landing page
// and /tools), the tool-page sidebar and the phone menu, so adding a tool
// here shows it in all of them.
// ─────────────────────────────────────────────────────────────────────────

export interface ToolRow {
  href: string
  titleKey: TKey
  /** Shorter name for the narrow tool sidebar, when the full title wraps */
  navKey?: TKey
  descKey: TKey
  /** Extra search words (always English technical terms) */
  keywords: string
  pro?: boolean
  /** Standard or reference manual the tool follows, shown as a small tag (only from the tool's guide references) */
  std?: string
  /** "Start here" mark in the tools directory */
  start?: boolean
}

export interface ToolGroup {
  id: string
  labelKey: TKey
  questionKey: TKey
  /** Accent for the group's icon and label: [dark theme, light theme] */
  color: [string, string]
  /** SVG path data for the group's icon (24×24, stroked) */
  icon: string
  rows: ToolRow[]
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'stability',
    color: ['#7fb2ff', '#2459b8'],
    icon: 'M3 17l5-6 4 4 8-9',
    labelKey: 'home_q_stability_label',
    questionKey: 'home_q_stability',
    rows: [
      { href: '/spc', titleKey: 'spc_title', descKey: 'home_row_spc', keywords: 'spc cp cpk pp ppk ppm nelson control chart capability attribute p np c u sigma', std: 'AIAG SPC', start: true },
      { href: '/imr-chart', titleKey: 'imr_title', descKey: 'home_row_imr', keywords: 'imr i-mr individuals moving range control chart', std: 'AIAG SPC' },
      { href: '/xbar-r-chart', titleKey: 'xbar_r_title', descKey: 'home_row_xbar_r', keywords: 'xbar x-bar r range subgroup control chart', std: 'AIAG SPC' },
      { href: '/xbar-s-chart', titleKey: 'xbar_s_title', descKey: 'home_row_xbar_s', keywords: 'xbar x-bar s standard deviation subgroup control chart', std: 'AIAG SPC' },
    ],
  },
  {
    id: 'msa',
    color: ['#b79cff', '#6a48c9'],
    icon: 'M12 21a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM12 13l4-4',
    labelKey: 'home_q_msa_label',
    questionKey: 'home_q_msa',
    rows: [
      { href: '/gage-rr', titleKey: 'gagerr_title', descKey: 'home_row_gagerr', keywords: 'gage gauge r&r grr msa aiag anova ndc repeatability reproducibility', pro: true, std: 'AIAG MSA' },
    ],
  },
  {
    id: 'problem',
    color: ['#5fd3b0', '#0b7d5e'],
    icon: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4',
    labelKey: 'home_q_problem_label',
    questionKey: 'home_q_problem',
    rows: [
      { href: '/descriptive', titleKey: 'descriptive_title', descKey: 'home_row_descriptive', keywords: 'descriptive mean median standard deviation histogram box plot normality' },
      { href: '/pareto', titleKey: 'pareto_title', descKey: 'home_row_pareto', keywords: 'pareto 80/20 defects causes' },
      { href: '/regression', titleKey: 'regression_title', descKey: 'home_row_regression', keywords: 'regression linear correlation anova prediction' },
      { href: '/multiregression', titleKey: 'multiregression_title', descKey: 'home_row_multiregression', keywords: 'multiple regression vif anova prediction' },
      { href: '/doe', titleKey: 'doe_title', navKey: 'nav_doe', descKey: 'home_row_doe', keywords: 'doe design of experiments factorial 2^k effects' },
    ],
  },
  {
    id: 'sampling',
    color: ['#f0b860', '#9a5f00'],
    icon: 'M6 6h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM4 10h16',
    labelKey: 'home_q_sampling_label',
    questionKey: 'home_q_sampling',
    rows: [
      { href: '/aql', titleKey: 'aql_title', navKey: 'nav_aql', descKey: 'home_row_aql', keywords: 'aql iso 2859 z1.4 sampling inspection lot ac re', std: 'ISO 2859-1' },
      { href: '/icmsf', titleKey: 'icmsf_title', navKey: 'nav_icmsf', descKey: 'home_row_icmsf', keywords: 'icmsf microbiological sampling food oc curve', std: 'ICMSF' },
    ],
  },
  {
    id: 'performance',
    color: ['#ff9a8f', '#b8382c'],
    icon: 'M4 18a8 8 0 1 1 16 0M12 18l3-5',
    labelKey: 'home_q_perf_label',
    questionKey: 'home_q_perf',
    rows: [
      { href: '/oee', titleKey: 'oee_title', descKey: 'home_row_oee', keywords: 'oee availability performance tpm losses' },
      { href: '/dpmo', titleKey: 'dpmo_title', descKey: 'home_row_dpmo', keywords: 'dpmo six sigma yield defects per million' },
    ],
  },
  {
    id: 'life',
    color: ['#7ed6e8', '#0b7489'],
    icon: 'M7 3h10M7 21h10M8 3c0 6 8 6 8 9s-8 3-8 9M16 3c0 6-8 6-8 9',
    labelKey: 'home_q_life_label',
    questionKey: 'home_q_life',
    rows: [
      { href: '/stability', titleKey: 'stability_title', navKey: 'nav_stability', descKey: 'home_row_stability', keywords: 'stability shelf life ich q1e expiry expiration', std: 'ICH Q1E' },
    ],
  },
]

export const TOOL_COUNT = TOOL_GROUPS.reduce((n, g) => n + g.rows.length, 0)
