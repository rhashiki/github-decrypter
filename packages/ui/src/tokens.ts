export const DESIGN_SYSTEM_SCHEMA = 'gd-ui-tokens/1' as const;
export const DESIGN_SYSTEM_BUILD = 29 as const;

export const designTokens = Object.freeze({
  schema: DESIGN_SYSTEM_SCHEMA,
  build: DESIGN_SYSTEM_BUILD,
  color: Object.freeze({
    canvas: '#0d1117',
    surface: '#161b22',
    surfaceRaised: '#1c2128',
    border: '#30363d',
    borderSubtle: '#21262d',
    text: '#f0f6fc',
    textMuted: '#8b949e',
    accent: '#58a6ff',
    accentStrong: '#1f6feb',
    success: '#3fb950',
    warning: '#d29922',
    danger: '#f85149',
    focus: '#58a6ff',
  }),
  space: Object.freeze({
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
    xxxl: '44px',
  }),
  radius: Object.freeze({
    sm: '6px',
    md: '10px',
    lg: '14px',
    pill: '999px',
  }),
  typography: Object.freeze({
    family: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    sizeXs: '12px',
    sizeSm: '14px',
    sizeMd: '16px',
    sizeLg: '20px',
    sizeXl: '28px',
    weightRegular: 400,
    weightMedium: 500,
    weightSemibold: 600,
    weightBold: 700,
    lineBody: 1.55,
  }),
  shadow: Object.freeze({
    focus: '0 0 0 3px rgba(88, 166, 255, 0.32)',
    successHalo: '0 0 0 4px rgba(63, 185, 80, 0.12)',
  }),
  motion: Object.freeze({
    fast: '120ms',
    normal: '180ms',
  }),
} as const);

export type DesignTokens = typeof designTokens;
