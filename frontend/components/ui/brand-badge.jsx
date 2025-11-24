import React from 'react';
import { Badge } from './badge';
import { cn } from '../../lib/utils';

const BrandBadge = React.forwardRef(({ 
  className, 
  variant = 'default', 
  size = 'default', 
  children, 
  ...props 
}, ref) => {
  const variantStyles = {
    default: 'bg-primary text-primary-foreground border-primary/20',
    secondary: 'bg-secondary text-secondary-foreground border-secondary/20',
    accent: 'bg-accent text-accent-foreground border-accent/20',
    success: 'bg-success text-success-foreground border-success/20',
    warning: 'bg-warning text-warning-foreground border-warning/20',
    destructive: 'bg-destructive text-destructive-foreground border-destructive/20',
    info: 'bg-info text-info-foreground border-info/20',
    outline: 'border-primary text-primary bg-primary/5',
    brand: 'brand-gradient text-white border-transparent'
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    default: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  };

  return (
    <Badge
      className={cn(
        variantStyles[variant],
        sizeStyles[size],
        'rounded-full font-medium transition-all duration-200',
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </Badge>
  );
});

BrandBadge.displayName = 'BrandBadge';

export { BrandBadge };
