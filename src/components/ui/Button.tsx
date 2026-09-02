import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'danger' | 'outline';

const styles: Record<Variant, string> = {
  primary: 'bg-leaf-600 text-white hover:bg-leaf-700 disabled:opacity-50',
  outline: 'border border-leaf-600 text-leaf-700 hover:bg-leaf-50',
  ghost: 'text-leaf-700 hover:bg-leaf-100',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed',
        styles[variant],
        className,
      )}
      {...props}
    />
  );
}
