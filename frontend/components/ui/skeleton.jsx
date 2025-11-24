import React from 'react';

export const Skeleton = ({ className, ...props }) => {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
      {...props}
    />
  );
};

export const CardSkeleton = () => (
  <div className="rounded-lg border bg-card p-6 space-y-4">
    <Skeleton className="h-6 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <Skeleton className="h-10 w-full" />
  </div>
);

export const TableSkeleton = ({ rows = 5, columns = 4 }) => (
  <div className="space-y-3">
    <div className="flex gap-4 p-4 border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex gap-4 p-4">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton key={colIndex} className="h-4 flex-1" />
        ))}
      </div>
    ))}
  </div>
);

export const FormSkeleton = () => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-full" />
    </div>
    <Skeleton className="h-10 w-full" />
  </div>
);



