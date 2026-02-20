import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobStatusBadge, PriorityBadge } from '@/components/ui/DynamicStatusBadge';

function accountNameOf(job) {
  const relation = Array.isArray(job?.accounts) ? job.accounts[0] : job?.accounts;
  return relation?.account_name || 'ללא לקוח';
}

export default function UnscheduledJobsWidget({ data }) {
  const navigate = useNavigate();
  const { unscheduledJobs } = data;

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </span>
          עבודות לא מתוזמנות
          {unscheduledJobs.length > 0 && (
            <span className="mr-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
              {unscheduledJobs.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {unscheduledJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <AlertCircle className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">כל העבודות מתוזמנות</p>
          </div>
        ) : (
          unscheduledJobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
              className="w-full rounded-lg border border-slate-100 bg-slate-50 p-3 text-right transition-all hover:border-amber-200 hover:bg-amber-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-amber-800 dark:hover:bg-amber-950/20"
            >
              <div className="font-medium text-slate-800 dark:text-slate-200">{job.title}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{accountNameOf(job)}</div>
              <div className="mt-1 flex items-center justify-between">
                <JobStatusBadge status={job.status} />
                <PriorityBadge priority={job.priority} />
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
