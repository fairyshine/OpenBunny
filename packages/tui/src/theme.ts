import type { NoticeTone, PanelSection, PanelItemStatus } from './types.js';

/* ── Color palette ─────────────────────────────────────────
 * Keep the base mostly neutral and reserve stronger accents
 * for state changes, similar to Gemini CLI's terminal tone.
 * ────────────────────────────────────────────────────────── */

/** Brand gradient: blue → cyan → mint (used for logo, spinner, accents) */
export const GRADIENT = ['#7dd3fc', '#38bdf8', '#5eead4'] as const;

export const T = {
  // ── brand ──────────────────────────────────────────────
  brand:       '#7dd3fc',
  brandDim:    '#38bdf8',
  brandLight:  '#bae6fd',
  accent:      '#5eead4',
  accentDim:   '#2dd4bf',
  accentSoft:  '#10353a',

  // ── semantic status ────────────────────────────────────
  ok:          '#86efac',
  warn:        '#facc15',
  err:         '#f87171',
  info:        '#93c5fd',

  // ── surfaces & text ────────────────────────────────────
  fg:          '#f5f5f5',
  fgDim:       '#d4d4d8',
  fgMuted:     '#a1a1aa',
  fgSubtle:    '#71717a',
  border:      '#3f3f46',
  borderLight: '#52525b',
  borderFocus: '#38bdf8',
  surface:     '#111111',
  surfaceAlt:  '#18181b',

  // ── message roles ──────────────────────────────────────
  user:        '#5eead4',
  assistant:   '#7dd3fc',
  system:      '#71717a',
  tool:        '#facc15',
  toolResult:  '#c4b5fd',
  skill:       '#67e8f9',
  thinking:    '#a1a1aa',

  // ── panel section accents ──────────────────────────────
  sGeneral:    '#7dd3fc',
  sLlm:        '#c4b5fd',
  sTools:      '#facc15',
  sSkills:     '#67e8f9',
  sNetwork:    '#93c5fd',
  sFiles:      '#86efac',
  sStats:      '#fb923c',
  sAbout:      '#e9d5ff',

  // ── gradient accent cycle (for spinner) ────────────────
  gradientCycle: [
    '#7dd3fc', // brand
    '#38bdf8', // sky
    '#22d3ee', // cyan
    '#5eead4', // mint
    '#facc15', // yellow
    '#f87171', // red
    '#7dd3fc', // back to brand
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
    case 'files':     return T.sFiles;
    case 'stats':     return T.sStats;
    case 'about':     return T.sAbout;
    default:          return T.brand;
  }
}

export function getSectionSurfaceColor(section: PanelSection): string {
  switch (section) {
    case 'general':   return '#15212a';
    case 'llm':       return '#21182c';
    case 'tools':     return '#2b2410';
    case 'skills':    return '#102432';
    case 'network':   return '#12202e';
    case 'files':     return '#11231c';
    case 'stats':     return '#2b1d12';
    case 'about':     return '#221827';
    default:          return T.surface;
  }
}

export function getSectionTabLabel(section: PanelSection): string {
  switch (section) {
    case 'general':   return 'General';
    case 'llm':       return 'LLM';
    case 'tools':     return 'Tools';
    case 'skills':    return 'Skills';
    case 'network':   return 'Network';
    case 'files':     return 'Files';
    case 'stats':     return 'Stats';
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
    case 'files':     return 'Ctrl+F';
    case 'stats':     return null;
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
