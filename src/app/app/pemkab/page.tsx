import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { getActiveHet } from '@/lib/het';
import { rupiah } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { HetForm } from '@/components/forms/PemkabForms';
import { CertReviewPanel, type CertRow } from '@/components/forms/CertReviewPanel';
import { needsAction } from '@/lib/cert';

export const dynamic = 'force-dynamic';

// Kartu KPI yang memetakan langsung ke Target Capaian 10.1 pada proposal.
function Kpi({
  label, value, targetText, progress, onTrack,
}: { label: string; value: string; targetText: string; progress: number; onTrack: boolean }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <p className="text-sm text-ink/60">{label}</p>
        <Badge tone={onTrack ? 'green' : 'amber'}>{onTrack ? 'Tercapai' : 'Proses'}</Badge>
      </div>
      <p className="mt-1 text-2xl font-semibold text-leaf-700">{value}</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-leaf-50">
        <div
          className={onTrack ? 'h-full bg-leaf-500' : 'h-full bg-amber-400'}
          style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-ink/50">Target: {targetText}</p>
    </Card>
  );
}

export default async function PemkabDashboard() {
  await requireRole('PEMKAB');

  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });

  const [
    producers, kurirAktif, selesai, refund, dibatalkan, komplainCount, gmv, b2bAgg, b2bCount,
  ] = await Promise.all([
    prisma.producerProfile.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.courierProfile.count({ where: { ktpVerified: true, active: true } }),
    prisma.order.count({ where: { status: 'SELESAI' } }),
    prisma.order.count({ where: { status: 'REFUND' } }),
    prisma.order.count({ where: { status: 'DIBATALKAN' } }),
    prisma.complaint.count(),
    prisma.order.aggregate({ _sum: { total: true }, where: { status: 'SELESAI' } }),
    prisma.order.aggregate({ _sum: { subtotal: true, platformFee: true }, where: { channel: 'B2B' } }),
    prisma.order.count({ where: { channel: 'B2B' } }),
  ]);

  // Pengurutan & penyaringan antrean dilakukan di panel (klien), supaya dinas
  // bisa berpindah tab tanpa memuat ulang halaman. Di sini cukup diserialkan.
  const certRows: CertRow[] = producers.map((p) => ({
    id: p.id,
    farmName: p.farmName,
    ownerName: p.user.name,
    kecamatan: p.kecamatan,
    certStatus: p.certStatus,
    certType: p.certType,
    certNumber: p.certNumber,
    certIssuer: p.certIssuer,
    certExpiresAt: p.certExpiresAt ? p.certExpiresAt.toISOString() : null,
    certSubmittedAt: p.certSubmittedAt ? p.certSubmittedAt.toISOString() : null,
    certDocUrl: p.certDocUrl,
    certNote: p.certNote,
  }));
  const pendingCount = producers.filter((p) => needsAction(p.certStatus)).length;

  // Perhitungan KPI (Target Capaian 10.1).
  const TARGET_PRODUSEN = 100;
  const TARGET_KURIR = 50;
  const terkirim = selesai + refund; // order yang sampai proses pengiriman/selesai
  const gagal = refund + dibatalkan;
  const suksesRate = selesai + gagal > 0 ? (selesai / (selesai + gagal)) * 100 : 100;
  const komplainRate = terkirim > 0 ? (komplainCount / terkirim) * 100 : 0;

  // HET aktif per kategori.
  const hetRows = [];
  for (const c of categories) {
    const h = await getActiveHet(c.id);
    hetRows.push({ c, het: h });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard Pemerintah Kabupaten</h1>
        <p className="text-sm text-ink/60">
          Pemantauan capaian pilot terhadap Target 10.1, penetapan HET, dan verifikasi sertifikasi.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Capaian pilot (Target 10.1)</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label="Kelompok produsen terintegrasi"
            value={`${producers.length}`}
            targetText={`${TARGET_PRODUSEN}+`}
            progress={(producers.length / TARGET_PRODUSEN) * 100}
            onTrack={producers.length >= TARGET_PRODUSEN}
          />
          <Kpi
            label="Mitra kurir aktif"
            value={`${kurirAktif}`}
            targetText={`${TARGET_KURIR}+`}
            progress={(kurirAktif / TARGET_KURIR) * 100}
            onTrack={kurirAktif >= TARGET_KURIR}
          />
          <Kpi
            label="Keberhasilan pengiriman"
            value={`${suksesRate.toFixed(1)}%`}
            targetText="> 98%"
            progress={suksesRate}
            onTrack={suksesRate >= 98}
          />
          <Kpi
            label="Komplain kesegaran"
            value={`${komplainRate.toFixed(1)}%`}
            targetText="< 2%"
            progress={100 - Math.min(100, komplainRate * 10)}
            onTrack={komplainRate < 2}
          />
        </div>
        <p className="mt-2 text-xs text-ink/50">
          GMV transaksi selesai: <b>{rupiah(gmv._sum.total ?? 0)}</b> · Sertifikasi pending: {pendingCount}
        </p>
        <p className="mt-1 text-xs text-ink/50">
          Kanal B2B: <b>{b2bCount}</b> pesanan · nilai <b>{rupiah(b2bAgg._sum.subtotal ?? 0)}</b> ·
          biaya layanan terkumpul <b>{rupiah(b2bAgg._sum.platformFee ?? 0)}</b> (mendanai subsidi ongkir B2C,
          tanpa beban APBD)
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Tetapkan HET</h2>
          <Card><HetForm categories={categories} /></Card>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">HET berlaku saat ini</h2>
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-leaf-50 text-left text-ink/70">
                <tr><th className="px-4 py-2">Kategori</th><th className="px-4 py-2">Batas atas</th><th className="px-4 py-2">Batas bawah</th></tr>
              </thead>
              <tbody>
                {hetRows.map(({ c, het }) => (
                  <tr key={c.id} className="border-t border-leaf-50">
                    <td className="px-4 py-2">{c.name} <span className="text-ink/40">/{c.unit}</span></td>
                    <td className="px-4 py-2 font-medium">{het ? rupiah(het.maxPrice) : <span className="text-ink/40">—</span>}</td>
                    <td className="px-4 py-2">{het?.floorPrice ? rupiah(het.floorPrice) : <span className="text-ink/40">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Produsen &amp; sertifikasi</h2>
          <span className="text-sm text-ink/50">{producers.length} produsen · {pendingCount} perlu tindakan</span>
        </div>
        {producers.length === 0 ? (
          <Card><p className="text-ink/60">Belum ada produsen terdaftar di sistem.</p></Card>
        ) : (
          <CertReviewPanel rows={certRows} />
        )}
      </section>
    </div>
  );
}
