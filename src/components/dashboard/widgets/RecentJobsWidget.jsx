import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Briefcase } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { JobStatusBadge } from '@/components/ui/DynamicStatusBadge';

function accountNameOf(job) {
  const relation = Array.isArray(job?.accounts) ? job.accounts[0] : job?.accounts;
  return relation?.account_name || 'ללא לקוח';
}

export default function RecentJobsWidget({ data }) {
  const navigate = useNavigate();
  const { recentJobs } = data;

  return (
    <Card className="border-0 shadow-sm h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <Briefcase className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </span>
          עבודות אחרונות
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentJobs.map((job) => (
          <button
            key={job.id}
            type="button"
            onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
            className="w-full rounded-lg border border-slate-100 bg-slate-50 p-3 text-right transition-all hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-slate-600 dark:hover:bg-slate-800"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-800 dark:text-slate-200">{job.title}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">{accountNameOf(job)}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <JobStatusBadge status={job.status} />
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  {format(new Date(job.created_at), 'dd/MM')}
                </span>
              </div>
            </div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
