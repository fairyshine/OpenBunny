import type { NoticeTone, PanelSection, PanelItemStatus } from './types.js';

/* ── Color palette ─────────────────────────────────────────
 * Three-tier system inspired by Gemini CLI:
 *   1. Raw palette (T) — hex values
 *   2. Semantic tokens — purpose-based aliases
 *   3. Gradient — brand identity colors
 * ────────────────────────────────────────────────────────── */

/** Brand gradient: purple → blue → cyan (used for logo, spinner, accents) */
export const GRADIENT = ['#9f7aea', '#7c6ff7', '#58d5ba'] as const;

export const T = {
  // ── brand ──────────────────────────────────────────────
  brand:       '#9f7aea',
  brandDim:    '#7c6ff7',
  brandLight:  '#c4b5fd',
  accent:      '#58d5ba',
  accentDim:   '#3a9e87',
  accentSoft:  '#164e47',

  // ── semantic status ────────────────────────────────────
  ok:          '#6ee7a0',
  warn:        '#fbbf24',
  err:         '#f87171',
  info:        '#60a5fa',

  // ── surfaces & text ────────────────────────────────────
  fg:          '#e4e4e7',
  fgDim:       '#a1a1aa',
  fgMuted:     '#71717a',
  fgSubtle:    '#52525b',
  border:      '#3f3f46',
  borderLight: '#52525b',
  borderFocus: '#9f7aea',
  surface:     '#18181b',
  surfaceAlt:  '#111827',

  // ── message roles ──────────────────────────────────────
  user:        '#6ee7a0',
  assistant:   '#c4b5fd',
  system:      '#71717a',
  tool:        '#fbbf24',
  toolResult:  '#c084fc',
  skill:       '#22d3ee',
  thinking:    '#a1a1aa',

  // ── panel section accents ──────────────────────────────
  sGeneral:    '#9f7aea',
  sLlm:        '#c084fc',
  sTools:      '#fbbf24',
  sSkills:     '#60a5fa',
  sNetwork:    '#22d3ee',
  sAbout:      '#f0abfc',

  // ── gradient accent cycle (for spinner) ────────────────
  gradientCycle: [
    '#c084fc', // purple
    '#9f7aea', // brand
    '#60a5fa', // blue
    '#22d3ee', // cyan
    '#58d5ba', // accent green
    '#fbbf24', // yellow
    '#f87171', // red
    '#c084fc', // back to purple
  ] as readonly string[],
} as const;

/* ── Semantic helpers ──────────────────────────────────── */

export function getSectionColor(section: PanelSection): string {
  switch (section) {
    case 'general':   return T.sGeneral;
    case 'llm':       return T.sLlm;
    case 'tools':     return T.sTools;
    case 'skills':    return T.sSkills;
    case 'network':   return T.sNetwork;
    case 'about':     return T.sAbout;
    default:          return T.brand;
  }
}

export function getSectionTabLabel(section: PanelSection): string {
  switch (section) {
    case 'general':   return 'General';
    case 'llm':       return 'LLM';
    case 'tools':     return 'Tools';
    case 'skills':    return 'Skills';
    case 'network':   return 'Network';
    case 'about':     return 'About';
    default:          return section;
  }
}

export function getSectionShortcut(section: PanelSection): string | null {
  switch (section) {
    case 'general':   return 'Ctrl+G';
    case 'llm':       return 'Ctrl+L';
    case 'tools':     return 'Ctrl+T';
    case 'skills':    return 'Ctrl+K';
    case 'network':   return 'Ctrl+P';
    default:          return null;
  }
}

export function getNoticeColor(tone: NoticeTone): string {
  switch (tone) {
    case 'success':  return T.ok;
    case 'warning':  return T.warn;
    case 'error':    return T.err;
    default:         return T.info;
  }
}

export function getStatusColor(status: PanelItemStatus): string {
  switch (status) {
    case 'connected':    return T.ok;
    case 'connecting':   return T.warn;
    default:             return T.fgMuted;
  }
}
