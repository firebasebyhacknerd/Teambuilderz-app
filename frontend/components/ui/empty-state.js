import { cn } from '../../lib/utils';

const iconClasses = 'h-12 w-12 text-primary';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action = null,
  className,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-10 text-center',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className={iconClasses} aria-hidden="true" />
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
