import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CertBadge } from '@/components/CertBadge';
import { CertSubmitForm } from '@/components/forms/CertSubmitForm';
import { CERT_STATUS_LABEL, daysUntil } from '@/lib/cert';

export const dynamic = 'force-dynamic';

const statusLabel = (s: string) =>
  CERT_STATUS_LABEL[s as keyof typeof CERT_STATUS_LABEL] ?? s;

function fmt(d: Date | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'Asia/Jakarta' }).format(d);
}

export default async function SertifikasiProdusen() {
  const user = await requireRole('PRODUSEN');
  const producer = await prisma.producerProfile.findUnique({ where: { userId: user.id } });
  if (!producer) {
    return (
      <Card>
        <p className="text-ink/60">Profil produsen belum ada.</p>
      </Card>
    );
  }

  const reviews = await prisma.certReview.findMany({
    where: { producerId: producer.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const sisa = daysUntil(producer.certExpiresAt);
  // Pengajuan hanya ditutup saat sedang ditinjau atau masih berlaku — status
  // lain (ditolak, perlu perbaikan, kedaluwarsa, dicabut) justru butuh jalan
  // masuk untuk memperbaiki.
  const bisaMengajukan =
    producer.certStatus !== 'MENUNGGU_VERIFIKASI' && producer.certStatus !== 'TERVERIFIKASI';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Sertifikasi</h1>
        <p className="text-sm text-ink/60">
          Ajukan sertifikat usaha Anda untuk diverifikasi dinas. Produk bersertifikat mendapat
          penanda khusus di katalog konsumen.
        </p>
      </div>

      <Card className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CertBadge status={producer.certStatus} type={producer.certType} />
          {producer.certExpiresAt && producer.certStatus === 'TERVERIFIKASI' && sisa !== null && (
            <Badge tone={sisa <= 60 ? 'amber' : 'neutral'}>
              {sisa >= 0 ? `Berlaku ${sisa} hari lagi` : 'Sudah lewat masa berlaku'}
            </Badge>
          )}
        </div>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-ink/50">Nomor sertifikat</dt>
            <dd>{producer.certNumber ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-ink/50">Penerbit</dt>
            <dd>{producer.certIssuer ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-ink/50">Terbit</dt>
            <dd>{fmt(producer.certIssuedAt)}</dd>
          </div>
          <div>
            <dt className="text-ink/50">Berlaku sampai</dt>
            <dd>{fmt(producer.certExpiresAt)}</dd>
          </div>
        </dl>
        {producer.certNote && (
          <div className="rounded-lg bg-leaf-50 p-3 text-sm">
            <p className="font-medium">Catatan dari dinas</p>
            <p className="text-ink/70">{producer.certNote}</p>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            {producer.certStatus === 'MENUNGGU_PERBAIKAN' ? 'Perbaiki pengajuan' : 'Ajukan sertifikasi'}
          </h2>
          <Card>
            {bisaMengajukan ? (
              <CertSubmitForm defaults={{ certType: producer.certType }} />
            ) : (
              <p className="text-sm text-ink/60">
                {producer.certStatus === 'MENUNGGU_VERIFIKASI'
                  ? 'Pengajuan Anda sedang ditinjau dinas. Anda akan mendapat notifikasi begitu ada keputusan.'
                  : 'Sertifikasi Anda masih berlaku. Ajukan lagi setelah diperpanjang penerbitnya.'}
              </p>
            )}
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Riwayat keputusan</h2>
          <Card>
            {reviews.length === 0 ? (
              <p className="text-sm text-ink/60">Belum ada riwayat.</p>
            ) : (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="border-b border-leaf-50 pb-2 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone="neutral">
                        {statusLabel(r.fromStatus)} → {statusLabel(r.toStatus)}
                      </Badge>
                      <span className="text-xs text-ink/50">
                        {new Intl.DateTimeFormat('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                          timeZone: 'Asia/Jakarta',
                        }).format(r.createdAt)}
                        {' · '}
                        {r.actorName ?? 'Sistem'}
                      </span>
                    </div>
                    {r.note && <p className="text-xs text-ink/60">{r.note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
