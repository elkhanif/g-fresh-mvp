import type { Role } from '@prisma/client';
import { prisma } from './db';
import { isPrivateKind, type PrivateKind } from './storage';

/**
 * Otorisasi baca berkas privat (foto KTP, salinan sertifikat, bukti komplain).
 *
 * PRINSIP: keputusan diambil dari DATABASE, bukan dari nama berkas.
 *
 * Kesimpulan §9 dokumen memory sudah benar — "nama file acak bukan proteksi
 * sungguhan". Maka route /api/files tidak boleh percaya apa pun dari URL
 * selain sebagai kunci pencarian: URL dicari di kolom pemiliknya, lalu
 * kepemilikan record itulah yang menentukan boleh/tidak. Berkas yang tidak
 * terdaftar di DB (mis. sisa unggahan yang record-nya sudah terhapus)
 * otomatis tidak bisa dibaca siapa pun — itu perilaku yang diinginkan.
 *
 * MATRIKS AKSES
 *   ktp        → kurir ybs · ADMIN
 *   cert       → produsen ybs · PEMKAB · ADMIN
 *   complaints → bukti konsumen: pelapor + produsen tersanggah + ADMIN
 *                bukti produsen : produsen ybs + ADMIN
 *
 * PEMKAB TIDAK punya akses `ktp`. Verifikasi KTP kurir dikerjakan ADMIN,
 * bukan dinas — jadi tidak ada alur kerja yang membutuhkannya, dan foto KTP
 * adalah data pribadi yang tunduk UU PDP. Peran yang tidak memerlukan sebuah
 * data tidak boleh bisa membukanya, sekalipun aksesnya tercatat: log itu
 * pengawasan, bukan izin.
 *
 * PEMKAB TETAP punya akses `cert` — di situ dinas memang pihak yang memutus
 * (verifikasi/tolak/cabut sertifikat), jadi mereka butuh melihat buktinya.
 *
 * Bukti produsen sengaja TIDAK dibuka ke konsumen: antarmuka mana pun tidak
 * menampilkannya, dan otorisasi mengikuti apa yang benar-benar dibutuhkan UI.
 */

const KTP_VIEWER_ROLES: Role[] = ['ADMIN'];
const CERT_VIEWER_ROLES: Role[] = ['ADMIN', 'PEMKAB'];

export interface Requester {
  id: string;
  role: Role;
  name: string;
}

export type AccessDecision = {
  allowed: boolean;
  /** Kode alasan penolakan; null bila diizinkan. */
  reason: string | null;
  /** userId pemilik data (subjek data), untuk dicatat di log akses. */
  subjectId: string | null;
};

const DENY = (reason: string, subjectId: string | null = null): AccessDecision => ({
  allowed: false,
  reason,
  subjectId,
});
const ALLOW = (subjectId: string | null): AccessDecision => ({
  allowed: true,
  reason: null,
  subjectId,
});

export async function decideFileAccess(
  kind: string,
  url: string,
  who: Requester,
): Promise<AccessDecision> {
  if (!isPrivateKind(kind)) return DENY('JENIS_TIDAK_DIKENAL');

  switch (kind as PrivateKind) {
    case 'ktp':
      return decideKtp(url, who);
    case 'cert':
      return decideCert(url, who);
    case 'complaints':
      return decideComplaint(url, who);
  }
}

async function decideKtp(url: string, who: Requester): Promise<AccessDecision> {
  const courier = await prisma.courierProfile.findFirst({
    where: { ktpPhotoUrl: url },
    select: { userId: true },
  });
  if (!courier) return DENY('BERKAS_TIDAK_TERDAFTAR');

  if (who.id === courier.userId) return ALLOW(courier.userId);
  if (KTP_VIEWER_ROLES.includes(who.role)) return ALLOW(courier.userId);
  return DENY('BUKAN_PEMILIK', courier.userId);
}

async function decideCert(url: string, who: Requester): Promise<AccessDecision> {
  const producer = await prisma.producerProfile.findFirst({
    where: { certDocUrl: url },
    select: { userId: true },
  });
  if (!producer) return DENY('BERKAS_TIDAK_TERDAFTAR');

  if (who.id === producer.userId) return ALLOW(producer.userId);
  if (CERT_VIEWER_ROLES.includes(who.role)) return ALLOW(producer.userId);
  return DENY('BUKAN_PEMILIK', producer.userId);
}

async function decideComplaint(url: string, who: Requester): Promise<AccessDecision> {
  const complaint = await prisma.complaint.findFirst({
    where: {
      OR: [{ evidenceUrls: { has: url } }, { producerEvidence: { has: url } }],
    },
    select: {
      orderId: true,
      reporterId: true,
      evidenceUrls: true,
    },
  });
  if (!complaint) return DENY('BERKAS_TIDAK_TERDAFTAR');

  // Berkas ini dari konsumen atau dari produsen? Menentukan siapa yang berhak.
  const fromConsumer = complaint.evidenceUrls.includes(url);

  // Produsen yang tersanggah: pemilik produk di order tersebut.
  const item = await prisma.orderItem.findFirst({
    where: { orderId: complaint.orderId },
    select: { product: { select: { producer: { select: { userId: true } } } } },
  });
  const producerUserId = item?.product.producer.userId ?? null;

  const subjectId = fromConsumer ? complaint.reporterId : producerUserId;

  if (who.role === 'ADMIN') return ALLOW(subjectId);
  if (producerUserId && who.id === producerUserId) return ALLOW(subjectId);
  if (fromConsumer && who.id === complaint.reporterId) return ALLOW(subjectId);
  return DENY('BUKAN_PIHAK_SENGKETA', subjectId);
}

/**
 * Catat percobaan akses — yang diizinkan MAUPUN yang ditolak.
 *
 * Append-only, dan sengaja TANPA relasi ke User: kalau ada foreign key,
 * `db:seed` yang menghapus User akan ikut menghapus jejak auditnya. Nama
 * pelaku disalin saat kejadian, pola yang sama dengan CertReview.
 *
 * Best-effort: kegagalan menulis log tidak menggagalkan penyajian berkas
 * (mengunci berkas gara-gara log gagal akan mematikan panel admin di saat
 * paling tidak tepat). Kegagalannya dicetak keras ke console. Kalau
 * kepatuhan menuntut "tidak ada akses tanpa jejak", tukar console.error
 * di bawah menjadi throw.
 */
export async function logFileAccess(entry: {
  kind: string;
  fileUrl: string;
  actor: Requester | null;
  decision: AccessDecision;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  try {
    await prisma.fileAccessLog.create({
      data: {
        kind: entry.kind,
        fileUrl: entry.fileUrl,
        actorId: entry.actor?.id ?? null,
        actorName: entry.actor?.name ?? 'Anonim',
        actorRole: entry.actor?.role ?? null,
        allowed: entry.decision.allowed,
        reason: entry.decision.reason,
        subjectId: entry.decision.subjectId,
        ip: entry.ip,
        userAgent: entry.userAgent?.slice(0, 300) ?? null,
      },
    });
  } catch (e) {
    console.error('[file-access] GAGAL menulis log akses berkas:', e);
  }
}
