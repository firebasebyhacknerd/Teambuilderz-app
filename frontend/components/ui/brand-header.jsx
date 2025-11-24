import React from 'react';
import { cn } from '../../lib/utils';

const BrandHeader = React.forwardRef(({ 
  className, 
  size = 'lg', 
  gradient = true,
  children, 
  ...props 
}, ref) => {
  const sizeStyles = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
    xl: 'text-3xl',
    '2xl': 'text-4xl',
    '3xl': 'text-5xl'
  };

  const gradientStyles = gradient 
    ? 'bg-gradient-to-r from-tbz-blue to-tbz-orange bg-clip-text text-transparent'
    : 'text-foreground';

  return (
    <h1
      className={cn(
        'font-display font-bold',
        sizeStyles[size],
        gradientStyles,
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </h1>
  );
});

BrandHeader.displayName = 'BrandHeader';

export { BrandHeader };
