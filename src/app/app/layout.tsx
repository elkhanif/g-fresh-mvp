import Link from 'next/link';
import { requireUser } from '@/lib/rbac';
import { Providers } from '@/components/Providers';
import { SignOutButton } from '@/components/SignOutButton';
import type { Role } from '@prisma/client';

const NAV: Record<Role, { href: string; label: string }[]> = {
  PRODUSEN: [
    { href: '/app/produsen', label: 'Produk' },
    { href: '/app/produsen/pesanan', label: 'Pesanan masuk' },
  ],
  KONSUMEN: [
    { href: '/app/konsumen', label: 'Belanja' },
    { href: '/app/konsumen/pesanan', label: 'Pesanan saya' },
    { href: '/app/konsumen/scan', label: 'Scan QR' },
  ],
  KURIR: [{ href: '/app/kurir', label: 'Tugas kurir' }],
  ADMIN: [{ href: '/app/admin', label: 'Operasional' }],
  PEMKAB: [
    { href: '/app/pemkab', label: 'Dashboard Pemkab' },
    { href: '/app/pemkab/produsen', label: 'Direktori produsen' },
  ],
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = NAV[user.role];

  return (
    <Providers>
      <div className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-leaf-100 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
            <div className="flex items-center gap-6">
              <Link href="/app" className="font-bold text-leaf-700">G-Fresh</Link>
              <nav className="hidden gap-4 sm:flex">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className="text-sm text-ink/70 hover:text-leaf-700">
                    {n.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-ink/60 sm:inline">{user.name}</span>
              <SignOutButton />
            </div>
          </div>
          <nav className="flex gap-4 overflow-x-auto px-5 pb-2 sm:hidden">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="whitespace-nowrap text-sm text-ink/70">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="mx-auto max-w-5xl px-5 py-6">{children}</div>
      </div>
    </Providers>
  );
}