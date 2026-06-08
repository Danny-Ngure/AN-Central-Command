import type { Config } from 'tailwindcss';

// Brand tokens — Alfayo Nelson Hope Foundation (ANHF) palette.
// Source: ANHF Brand Color Guide (teal-blue + orange).
//
// Naming policy: existing class names (`brand-violet`, `brand-cyan`, …) are kept
// for source-compatibility — their hex values are rebound to the ANHF palette so
// the whole product re-skins via this single file. New code should prefer the
// explicit tokens (`brand-tealBlue`, `brand-orangeBright`, `brand-aqua`, …).

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          // ===================================================================
          // 2026 warm palette. Six brand colours, applied in priority order:
          //   1 #BE5103 burnt orange  → PRIMARY  (active nav, headers, accent)
          //   2 #FFCE1B golden yellow → HIGHLIGHT (active/selected, key stats)
          //   3 #069494 teal          → INFO/LINKS/live accents
          //   4 #B7410E rust          → ACTION/warning (CTA buttons)
          //   5 #807040 olive         → MUTED accent / neutral chips
          //   6 #8D5A2B brown         → borders / dividers / panel edges
          // Backgrounds are warm near-black so the whole product feels cohesive.
          // Every legacy `brand-*` class is rebound below so the app re-skins
          // from this single file.
          // ===================================================================

          // ----- the six, as explicit tokens -----
          burnt:        '#BE5103',   // 1 primary
          gold:         '#FFCE1B',   // 2 highlight
          teal:         '#069494',   // 3 info / links
          rust:         '#B7410E',   // 4 action / warning
          olive:        '#807040',   // 5 muted accent
          brown:        '#8D5A2B',   // 6 borders / panel edges

          // ----- surfaces (theme-switchable via CSS vars; see globals.css) -----
          darkBg:       'rgb(var(--c-bg) / <alpha-value>)',            // page
          cardBg:       'rgb(var(--c-card) / <alpha-value>)',          // card
          cardBgHeavy:  'rgb(var(--c-card-heavy) / <alpha-value>)',    // inset
          panel:        'rgb(var(--c-panel) / <alpha-value>)',         // panel
          border:       'rgb(var(--c-border) / <alpha-value>)',        // divider
          borderStrong: 'rgb(var(--c-border-strong) / <alpha-value>)', // strong border
          field:        'rgb(var(--c-field) / <alpha-value>)',         // input background

          // ----- primary brand (was teal-blue, now burnt orange) -----
          tealBlue:     '#BE5103',   // → primary
          tealBright:   '#d96b1c',   // lighter burnt for hover
          orangeBright: '#BE5103',   // → primary accent
          skyBlue:      '#069494',   // → teal (live accents)
          darkGray:     'rgb(var(--c-panel) / <alpha-value>)',   // themed panel

          // ----- secondary -----
          deepBlue:     '#8D5A2B',   // headings → brown
          orangeAlt:    '#B7410E',   // → rust

          // ----- interface -----
          orangePrimary:'#B7410E',   // CTA buttons → rust
          aqua:         '#069494',   // links → teal
          interfaceGray:'#333333',
          mediumGray:   '#6b6b6b',
          lightGray:    '#e0e0e0',

          // ----- text (theme-switchable via CSS vars) -----
          textActive:   'rgb(var(--c-text-active) / <alpha-value>)',
          textBody:     'rgb(var(--c-text-body) / <alpha-value>)',
          textMuted:    'rgb(var(--c-text-muted) / <alpha-value>)',

          // ----- state colours -----
          danger:       '#dc2626',   // real error red (kept)
          warning:      '#B7410E',   // rust
          success:      '#10b981',   // emerald — visited / OK state

          // ----- back-compat aliases (legacy classes re-skin automatically) -----
          violet:       '#BE5103',   // → primary
          cyan:         '#069494',   // → teal
          skyblue:      '#069494',   // → teal
          orange:       '#BE5103',   // → primary
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        // Brand-tinted glow — softened (calmer, less "neon") for the 2026 redesign.
        'brand-teal':   '0 0 16px rgba(190, 81, 3, 0.28)',   // burnt (primary)
        'brand-orange': '0 0 16px rgba(183, 65, 14, 0.26)',  // rust (action)
        'brand-sky':    '0 0 16px rgba(6, 148, 148, 0.26)',  // teal (info)
        'brand-gold':   '0 0 18px rgba(255, 206, 27, 0.30)', // highlight pop
      },
    },
  },
  plugins: [],
} satisfies Config;
