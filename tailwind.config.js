/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand tokens. Components use these names, never raw hex.
        brand: { DEFAULT: '#0F3B2E', 700: '#0F3B2E', 600: '#17533F', 500: '#1F6B52', 100: '#DCE8E2' },
        cream: { DEFAULT: '#F6F5EF', 200: '#ECEADF' },
        gold: { DEFAULT: '#C9A227', 600: '#A87F00' },
        stop: { DEFAULT: '#B42318', light: '#FDECEA', dark: '#F97066' },
        ok: { DEFAULT: '#0E7A50', light: '#E3F4EC', dark: '#4CC38A' },
        ink: { DEFAULT: '#1B1F1D', soft: '#4A524E', muted: '#6B746F' },
        night: { DEFAULT: '#0E1513', card: '#16201C', line: '#2A3631' },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
