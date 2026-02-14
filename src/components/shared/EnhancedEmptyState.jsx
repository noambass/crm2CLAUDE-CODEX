import React from 'react';
import { Button } from "@/components/ui/button";

export default function EnhancedEmptyState({ 
  icon: Icon, 
  title, 
  description, 
  primaryAction,
  secondaryAction,
  variant = 'default' // default, filtered
}) {
  const iconColors = {
    default: 'text-slate-400',
    filtered: 'text-slate-300'
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {Icon && (
        <div className="mb-6">
          <Icon className={`w-20 h-20 ${iconColors[variant]}`} strokeWidth={1.5} />
        </div>
      )}
      
      <h3 className="text-xl font-semibold text-slate-800 mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-slate-500 mb-6 max-w-md leading-relaxed">
          {description}
        </p>
      )}
      
      <div className="flex flex-col sm:flex-row gap-3">
        {primaryAction && (
          <Button
            onClick={primaryAction.onClick}
            style={{ backgroundColor: '#00214d' }}
            className="hover:opacity-90"
          >
            {primaryAction.label}
          </Button>
        )}
        
        {secondaryAction && (
          <Button
            onClick={secondaryAction.onClick}
            variant="outline"
          >
            {secondaryAction.label}
          </Button>
        )}
      </div>
    </div>
  );
}