import React from 'react';
import Image from 'next/image';
import { cn } from '../../lib/utils';

const BrandLogo = React.forwardRef(({ 
  className, 
  size = 'md',
  variant = 'default',
  withText = false,
  ...props 
}, ref) => {
  const sizes = {
    sm: { width: 24, height: 24, container: 'h-8 w-8' },
    md: { width: 32, height: 32, container: 'h-10 w-10' },
    lg: { width: 48, height: 48, container: 'h-12 w-12' },
    xl: { width: 64, height: 64, container: 'h-16 w-16' }
  };

  const variants = {
    default: 'rounded-xl brand-gradient p-2 shadow-brand',
    minimal: 'rounded-lg bg-surface p-2',
    ghost: 'rounded-lg p-2',
    card: 'rounded-xl bg-card border border-border p-2 shadow-sm'
  };

  const { width, height, container } = sizes[size];

  return (
    <div 
      ref={ref}
      className={cn(
        'flex items-center justify-center transition-all duration-200',
        container,
        variants[variant],
        className
      )}
      {...props}
    >
      <Image
        src="/logo.svg"
        alt="TeamBuilderz Logo"
        width={width}
        height={height}
        className="object-contain"
        priority
      />
      {withText && (
        <span className="ml-2 font-display font-bold text-lg brand-text-gradient">
          TeamBuilderz
        </span>
      )}
    </div>
  );
});

BrandLogo.displayName = 'BrandLogo';

export { BrandLogo };
