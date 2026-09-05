'use client';
import Link from 'next/link';
import { useCart } from '@/lib/cart';
import { Icon } from '@/components/ui/Icon';

export function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link
      href="/app/konsumen/keranjang"
      className="relative rounded-lg p-2 text-ink/60 hover:bg-leaf-50 hover:text-leaf-700"
      aria-label="Keranjang"
    >
      <Icon name="cart" size={21} />
      {ready && count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[1.15rem] rounded-full bg-accent-500 px-1 text-center text-[0.7rem] font-medium leading-[1.15rem] text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
