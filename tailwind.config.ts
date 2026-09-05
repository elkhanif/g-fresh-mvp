import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palet poster G-Fresh: hijau #2E7D32, oranye #FF8F00, biru #1565C0,
        // latar #F8F9FA. Skala `leaf` sengaja disusun agar 600 = #2E7D32,
        // supaya seluruh `bg-leaf-600` yang sudah tersebar di kode langsung
        // memakai hijau poster tanpa menyentuh satu pun komponen.
        leaf: {
          50: '#E8F5E9', 100: '#C8E6C9', 200: '#A5D6A7',
          300: '#81C784', 400: '#66BB6A', 500: '#43A047',
          600: '#2E7D32', 700: '#256428', 800: '#1B5E20', 900: '#123D16',
        },
        // Oranye: aksi utama yang harus menonjol. Dipakai terbatas — kalau
        // semua tombol oranye, tidak ada yang menonjol.
        accent: {
          50: '#FFF3E0', 100: '#FFE0B2', 500: '#FF8F00',
          600: '#EF6C00', 700: '#E65100',
        },
        // Biru: elemen informasi/data (grafik, label acuan resmi).
        info: {
          50: '#E3F2FD', 100: '#BBDEFB', 500: '#1565C0', 600: '#0D47A1',
        },
        surface: '#F8F9FA',
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
