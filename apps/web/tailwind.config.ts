import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Inter', 'sans-serif'],
      },
      colors: {
        ink: { 900: '#0b0d10', 700: '#1f2328', 500: '#5b6470' },
        paper: { 50: '#fafaf7', 100: '#f4f3ee' },
      },
    },
  },
  plugins: [],
} satisfies Config;
