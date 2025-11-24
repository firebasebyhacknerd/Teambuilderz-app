import React from 'react';
import { Input } from './input';
import { cn } from '../../lib/utils';

const BrandInput = React.forwardRef(({ 
  className, 
  variant = 'default', 
  error = false,
  ...props 
}, ref) => {
  const variantStyles = {
    default: 'bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20',
    filled: 'bg-surface border-transparent text-foreground placeholder:text-muted-foreground focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20',
    ghost: 'bg-transparent border-transparent text-foreground placeholder:text-muted-foreground focus:bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20'
  };

  const errorStyles = error 
    ? 'border-destructive focus:border-destructive focus:ring-destructive/20' 
    : '';

  return (
    <Input
      className={cn(
        'rounded-lg border transition-all duration-200 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        variantStyles[variant],
        errorStyles,
        className
      )}
      ref={ref}
      {...props}
    />
  );
});

BrandInput.displayName = 'BrandInput';

export { BrandInput };
