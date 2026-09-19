interface StatCardProps {
  label: string;
  value: string;
  /** Small line under the value — a count, a delta, a hint. */
  hint?: string;
  tone?: 'default' | 'positive' | 'negative' | 'accent';
  icon?: React.ReactNode;
}

const tones = {
  default: 'text-stone-800',
  positive: 'text-emerald-600',
  negative: 'text-red-600',
  accent: 'text-gold-600',
};

export function StatCard({ label, value, hint, tone = 'default', icon }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-stone-200/70 shadow-soft p-3.5">
      <div className="flex items-center gap-1.5 text-stone-400">
        {icon}
        <p className="eyebrow truncate">{label}</p>
      </div>
      <p className={`text-lg font-bold mt-1.5 tabular-nums leading-tight ${tones[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-stone-400 mt-0.5 truncate">{hint}</p>}
    </div>
  );
}
