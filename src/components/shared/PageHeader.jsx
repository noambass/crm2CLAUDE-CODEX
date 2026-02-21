import React from 'react';
import { cn } from '@/lib/utils';

export default function PageHeader({ title, subtitle, icon: Icon, actions = null, className = '' }) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground lg:text-3xl">
          {Icon ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <span className="truncate">{title}</span>
        </h1>
        {subtitle ? <p className="mt-1 text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
