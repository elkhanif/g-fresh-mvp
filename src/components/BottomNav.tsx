'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { useCart } from '@/lib/cart';
import type { NavItem } from '@/lib/nav';

/**
 * Bottom navigation untuk layar sempit.
 *
 * Hanya tampil di bawah breakpoint `sm`; di layar lebar menu tetap mendatar
 * di header. Butir aktif ditentukan dari pathname, dengan pencocokan tepat
 * untuk beranda peran supaya "/app/konsumen" tidak ikut menyala saat berada
 * di "/app/konsumen/keranjang".
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const { count, ready } = useCart();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-leaf-100 bg-white/95 backdrop-blur sm:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigasi utama"
    >
      <div className="mx-auto flex max-w-lg">
        {items.map((n) => {
          const aktif =
            n.href === pathname || (n.href !== '/app/konsumen' && pathname.startsWith(n.href + '/'));
          const badge = n.icon === 'cart' && ready && count > 0 ? count : null;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={aktif ? 'page' : undefined}
              className={
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] ' +
                (aktif ? 'font-medium text-leaf-700' : 'text-ink/50')
              }
            >
              <span className="relative">
                <Icon name={n.icon} size={22} />
                {badge && (
                  <span className="absolute -right-2 -top-1 min-w-[1.05rem] rounded-full bg-accent-500 px-1 text-center text-[0.62rem] font-medium leading-[1.05rem] text-white">
                    {badge}
                  </span>
                )}
              </span>
              {n.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
