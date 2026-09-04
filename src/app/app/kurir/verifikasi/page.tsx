import { requireRole } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { KtpSubmitForm } from '@/components/forms/KtpSubmitForm';

export const dynamic = 'force-dynamic';

export default async function VerifikasiKtp() {
  const user = await requireRole('KURIR');
  const courier = await prisma.courierProfile.findUnique({ where: { userId: user.id } });

  if (!courier) {
    return (
      <Card>
        <p className="text-ink/60">
          Profil kurir tidak ditemukan untuk akun ini. Coba keluar lalu masuk kembali.
        </p>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Verifikasi KTP</h1>
        <p className="text-sm text-ink/60">
          Wajib diverifikasi sebelum Anda bisa mengambil tugas pengiriman.
        </p>
      </div>

      {courier.ktpVerified ? (
        <Card className="border-leaf-200 bg-leaf-50">
          <div className="flex items-center gap-3">
            {courier.ktpPhotoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={courier.ktpPhotoUrl} alt="Foto KTP" className="h-16 w-24 rounded-lg border border-leaf-100 object-cover" />
            )}
            <div>
              <Badge tone="green">✓ Terverifikasi</Badge>
              <p className="mt-1 text-sm text-ink/70">NIK: {courier.ktpNumber}</p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {courier.ktpRejectedReason && (
            <Card className="border-red-200 bg-red-50">
              <p className="text-sm font-medium text-red-800">Pengajuan sebelumnya ditolak</p>
              <p className="mt-1 text-sm text-red-700">{courier.ktpRejectedReason}</p>
              <p className="mt-2 text-xs text-red-600">Perbaiki data di bawah lalu ajukan ulang.</p>
            </Card>
          )}
          {!courier.ktpRejectedReason && courier.ktpSubmittedAt && (
            <Card className="border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-800">
                Pengajuan Anda sedang ditinjau admin. Anda akan diberi tahu begitu ada keputusan.
              </p>
            </Card>
          )}
          <Card>
            <KtpSubmitForm currentNik={courier.ktpNumber} />
          </Card>
        </>
      )}

      <p className="text-xs text-ink/45">
        Data KTP Anda hanya digunakan untuk verifikasi identitas mitra kurir dan tidak
        dibagikan ke pihak selain operator G-Fresh.
      </p>
    </div>
  );
}
