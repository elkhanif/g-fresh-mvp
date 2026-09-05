import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'G-Fresh — Pasar Pangan Segar Gresik',
  description:
    'Marketplace pangan segar hyperlocal dengan QR-traceability, HET, dan garansi kesegaran untuk Kabupaten Gresik.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'G-Fresh', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#2E7D32',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        {children}
        {/* Registrasi service worker PWA (tanpa dependency tambahan). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function () {
                  navigator.serviceWorker.register('/sw.js').catch(function(){});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
