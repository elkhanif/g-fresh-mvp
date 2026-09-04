import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { rupiah } from '@/lib/utils';
import { CATEGORY_LABEL } from '@/lib/negotiation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ComplaintRespondForm } from '@/components/forms/ComplaintRespondForm';

export const dynamic = 'force-dynamic';

function fmt(d: Date) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  }).format(d);
}

function sisaWaktu(deadline: Date) {
  const ms = deadline.getTime() - Date.now();
  if (ms <= 0) return 'tenggat lewat';
  const jam = Math.floor(ms / 3_600_000);
  const menit = Math.floor((ms % 3_600_000) / 60_000);
  return jam > 0 ? `sisa ${jam} jam ${menit} menit` : `sisa ${menit} menit`;
}

function isImage(u: string) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(u);
}

function Bukti({ urls, label }: { urls: string[]; label: string }) {
  if (!urls?.length) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-ink/60">{label}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {urls.map((u) =>
          isImage(u) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={u} href={u} target="_blank" rel="noreferrer">
              <img src={u} alt="bukti" className="h-20 w-20 rounded-lg border border-leaf-100 object-cover" />
            </a>
          ) : (
            <a key={u} href={u} target="_blank" rel="noreferrer"
              className="flex h-20 w-20 items-center justify-center rounded-lg border border-leaf-100 bg-leaf-50 text-xs text-leaf-700">
              ▶ Video
            </a>
          ),
        )}
      </div>
    </div>
  );
}

const STANCE_LABEL: Record<string, { text: string; tone: 'green' | 'amber' | 'red' | 'neutral' }> = {
  BELUM_MERESPON: { text: 'Belum ditanggapi', tone: 'amber' },
  SETUJU: { text: 'Anda menyetujui penuh', tone: 'neutral' },
  TAWAR: { text: 'Anda menawar sebagian', tone: 'neutral' },
  TOLAK: { text: 'Anda menyanggah', tone: 'neutral' },
};

export default async function ProdusenKomplain() {
  const user = await requireRole('PRODUSEN');
  const producer = await prisma.producerProfile.findUnique({ where: { userId: user.id } });

  // Wajib berhenti di sini bila profil tidak ada — TANPA guard ini,
  // producer?.id di bawah akan bernilai undefined, dan Prisma memperlakukan
  // filter undefined sebagai "abaikan filter ini", bukan "jangan ada yang
  // cocok". Akibatnya query bisa balik menampilkan komplain SEMUA produsen,
  // bukan cuma milik akun ini — dan Anda bisa tampak bisa merespon komplain
  // yang bukan untuk produk Anda (walau endpoint respond tetap menolaknya).
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

  const complaints = await prisma.complaint.findMany({
    where: { order: { items: { some: { product: { producerId: producer.id } } } } },
    include: {
      order: { include: { items: { include: { product: true } }, consumer: { select: { name: true } } } },
      offers: { orderBy: { round: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  const perluTanggapan = complaints.filter((c) => c.status === 'MENUNGGU_SANGGAHAN');
  const menungguKonsumen = complaints.filter((c) => c.status === 'MENUNGGU_PERSETUJUAN');
  const riwayat = complaints.filter(
    (c) => c.status !== 'MENUNGGU_SANGGAHAN' && c.status !== 'MENUNGGU_PERSETUJUAN',
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Komplain atas produk saya</h1>
        <p className="text-sm text-ink/60">
          Anda berhak menanggapi setiap komplain sebelum admin memutuskan. Batas waktu tanggapan 12 jam.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Perlu tanggapan{' '}
          {perluTanggapan.length > 0 && <Badge tone="amber">{perluTanggapan.length}</Badge>}
        </h2>
        {perluTanggapan.length === 0 ? (
          <Card><p className="text-ink/60">Tidak ada komplain yang menunggu tanggapan Anda.</p></Card>
        ) : (
          <div className="space-y-3">
            {perluTanggapan.map((c) => (
              <Card key={c.id} className="border-amber-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    Pesanan #{c.orderId.slice(-6)}
                    {c.round > 0 && <span className="ml-2 text-xs font-normal text-ink/50">putaran ke-{c.round + 1}</span>}
                  </p>
                  {c.responseDeadline && <Badge tone="amber">{sisaWaktu(c.responseDeadline)}</Badge>}
                </div>
                <p className="mt-1 text-sm text-ink/70">
                  Dari {c.order.consumer.name} · {fmt(c.createdAt)} · Nilai {rupiah(c.order.total)}
                </p>
                <p className="text-xs text-ink/50">
                  {CATEGORY_LABEL[c.category]} · Item: {c.order.items.map((i) => i.product.name).join(', ')}
                </p>
                <p className="mt-2 rounded-lg bg-leaf-50 p-2 text-sm">
                  <span className="font-medium">Keluhan: </span>{c.reason}
                  {c.qtyAffected != null && (
                    <span className="ml-1 text-ink/60">(kurang {c.qtyAffected})</span>
                  )}
                </p>
                {c.round > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    Tawaran sebelumnya ditolak konsumen. Ini kesempatan Anda untuk menawar ulang atau menyanggah.
                  </p>
                )}
                <Bukti urls={c.evidenceUrls} label="Bukti dari konsumen" />
                <div className="mt-3">
                  <ComplaintRespondForm
                    complaintId={c.id}
                    orderTotal={c.order.total}
                    suggestedRefund={c.suggestedRefund}
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {menungguKonsumen.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Menunggu keputusan konsumen</h2>
          <div className="space-y-3">
            {menungguKonsumen.map((c) => (
              <Card key={c.id} className="border-blue-200">
                <p className="font-medium">Pesanan #{c.orderId.slice(-6)}</p>
                <p className="mt-1 text-sm text-ink/70">
                  Anda menawarkan <b>{rupiah(c.offers[0]?.amount ?? 0)}</b> — menunggu konsumen menerima atau menolak.
                </p>
                <p className="mt-1 text-xs text-ink/45">Diajukan {c.offers[0] ? fmt(c.offers[0].createdAt) : ''}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Riwayat komplain</h2>
        {riwayat.length === 0 ? (
          <Card><p className="text-ink/60">Belum ada riwayat komplain.</p></Card>
        ) : (
          <div className="space-y-3">
            {riwayat.map((c) => {
              const st = STANCE_LABEL[c.producerStance] ?? STANCE_LABEL.BELUM_MERESPON;
              return (
                <Card key={c.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">Pesanan #{c.orderId.slice(-6)}</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={st.tone}>{st.text}</Badge>
                      <Badge tone={c.status === 'VALID' ? 'red' : c.status === 'DITOLAK' ? 'green' : 'amber'}>
                        {c.status === 'VALID' ? 'Refund ke konsumen'
                          : c.status === 'DITOLAK' ? 'Komplain ditolak'
                          : 'Menunggu keputusan admin'}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-ink/70">{CATEGORY_LABEL[c.category]} — {c.reason}</p>
                  {c.offers.length > 0 && (
                    <p className="mt-1 text-xs text-ink/50">
                      Riwayat tawaran: {c.offers.map((o) => `${rupiah(o.amount)} (${o.status.toLowerCase()})`).join(' → ')}
                    </p>
                  )}
                  {c.producerResponse && (
                    <p className="mt-1 text-sm text-ink/60">
                      <span className="font-medium">Tanggapan Anda: </span>{c.producerResponse}
                    </p>
                  )}
                  {c.reviewNote && (
                    <p className="mt-1 text-xs text-ink/50">Catatan: {c.reviewNote}</p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
