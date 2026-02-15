import React from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { MapPin, Calendar, Clock } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { JobStatusBadge, NextActionBadge, PriorityBadge } from '@/components/ui/DynamicStatusBadge';
import { getStatusPresentation } from '@/lib/workflow/statusPresentation';
import { getLineItemTotal } from '@/lib/jobLineItems';
import EmptyState from '@/components/shared/EmptyState';
import { Briefcase } from 'lucide-react';

function formatMoney(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';
}

function getAccountName(job) {
  return job.account_name || job.client_name || 'ללא לקוח';
}

function getAddress(job) {
  return job.address_text || job.address || '';
}

function getScheduledAt(job) {
  return job.scheduled_start_at || null;
}

function JobCardContent({ job, isExpanded }) {
  const lineItems = Array.isArray(job.line_items) ? job.line_items : [];
  const total = job.total != null ? job.total : lineItems.reduce((sum, item) => sum + getLineItemTotal(item), 0);

  if (!isExpanded) {
    return (
      <>
        <div className="min-w-0 flex-1">
          <h3 className="mb-1 truncate text-sm font-semibold text-foreground">{job.title}</h3>
          <p className="mb-1 truncate text-xs font-medium text-muted-foreground">{getAccountName(job)}</p>
          {job.description ? <p className="mb-1 line-clamp-1 text-xs text-muted-foreground">{job.description}</p> : null}
          {getAddress(job) ? (
            <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{getAddress(job)}</span>
            </div>
          ) : null}
          {getScheduledAt(job) ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>{format(new Date(getScheduledAt(job)), 'dd/MM HH:mm', { locale: he })}</span>
            </div>
          ) : null}
          {job.arrival_notes ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/90">{job.arrival_notes}</p> : null}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          <JobStatusBadge status={job.status} />
          <NextActionBadge status={job.status} />
          <PriorityBadge priority={job.priority} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 truncate text-sm font-semibold text-foreground">{job.title}</h3>
        <p className="mb-1 truncate text-xs font-medium text-muted-foreground">{getAccountName(job)}</p>
        {getAddress(job) ? (
          <div className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{getAddress(job)}</span>
          </div>
        ) : null}
        {getScheduledAt(job) ? (
          <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>{format(new Date(getScheduledAt(job)), 'dd/MM HH:mm', { locale: he })}</span>
          </div>
        ) : null}
        {lineItems.length > 0 ? (
          <div className="mt-2 border-t border-border pt-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">שורות שירות</p>
            <ul className="space-y-1 text-xs">
              {lineItems.map((line, idx) => {
                const qty = Number(line.quantity) || 0;
                const unitPrice = Number(line.unit_price) || 0;
                const lineTotal = getLineItemTotal(line);
                return (
                  <li key={line.id || idx} className="flex justify-between gap-2 text-foreground">
                    <span className="truncate">{line.description || 'שירות'}</span>
                    <span dir="ltr" className="shrink-0">
                      {qty} × ₪{formatMoney(unitPrice)} = ₪{formatMoney(lineTotal)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p dir="ltr" className="mt-1.5 text-sm font-semibold text-foreground">
              סה״כ: ₪{formatMoney(total)}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">אין שורות שירות</p>
        )}
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <JobStatusBadge status={job.status} />
        <NextActionBadge status={job.status} />
        <PriorityBadge priority={job.priority} />
      </div>
    </>
  );
}

export function JobsListView({ jobs, navigate, isExpandedCards }) {
  if (jobs.length === 0) {
    return <EmptyState icon={Briefcase} title="אין עבודות" description="לא נמצאו עבודות התואמות לחיפוש" />;
  }

  const isExpanded = isExpandedCards === true;

  return (
    <div className={isExpanded ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>
      {jobs.map((job) => (
        <Card
          key={job.id}
          className="cursor-pointer border border-border bg-card transition-all duration-200 hover:border-[#00214d]/30 hover:shadow-md dark:hover:border-[#00214d]/40"
          onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
        >
          <CardContent className="p-4">
            <div className={`flex items-start justify-between gap-4 ${isExpanded ? 'flex-col' : ''}`}>
              <JobCardContent job={job} isExpanded={isExpanded} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function JobsByStatusView({ jobs, navigate, isExpandedCards }) {
  const statusOrder = ['quote', 'waiting_schedule', 'waiting_execution', 'done'];
  const isExpanded = isExpandedCards === true;

  return (
    <div className="space-y-6">
      {statusOrder.map((status) => {
        const items = jobs.filter((job) => job.status === status);
        if (items.length === 0) return null;

        const presentation = getStatusPresentation(status);

        return (
          <div key={status}>
            <div
              className="mb-3 flex items-center gap-2 rounded-lg border-s-4 py-1.5 ps-2"
              style={{ borderInlineStartColor: presentation.color }}
            >
              <h3 className="font-semibold text-foreground">{presentation.label}</h3>
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-xs font-semibold">
                {items.length}
              </Badge>
            </div>
            <div className={isExpanded ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>
              {items.map((job) => (
                <Card
                  key={job.id}
                  className="cursor-pointer border border-border bg-card transition-all duration-200 hover:border-[#00214d]/30 hover:shadow-md dark:hover:border-[#00214d]/40"
                  onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                >
                  <CardContent className="p-4">
                    <div className={`flex items-start justify-between gap-4 ${isExpanded ? 'flex-col' : ''}`}>
                      <JobCardContent job={job} isExpanded={isExpanded} />
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

export function JobsByClientsView({ jobs, navigate, isExpandedCards }) {
  const grouped = jobs.reduce((acc, job) => {
    const key = getAccountName(job);
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});

  const sortedAccounts = Object.keys(grouped).sort((a, b) => a.localeCompare(b, 'he'));
  const isExpanded = isExpandedCards === true;

  return (
    <div className="space-y-6">
      {sortedAccounts.map((accountName) => (
        <div key={accountName}>
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 dark:bg-muted/20">
            <h3 className="font-semibold text-foreground">{accountName}</h3>
            <Badge variant="secondary" className="h-5 rounded-full px-2 text-xs font-semibold">
              {grouped[accountName].length}
            </Badge>
          </div>

          <div className={isExpanded ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>
            {grouped[accountName].map((job) => (
              <Card
                key={job.id}
                className="cursor-pointer border border-border bg-card transition-all duration-200 hover:border-[#00214d]/30 hover:shadow-md dark:hover:border-[#00214d]/40"
                onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
              >
                <CardContent className="p-4">
                  <div className={`flex items-start justify-between gap-4 ${isExpanded ? 'flex-col' : ''}`}>
                    <JobCardContent job={job} isExpanded={isExpanded} />
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

export function JobsByDateView({ jobs, navigate, isExpandedCards }) {
  const scheduledJobs = jobs.filter((j) => getScheduledAt(j));
  const unscheduledJobs = jobs.filter((j) => !getScheduledAt(j));
  const isExpanded = isExpandedCards === true;

  const grouped = scheduledJobs.reduce((acc, job) => {
    const scheduledAt = getScheduledAt(job);
    const key = format(new Date(scheduledAt), 'yyyy-MM-dd');
    if (!acc[key]) acc[key] = [];
    acc[key].push(job);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort().reverse();

  function JobCard({ job }) {
    return (
      <Card
        className="cursor-pointer border border-border bg-card transition-all duration-200 hover:border-[#00214d]/30 hover:shadow-md dark:hover:border-[#00214d]/40"
        onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
      >
        <CardContent className="p-4">
          <div className={`flex items-start justify-between gap-4 ${isExpanded ? 'flex-col' : ''}`}>
            <JobCardContent job={job} isExpanded={isExpanded} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => (
        <div key={dateKey}>
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 dark:bg-muted/20">
            <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="font-semibold text-foreground">
              {format(new Date(`${dateKey}T00:00:00`), 'EEEE, dd/MM/yyyy', { locale: he })}
            </h3>
            <Badge variant="secondary" className="h-5 rounded-full px-2 text-xs font-semibold">
              {grouped[dateKey].length}
            </Badge>
          </div>

          <div className={isExpanded ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>
            {grouped[dateKey]
              .slice()
              .sort((a, b) => new Date(getScheduledAt(a)).getTime() - new Date(getScheduledAt(b)).getTime())
              .map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
          </div>
        </div>
      ))}

      {unscheduledJobs.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-lg border-s-4 border-amber-500/70 bg-amber-50/50 px-3 py-2 dark:bg-amber-950/20 dark:border-amber-500/50">
            <Calendar className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <h3 className="font-semibold text-foreground">ללא תאריך מתוזמן</h3>
            <Badge variant="secondary" className="h-5 rounded-full px-2 text-xs font-semibold">
              {unscheduledJobs.length}
            </Badge>
          </div>
          <div className={isExpanded ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-2'}>
            {unscheduledJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
