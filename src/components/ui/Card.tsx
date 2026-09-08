import { cn } from '@/lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-xl border border-leaf-100 bg-white p-4 shadow-xs', className)}
      {...props}
    />
  );
}
