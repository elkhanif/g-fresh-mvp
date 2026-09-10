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

  // Titik antar dari pesanan terakhir yang punya koordinat.
  //
  // `User` cuma menyimpan `defaultAddress` berupa teks, tidak ada kolom
  // koordinat tersimpan. Menambah `defaultLat`/`defaultLng` sebenarnya
  // mungkin dan aman lewat `db push` (murni ADD COLUMN), tapi belum perlu:
  // koordinat yang dipakai pembeli terakhir kali SUDAH tersimpan di
  // `Order.destLat/destLng`, dan itu justru lebih jujur — yang diingat adalah
  // tempat barang benar-benar diantar, bukan pengaturan yang mungkin sudah
  // lama tidak diperbarui.
  //
  // `destLat: { not: null }` penting: tanpa itu, pesanan terbaru yang dibuat
  // sebelum fitur ini ada (koordinatnya null) akan selalu terpilih dan pin
  // pembeli tidak pernah ter-prefill.
  const pesananTerakhirBerpin = me
    ? await prisma.order.findFirst({
        where: { consumerId: me.id, destLat: { not: null }, destLng: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { destLat: true, destLng: true },
      })
    : null;

  const pinTerakhir =
    pesananTerakhirBerpin?.destLat != null && pesananTerakhirBerpin?.destLng != null
      ? { lat: pesananTerakhirBerpin.destLat, lng: pesananTerakhirBerpin.destLng }
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
        pinTerakhir={pinTerakhir}
      />
    </div>
  );
}
