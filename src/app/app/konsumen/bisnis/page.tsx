import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { PLATFORM_FEE_RATE, PAYMENT_TERM_DAYS, B2B_MIN_SUBTOTAL } from '@/lib/b2b';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { BusinessForm } from '@/components/forms/BusinessForm';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(d);
}

const INV_TONE: Record<string, 'green' | 'amber' | 'red'> = {
  LUNAS: 'green', BELUM_DIBAYAR: 'amber', JATUH_TEMPO: 'red',
};
const INV_LABEL: Record<string, string> = {
  LUNAS: 'Lunas', BELUM_DIBAYAR: 'Belum dibayar', JATUH_TEMPO: 'Jatuh tempo',
};

export default async function BisnisPage() {
  const user = await requireRole('KONSUMEN');
  const biz = await prisma.businessProfile.findUnique({ where: { userId: user.id } });

  const invoices = biz
    ? await prisma.invoice.findMany({
        where: { order: { consumerId: user.id } },
        orderBy: { issuedAt: 'desc' },
        take: 50,
      })
    : [];

  const belum = invoices.filter((i) => i.status !== 'LUNAS');
  const totalTertunggak = belum.reduce((a, i) => a + i.total, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Akun bisnis (B2B)</h1>
        <p className="text-sm text-ink/60">
          Pesan dalam volume dengan harga grosir dan pembayaran bertermin {PAYMENT_TERM_DAYS} hari.
        </p>
      </div>

      {biz && (
        <Card className={biz.verified ? 'border-leaf-200' : 'border-amber-200 bg-amber-50'}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{biz.companyName}</p>
              <p className="text-sm text-ink/60">{biz.businessType} · PIC {biz.picName}</p>
            </div>
            <Badge tone={biz.verified ? 'green' : 'amber'}>
              {biz.verified ? '✓ Terverifikasi' : 'Menunggu verifikasi admin'}
            </Badge>
          </div>
          {!biz.verified && (
            <p className="mt-2 text-sm text-amber-800">
              Anda belum dapat memesan sebagai B2B sampai admin memverifikasi profil ini.
            </p>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-1 font-semibold">Ketentuan kanal B2B</h2>
        <ul className="mb-4 space-y-1 text-sm text-ink/70">
          <li>• Nilai minimum pesanan {rupiah(B2B_MIN_SUBTOTAL)} per transaksi.</li>
          <li>• Biaya layanan platform {(PLATFORM_FEE_RATE * 100).toFixed(1)}% dari subtotal.</li>
          <li>• Invoice diterbitkan otomatis, termin {PAYMENT_TERM_DAYS} hari sejak pesanan dibuat.</li>
          <li>• Produsen tetap menerima 100% harga produk — komisi produsen 0%.</li>
        </ul>
        <BusinessForm
          initial={biz ? {
            companyName: biz.companyName, businessType: biz.businessType,
            npwp: biz.npwp ?? '', picName: biz.picName, picPhone: biz.picPhone,
            billingAddress: biz.billingAddress,
          } : undefined}
        />
      </Card>

      {invoices.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Tagihan</h2>
            {totalTertunggak > 0 && (
              <span className="text-sm text-ink/60">
                Tertunggak: <b className="text-amber-700">{rupiah(totalTertunggak)}</b>
              </span>
            )}
          </div>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-leaf-50 text-left text-ink/70">
                <tr>
                  <th className="px-4 py-2">No. invoice</th>
                  <th className="px-4 py-2">Terbit</th>
                  <th className="px-4 py-2">Jatuh tempo</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-t border-leaf-50">
                    <td className="px-4 py-2">
                      <Link href={`/app/konsumen/invoice/${i.id}`} className="font-medium text-leaf-700 hover:underline">
                        {i.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-ink/60">{fmtDate(i.issuedAt)}</td>
                    <td className="px-4 py-2 text-ink/60">{fmtDate(i.dueDate)}</td>
                    <td className="px-4 py-2 font-medium">{rupiah(i.total)}</td>
                    <td className="px-4 py-2">
                      <Badge tone={INV_TONE[i.status]}>{INV_LABEL[i.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}
