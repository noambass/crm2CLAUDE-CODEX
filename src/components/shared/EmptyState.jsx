import React from 'react';
import { Button } from "@/components/ui/button";

export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-800 mb-2">{title}</h3>
      <p className="text-slate-500 text-center mb-6 max-w-sm">{description}</p>
      {actionLabel && onAction &&
      <Button 
        onClick={onAction}
        
        className="app-cta shadow-lg"
      >
          {actionLabel}
        </Button>
      }
    </div>);

}