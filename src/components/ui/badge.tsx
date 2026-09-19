interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold';
  children: React.ReactNode;
}

const badgeVariants = {
  default: 'bg-stone-100 text-stone-600 ring-stone-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  // Title badges (Treasurer, Secretary, ...) — the group's gold accent
  gold: 'bg-gold-50 text-gold-700 ring-gold-200',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold
      ring-1 ring-inset whitespace-nowrap ${badgeVariants[variant]}`}>
      {children}
    </span>
  );
}
