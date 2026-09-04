'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';

// Scan QR telusur pakai kamera. Memakai html5-qrcode (import dinamis agar
// tidak dieksekusi saat SSR). Setelah berhasil, arahkan ke halaman /trace.
export default function ScanPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const doneRef = useRef(false);

  useEffect(() => {
    let scanner: any;
    let cancelled = false;

    import('html5-qrcode')
      .then(({ Html5QrcodeScanner }) => {
        if (cancelled) return;
        scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: 240 }, false);
        scanner.render(
          (decodedText: string) => {
            if (doneRef.current) return;
            doneRef.current = true;
            scanner.clear().catch(() => {});
            goToTrace(decodedText);
          },
          () => {}, // abaikan error frame-per-frame
        );
      })
      .catch(() => setError('Gagal memuat pemindai. Coba muat ulang halaman.'));

    function goToTrace(text: string) {
      try {
        const u = new URL(text);
        if (u.pathname.startsWith('/trace/')) return router.push(u.pathname);
      } catch {
        /* bukan URL penuh */
      }
      router.push(`/trace/${encodeURIComponent(text)}`);
    }

    return () => {
      cancelled = true;
      scanner?.clear?.().catch(() => {});
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-xl font-semibold">Pindai QR produk</h1>
      <p className="mb-4 text-sm text-ink/60">
        Arahkan kamera ke QR pada kemasan untuk melihat asal-usul & waktu panennya.
      </p>
      <Card>
        <div id="qr-reader" className="w-full" />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-ink/50">
          Izinkan akses kamera saat diminta browser. Di HP, gunakan koneksi HTTPS
          (mis. lewat ngrok/Tailscale) agar kamera aktif.
        </p>
      </Card>
    </div>
  );
}
