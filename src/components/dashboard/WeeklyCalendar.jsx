import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, addDays, isSameDay, endOfWeek } from 'date-fns';
import { he } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <CalendarIcon className="h-5 w-5 text-emerald-500" />
            לוח שבועי
          </CardTitle>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goToPrevWeek}
              aria-label="שבוע קודם"
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <span className="min-w-28 flex-1 text-center text-xs text-slate-600 sm:min-w-36 sm:text-sm">
              {format(weekDays[0], 'dd/MM')} - {format(weekDays[6], 'dd/MM')}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={goToNextWeek}
              aria-label="שבוע הבא"
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={goToToday} className="text-xs sm:text-sm">
              היום
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loadingJobs ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            טוען עבודות לשבוע הנבחר...
          </div>
        ) : null}

        {!loadingJobs && isMobile ? (
          <div className="space-y-3">
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {weekDays.map((day) => {
                const dayJobs = getJobsForDay(day);
                const active = isSameDay(day, selectedDay);

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => setMobileSelectedDay(day)}
                    className={`min-w-[84px] shrink-0 rounded-xl border px-3 py-2 text-center transition ${
                      active
                        ? 'border-[#00214d] bg-[#00214d] text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-[11px] font-semibold">{format(day, 'EEE', { locale: he })}</div>
                    <div className="text-base font-bold">{format(day, 'd')}</div>
                    <div className={`text-[10px] ${active ? 'text-white/90' : 'text-slate-500'}`}>
                      {dayJobs.length} עבודות
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              {format(selectedDay, 'EEEE, dd/MM', { locale: he })}
            </div>

            <div className="space-y-2">
              {selectedDayJobs.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                  אין עבודות מתוזמנות ליום זה.
                </div>
              ) : (
                selectedDayJobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-right shadow-sm transition hover:bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-800">{job.title}</div>
                        {job.address_text ? (
                          <div className="mt-0.5 truncate text-xs text-slate-500">{job.address_text}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                        {format(parseValidScheduledAt(job.scheduled_start_at), 'HH:mm')}
                      </div>
                    </div>
                    <div className="mt-2">
                      <JobStatusBadge status={job.status} />
                    </div>
                  </button>
                ))
              )}
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={() => navigate(createPageUrl('Calendar'))}>
              מעבר ללוח שנה מלא
            </Button>
          </div>
        ) : null}

        {!loadingJobs && !isMobile ? (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const dayJobs = getJobsForDay(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  className={`rounded-lg border p-2 ${
                    isToday ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    {format(day, 'EEE', { locale: he })}
                    <div className="text-xs text-slate-500">{format(day, 'dd/MM')}</div>
                  </div>

                  <div className="space-y-1">
                    {dayJobs.slice(0, 2).map((job) => (
                      <button
                        key={job.id}
                        type="button"
                        onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                        className="w-full rounded bg-slate-50 p-1.5 text-right text-xs hover:bg-slate-100"
                      >
                        <div className="truncate font-medium text-slate-800">{job.title}</div>
                        {job.address_text ? (
                          <div className="truncate text-[11px] text-slate-500">{job.address_text}</div>
                        ) : null}
                        <div className="mt-1">
                          <JobStatusBadge status={job.status} />
                        </div>
                      </button>
                    ))}

                    {dayJobs.length > 2 ? (
                      <div className="py-1 text-center text-xs text-emerald-600">+{dayJobs.length - 2}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
