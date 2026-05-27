/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          darkBg: '#000000',
          cardBg: '#08080C',
          border: '#1C1D2A',
          violet: '#A855F7',      // Purple
          cyan: '#00E5FF',        // Turquoise / Turquoise Cyan
          skyblue: '#00B0FF',     // Sky Blue
          orange: '#FF9800',      // Orange
          textMuted: '#8E94B3',
          textActive: '#FFFFFF',  // White
          danger: '#FF3E3E',
          warning: '#FF9F1C',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
