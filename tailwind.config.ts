import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // G-Fresh palette: "pasar pagi" — daun muda + tanah + terang
        leaf: {
          50: '#f1f8ec', 100: '#dcefce', 200: '#bfe1a4',
          300: '#9ccf76', 400: '#7cbb4f', 500: '#5ea033',
          600: '#487d26', 700: '#396120', 800: '#2f4e1e', 900: '#28401d',
        },
        clay: { 100: '#f6ede2', 400: '#c98b5a', 600: '#a5673a' },
        ink: '#1b241a',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
