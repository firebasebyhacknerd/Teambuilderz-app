import { useId } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTheme } from '../../lib/theme';

const LABEL_CLASSES =
  'text-xs font-semibold uppercase tracking-wide text-muted-foreground';

const OPTION_LABELS = {
  light: 'Light',
  dark: 'Dark',
  system: 'System (Auto)',
};

export function ThemeSelect({ className, hideLabel = false, compact = false }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const selectId = useId();

  const isSystem = theme === 'system';
  const effective = isSystem ? resolvedTheme : theme;

  const mainIcon =
    effective === 'dark' ? (
      <Moon className={compact ? 'h-4 w-4 text-blue-200' : 'h-5 w-5 text-blue-200'} />
    ) : (
      <Sun className={compact ? 'h-4 w-4 text-amber-500' : 'h-5 w-5 text-amber-500'} />
    );

  const overlayIcon =
    effective === 'dark' ? (
      <Moon className={compact ? 'h-3 w-3 text-blue-200' : 'h-4 w-4 text-blue-200'} />
    ) : (
      <Sun className={compact ? 'h-3 w-3 text-amber-500' : 'h-4 w-4 text-amber-500'} />
    );

  const iconWrapperClass = compact
    ? 'h-8 w-8'
    : 'h-9 w-9';
  const selectClass = compact
    ? 'h-8 px-2 text-xs'
    : 'h-9 px-3 text-sm';
  const tooltip =
    isSystem
      ? `System preference (${resolvedTheme === 'dark' ? 'dark' : 'light'})`
      : effective === 'dark'
        ? 'Dark mode'
        : 'Light mode';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label
        htmlFor={selectId}
        className={hideLabel ? 'sr-only' : LABEL_CLASSES}
      >
        Theme
      </label>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-md border border-border bg-card shadow-sm text-muted-foreground',
            iconWrapperClass,
          )}
          aria-hidden="true"
          title={tooltip}
        >
          {theme === 'system' ? (
            <span className="relative flex items-center justify-center">
              <Monitor className={compact ? 'h-4 w-4 text-muted-foreground' : 'h-5 w-5 text-muted-foreground'} />
              <span className="absolute -bottom-1 -right-1 rounded-full border border-border bg-background p-0.5">
                {overlayIcon}
              </span>
            </span>
          ) : (
            mainIcon
          )}
        </span>
        <select
          id={selectId}
          value={theme}
          onChange={(event) => setTheme(event.target.value)}
          className={cn(
            'rounded-md border border-input bg-background text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            selectClass,
          )}
          aria-label="Select theme"
        >
          {Object.entries(OPTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

