import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { PAYMENT_TERM_DAYS } from '@/lib/b2b';
import { Badge } from '@/components/ui/Badge';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(d);
}

const INV_TONE: Record<string, 'green' | 'amber' | 'red'> = {
  LUNAS: 'green', BELUM_DIBAYAR: 'amber', JATUH_TEMPO: 'red',
};
const INV_LABEL: Record<string, string> = {
  LUNAS: 'LUNAS', BELUM_DIBAYAR: 'BELUM DIBAYAR', JATUH_TEMPO: 'JATUH TEMPO',
};

export default async function InvoiceDetail({ params }: { params: { id: string } }) {
  const user = await requireUser();

  const inv = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      order: {
        include: {
          items: { include: { product: { include: { producer: true } } } },
          consumer: { include: { business: true } },
        },
      },
    },
  });
  if (!inv) notFound();

  // Pemilik invoice, admin, atau Pemkab boleh melihat.
  const isOwner = inv.order.consumerId === user.id;
  const isStaff = user.role === 'ADMIN' || user.role === 'PEMKAB';
  if (!isOwner && !isStaff) notFound();

  const biz = inv.order.consumer.business;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={isOwner ? '/app/konsumen/bisnis' : '/app/admin'} className="text-sm text-leaf-700 hover:underline">
          ← Kembali
        </Link>
        <span className="text-sm text-ink/50">Gunakan Ctrl+P untuk mencetak / simpan PDF</span>
      </div>

      <div className="rounded-xl border border-leaf-100 bg-white p-8 print:border-0 print:p-0">
        {/* Kepala invoice */}
        <div className="flex items-start justify-between border-b border-leaf-100 pb-5">
          <div>
            <p className="text-xl font-bold text-leaf-700">G-Fresh</p>
            <p className="text-sm text-ink/60">Pasar pangan segar hyperlocal</p>
            <p className="mt-1 text-xs text-ink/50">Kabupaten Gresik, Jawa Timur</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">INVOICE</p>
            <p className="text-sm font-medium">{inv.number}</p>
            <div className="mt-2">
              <Badge tone={INV_TONE[inv.status]}>{INV_LABEL[inv.status]}</Badge>
            </div>
          </div>
        </div>

        {/* Pihak & tanggal */}
        <div className="grid gap-6 border-b border-leaf-100 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase text-ink/50">Ditagihkan kepada</p>
            <p className="mt-1 font-medium">{biz?.companyName ?? inv.order.consumer.name}</p>
            {biz && (
              <>
                <p className="text-sm text-ink/70">{biz.businessType}</p>
                <p className="text-sm text-ink/70">{biz.billingAddress}</p>
                {biz.npwp && <p className="text-sm text-ink/70">NPWP: {biz.npwp}</p>}
                <p className="mt-1 text-sm text-ink/60">PIC: {biz.picName} · {biz.picPhone}</p>
              </>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase text-ink/50">Tanggal terbit</p>
            <p className="mt-1 text-sm">{fmtDate(inv.issuedAt)}</p>
            <p className="mt-3 text-xs font-semibold uppercase text-ink/50">Jatuh tempo</p>
            <p className="mt-1 text-sm font-medium">{fmtDate(inv.dueDate)}</p>
            <p className="text-xs text-ink/50">termin {PAYMENT_TERM_DAYS} hari</p>
            {inv.paidAt && (
              <>
                <p className="mt-3 text-xs font-semibold uppercase text-ink/50">Dilunasi</p>
                <p className="mt-1 text-sm">{fmtDate(inv.paidAt)}</p>
              </>
            )}
          </div>
        </div>

        {/* Rincian barang */}
        <table className="mt-5 w-full text-sm">
          <thead>
            <tr className="border-b border-leaf-100 text-left text-ink/60">
              <th className="pb-2">Produk</th>
              <th className="pb-2">Produsen</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Harga</th>
              <th className="pb-2 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {inv.order.items.map((it) => (
              <tr key={it.id} className="border-b border-leaf-50">
                <td className="py-2">{it.product.name}</td>
                <td className="py-2 text-ink/60">{it.product.producer.farmName}</td>
                <td className="py-2 text-right">{it.qty} {it.product.unit}</td>
                <td className="py-2 text-right">{rupiah(it.unitPrice)}</td>
                <td className="py-2 text-right">{rupiah(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-ink/60">Subtotal produk</span><span>{rupiah(inv.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">Biaya pengiriman</span><span>{rupiah(inv.deliveryFee)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink/60">Biaya layanan platform</span><span>{rupiah(inv.platformFee)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-leaf-100 pt-2 text-base font-bold">
            <span>Total</span><span>{rupiah(inv.total)}</span>
          </div>
        </div>

        {/* Catatan */}
        <div className="mt-8 border-t border-leaf-100 pt-4 text-xs text-ink/55">
          <p className="font-semibold text-ink/70">Catatan pembayaran</p>
          <p className="mt-1">
            Pembayaran dilakukan melalui transfer ke rekening operator G-Fresh sesuai instruksi
            yang dikirim terpisah. Konfirmasi pelunasan diverifikasi manual oleh operator pada fase pilot.
          </p>
          <p className="mt-2">
            Biaya layanan platform digunakan untuk mendanai subsidi ongkos kirim bagi konsumen
            rumah tangga (skema lintas-subsidi). Produsen menerima 100% harga produk tanpa potongan komisi.
          </p>
        </div>
      </div>
    </div>
  );
}
