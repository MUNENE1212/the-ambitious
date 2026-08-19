import { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
}

export function Card({ title, action, children, className = '', ...props }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-stone-200 shadow-sm ${className}`} {...props}>
      {(title || action) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
          {title && <h3 className="font-semibold text-stone-800">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
