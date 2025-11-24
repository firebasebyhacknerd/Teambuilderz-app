import React from 'react';
import { cn } from '../../lib/utils';

const BrandTable = React.forwardRef(({ 
  className, 
  striped = false,
  hover = true,
  children,
  ...props 
}, ref) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <table
        ref={ref}
        className={cn(
          'w-full border-collapse bg-card text-sm',
          className
        )}
        {...props}
      >
        {children}
      </table>
    </div>
  );
});

BrandTable.displayName = 'BrandTable';

const BrandTableHeader = React.forwardRef(({ 
  className, 
  ...props 
}, ref) => {
  return (
    <thead
      ref={ref}
      className={cn(
        'bg-surface border-b border-border',
        className
      )}
      {...props}
    />
  );
});

BrandTableHeader.displayName = 'BrandTableHeader';

const BrandTableBody = React.forwardRef(({ 
  className, 
  striped = false,
  hover = true,
  ...props 
}, ref) => {
  return (
    <tbody
      ref={ref}
      className={cn(
        '[&_tr:last-child]:border-0',
        striped && '[&_tr:nth-child(even)]:bg-surface/50',
        hover && '[&_tr:hover]:bg-surface-hover',
        className
      )}
      {...props}
    />
  );
});

BrandTableBody.displayName = 'BrandTableBody';

const BrandTableRow = React.forwardRef(({ 
  className, 
  hover = true,
  ...props 
}, ref) => {
  return (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border transition-colors duration-150',
        hover && 'hover:bg-surface-hover',
        className
      )}
      {...props}
    />
  );
});

BrandTableRow.displayName = 'BrandTableRow';

const BrandTableHead = React.forwardRef(({ 
  className, 
  ...props 
}, ref) => {
  return (
    <th
      ref={ref}
      className={cn(
        'px-4 py-3 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
});

BrandTableHead.displayName = 'BrandTableHead';

const BrandTableCell = React.forwardRef(({ 
  className, 
  ...props 
}, ref) => {
  return (
    <td
      ref={ref}
      className={cn(
        'px-4 py-3 align-middle [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    />
  );
});

BrandTableCell.displayName = 'BrandTableCell';

export { 
  BrandTable, 
  BrandTableHeader, 
  BrandTableBody, 
  BrandTableRow, 
  BrandTableHead, 
  BrandTableCell 
};
