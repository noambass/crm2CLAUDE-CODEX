import React from 'react';

export default function PageHeader({ title, description, actions, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between ${className}`}>
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground lg:text-3xl">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
