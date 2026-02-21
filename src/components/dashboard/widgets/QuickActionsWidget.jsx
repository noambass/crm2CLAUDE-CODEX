import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, ArrowUpRight, Calendar, Map } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function QuickActionsWidget() {
  const navigate = useNavigate();

  return (
    <Card className="border-0 bg-gradient-to-l from-primary to-primary/80 shadow-sm">
      <CardContent className="flex flex-col items-start justify-between gap-4 p-6 text-white sm:flex-row sm:items-center">
        <div>
          <h3 className="text-xl font-bold">פעולות מהירות</h3>
          <p className="text-sm text-blue-200">יצירת רשומה חדשה או מעבר מהיר</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(createPageUrl('ClientForm'))}>
            <Users className="ml-1 h-4 w-4" /> לקוח
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(createPageUrl('QuoteForm'))}>
            <FileText className="ml-1 h-4 w-4" /> הצעת מחיר
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(createPageUrl('JobForm'))}>
            <ArrowUpRight className="ml-1 h-4 w-4" /> עבודה
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(createPageUrl('Calendar'))}>
            <Calendar className="ml-1 h-4 w-4" /> לוח שנה
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(createPageUrl('Map'))}>
            <Map className="ml-1 h-4 w-4" /> מפה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
