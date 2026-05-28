import type { Config } from 'tailwindcss';

// Brand tokens copied from prototypes/vite-react-sketch/tailwind.config.js (Tailwind 3.x).
// Once shadcn/ui is initialised in Phase 4b, the design tokens move into packages/ui.

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          darkBg: '#000000',
          cardBg: '#08080C',
          border: '#1C1D2A',
          violet: '#A855F7',
          cyan: '#00E5FF',
          skyblue: '#00B0FF',
          orange: '#FF9800',
          textMuted: '#8E94B3',
          textActive: '#FFFFFF',
          danger: '#FF3E3E',
          warning: '#FF9F1C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
