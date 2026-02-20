import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import { Clock, Briefcase, FileText, UserPlus } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function buildTimeline(jobs, quotes) {
  const events = [];

  (jobs || []).slice(0, 10).forEach((job) => {
    events.push({
      id: `job-${job.id}`,
      type: 'job',
      title: job.title || 'עבודה חדשה',
      subtitle: Array.isArray(job.accounts) ? job.accounts[0]?.account_name : job.accounts?.account_name,
      status: job.status,
      date: new Date(job.created_at),
      url: createPageUrl(`JobDetails?id=${job.id}`),
    });
  });

  (quotes || []).slice(0, 10).forEach((quote) => {
    events.push({
      id: `quote-${quote.id}`,
      type: 'quote',
      title: quote.title || 'הצעת מחיר',
      subtitle: Array.isArray(quote.accounts) ? quote.accounts[0]?.account_name : quote.accounts?.account_name,
      status: quote.status,
      date: new Date(quote.created_at),
      url: createPageUrl(`QuoteDetails?id=${quote.id}`),
    });
  });

  return events.sort((a, b) => b.date - a.date).slice(0, 8);
}

const typeConfig = {
  job: {
    icon: Briefcase,
    label: 'עבודה',
    dotColor: 'bg-blue-500',
    iconBg: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  quote: {
    icon: FileText,
    label: 'הצעת מחיר',
    dotColor: 'bg-violet-500',
    iconBg: 'bg-violet-50 dark:bg-violet-950/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
  },
};

export default function ActivityTimelineWidget({ data }) {
  const navigate = useNavigate();
  const { recentJobs, unconvertedQuotes, allQuotes } = data;
  const timeline = buildTimeline(recentJobs, allQuotes || unconvertedQuotes);

  if (timeline.length === 0) {
    return (
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
              <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </span>
            פעילות אחרונה
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <Clock className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">אין פעילות אחרונה</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
            <Clock className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          </span>
          פעילות אחרונה
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute right-[15px] top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />

          <div className="space-y-4">
            {timeline.map((event) => {
              const config = typeConfig[event.type] || typeConfig.job;
              const Icon = config.icon;

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => navigate(event.url)}
                  className="relative flex w-full items-start gap-3 pr-9 text-right transition-opacity hover:opacity-80"
                >
                  <div className={`absolute right-[9px] top-1 h-3 w-3 rounded-full ${config.dotColor} ring-2 ring-white dark:ring-slate-900`} />
                  <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`rounded p-1 ${config.iconBg}`}>
                          <Icon className={`h-3 w-3 ${config.iconColor}`} />
                        </div>
                        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">
                          {event.title}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                        {formatDistanceToNow(event.date, { addSuffix: true, locale: he })}
                      </span>
                    </div>
                    {event.subtitle && (
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{event.subtitle}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
