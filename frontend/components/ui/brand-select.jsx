import React from 'react';
import { Select } from './select';
import { cn } from '../../lib/utils';

const BrandSelect = React.forwardRef(({ 
  className, 
  variant = 'default',
  children,
  ...props 
}, ref) => {
  const variantStyles = {
    default: 'bg-background border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20',
    filled: 'bg-surface border-transparent text-foreground focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20',
    ghost: 'bg-transparent border-transparent text-foreground focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20'
  };

  return (
    <Select
      className={cn(
        'rounded-lg border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variantStyles[variant],
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </Select>
  );
});

BrandSelect.displayName = 'BrandSelect';

export { BrandSelect };
