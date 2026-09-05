import { requireRole, getSessionUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { CartCheckout } from '@/components/forms/CartCheckout';

export const dynamic = 'force-dynamic';

export default async function KeranjangPage() {
  await requireRole('KONSUMEN');
  const me = await getSessionUser();
  const account = me
    ? await prisma.user.findUnique({
        where: { id: me.id },
        select: { defaultAddress: true, business: true },
      })
    : null;

  // Kanal grosir hanya terbuka untuk akun bisnis yang sudah diverifikasi
  // admin — sama seperti aturan di halaman detail produk sebelumnya.
  const b2bEligible = !!account?.business?.verified;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Keranjang</h1>
        <p className="text-sm text-ink/60">
          Satu keranjang untuk banyak penjual — barang dari beberapa kios dan petani bisa dipesan
          sekaligus.
        </p>
      </div>
      <CartCheckout
        defaultAddress={account?.defaultAddress ?? ''}
        billingAddress={account?.business?.billingAddress ?? ''}
        b2bEligible={b2bEligible}
      />
    </div>
  );
}
