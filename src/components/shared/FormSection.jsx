import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function FormSection({ title, description, children, contentClassName = '' }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
