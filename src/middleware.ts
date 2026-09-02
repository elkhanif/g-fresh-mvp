export { default } from 'next-auth/middleware';

// Lindungi seluruh area terautentikasi. Pengecekan peran per-halaman
// ditangani requireRole() di server component.
export const config = {
  matcher: ['/app/:path*'],
};
