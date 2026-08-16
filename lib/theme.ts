import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';

// ─────────────────────────────────────────────────────────────────────────
// Quality Hub visual identity — single source of truth
// ─────────────────────────────────────────────────────────────────────────
// These are the exact color values already in use across ParetoChart.tsx,
// DPMOCalculator.tsx, and the landing page (app/page.tsx) — extracted here,
// not invented. Before this file existed, each tool defined its own copy
// of this object, so changing the brand color meant editing 3+ files by
// hand. Now every tool imports COLORS (and, for new/rebuilt pages,
// getSharedStyles) from here instead.
//
// To change the brand color across the whole site: edit `accent` (and its
// light-mode counterpart) below. Everything that imports COLORS picks it
// up automatically.
// ─────────────────────────────────────────────────────────────────────────

export type ThemeMode = 'dark' | 'light';

export const COLORS = {
  dark: {
    bg: '#0a0f1e',
    surface: '#111827',
    surface2: '#1e2d40',
    border: '#1e3a5f',
    accent: '#0fd4c8',
    accent2: '#00a896', // used in the logo/CTA gradient: accent -> accent2
    amber: '#f59e0b',
    danger: '#ef4444',
    text: '#e2e8f0',
    muted: '#6b89b4',
    grid: 'rgba(255,255,255,0.06)',
    // chart-specific (Pareto bars/line)
    bar: '#0fd4c8',
    barHover: '#14b8b0',
    line: '#f59e0b',
    vital: 'rgba(245,158,11,0.15)',
  },
  light: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surface2: '#f1f5f9',
    border: '#e2e8f0',
    accent: '#0e7474',
    accent2: '#00a896',
    amber: '#d97706',
    danger: '#ef4444',
    text: '#1e293b',
    muted: '#64748b',
    grid: 'rgba(0,0,0,0.06)',
    bar: '#0e7474',
    barHover: '#0f8585',
    line: '#d97706',
    vital: 'rgba(217,119,6,0.08)',
  },
} as const;

export type ThemeColors = (typeof COLORS)['dark'];

// The gradient used for the logo mark and primary CTAs site-wide.
// Always the same two stops regardless of light/dark mode.
export const BRAND_GRADIENT = `linear-gradient(135deg, ${COLORS.dark.accent}, ${COLORS.dark.accent2})`;
export const BRAND_GRADIENT_TEXT_COLOR = '#060d1a'; // text color placed ON TOP of the gradient

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
      background: theme === 'dark' ? 'rgba(6,13,26,.95)' : '#ffffff',
      backdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${theme === 'dark' ? 'rgba(15,212,200,.1)' : c.border}`,
      flexShrink: 0,
    },
    navLeft: { display: 'flex', alignItems: 'center', gap: 16 },
    navRight: { display: 'flex', alignItems: 'center', gap: 14 },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      textDecoration: 'none',
      color: theme === 'dark' ? '#f0f6ff' : c.text,
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
      background: theme === 'dark' ? '#0d1520' : '#f8fafc',
      border: `1px solid ${c.border}`,
      borderRadius: 7,
      color: c.text,
      padding: '7px 10px',
      fontSize: 13,
      outline: 'none',
      width: '100%',
    },
    select: {
      background: theme === 'dark' ? '#0d1520' : '#f8fafc',
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

export function usePersistedTheme(): [ThemeMode, Dispatch<SetStateAction<ThemeMode>>] {
  const [theme, setTheme] = useState<ThemeMode>('dark');

  // On first load, read whatever was saved last time
  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
    }
  }, []);

  // Every time the theme changes, save it
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return [theme, setTheme];
}