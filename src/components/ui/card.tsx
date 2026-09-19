import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  /** Small muted line under the title. */
  subtitle?: string;
  action?: React.ReactNode;
  /** Remove the inner padding, e.g. for a flush list. */
  flush?: boolean;
}

export function Card({ title, subtitle, action, flush, children, className = '', ...props }: CardProps) {
  return (
    <div
      className={`bg-white rounded-2xl border border-stone-200/70 shadow-soft overflow-hidden ${className}`}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h3 className="font-semibold text-stone-800 truncate">{title}</h3>}
            {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={flush ? '' : `px-4 pb-4 ${title || action ? '' : 'pt-4'}`}>{children}</div>
    </div>
  );
}
