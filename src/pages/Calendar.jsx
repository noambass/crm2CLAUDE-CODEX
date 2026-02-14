import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { JobStatusBadge, NextActionBadge } from '@/components/ui/DynamicStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { toast } from 'sonner';
import { queryClientInstance } from '@/lib/query-client';
import {
  listScheduledJobs,
  listUnscheduledJobs,
  rescheduleJob,
  setJobSchedule,
} from '@/data/calendarRepo';
import { buildTenMinuteTimeOptions, isTenMinuteSlot, toTenMinuteSlot } from '@/lib/time/timeSlots';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { useUiPreferences } from '@/lib/ui/useUiPreferences';
import { useIsMobile } from '@/lib/ui/useIsMobile';

const TIME_OPTIONS_10_MIN = buildTenMinuteTimeOptions();
const DEFAULT_SCHEDULE_TIME = '08:00';
const WEEK_DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const getScheduledAt = (job) => job?.scheduled_start_at || null;

const getClientName = (job) => {
  const account = Array.isArray(job?.accounts) ? job.accounts[0] : job?.accounts;
  return job?.client_name || job?.account_name || account?.account_name || 'ללא לקוח';
};

function normalizeCalendarJob(job) {
  const scheduledAt = getScheduledAt(job);
  const parsedDate = scheduledAt ? new Date(scheduledAt) : null;

  return {
    ...job,
    scheduled_start_at: scheduledAt,
    scheduled_date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? format(parsedDate, 'yyyy-MM-dd') : '',
    scheduled_time: parsedDate && !Number.isNaN(parsedDate.getTime()) ? toTenMinuteSlot(format(parsedDate, 'HH:mm')) : '',
    client_name: getClientName(job),
    address: job?.address || job?.address_text || '',
  };
}

function buildWazeUrl(job) {
  const lat = Number(job?.lat);
  const lng = Number(job?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }
  const address = encodeURIComponent(job?.address_text || job?.address || '');
  return `https://waze.com/ul?q=${address}&navigate=yes`;
}

