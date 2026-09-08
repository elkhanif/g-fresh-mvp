import { NextResponse } from 'next/server';
import { apiUser } from '@/lib/rbac';
import { decideFileAccess, logFileAccess, type Requester } from '@/lib/file-access';
import { contentTypeFor, isPrivateKind, privateFilePath, readPrivate } from '@/lib/storage';

/**
 * GET /api/files/[kind]/[name] — satu-satunya jalan membaca berkas privat.
 *
 * kind: ktp | cert | complaints
 *
 * Semua penolakan menjawab 404, bukan 403. Membedakan "tidak ada" dari
 * "tidak boleh" memberi tahu penyerang bahwa foto KTP milik seseorang MEMANG
 * ADA di sistem — informasi yang tidak perlu dibocorkan. Penolakannya tetap
 * tercatat lengkap dengan alasan sebenarnya di FileAccessLog.
 */

export const dynamic = 'force-dynamic';

const notFound = () => NextResponse.json({ error: 'Berkas tidak ditemukan.' }, { status: 404 });

export async function GET(
  req: Request,
  { params }: { params: { kind: string; name: string } },
) {
  const { kind, name } = params;

  // Lapis 1 — bentuk permintaan. Tolak sebelum menyentuh DB atau disk.
  if (!isPrivateKind(kind)) return notFound();
  const fullPath = privateFilePath(kind, name);
  if (!fullPath) return notFound();

  const url = `/api/files/${kind}/${name}`;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
  const userAgent = req.headers.get('user-agent');

  // Lapis 2 — harus login.
  const user = await apiUser();
  if (!user) {
    await logFileAccess({
      kind,
      fileUrl: url,
      actor: null,
      decision: { allowed: false, reason: 'BELUM_LOGIN', subjectId: null },
      ip,
      userAgent,
    });
    return notFound();
  }

  // `session.user.name` bertipe opsional (konvensi next-auth), padahal
  // `User.name` di schema non-null. Fallback-nya BUKAN 'Anonim': label itu
  // dipakai logFileAccess khusus untuk permintaan tanpa sesi. Menyamakan
  // keduanya membuat jejak audit menyesatkan — pelaku yang login tercatat
  // seolah anonim.
  const who: Requester = { id: user.id, role: user.role, name: user.name ?? '(nama kosong)' };

  // Lapis 3 — kepemilikan, diputuskan dari DB.
  const decision = await decideFileAccess(kind, url, who);
  await logFileAccess({ kind, fileUrl: url, actor: who, decision, ip, userAgent });
  if (!decision.allowed) return notFound();

  const buf = await readPrivate(kind, name);
  if (!buf) return notFound();

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(name),
      'Content-Length': String(buf.length),
      'Content-Disposition': `inline; filename="${name}"`,
      // Jangan pernah biarkan berkas ini nyangkut di cache bersama. Tanpa
      // header ini, CDN/proxy di depan aplikasi bisa menyimpan foto KTP di
      // simpul tepi dan menyajikannya ke permintaan lain tanpa cek sesi.
      'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
