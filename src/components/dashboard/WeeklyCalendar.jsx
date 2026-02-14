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

export default function WeeklyCalendar() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadJobs() {
      const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { locale: he });
      const weekEnd = endOfWeek(weekStart, { locale: he });

      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, status, scheduled_start_at, address_text')
        .gte('scheduled_start_at', weekStart.toISOString())
        .lte('scheduled_start_at', weekEnd.toISOString())
        .order('scheduled_start_at', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error loading weekly jobs:', error);
        return;
      }

      if (mounted) setJobs(data || []);
    }

    loadJobs();
    return () => {
      mounted = false;
    };
  }, [user, weekOffset]);

  if (isLoadingAuth || !user) return null;

  const weekStart = startOfWeek(addDays(new Date(), weekOffset * 7), { locale: he });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <CalendarIcon className="h-5 w-5 text-emerald-500" />
            לוח שבועי
          </CardTitle>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              aria-label="שבוע קודם"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <span className="min-w-36 text-center text-sm text-slate-600">
              {format(weekDays[0], 'dd/MM')} - {format(weekDays[6], 'dd/MM')}
            </span>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              aria-label="שבוע הבא"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <Button type="button" variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              היום
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const dayJobs = jobs.filter(
              (job) => job.scheduled_start_at && isSameDay(new Date(job.scheduled_start_at), day)
            );
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
      </CardContent>
    </Card>
  );
}
