import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Calendar } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobStatusBadge } from '@/components/ui/DynamicStatusBadge';
import { parseValidScheduledAt } from '@/lib/jobs/scheduleValidity';

function accountNameOf(job) {
  const relation = Array.isArray(job?.accounts) ? job.accounts[0] : job?.accounts;
  return relation?.account_name || 'ללא לקוח';
}

export default function TodayJobsWidget({ data }) {
  const navigate = useNavigate();
  const { todayJobs } = data;

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
            <Calendar className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </span>
          עבודות להיום
          {todayJobs.length > 0 && (
            <span className="mr-auto rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              {todayJobs.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {todayJobs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">אין עבודות מתוזמנות להיום</p>
          </div>
        ) : (
          todayJobs.slice(0, 5).map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
              className="w-full rounded-lg border border-slate-100 bg-slate-50 p-3 text-right transition-all hover:border-emerald-200 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20"
            >
              <div className="font-medium text-slate-800 dark:text-slate-200">{job.title}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{accountNameOf(job)}</div>
              <div className="mt-1 flex items-center justify-between">
                <JobStatusBadge status={job.status} />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {format(parseValidScheduledAt(job.scheduled_start_at), 'HH:mm')}
                </span>
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
