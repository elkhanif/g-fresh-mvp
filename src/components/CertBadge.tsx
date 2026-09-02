import { Badge } from './ui/Badge';
import type { CertStatus } from '@prisma/client';

export function CertBadge({ status, type }: { status: CertStatus; type?: string | null }) {
  if (status === 'TERVERIFIKASI')
    return <Badge tone="green">✓ Tersertifikasi{type ? ` · ${type}` : ''}</Badge>;
  if (status === 'MENUNGGU_VERIFIKASI') return <Badge tone="amber">Menunggu verifikasi</Badge>;
  if (status === 'DITOLAK') return <Badge tone="red">Sertifikasi ditolak</Badge>;
  return <Badge tone="neutral">Belum bersertifikat</Badge>;
}
