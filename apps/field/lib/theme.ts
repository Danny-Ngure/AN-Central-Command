// Design tokens mirrored from the web app's tailwind.config.ts brand-* palette.
// Single source of truth eventually lives in @an/ui — for now, duplicate so the
// mobile app doesn't depend on a not-yet-shared design system package.

export const theme = {
  colors: {
    darkBg: '#000000',
    cardBg: '#08080C',
    cardBgElevated: '#12131C',
    border: '#1C1D2A',
    violet: '#A855F7',
    cyan: '#00E5FF',
    skyblue: '#00B0FF',
    orange: '#FF9800',
    textMuted: '#8E94B3',
    textActive: '#FFFFFF',
    textBody: '#E1E4F0',
    danger: '#FF3E3E',
    warning: '#FF9F1C',
    success: '#22C55E',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    full: 9999,
  },
  fontSize: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 24,
    xxl: 32,
  },
} as const;

export type Theme = typeof theme;
