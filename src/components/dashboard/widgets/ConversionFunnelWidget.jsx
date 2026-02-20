import React from 'react';
import { GitBranch, ArrowDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ConversionFunnelWidget({ data }) {
  const { allQuotes, allJobs } = data;

  const totalQuotes = allQuotes?.length || 0;
  const sentQuotes = allQuotes?.filter((q) => q.status === 'sent' || q.status === 'approved').length || 0;
  const approvedQuotes = allQuotes?.filter((q) => q.status === 'approved').length || 0;
  const convertedQuotes = allQuotes?.filter((q) => q.converted_job_id).length || 0;

  const conversionRate = totalQuotes > 0 ? ((convertedQuotes / totalQuotes) * 100).toFixed(1) : 0;

  const funnelSteps = [
    { label: 'סה"כ הצעות', count: totalQuotes, color: 'bg-violet-500', width: '100%' },
    { label: 'נשלחו / אושרו', count: sentQuotes, color: 'bg-blue-500', width: totalQuotes > 0 ? `${Math.max((sentQuotes / totalQuotes) * 100, 20)}%` : '20%' },
    { label: 'אושרו', count: approvedQuotes, color: 'bg-emerald-500', width: totalQuotes > 0 ? `${Math.max((approvedQuotes / totalQuotes) * 100, 15)}%` : '15%' },
    { label: 'הומרו לעבודה', count: convertedQuotes, color: 'bg-green-600', width: totalQuotes > 0 ? `${Math.max((convertedQuotes / totalQuotes) * 100, 10)}%` : '10%' },
  ];

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/50">
            <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </span>
          משפך המרה
          <span className="mr-auto rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700 dark:bg-green-900/50 dark:text-green-300">
            {conversionRate}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {totalQuotes === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <GitBranch className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">אין מספיק נתונים</p>
          </div>
        ) : (
          <div className="space-y-2">
            {funnelSteps.map((step, i) => (
              <div key={step.label}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{step.label}</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{step.count}</span>
                </div>
                <div className="h-7 w-full overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-md ${step.color} transition-all duration-500 flex items-center justify-center`}
                    style={{ width: step.width }}
                  >
                    {step.count > 0 && (
                      <span className="text-[10px] font-bold text-white">{step.count}</span>
                    )}
                  </div>
                </div>
                {i < funnelSteps.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
