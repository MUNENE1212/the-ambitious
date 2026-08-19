interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  warning?: boolean;
}

export function StatCard({ label, value, icon, warning }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl border p-4 ${warning ? 'border-amber-300 bg-amber-50' : 'border-stone-200'}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">{label}</p>
        {icon && <span className="text-amber-600">{icon}</span>}
      </div>
      <p className={`mt-1 text-2xl font-bold ${warning ? 'text-amber-700' : 'text-stone-800'}`}>{value}</p>
    </div>
  );
}
