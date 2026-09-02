import { Badge } from './ui/Badge';
import { tierOf } from '@/lib/rating';

export function PerfBadge({ rating }: { rating: number }) {
  const tier = tierOf(rating);
  const tone =
    tier.key === 'SANGAT_BAIK' ? 'green'
    : tier.key === 'BAIK' ? 'blue'
    : tier.key === 'PEMBINAAN' ? 'amber'
    : 'red';
  return (
    <Badge tone={tone as 'green' | 'blue' | 'amber' | 'red'}>
      ★ {rating.toFixed(1)} · {tier.label}
    </Badge>
  );
}
