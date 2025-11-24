import React from 'react';
import { Card } from './card';
import { cn } from '../../lib/utils';

const BrandCard = React.forwardRef(({ 
  className, 
  variant = 'default', 
  hover = true, 
  children, 
  ...props 
}, ref) => {
  const variantStyles = {
    default: 'bg-card text-card-foreground border-border shadow-md hover:shadow-lg transition-all duration-200',
    elevated: 'bg-card text-card-foreground border-border shadow-lg hover:shadow-xl transition-all duration-200',
    brand: 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-brand hover:shadow-brand-lg transition-all duration-200',
    surface: 'bg-surface text-foreground border-border hover:bg-surface-hover transition-all duration-200',
    glass: 'bg-background/80 backdrop-blur-sm border-border/20 shadow-md hover:shadow-lg transition-all duration-200'
  };

  const hoverStyles = hover ? 'hover:scale-[1.02] hover:border-primary/30' : '';

  return (
    <Card
      className={cn(
        variantStyles[variant],
        hoverStyles,
        'rounded-xl',
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </Card>
  );
});

BrandCard.displayName = 'BrandCard';

export { BrandCard };
