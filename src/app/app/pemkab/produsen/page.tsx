import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';

export const dynamic = 'force-dynamic';

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-sm text-ink/60">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-leaf-700">{value}</p>
    </Card>
  );
}

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(d);
}

export default async function DirektoriProdusen() {
  await requireRole('PEMKAB');

  // Semua produsen yang sudah terintegrasi (punya akun + profil di sistem).
  const producers = await prisma.producerProfile.findMany({
    include: {
      user: { select: { name: true, phone: true } },
      products: { select: { active: true, stock: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Ringkas per produsen: berapa produk aktif (aktif & masih ada stok).
  const rows = producers.map((p) => {
    const total = p.products.length;
    const aktif = p.products.filter((x) => x.active && x.stock > 0).length;
    return { p, total, aktif };
  });

  const jualanAktif = rows.filter((r) => r.aktif > 0).length;
  const tersertifikasi = producers.filter((p) => p.certStatus === 'TERVERIFIKASI').length;

  // Rekap sebaran per kecamatan.
  const perKec = new Map<string, number>();
  for (const p of producers) perKec.set(p.kecamatan, (perKec.get(p.kecamatan) ?? 0) + 1);
  const kecList = [...perKec.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Direktori produsen terintegrasi</h1>
        <p className="text-sm text-ink/60">
          Daftar produsen yang telah terhubung ke sistem G-Fresh. Halaman pantauan (read-only).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total produsen" value={producers.length} />
        <Stat label="Aktif berjualan" value={jualanAktif} />
        <Stat label="Tersertifikasi" value={tersertifikasi} />
        <Stat label="Kecamatan tercakup" value={perKec.size} />
      </div>

      {kecList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {kecList.map(([kec, n]) => (
            <Badge key={kec} tone="neutral">
              {kec}: {n}
            </Badge>
          ))}
        </div>
      )}

      {producers.length === 0 ? (
        <Card>
          <p className="text-ink/60">Belum ada produsen terdaftar di sistem.</p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-leaf-50 text-left text-ink/70">
              <tr>
                <th className="px-4 py-2">Produsen</th>
                <th className="px-4 py-2">Pemilik</th>
                <th className="px-4 py-2">Kecamatan</th>
                <th className="px-4 py-2">Produk aktif</th>
                <th className="px-4 py-2">Sertifikasi</th>
                <th className="px-4 py-2">Rating</th>
                <th className="px-4 py-2">Bergabung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, total, aktif }) => (
                <tr key={p.id} className="border-t border-leaf-50 align-top">
                  <td className="px-4 py-2 font-medium">{p.farmName}</td>
                  <td className="px-4 py-2">
                    <div>{p.user.name}</div>
                    <div className="text-xs text-ink/50">{p.user.phone}</div>
                  </td>
                  <td className="px-4 py-2">{p.kecamatan}</td>
                  <td className="px-4 py-2">
                    {aktif > 0 ? (
                      <span className="font-medium text-leaf-700">{aktif}</span>
                    ) : (
                      <span className="text-ink/40">0</span>
                    )}
                    <span className="text-ink/40"> / {total}</span>
                  </td>
                  <td className="px-4 py-2">
                    <CertBadge status={p.certStatus} type={p.certType} />
                  </td>
                  <td className="px-4 py-2">★ {p.ratingScore.toFixed(1)}</td>
                  <td className="px-4 py-2 text-ink/60">{fmtDate(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}