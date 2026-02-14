import React from 'react';
import { format } from 'date-fns';
import { MapPin, Calendar } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JobStatusBadge, PriorityBadge } from '@/components/ui/DynamicStatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { Briefcase } from 'lucide-react';

function getAccountName(job) {
  return job.account_name || job.client_name || 'ללא לקוח';
}

function getAddress(job) {
  return job.address_text || job.address || '';
}

function getScheduledAt(job) {
  return job.scheduled_start_at || job.scheduled_at || null;
}

export function JobsListView({ jobs, navigate }) {
  if (jobs.length === 0) {
    return <EmptyState icon={Briefcase} title="אין עבודות" description="לא נמצאו עבודות התואמות לחיפוש" />;
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <Card
          key={job.id}
          className="group cursor-pointer border-0 shadow-sm transition-all duration-300 hover:shadow-md"
          onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="mb-1 truncate text-sm font-semibold text-slate-800">{job.title}</h3>
                <p className="mb-1 truncate text-xs text-slate-600">{getAccountName(job)}</p>
                {job.description ? <p className="mb-1 line-clamp-1 text-xs text-slate-500">{job.description}</p> : null}
                {getAddress(job) ? (
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{getAddress(job)}</span>
                  </div>
                ) : null}
                {job.arrival_notes ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{job.arrival_notes}</p> : null}
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <JobStatusBadge status={job.status} />
                <PriorityBadge priority={job.priority} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function JobsByStatusView({ jobs, navigate }) {
  const statusOrder = ['quote', 'waiting_schedule', 'waiting_execution', 'done'];
  const statusLabels = {
    quote: 'הצעת מחיר',
    waiting_schedule: 'ממתין לתזמון',
    waiting_execution: 'ממתין לביצוע',
    done: 'בוצע',
  };

  return (
    <div className="space-y-4">
      {statusOrder.map((status) => {
        const items = jobs.filter((job) => job.status === status);
        if (items.length === 0) return null;

        return (
          <div key={status}>
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
              {statusLabels[status]}
              <Badge variant="outline">{items.length}</Badge>
            </h3>
            <div className="space-y-2">
              {items.map((job) => (
                <Card
                  key={job.id}
                  className="cursor-pointer border-0 shadow-sm transition-all hover:shadow-md"
                  onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="mb-1 truncate text-sm font-semibold text-slate-800">{job.title}</h4>
                        <p className="mb-1 truncate text-xs text-slate-600">{getAccountName(job)}</p>
                        {getAddress(job) ? (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{getAddress(job)}</span>
                          </div>
                        ) : null}
                      </div>
                      <PriorityBadge priority={job.priority} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function JobsByClientsView({ jobs, navigate }) {
  const grouped = jobs.reduce((acc, job) => {
    const key = getAccountName(job);
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});

  const sortedAccounts = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'he'));

  return (
    <div className="space-y-4">
      {sortedAccounts.map((accountName) => (
        <div key={accountName}>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            {accountName}
            <Badge variant="outline">{grouped[accountName].length}</Badge>
          </h3>

          <div className="space-y-2">
            {grouped[accountName].map((job) => (
              <Card
                key={job.id}
                className="cursor-pointer border-0 shadow-sm transition-all hover:shadow-md"
                onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h4 className="mb-1 truncate text-sm font-semibold text-slate-800">{job.title}</h4>
                      {job.description ? <p className="mb-1 line-clamp-1 text-xs text-slate-500">{job.description}</p> : null}
                      {getAddress(job) ? (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{getAddress(job)}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <JobStatusBadge status={job.status} />
                      <PriorityBadge priority={job.priority} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function JobsByDateView({ jobs, navigate }) {
  const grouped = jobs.reduce((acc, job) => {
    const scheduledAt = getScheduledAt(job);
    if (!scheduledAt) return acc;

    const key = format(new Date(scheduledAt), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort().reverse();

  return (
    <div className="space-y-4">
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-slate-800">
            {format(new Date(`${dateKey}T00:00:00`), 'EEEE, dd/MM/yyyy')}
            <Badge variant="outline">{grouped[dateKey].length}</Badge>
          </h3>

          <div className="space-y-2">
            {grouped[dateKey]
              .slice()
              .sort((a, b) => new Date(getScheduledAt(a)).getTime() - new Date(getScheduledAt(b)).getTime())
              .map((job) => {
                const scheduledAt = getScheduledAt(job);

                return (
                  <Card
                    key={job.id}
                    className="cursor-pointer border-0 shadow-sm transition-all hover:shadow-md"
                    onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h4 className="mb-1 truncate text-sm font-semibold text-slate-800">{job.title}</h4>
                          <p className="mb-1 truncate text-xs text-slate-600">{getAccountName(job)}</p>
                          {getAddress(job) ? (
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{getAddress(job)}</span>
                            </div>
                          ) : null}
                          {scheduledAt ? (
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <Calendar className="h-3 w-3" />
                              <span>{format(new Date(scheduledAt), 'HH:mm')}</span>
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1">
                          <JobStatusBadge status={job.status} />
                          <PriorityBadge priority={job.priority} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}
