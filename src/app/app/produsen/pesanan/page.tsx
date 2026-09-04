import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { qrDataUrl } from '@/lib/qr';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';

export const dynamic = 'force-dynamic';

export default async function ProdusenPesanan() {
  const user = await requireRole('PRODUSEN');
  const producer = await prisma.producerProfile.findUnique({ where: { userId: user.id } });

  // Wajib berhenti di sini bila profil tidak ada — TANPA guard ini,
  // producer?.id di bawah akan bernilai undefined, dan Prisma memperlakukan
  // filter undefined sebagai "abaikan filter ini", bukan "jangan ada yang
  // cocok". Akibatnya query bisa balik menampilkan pesanan SEMUA produsen,
  // bukan cuma milik akun ini.
  if (!producer) {
    return (
      <Card>
        <p className="text-ink/60">
          Profil produsen tidak ditemukan untuk akun ini. Coba keluar lalu masuk kembali —
          bila masih terjadi, hubungi admin.
        </p>
      </Card>
    );
  }

  // Order yang memuat produk milik produsen ini (dan sudah dibayar).
  const orders = await prisma.order.findMany({
    where: {
      items: { some: { product: { producerId: producer.id } } },
      status: { in: ['DIBAYAR', 'DIJEMPUT_KURIR', 'DIKIRIM', 'DITERIMA', 'SELESAI'] },
    },
    include: {
      items: { include: { product: true } },
      consumer: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Siapkan QR untuk tiap item milik produsen ini.
  const qrByItem: Record<string, string> = {};
  for (const o of orders) {
    for (const it of o.items) {
      if (it.product.producerId === producer.id) {
        qrByItem[it.id] = await qrDataUrl(it.traceCode);
      }
    }
  }

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Pesanan masuk</h1>
      {orders.length === 0 && <Card><p className="text-ink/60">Belum ada pesanan.</p></Card>}
      <div className="space-y-4">
        {orders.map((o) => (
          <Card key={o.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Pesanan #{o.id.slice(-6)}</p>
                <p className="text-sm text-ink/60">Pembeli: {o.consumer.name}</p>
              </div>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {o.items
                .filter((it) => it.product.producerId === producer.id)
                .map((it) => (
                  <div key={it.id} className="flex gap-3 rounded-lg border border-leaf-100 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrByItem[it.id]} alt="QR telusur" className="h-24 w-24" />
                    <div className="text-sm">
                      <p className="font-medium">{it.product.name}</p>
                      <p className="text-ink/60">{it.qty} × {rupiah(it.unitPrice)}</p>
                      <p className="mt-1 text-xs text-ink/50">Tempel QR ini pada kemasan.</p>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
