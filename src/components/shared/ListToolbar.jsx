import React from 'react';

export default function ListToolbar({ className = '', children }) {
  return (
    <div className={`grid gap-2 rounded-xl border bg-card p-3 shadow-sm lg:p-4 ${className}`}>
      {children}
    </div>
  );
}
