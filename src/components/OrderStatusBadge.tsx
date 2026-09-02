import { Badge } from './ui/Badge';
import type { OrderStatus } from '@prisma/client';

const map: Record<OrderStatus, { label: string; tone: 'neutral' | 'green' | 'amber' | 'red' | 'blue' }> = {
  MENUNGGU_BAYAR: { label: 'Menunggu Bayar', tone: 'amber' },
  DIBAYAR: { label: 'Dibayar (escrow)', tone: 'blue' },
  DIJEMPUT_KURIR: { label: 'Dijemput Kurir', tone: 'blue' },
  DIKIRIM: { label: 'Dikirim', tone: 'blue' },
  DITERIMA: { label: 'Diterima — masa garansi', tone: 'amber' },
  SELESAI: { label: 'Selesai', tone: 'green' },
  SENGKETA: { label: 'Sengketa', tone: 'red' },
  DIBATALKAN: { label: 'Dibatalkan', tone: 'neutral' },
  REFUND: { label: 'Refund', tone: 'red' },
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const m = map[status];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
