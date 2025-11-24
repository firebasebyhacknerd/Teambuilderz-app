import React from 'react';
import { Button } from './button';
import { cn } from '../../lib/utils';

const BrandButton = React.forwardRef(({ 
  className, 
  variant = 'primary', 
  size = 'default', 
  children, 
  ...props 
}, ref) => {
  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active shadow-brand hover:shadow-brand-lg transition-all duration-200',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary-hover transition-all duration-200',
    accent: 'bg-accent text-accent-foreground hover:bg-accent-hover transition-all duration-200',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200',
    ghost: 'text-primary hover:bg-primary/10 transition-all duration-200',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive-hover transition-all duration-200',
    success: 'bg-success text-success-foreground hover:bg-success/90 transition-all duration-200',
    warning: 'bg-warning text-warning-foreground hover:bg-warning/90 transition-all duration-200',
    info: 'bg-info text-info-foreground hover:bg-info/90 transition-all duration-200',
    gradient: 'brand-gradient text-white shadow-brand hover:shadow-brand-lg transition-all duration-200'
  };

  return (
    <Button
      className={cn(variantStyles[variant], className)}
      size={size}
      ref={ref}
      {...props}
    >
      {children}
    </Button>
  );
});

BrandButton.displayName = 'BrandButton';

export { BrandButton };
