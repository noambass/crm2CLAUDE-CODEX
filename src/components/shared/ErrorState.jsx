import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ErrorState({
  title = 'אירעה שגיאה בטעינת הנתונים',
  description = 'לא הצלחנו לטעון את המידע כרגע.',
  onRetry,
  retryLabel = 'נסה שוב',
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-4 py-14 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mb-6 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="ml-1 h-4 w-4" />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
