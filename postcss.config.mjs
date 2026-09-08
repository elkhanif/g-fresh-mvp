// Tailwind v4: satu plugin saja. `autoprefixer` dan `postcss-import` tidak
// dipakai lagi — keduanya sudah ditangani di dalam @tailwindcss/postcss.
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