export default function Calendar() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const { preferences, setPreference } = useUiPreferences();
  const isMobile = useIsMobile();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [mobileSelectedDay, setMobileSelectedDay] = useState(new Date());
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggingJobId, setDraggingJobId] = useState(null);

  const [selectedDay, setSelectedDay] = useState(null);
  const [dayJobsModalOpen, setDayJobsModalOpen] = useState(false);
  const [dayJobs, setDayJobs] = useState([]);

  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: DEFAULT_SCHEDULE_TIME });
  const [selectedJobForSchedule, setSelectedJobForSchedule] = useState(null);

  const [dragConfirmOpen, setDragConfirmOpen] = useState(false);
  const [dragScheduleTarget, setDragScheduleTarget] = useState(null);

  const mobileCalendarView = preferences.mobileCalendarView || 'week';
  const isMobileWeekView = isMobile && mobileCalendarView === 'week';

  const getJobScheduledDate = useCallback((job) => {
    const scheduledAt = getScheduledAt(job);
    if (!scheduledAt) return null;
    const parsed = new Date(scheduledAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return null;
  }, []);

  const getJobsForDay = useCallback(
    (day, sourceJobs = jobs) =>
      sourceJobs.filter((job) => {
        const scheduledDate = getJobScheduledDate(job);
        return scheduledDate && isSameDay(scheduledDate, day);
      }),
    [jobs, getJobScheduledDate]
  );

  const loadJobs = useCallback(async () => {
    if (!user) {
      setJobs([]);
      return [];
    }

    setLoading(true);
    try {
      const anchorDate = isMobileWeekView ? mobileSelectedDay : currentDate;
      const rangeStart = isMobileWeekView
        ? startOfWeek(anchorDate, { locale: he })
        : startOfWeek(startOfMonth(anchorDate), { locale: he });
      const rangeEnd = isMobileWeekView
        ? endOfWeek(anchorDate, { locale: he })
        : endOfWeek(endOfMonth(anchorDate), { locale: he });

      const [scheduledRows, unscheduledRows] = await Promise.all([
        listScheduledJobs(rangeStart.toISOString(), rangeEnd.toISOString()),
        listUnscheduledJobs(),
      ]);

      const byId = new Map();
      for (const row of unscheduledRows || []) byId.set(row.id, normalizeCalendarJob(row));
      for (const row of scheduledRows || []) byId.set(row.id, normalizeCalendarJob(row));

      const merged = Array.from(byId.values());
      setJobs(merged);
      return merged;
    } catch (error) {
      console.error('Error loading jobs:', error);
      toast.error('שגיאה בטעינת עבודות', {
        description: getDetailedErrorReason(error, 'נסה שוב בעוד רגע'),
        duration: 5000,
      });
      return [];
    } finally {
      setLoading(false);
    }
  }, [currentDate, isMobileWeekView, mobileSelectedDay, user]);

  useEffect(() => {
    if (!user) return;
    loadJobs();
  }, [loadJobs, user]);

  useEffect(() => {
    if (!isMobile) return;
    if (!preferences.mobileCalendarView) {
      setPreference('mobileCalendarView', 'week');
    }
    if (!preferences.mobileWeekStyle) {
      setPreference('mobileWeekStyle', 'day_carousel');
    }
  }, [isMobile, preferences.mobileCalendarView, preferences.mobileWeekStyle, setPreference]);

  const refreshDayData = useCallback(
    async (dayToRefresh = selectedDay) => {
      const refreshed = await loadJobs();
      if (dayToRefresh) {
        setDayJobs(getJobsForDay(dayToRefresh, refreshed));
      }
    },
    [getJobsForDay, loadJobs, selectedDay]
  );

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: he });
  const calendarEnd = endOfWeek(monthEnd, { locale: he });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const mobileWeekStart = startOfWeek(mobileSelectedDay, { locale: he });
  const mobileWeekEnd = endOfWeek(mobileSelectedDay, { locale: he });
  const mobileWeekDays = eachDayOfInterval({ start: mobileWeekStart, end: mobileWeekEnd });

  const unscheduledJobs = useMemo(() => jobs.filter((job) => !getJobScheduledDate(job)), [jobs, getJobScheduledDate]);
  const selectedMobileDayJobs = useMemo(() => getJobsForDay(mobileSelectedDay), [getJobsForDay, mobileSelectedDay]);

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setMobileSelectedDay(now);
  };

  const goPrevWeek = () => setMobileSelectedDay((prev) => subDays(prev, 7));
  const goNextWeek = () => setMobileSelectedDay((prev) => addDays(prev, 7));

  const openDayModal = (day) => {
    if (isMobileWeekView) {
      setMobileSelectedDay(day);
      return;
    }

    setSelectedDay(day);
    setDayJobs(getJobsForDay(day));
    setDayJobsModalOpen(true);
  };

  const openScheduleDialog = (job, dateValue = '') => {
    const scheduledDate = getJobScheduledDate(job);
    setSelectedJobForSchedule(job);
    setScheduleData({
      date: dateValue || (scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : ''),
      time:
        toTenMinuteSlot(job.scheduled_time || (scheduledDate ? format(scheduledDate, 'HH:mm') : DEFAULT_SCHEDULE_TIME))
        || DEFAULT_SCHEDULE_TIME,
    });
    setScheduleDialogOpen(true);
  };

  const handleScheduleJob = async () => {
    if (!selectedJobForSchedule || !scheduleData.date || !scheduleData.time) return;
    if (!isTenMinuteSlot(scheduleData.time)) {
      toast.error('יש לבחור שעה בקפיצות של 10 דקות');
      return;
    }

    const targetJob = selectedJobForSchedule;
    const previous = {
      status: targetJob.status,
      scheduled_start_at: targetJob.scheduled_start_at || null,
    };

    try {
      const scheduledAt = new Date(`${scheduleData.date}T${scheduleData.time}`).toISOString();
      const result = await rescheduleJob(targetJob.id, scheduledAt, targetJob.status);

      setScheduleDialogOpen(false);
      setScheduleData({ date: '', time: DEFAULT_SCHEDULE_TIME });
      setSelectedJobForSchedule(null);

      setJobs((prev) =>
        prev.map((job) =>
          job.id === targetJob.id
            ? {
                ...job,
                scheduled_start_at: result.scheduled_start_at,
                status: result.status,
                scheduled_date: scheduleData.date,
                scheduled_time: scheduleData.time,
              }
            : job
        )
      );

      await refreshDayData(isMobileWeekView ? mobileSelectedDay : selectedDay);

      toast.success('התזמון עודכן בהצלחה', {
        action: {
          label: 'בטל',
          onClick: async () => {
            try {
              await setJobSchedule(targetJob.id, previous.scheduled_start_at, previous.status);
              await refreshDayData(isMobileWeekView ? mobileSelectedDay : selectedDay);
            } catch (error) {
              toast.error('שחזור תזמון נכשל', {
                description: getDetailedErrorReason(error, 'לא הצלחנו לשחזר את התזמון הקודם.'),
              });
            }
          },
        },
      });

      queryClientInstance.invalidateQueries({ queryKey: ['calendar'] });
      queryClientInstance.invalidateQueries({ queryKey: ['jobs'] });
    } catch (error) {
      console.error('Error scheduling job:', error);
      toast.error('שגיאה בעדכון תזמון', {
        description: getDetailedErrorReason(error, 'נסה שוב בעוד רגע'),
        duration: 5000,
      });
    }
  };

  const handleDayDrop = (day, jobId) => {
    if (isMobile) return;
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
    setDragScheduleTarget({
      day,
      job,
      time: DEFAULT_SCHEDULE_TIME,
    });
    setDragConfirmOpen(true);
  };

  const confirmDragSchedule = async () => {
    if (!dragScheduleTarget) return;

    const targetDate = format(dragScheduleTarget.day, 'yyyy-MM-dd');
    const targetTime = dragScheduleTarget.time || DEFAULT_SCHEDULE_TIME;
    const previous = {
      status: dragScheduleTarget.job.status,
      scheduled_start_at: dragScheduleTarget.job.scheduled_start_at || null,
    };

    try {
      const scheduledAt = new Date(`${targetDate}T${targetTime}`).toISOString();
      await rescheduleJob(dragScheduleTarget.job.id, scheduledAt, dragScheduleTarget.job.status);
      setDragConfirmOpen(false);
      setDragScheduleTarget(null);
      await refreshDayData(dragScheduleTarget.day);
      queryClientInstance.invalidateQueries({ queryKey: ['calendar'] });
      queryClientInstance.invalidateQueries({ queryKey: ['jobs'] });

      toast.success('העבודה תוזמנה בהצלחה', {
        action: {
          label: 'בטל',
          onClick: async () => {
            try {
              await setJobSchedule(
                dragScheduleTarget.job.id,
                previous.scheduled_start_at,
                previous.status
              );
              await refreshDayData(dragScheduleTarget.day);
            } catch (error) {
              toast.error('שחזור תזמון נכשל', {
                description: getDetailedErrorReason(error, 'לא הצלחנו לשחזר את התזמון הקודם.'),
              });
            }
          },
        },
      });
    } catch (error) {
      console.error('Error drag-scheduling job:', error);
      toast.error('שגיאה בעדכון תזמון', {
        description: getDetailedErrorReason(error, 'נסה שוב בעוד רגע'),
      });
    }
  };

  const renderJobCard = (job, { compact = false } = {}) => {
    return (
      <Card key={job.id} className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h4 className="truncate font-semibold text-slate-800 dark:text-slate-100">{job.title}</h4>
              <p className="truncate text-sm text-slate-600 dark:text-slate-300">{job.client_name}</p>
              {job.address ? (
                <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{job.address}</span>
                </div>
              ) : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <JobStatusBadge status={job.status} />
                {!compact ? <NextActionBadge status={job.status} /> : null}
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openScheduleDialog(job, format(isMobileWeekView ? mobileSelectedDay : new Date(), 'yyyy-MM-dd'))}
              >
                <Clock className="ml-1 h-4 w-4" />
                תזמון
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
              >
                פרטים מלאים
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => window.open(buildWazeUrl(job), '_blank')}
              >
                <ExternalLink className="ml-1 h-4 w-4" />
                Waze
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoadingAuth) return <LoadingSpinner />;
  if (!user) return null;
  if (loading) return <LoadingSpinner />;

  return (
    <div data-testid="calendar-page" dir="rtl" className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
            <CalendarIcon className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">לוח שנה</h1>
            <p className="text-slate-500 dark:text-slate-300">תזמונים, עומסים ופעולות מהירות</p>
          </div>
        </div>
        <Button onClick={() => navigate(createPageUrl('JobForm'))} className="bg-[#00214d] hover:bg-[#00214d]/90">
          <Plus className="ml-2 h-4 w-4" />
          עבודה חדשה
        </Button>
      </div>

      {isMobile ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              <Button
                size="sm"
                variant={mobileCalendarView === 'week' ? 'default' : 'ghost'}
                className={mobileCalendarView === 'week' ? 'bg-[#00214d] text-white hover:bg-[#00214d]/90' : ''}
                onClick={() => setPreference('mobileCalendarView', 'week')}
              >
                שבוע
              </Button>
              <Button
                size="sm"
                variant={mobileCalendarView === 'month' ? 'default' : 'ghost'}
                className={mobileCalendarView === 'month' ? 'bg-[#00214d] text-white hover:bg-[#00214d]/90' : ''}
                onClick={() => setPreference('mobileCalendarView', 'month')}
              >
                חודש
              </Button>
            </div>

            {isMobileWeekView ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="icon" onClick={goPrevWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {format(mobileWeekStart, 'dd/MM', { locale: he })} - {format(mobileWeekEnd, 'dd/MM', { locale: he })}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">{format(mobileSelectedDay, 'MMMM yyyy', { locale: he })}</p>
                  </div>
                  <Button variant="outline" size="icon" onClick={goNextWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>

                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {mobileWeekDays.map((day, idx) => {
                    const active = isSameDay(day, mobileSelectedDay);
                    const jobsCount = getJobsForDay(day).length;
                    return (
                      <button
                        key={format(day, 'yyyy-MM-dd')}
                        type="button"
                        onClick={() => setMobileSelectedDay(day)}
                        className={`shrink-0 rounded-xl border px-3 py-2 text-center transition ${
                          active
                            ? 'border-[#00214d] bg-[#00214d] text-white'
                            : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        <div className="text-xs font-medium">{WEEK_DAY_LABELS[idx]}</div>
                        <div className="text-sm font-bold">{format(day, 'd')}</div>
                        <div className={`text-[10px] ${active ? 'text-white/90' : 'text-slate-500 dark:text-slate-300'}`}>
                          {jobsCount} עבודות
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button variant="outline" onClick={handleToday}>היום</Button>

                <div className="space-y-3">
                  {selectedMobileDayJobs.length === 0 ? (
                    <Card className="border-0 bg-slate-50 shadow-none dark:bg-slate-800/60">
                      <CardContent className="p-4 text-center text-sm text-slate-500 dark:text-slate-300">
                        אין עבודות מתוזמנות ליום זה.
                      </CardContent>
                    </Card>
                  ) : (
                    selectedMobileDayJobs.map((job) => renderJobCard(job))
                  )}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {unscheduledJobs.length > 0 ? (
        <Card className="border-0 border-l-4 border-l-amber-500 bg-amber-50 shadow-sm dark:bg-amber-950/20">
          <CardContent className="p-4">
            <h3 className="mb-3 font-semibold text-amber-900 dark:text-amber-200">עבודות לא מתוזמנות ({unscheduledJobs.length})</h3>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {unscheduledJobs.slice(0, 12).map((job) => (
                <Card
                  key={job.id}
                  data-testid={`calendar-unscheduled-${job.id}`}
                  draggable={!isMobile}
                  onDragStart={(event) => {
                    if (isMobile) return;
                    event.dataTransfer.setData('text/job-id', job.id);
                    setDraggingJobId(job.id);
                  }}
                  onDragEnd={() => setDraggingJobId(null)}
                  className={`border-0 shadow-sm transition hover:shadow-md ${
                    !isMobile ? 'cursor-grab' : 'cursor-pointer'
                  } ${draggingJobId === job.id ? 'ring-2 ring-amber-500' : ''}`}
                  onClick={() => {
                    if (!isMobile) return;
                    openScheduleDialog(job, format(mobileSelectedDay, 'yyyy-MM-dd'));
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{job.title}</h4>
                        <p className="truncate text-xs text-slate-600 dark:text-slate-300">{job.client_name}</p>
                        {job.address ? (
                          <div className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{job.address}</span>
                          </div>
                        ) : null}
                        <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                          {isMobile ? 'הקש לתזמון מהיר ביום הנבחר' : 'גרור ליום בלוח לתזמון מהיר (08:00)'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <JobStatusBadge status={job.status} />
                        <NextActionBadge status={job.status} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isMobile || mobileCalendarView === 'month' ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{format(currentDate, 'MMMM yyyy', { locale: he })}</h2>
              <Button variant="outline" onClick={handleToday}>היום</Button>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {WEEK_DAY_LABELS.map((day) => (
                <div key={day} className="py-2 text-center font-semibold text-slate-600 dark:text-slate-300">
                  {day}
                </div>
              ))}

              {calendarDays.map((day) => {
                const dayJobsForCell = getJobsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDayToday = isToday(day);

                return (
                  <div
                    key={format(day, 'yyyy-MM-dd')}
                    data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                    onClick={() => openDayModal(day)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (isMobile) return;
                      const jobId = event.dataTransfer.getData('text/job-id');
                      if (jobId) handleDayDrop(day, jobId);
                    }}
                    className={`min-h-28 cursor-pointer rounded-lg border p-2 transition ${
                      isDayToday
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 dark:border-slate-700 dark:hover:bg-slate-800/60'
                    } ${!isCurrentMonth ? 'opacity-40' : ''}`}
                  >
                    <div className={`mb-2 text-sm font-medium ${isDayToday ? 'text-emerald-600' : 'text-slate-600 dark:text-slate-300'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayJobsForCell.slice(0, 2).map((job) => (
                        <div
                          key={job.id}
                          data-testid={`calendar-day-job-${job.id}`}
                          className="rounded border border-slate-200 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="truncate font-medium text-slate-700 dark:text-slate-100">{job.title}</div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] text-slate-500 dark:text-slate-300">{job.scheduled_time || '--:--'}</span>
                            <JobStatusBadge status={job.status} />
                          </div>
                        </div>
                      ))}
                      {dayJobsForCell.length > 2 ? (
                        <div className="text-center text-xs font-medium text-emerald-700 dark:text-emerald-300">+{dayJobsForCell.length - 2} נוספות</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={dayJobsModalOpen} onOpenChange={setDayJobsModalOpen}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>עבודות ליום {selectedDay ? format(selectedDay, 'dd/MM/yyyy') : ''}</DialogTitle>
          </DialogHeader>

          <div className="mb-3 flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                navigate(
                  createPageUrl(`JobForm?date=${selectedDay ? format(selectedDay, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}`)
                )
              }
            >
              <Plus className="ml-1 h-4 w-4" />
              עבודה חדשה ליום זה
            </Button>
          </div>

          <div className="space-y-3">
            {dayJobs.length === 0 ? (
              <Card className="border-0 bg-slate-50 shadow-none dark:bg-slate-800/60">
                <CardContent className="p-4 text-center text-sm text-slate-500 dark:text-slate-300">
                  אין עבודות מתוזמנות ליום זה.
                </CardContent>
              </Card>
            ) : (
              dayJobs.map((job) => renderJobCard(job, { compact: true }))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>תזמון עבודה: {selectedJobForSchedule?.title || ''}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-date">תאריך</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleData.date}
                onChange={(event) => setScheduleData((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-time">שעה (24H, קפיצות של 10 דקות)</Label>
              <select
                id="schedule-time"
                value={scheduleData.time}
                onChange={(event) => setScheduleData((prev) => ({ ...prev, time: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="">בחר שעה...</option>
                {TIME_OPTIONS_10_MIN.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              ביטול
            </Button>
            <Button
              onClick={handleScheduleJob}
              disabled={!scheduleData.date || !scheduleData.time}
              className="bg-[#00214d] text-white hover:bg-[#00214d]/90"
            >
              שמור תזמון
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dragConfirmOpen} onOpenChange={setDragConfirmOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>לאשר תזמון מהיר?</AlertDialogTitle>
            <AlertDialogDescription>
              העבודה תתוזמן לתאריך {dragScheduleTarget ? format(dragScheduleTarget.day, 'dd/MM/yyyy') : ''} בשעה {dragScheduleTarget?.time || DEFAULT_SCHEDULE_TIME}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDragSchedule}>אשר תזמון</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
