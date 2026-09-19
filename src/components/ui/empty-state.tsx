interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center
      rounded-2xl border border-dashed border-stone-200 bg-white/50">
      <div className="grid place-items-center w-12 h-12 rounded-2xl bg-stone-100 text-stone-400 mb-3">
        {icon ?? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 12.75h6m-6 3h6m3 3.75V6.108c0-1.135-.845-2.098-1.976-2.192a48.4 48.4 0 00-1.123-.08m-5.8 0A2.251 2.251 0 0113.5 2.25h-3a2.251 2.251 0 00-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 3.836A48.4 48.4 0 005.627 3.916C4.496 4.01 3.75 4.973 3.75 6.108V19.5a2.25 2.25 0 002.25 2.25h12a2.25 2.25 0 002.25-2.25V6.108" />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-stone-700">{title}</h3>
      {description && <p className="mt-1 text-sm text-stone-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
