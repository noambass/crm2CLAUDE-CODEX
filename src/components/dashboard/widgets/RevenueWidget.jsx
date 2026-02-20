import React from 'react';
import { TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export default function RevenueWidget({ data }) {
  const { stats } = data;
  const revenue = stats.monthlyRevenue || 0;

  return (
    <Card className="border-0 shadow-sm bg-gradient-to-l from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-100 p-3 dark:bg-blue-900/50">
            <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium">הכנסות חודשיות משוערות (כולל מע"מ)</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {stats.doneJobs} עבודות שבוצעו החודש
            </p>
          </div>
        </div>
        <span className="text-2xl font-bold text-blue-700 dark:text-blue-400">
          ₪{revenue.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </CardContent>
    </Card>
  );
}
