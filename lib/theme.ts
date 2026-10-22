import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// Mizan Quality colours — single source of truth (approved 22 Oct 2026,
// "navy, ivory & gold"). Each colour has ONE job:
//   accent / onAccent  primary buttons, active states, links (ivory on dark,
//                      navy on light) and the text placed on them
//   data / data2       chart series (blue) and secondary series (lavender)
//   gold / onGold      brand and Pro only (Get Pro, PRO badges)
//   good / amber / danger   process verdicts only (capable / caution / not)
// Every value was checked for WCAG contrast on its background (>= 4.5:1
// for text, >= 3:1 for chart marks). Pages that cannot reach `c` (module-
// level helpers) can use the CSS variables --qh-<name> set by
// usePersistedTheme below.
// ─────────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

export const COLORS = {
  dark: {
    bg: '#0A1120',
    surface: '#101A2C',
    surface2: '#17233A',
    border: '#22314A',
    accent: '#F1ECE1',
    accent2: '#F1ECE1', // kept for older code paths; same as accent (no gradients)
    onAccent: '#0B1F3F',
    data: '#8FB3E8',
    data2: '#C3B4F0',
    gold: '#CDAA62',
    onGold: '#1A1305',
    good: '#45C486',
    amber: '#E9A23B',
    danger: '#F06464',
    text: '#EEF1F6',
    muted: '#8A98AF',
    grid: 'rgba(255,255,255,0.06)',
    // chart-specific
    bar: '#8FB3E8',
    barHover: '#A9C5EE',
    line: '#C3B4F0',
    vital: 'rgba(143,179,232,0.12)',
  },
  light: {
    bg: '#F7F8FA',
    surface: '#ffffff',
    surface2: '#EEF2F7',
    border: '#DDE3EB',
    accent: '#0B1F3F',
    accent2: '#0B1F3F',
    onAccent: '#FFFFFF',
    data: '#2F5E9E',
    data2: '#6A55B8',
    gold: '#85662F',
    onGold: '#FFFFFF',
    good: '#1A7F4B',
    amber: '#935E07',
    danger: '#C9302C',
    text: '#0E1B31',
    muted: '#5B6B82',
    grid: 'rgba(15,30,54,0.07)',
    bar: '#2F5E9E',
    barHover: '#3A6DB3',
    line: '#6A55B8',
    vital: 'rgba(47,94,158,0.08)',
  },
} as const;

/** Transparent version of any colour (hex or CSS variable): tint('var(--qh-good)', 20) */
export function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export type ThemeColors = (typeof COLORS)['dark'];

// Primary call-to-action fill and its text. These follow the active theme
// through the CSS variables set by usePersistedTheme (ivory on dark, navy
// on light), so they are safe in module-level style objects too.
export const BRAND_GRADIENT = 'var(--qh-accent)';
export const BRAND_GRADIENT_TEXT_COLOR = 'var(--qh-onAccent)';

/**
 * Shared structural styles used by every tool page (SPC, Pareto, DPMO, AQL):
 * the top nav with logo + breadcrumb + theme toggle, the card/table/badge
 * look, inputs, buttons. Extracted from ParetoChart.tsx and
 * DPMOCalculator.tsx, which already matched almost exactly.
 *
 * Usage in a page/component:
 *   const [theme, setTheme] = useState<ThemeMode>('dark');
 *   const c = COLORS[theme];
 *   const s = getSharedStyles(theme);
 *   ...
 *   <div style={s.page}> <nav style={s.nav}> ... </nav> ... </div>
 *
 * Pages can override or extend individual keys, e.g.:
 *   const s = { ...getSharedStyles(theme), left: { ...getSharedStyles(theme).left, width: 300 } };
 */
