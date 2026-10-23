import type { TKey } from '@/lib/i18n/translations'

// ─────────────────────────────────────────────────────────────────────────
// Every live tool, grouped by the question a quality engineer is asking.
// Used by the landing page (tools section) and the tool-page sidebar, so
// adding a tool here shows it in both places.
// ─────────────────────────────────────────────────────────────────────────

export interface ToolRow {
  href: string
  titleKey: TKey
  descKey: TKey
  /** Extra search words (always English technical terms) */
  keywords: string
  pro?: boolean
}
export interface ToolGroup {
  id: string
  labelKey: TKey
  questionKey: TKey
  rows: ToolRow[]
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'stability',
    labelKey: 'home_q_stability_label',
    questionKey: 'home_q_stability',
    rows: [
      { href: '/spc', titleKey: 'spc_title', descKey: 'home_row_spc', keywords: 'spc cp cpk pp ppk ppm nelson control chart capability attribute p np c u sigma' },
      { href: '/imr-chart', titleKey: 'imr_title', descKey: 'home_row_imr', keywords: 'imr i-mr individuals moving range control chart' },
      { href: '/xbar-r-chart', titleKey: 'xbar_r_title', descKey: 'home_row_xbar_r', keywords: 'xbar x-bar r range subgroup control chart' },
      { href: '/xbar-s-chart', titleKey: 'xbar_s_title', descKey: 'home_row_xbar_s', keywords: 'xbar x-bar s standard deviation subgroup control chart' },
    ],
  },
  {
    id: 'msa',
    labelKey: 'home_q_msa_label',
    questionKey: 'home_q_msa',
    rows: [
      { href: '/gage-rr', titleKey: 'gagerr_title', descKey: 'home_row_gagerr', keywords: 'gage gauge r&r grr msa aiag anova ndc repeatability reproducibility', pro: true },
      { href: '/descriptive', titleKey: 'descriptive_title', descKey: 'home_row_descriptive', keywords: 'descriptive mean median standard deviation histogram box plot normality' },
    ],
  },
  {
    id: 'sampling',
    labelKey: 'home_q_sampling_label',
    questionKey: 'home_q_sampling',
    rows: [
      { href: '/aql', titleKey: 'aql_title', descKey: 'home_row_aql', keywords: 'aql iso 2859 z1.4 sampling inspection lot ac re' },
      { href: '/icmsf', titleKey: 'icmsf_title', descKey: 'home_row_icmsf', keywords: 'icmsf microbiological sampling food oc curve' },
    ],
  },
  {
    id: 'problem',
    labelKey: 'home_q_problem_label',
    questionKey: 'home_q_problem',
    rows: [
      { href: '/pareto', titleKey: 'pareto_title', descKey: 'home_row_pareto', keywords: 'pareto 80/20 defects causes' },
      { href: '/regression', titleKey: 'regression_title', descKey: 'home_row_regression', keywords: 'regression linear correlation anova prediction' },
      { href: '/multiregression', titleKey: 'multiregression_title', descKey: 'home_row_multiregression', keywords: 'multiple regression vif anova prediction' },
      { href: '/doe', titleKey: 'doe_title', descKey: 'home_row_doe', keywords: 'doe design of experiments factorial 2^k effects' },
    ],
  },
  {
    id: 'performance',
    labelKey: 'home_q_perf_label',
    questionKey: 'home_q_perf',
    rows: [
      { href: '/oee', titleKey: 'oee_title', descKey: 'home_row_oee', keywords: 'oee availability performance tpm losses' },
      { href: '/dpmo', titleKey: 'dpmo_title', descKey: 'home_row_dpmo', keywords: 'dpmo six sigma yield defects per million' },
    ],
  },
  {
    id: 'life',
    labelKey: 'home_q_life_label',
    questionKey: 'home_q_life',
    rows: [
      { href: '/stability', titleKey: 'stability_title', descKey: 'home_row_stability', keywords: 'stability shelf life ich q1e expiry expiration' },
    ],
  },
]
export const TOOL_COUNT = TOOL_GROUPS.reduce((n, g) => n + g.rows.length, 0)
