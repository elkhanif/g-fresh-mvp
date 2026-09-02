import { cn } from '@/lib/utils';

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue';
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: 'bg-leaf-100 text-leaf-800',
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}