export function getSharedStyles(theme: ThemeMode): Record<string, CSSProperties> {
  const c = COLORS[theme];

  return {
    page: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: c.bg,
      color: c.text,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 14,
    },
    nav: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      height: 56,
      background: theme === 'dark' ? 'rgba(10,17,32,.95)' : '#ffffff',
      backdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${c.border}`,
      flexShrink: 0,
    },
    navLeft: { display: 'flex', alignItems: 'center', gap: 16 },
    navRight: { display: 'flex', alignItems: 'center', gap: 14 },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      textDecoration: 'none',
      color: c.text,
      fontWeight: 800,
      fontSize: 15,
    },
    logoIcon: {
      width: 30,
      height: 30,
      background: BRAND_GRADIENT,
      borderRadius: 7,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: BRAND_GRADIENT_TEXT_COLOR,
      fontWeight: 900,
      fontSize: 13,
    },
    separator: { color: 'rgba(255,255,255,.12)', fontSize: 20 },
    breadcrumb: { fontSize: 13, color: c.muted, fontWeight: 500 },
    themeBtn: {
      background: theme === 'dark' ? 'rgba(255,255,255,0.08)' : c.surface2,
      border: `1px solid ${c.border}`,
      borderRadius: 20,
      padding: '5px 14px',
      color: c.text,
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 600,
    },
    ctaBtn: {
      background: BRAND_GRADIENT,
      color: BRAND_GRADIENT_TEXT_COLOR,
      fontWeight: 700,
      fontSize: 12,
      padding: '7px 16px',
      borderRadius: 7,
      textDecoration: 'none',
    },
    // Pro / upgrade CTAs only — gold is reserved for the brand and Pro
    proBtn: {
      background: c.gold,
      color: c.onGold,
      fontWeight: 700,
      fontSize: 12,
      padding: '7px 16px',
      borderRadius: 7,
      textDecoration: 'none',
    },
    signInLink: { fontSize: 13, color: c.muted, textDecoration: 'none', fontWeight: 500 },

    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    left: {
      width: 320,
      flexShrink: 0,
      background: c.surface,
      borderRight: `1px solid ${c.border}`,
      overflowY: 'auto',
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    },
    right: { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },
    main: { flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 },

    sectionTitle: {
      fontSize: 11,
      fontWeight: 700,
      color: c.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    },
    card: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 },
    rowCard: {
      background: c.surface2,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    },

    input: {
      background: theme === 'dark' ? '#0C1424' : '#F7F8FA',
      border: `1px solid ${c.border}`,
      borderRadius: 7,
      color: c.text,
      padding: '7px 10px',
      fontSize: 13,
      outline: 'none',
      width: '100%',
    },
    select: {
      background: theme === 'dark' ? '#0C1424' : '#F7F8FA',
      border: `1px solid ${c.border}`,
      borderRadius: 7,
      color: c.text,
      padding: '7px 10px',
      fontSize: 13,
      outline: 'none',
      width: '100%',
    },
    label: { fontSize: 10, color: c.muted, marginBottom: 2 },

    removeBtn: {
      background: 'transparent',
      border: 'none',
      color: c.danger,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 700,
      padding: '2px 4px',
    },
    addBtn: {
      background: `${c.accent}15`,
      border: `1px dashed ${c.accent}`,
      borderRadius: 9,
      color: c.accent,
      padding: '9px 0',
      width: '100%',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      transition: 'background .15s ease, border-color .15s ease',
    },
    exportBtn: {
      background: c.surface2,
      border: `1px solid ${c.border}`,
      borderRadius: 9,
      color: c.text,
      padding: '9px 12px',
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      justifyContent: 'center',
      boxShadow: theme === 'dark' ? '0 1px 0 rgba(255,255,255,0.03) inset' : '0 1px 2px rgba(15,23,42,0.04)',
      transition: 'transform .15s ease, border-color .15s ease, background .15s ease, box-shadow .15s ease',
    },
    saveBtn: {
      background: `${c.accent}16`,
      border: `1px solid ${c.accent}55`,
      borderRadius: 9,
      color: c.accent,
      padding: '9px 14px',
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      whiteSpace: 'nowrap',
      transition: 'transform .15s ease, border-color .15s ease, background .15s ease',
    },

    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
    statCard: {
      background: c.surface2,
      border: `1px solid ${c.border}`,
      borderRadius: 10,
      padding: '14px 16px',
      textAlign: 'center',
    },
    statVal: { fontSize: 22, fontWeight: 800, color: c.accent },
    statLabel: { fontSize: 11, color: c.muted, marginTop: 4 },

    chartWrap: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 12, padding: 20 },
    chartInner: { height: 340, position: 'relative' },

    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: {
      textAlign: 'left',
      padding: '10px 12px',
      color: c.muted,
      fontWeight: 600,
      fontSize: 11,
      borderBottom: `1px solid ${c.border}`,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    td: { padding: '10px 12px', borderBottom: `1px solid ${c.border}40` },

    badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, display: 'inline-block' },
    toast: {
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      background: c.accent,
      color: BRAND_GRADIENT_TEXT_COLOR,
      padding: '10px 20px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 700,
      zIndex: 100,
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    },
  };
}
// ─────────────────────────────────────────────────────────────────────────
// Persisted theme — remembers dark/light choice across page navigations
// using the browser's localStorage. Use this instead of a plain useState
// on any page that has a theme toggle, so the choice sticks site-wide.
// ─────────────────────────────────────────────────────────────────────────
const THEME_STORAGE_KEY = 'qh-theme';

export function applyThemeVars(theme: ThemeMode) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(COLORS[theme])) root.style.setProperty(`--qh-${k}`, v);
  root.dataset.qhTheme = theme;
}

export function usePersistedTheme(): [ThemeMode, Dispatch<SetStateAction<ThemeMode>>] {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  // On first load, read whatever was saved last time
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    }
  }, []);

  // Every time the theme changes, save it and publish the palette as CSS
  // variables (--qh-accent, --qh-good, ...) for styles that can't reach COLORS
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyThemeVars(theme);
  }, [theme]);

  return [theme, setTheme];
}