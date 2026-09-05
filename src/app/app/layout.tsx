import Link from 'next/link';
import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Providers } from '@/components/Providers';
import { SignOutButton } from '@/components/SignOutButton';
import { NotificationBell } from '@/components/NotificationBell';
import { CartProvider } from '@/lib/cart';
import { CartLink } from '@/components/CartLink';
import { BottomNav } from '@/components/BottomNav';
import { NAV, NAV_BISNIS } from '@/lib/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const nav = NAV[user.role];

  // Menu "Akun bisnis" hanya muncul bila konsumen memang punya profil usaha —
  // sebelumnya selalu tampil dan membingungkan pembeli rumah tangga.
  const punyaBisnis =
    user.role === 'KONSUMEN'
      ? !!(await prisma.businessProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        }))
      : false;
  const navHeader = punyaBisnis ? [...nav.slice(0, -1), NAV_BISNIS, nav[nav.length - 1]] : nav;

  return (
    <Providers>
      <CartProvider>
        <div className="min-h-screen">
          <header className="sticky top-0 z-10 border-b border-leaf-100 bg-white/90 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-2.5">
              <div className="flex items-center gap-6">
                <Link href="/app" className="flex items-center" aria-label="G-Fresh">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.svg" alt="G-Fresh" className="h-7 w-auto" />
                </Link>
                <nav className="hidden gap-4 sm:flex">
                  {navHeader.map((n) => (
                    <Link
                      key={n.href}
                      href={n.href}
                      className="text-sm text-ink/70 hover:text-leaf-700"
                    >
                      {n.label}
                    </Link>
                  ))}
                </nav>
              </div>
              <div className="flex items-center gap-1">
                {user.role === 'KONSUMEN' && <CartLink />}
                <NotificationBell />
                <Link
                  href="/app/akun"
                  className="hidden px-2 text-sm text-ink/70 hover:text-leaf-700 sm:inline"
                >
                  {user.name}
                </Link>
                <SignOutButton />
              </div>
            </div>
          </header>

          {/* pb-24 di mobile memberi ruang untuk bottom nav yang melayang */}
          <div className="mx-auto max-w-5xl px-5 pb-24 pt-6 sm:pb-6">{children}</div>

          <BottomNav items={nav} />
        </div>
      </CartProvider>
    </Providers>
  );
}
