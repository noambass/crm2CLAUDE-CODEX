import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, isSameDay, endOfWeek, isToday } from 'date-fns';
import { he } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JobStatusBadge } from '@/components/ui/DynamicStatusBadge';
import { useIsMobile } from '@/lib/ui/useIsMobile';
import { parseValidScheduledAt } from '@/lib/jobs/scheduleValidity';

export default function WeeklyCalendar() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const isMobile = useIsMobile(768);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [mobileSelectedDay, setMobileSelectedDay] = useState(new Date());

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadJobs() {
      if (mounted) setLoadingJobs(true);

      try {
        const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { locale: he });
        const weekEnd = endOfWeek(weekStart, { locale: he });

        const { data, error } = await supabase
          .from('jobs')
          .select('id, title, status, scheduled_start_at, address_text')
          .gte('scheduled_start_at', weekStart.toISOString())
          .lte('scheduled_start_at', weekEnd.toISOString())
          .order('scheduled_start_at', { ascending: true, nullsFirst: false });

        if (error) throw error;
        if (mounted) setJobs(data || []);
      } catch (error) {
        console.error('Error loading weekly jobs:', error);
      } finally {
        if (mounted) setLoadingJobs(false);
      }
    }

    loadJobs();
    return () => {
      mounted = false;
    };
  }, [user, weekOffset]);

  if (isLoadingAuth || !user) return null;

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { locale: he });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const selectedDay = weekDays.some((day) => isSameDay(day, mobileSelectedDay)) ? mobileSelectedDay : weekDays[0];

  function getJobsForDay(day) {
    return jobs.filter((job) => {
      const scheduledDate = parseValidScheduledAt(job.scheduled_start_at);
      return scheduledDate && isSameDay(scheduledDate, day);
    });
  }

  const selectedDayJobs = getJobsForDay(selectedDay);

  function goToPrevWeek() {
    setWeekOffset((prev) => prev - 1);
    setMobileSelectedDay((prev) => addDays(prev, -7));
  }

  function goToNextWeek() {
    setWeekOffset((prev) => prev + 1);
    setMobileSelectedDay((prev) => addDays(prev, 7));
  }

  function goToToday() {
    setWeekOffset(0);
    setMobileSelectedDay(new Date());
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <CalendarIcon className="h-5 w-5" />
            </span>
            לוח שבועי
          </CardTitle>

          <div className="flex items-center gap-1 sm:gap-2 rounded-lg bg-muted/50 p-1 dark:bg-muted/30">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goToPrevWeek}
              aria-label="שבוע קודם"
              className="h-8 w-8 shrink-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <span className="min-w-28 flex-1 text-center text-xs font-medium text-foreground sm:min-w-36 sm:text-sm">
              {format(weekDays[0], 'dd/MM')} – {format(weekDays[6], 'dd/MM')}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goToNextWeek}
              aria-label="שבוע הבא"
              className="h-8 w-8 shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant={weekOffset === 0 ? 'default' : 'outline'}
              size="sm"
              onClick={goToToday}
              className="shrink-0 text-xs sm:text-sm"
            >
              היום
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loadingJobs ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
            <p className="text-sm text-muted-foreground">טוען עבודות לשבוע הנבחר...</p>
          </div>
        ) : null}

        {!loadingJobs && isMobile ? (
          <div className="space-y-4">
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {weekDays.map((day) => {
                const dayJobs = getJobsForDay(day);
                const active = isSameDay(day, selectedDay);
                const isTodayCell = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setMobileSelectedDay(day)}
                    className={`min-w-[80px] shrink-0 rounded-xl border-2 px-3 py-2.5 text-center transition-all ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground shadow-md'
                        : isTodayCell
                        ? 'border-emerald-500/60 bg-emerald-50/70 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : 'border-border bg-card text-foreground hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
                      {format(day, 'EEE', { locale: he })}
                    </div>
                    <div className="mt-0.5 text-base font-bold">{format(day, 'd')}</div>
                    <div className={`mt-1 text-[10px] font-medium ${active ? 'opacity-90' : 'text-muted-foreground'}`}>
                      {dayJobs.length} עבודות
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl bg-muted/50 px-4 py-2.5 text-center">
              <span className="text-sm font-medium text-foreground">
                {format(selectedDay, 'EEEE, dd/MM', { locale: he })}
              </span>
            </div>

            <div className="space-y-2">
              {selectedDayJobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
                  <CalendarIcon className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">אין עבודות מתוזמנות ליום זה.</p>
                </div>
              ) : (
                selectedDayJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                    className="group w-full rounded-xl border border-border bg-card p-3.5 text-right shadow-sm transition-all hover:border-emerald-500/40 hover:shadow-md dark:hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">{job.title}</div>
                        {job.address_text ? (
                          <div className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{job.address_text}</span>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">
                        <Clock className="h-3.5 w-3.5" />
                        {format(parseValidScheduledAt(job.scheduled_start_at), 'HH:mm')}
                      </div>
                    </div>
                    <div className="mt-2.5">
                      <JobStatusBadge status={job.status} />
                    </div>
                  </button>
                ))
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-dashed"
              onClick={() => navigate(createPageUrl('Calendar'))}
            >
              <CalendarIcon className="h-4 w-4" />
              מעבר ללוח שנה מלא
            </Button>
          </div>
        ) : null}

        {!loadingJobs && !isMobile ? (
          <div className="overflow-x-auto">
            <div className="min-w-[840px] grid grid-cols-7 gap-3">
              {weekDays.map((day) => {
                const dayJobs = getJobsForDay(day);
                const isTodayCell = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    className={`flex min-h-[240px] flex-col rounded-xl border transition-shadow ${
                      isTodayCell
                        ? 'border-emerald-500/60 bg-emerald-50/70 dark:border-emerald-500/50 dark:bg-emerald-950/30 shadow-sm'
                        : 'border-border bg-card/50 dark:bg-card/30'
                    }`}
                  >
                    <div className={`rounded-t-xl px-3 py-2.5 text-center ${
                      isTodayCell ? 'bg-emerald-500/15 dark:bg-emerald-500/20' : 'bg-muted/40 dark:bg-muted/20'
                    }`}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {format(day, 'EEE', { locale: he })}
                      </div>
                      <div className={`text-sm font-bold ${isTodayCell ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground'}`}>
                        {format(day, 'd')}/{format(day, 'MM')}
                      </div>
                    </div>

                    <div className="flex min-h-[120px] flex-1 flex-col space-y-1.5 p-2">
                      {dayJobs.length === 0 ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-4">
                          <span className="text-[10px] text-muted-foreground">אין עבודות</span>
                        </div>
                      ) : null}
                      {dayJobs.slice(0, 3).map((job) => (
                        <button
                          key={job.id}
                          type="button"
                          onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                          className="group w-full min-w-0 overflow-hidden rounded-lg border border-border/60 bg-background/80 p-2.5 text-right transition-all hover:border-emerald-500/40 hover:bg-emerald-50/50 hover:shadow-sm dark:hover:bg-emerald-950/20"
                        >
                          <div className="flex min-w-0 items-center justify-between gap-1.5 overflow-hidden">
                            <span className="flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(parseValidScheduledAt(job.scheduled_start_at), 'HH:mm')}
                            </span>
                            <div className="min-w-0 overflow-hidden">
                              <JobStatusBadge status={job.status} />
                            </div>
                          </div>
                          <div className="mt-1.5 min-w-0 break-words text-xs font-semibold text-foreground line-clamp-2" title={job.title}>
                            {job.title}
                          </div>
                          {job.address_text ? (
                            <div className="mt-1 flex min-w-0 items-start gap-0.5 text-[10px] text-muted-foreground">
                              <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                              <span className="min-w-0 break-words line-clamp-2" title={job.address_text}>{job.address_text}</span>
                            </div>
                          ) : null}
                        </button>
                      ))}

                      {dayJobs.length > 3 ? (
                        <div className="rounded-lg border border-dashed border-border py-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          +{dayJobs.length - 3} נוספות
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
