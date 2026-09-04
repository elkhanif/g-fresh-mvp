import { requireUser } from '@/lib/rbac';
import { prisma } from '@/lib/db';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProfileForm, PasswordForm } from '@/components/forms/AccountForms';

export const dynamic = 'force-dynamic';

const ROLE_LABEL: Record<string, string> = {
  PRODUSEN: 'Produsen', KONSUMEN: 'Konsumen', KURIR: 'Kurir', ADMIN: 'Admin operator', PEMKAB: 'Pemkab',
};

export default async function AkunPage() {
  const user = await requireUser();
  const me = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, phone: true, role: true, kecamatan: true, defaultAddress: true, createdAt: true },
  });
  if (!me) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Pengaturan akun</h1>
        <p className="text-sm text-ink/60">Kelola profil dan keamanan akun Anda.</p>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{me.email}</p>
            <p className="text-sm text-ink/60">
              Bergabung {new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(me.createdAt)}
              {me.kecamatan ? ` · Kec. ${me.kecamatan}` : ''}
            </p>
          </div>
          <Badge tone="green">{ROLE_LABEL[me.role] ?? me.role}</Badge>
        </div>
        <p className="mt-2 text-xs text-ink/45">Email dan peran tidak dapat diubah dari sini.</p>
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Profil</h2>
        <ProfileForm
          role={me.role}
          name={me.name}
          phone={me.phone}
          defaultAddress={me.defaultAddress ?? ''}
        />
      </Card>

      <Card>
        <h2 className="mb-3 font-semibold">Keamanan</h2>
        <PasswordForm />
      </Card>
    </div>
  );
}
