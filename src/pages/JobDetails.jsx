import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit,
  ExternalLink,
  ListChecks,
  Mail,
  MapPin,
  Phone,
  Route,
  User,
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getStatusForScheduling } from '@/lib/jobs/schedulingStatus';
import { JOB_ALLOWED_TRANSITIONS } from '@/lib/workflow/statusPolicy';
import { getStatusPresentation } from '@/lib/workflow/statusPresentation';
import { buildTenMinuteTimeOptions, isTenMinuteSlot, toTenMinuteSlot } from '@/lib/time/timeSlots';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { JobStatusBadge, NextActionBadge, PriorityBadge } from '@/components/ui/DynamicStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';

const TIME_OPTIONS_10_MIN = buildTenMinuteTimeOptions();
const DEFAULT_TIME = '08:00';
const JOB_STATUS_ORDER = ['quote', 'waiting_schedule', 'waiting_execution', 'done'];

function findStatusTransitionPath(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) return null;
  if (fromStatus === toStatus) return [];

  const visited = new Set([fromStatus]);
  const queue = [{ status: fromStatus, path: [] }];

  while (queue.length > 0) {
    const current = queue.shift();
    const nextStatuses = JOB_ALLOWED_TRANSITIONS[current.status] || [];

    for (const nextStatus of nextStatuses) {
      const nextPath = [...current.path, nextStatus];
      if (nextStatus === toStatus) return nextPath;
      if (visited.has(nextStatus)) continue;
      visited.add(nextStatus);
      queue.push({ status: nextStatus, path: nextPath });
    }
  }

  return null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('he-IL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getAccountName(job) {
  const relation = Array.isArray(job?.accounts) ? job.accounts[0] : job?.accounts;
  return relation?.account_name || 'ללא לקוח';
}

function buildWazeUrl(job) {
  const lat = Number(job?.lat);
  const lng = Number(job?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  }

  const address = String(job?.address_text || '').trim();
  if (!address) return '';
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

function normalizeJobContact(row) {
  return {
    id: row.id,
    full_name: row.full_name || '',
    phone: row.phone || '',
    notes: row.relation === 'primary' ? '' : row.relation || '',
  };
}

export default function JobDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const { id: routeJobId } = useParams();

  const urlParams = new URLSearchParams(window.location.search);
  const jobId = routeJobId || urlParams.get('id');

  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [job, setJob] = useState(null);
  const [jobContacts, setJobContacts] = useState([]);
  const [clientPrimaryContact, setClientPrimaryContact] = useState(null);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: DEFAULT_TIME });
  const [manualStatus, setManualStatus] = useState('');

  useEffect(() => {
    if (!user || !jobId) return;

    let mounted = true;

    async function loadJobDetails() {
      try {
        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('*, accounts(id, account_name)')
          .eq('id', jobId)
          .single();

        if (jobError) throw jobError;

        const accountId = jobData?.account_id;
        const [contactsRes, clientContactRes] = await Promise.all([
          supabase
            .from('job_contacts')
            .select('id, full_name, phone, relation, sort_order')
            .eq('job_id', jobId)
            .order('sort_order', { ascending: true }),
          accountId
            ? supabase
              .from('contacts')
              .select('id, full_name, phone, email, is_primary, created_at')
              .eq('account_id', accountId)
              .order('is_primary', { ascending: false })
              .order('created_at', { ascending: true })
              .limit(1)
              .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (contactsRes.error) throw contactsRes.error;
        if (clientContactRes.error) throw clientContactRes.error;

        if (!mounted) return;
        setJob(jobData);
        setJobContacts((contactsRes.data || []).map(normalizeJobContact));
        setClientPrimaryContact(clientContactRes.data || null);
      } catch (error) {
        console.error('Error loading job details:', error);
        toast.error('שגיאה בטעינת פרטי עבודה', {
          description: getDetailedErrorReason(error, 'טעינת פרטי העבודה נכשלה.'),
          duration: 9000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadJobDetails();

    return () => {
      mounted = false;
    };
  }, [user, jobId]);

  const scheduledDate = useMemo(() => {
    if (!job?.scheduled_start_at) return null;
    const parsed = new Date(job.scheduled_start_at);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [job]);

  const lineItems = useMemo(() => {
    if (!job) return [];
    return Array.isArray(job.line_items) ? job.line_items : [];
  }, [job]);

  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, line) => {
      const qty = toNumber(line.quantity);
      const price = toNumber(line.unit_price);
      return sum + qty * price;
    }, 0);
  }, [lineItems]);

  const vatAmount = subtotal * 0.18;
  const totalWithVat = subtotal + vatAmount;

  const timeline = useMemo(() => {
    if (!job) return [];

    const events = [
      {
        key: 'created',
        title: 'העבודה נוצרה',
        date: job.created_at,
      },
    ];

    if (job.scheduled_start_at) {
      events.push({
        key: 'scheduled',
        title: 'נקבע תזמון לעבודה',
        date: job.scheduled_start_at,
      });
    }

    if (job.updated_at && job.updated_at !== job.created_at) {
      events.push({
        key: 'updated',
        title: 'עודכן לאחרונה',
        date: job.updated_at,
      });
    }

    if (job.status === 'done') {
      events.push({
        key: 'done',
        title: 'העבודה סומנה כהושלמה',
        date: job.updated_at || job.scheduled_start_at || job.created_at,
      });
    }

    return events
      .filter((event) => event.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [job]);

  useEffect(() => {
    setManualStatus(job?.status || '');
  }, [job?.status]);

  const reachableStatusOptions = useMemo(() => {
    if (!job?.status) return [];
    return JOB_STATUS_ORDER
      .filter((status) => findStatusTransitionPath(job.status, status) !== null)
      .map((status) => ({
        value: status,
        label: getStatusPresentation(status).label,
      }));
  }, [job?.status]);

  function openScheduleDialog() {
    const now = new Date();
    const targetDate = scheduledDate || now;

    setScheduleData({
      date: format(targetDate, 'yyyy-MM-dd'),
      time: toTenMinuteSlot(scheduledDate ? format(scheduledDate, 'HH:mm') : DEFAULT_TIME) || DEFAULT_TIME,
    });
    setScheduleDialogOpen(true);
  }

  async function handleScheduleSave() {
    if (!job || !scheduleData.date || !scheduleData.time) return;

    if (!isTenMinuteSlot(scheduleData.time)) {
      toast.error('יש לבחור שעה בקפיצות של 10 דקות');
      return;
    }

    setScheduling(true);
    try {
      const nextIso = new Date(`${scheduleData.date}T${scheduleData.time}`).toISOString();
      const nextStatus = getStatusForScheduling(job.status);

      const { error } = await supabase
        .from('jobs')
        .update({
          scheduled_start_at: nextIso,
          status: nextStatus,
        })
        .eq('id', job.id);

      if (error) throw error;

      setJob((prev) =>
        prev
          ? {
              ...prev,
              scheduled_start_at: nextIso,
              status: nextStatus,
              updated_at: new Date().toISOString(),
            }
          : prev
      );
      setScheduleDialogOpen(false);

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['map'] });
      toast.success('התזמון נשמר בהצלחה');
    } catch (error) {
      console.error('Error scheduling job:', error);
      toast.error('שגיאה בעדכון תזמון', {
        description: getDetailedErrorReason(error, 'עדכון התזמון נכשל.'),
        duration: 9000,
      });
    } finally {
      setScheduling(false);
    }
  }

  async function handleMarkDone() {
    if (!job || job.status === 'done') return;

    setCompleting(true);
    try {
      const transitionPath = findStatusTransitionPath(job.status, 'done');
      if (!transitionPath) {
        toast.error('המעבר לסטטוס הושלם אינו חוקי מהסטטוס הנוכחי');
        return;
      }

      for (const nextStatus of transitionPath) {
        const { error } = await supabase
          .from('jobs')
          .update({ status: nextStatus })
          .eq('id', job.id);
        if (error) throw error;
      }

      setJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'done',
              updated_at: new Date().toISOString(),
            }
          : prev
      );

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['map'] });
      toast.success('העבודה סומנה כבוצעה');
    } catch (error) {
      console.error('Error marking job as done:', error);
      toast.error('שגיאה בסימון עבודה כבוצעה', {
        description: getDetailedErrorReason(error, 'לא הצלחנו לסמן את העבודה כבוצעה.'),
        duration: 9000,
      });
    } finally {
      setCompleting(false);
    }
  }

  async function handleManualStatusUpdate() {
    if (!job || !manualStatus || manualStatus === job.status) return;

    setStatusUpdating(true);
    try {
      const transitionPath = findStatusTransitionPath(job.status, manualStatus);
      if (!transitionPath) {
        toast.error('מעבר הסטטוס שבחרת אינו חוקי');
        return;
      }

      for (const nextStatus of transitionPath) {
        const { error } = await supabase
          .from('jobs')
          .update({ status: nextStatus })
          .eq('id', job.id);
        if (error) throw error;
      }

      setJob((prev) =>
        prev
          ? {
              ...prev,
              status: manualStatus,
              updated_at: new Date().toISOString(),
            }
          : prev
      );

      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
      queryClient.invalidateQueries({ queryKey: ['map'] });
      toast.success('סטטוס העבודה עודכן ידנית');
    } catch (error) {
      console.error('Error updating job status manually:', error);
      toast.error('שגיאה בעדכון סטטוס עבודה', {
        description: getDetailedErrorReason(error, 'לא הצלחנו לעדכן את סטטוס העבודה.'),
        duration: 9000,
      });
    } finally {
      setStatusUpdating(false);
    }
  }

  const accountName = getAccountName(job);
  const wazeUrl = buildWazeUrl(job);

  if (isLoadingAuth) return <LoadingSpinner />;
  if (!user) return null;
  if (loading) return <LoadingSpinner />;

  if (!job) {
    return (
      <EmptyState
        icon={ListChecks}
        title="עבודה לא נמצאה"
        description="העבודה שביקשת לא קיימת או נמחקה"
      />
    );
  }

  return (
    <div data-testid="job-details-page" dir="rtl" className="mx-auto max-w-5xl space-y-6 p-4 lg:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl('Jobs'))}
          className="rounded-full"
          data-testid="job-details-back"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold text-slate-800 dark:text-slate-100">{job.title || 'עבודה ללא כותרת'}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span className="inline-flex items-center gap-1">
              <User className="h-4 w-4" />
              {accountName}
            </span>
            {job.address_text ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {job.address_text}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <JobStatusBadge status={job.status} />
          <NextActionBadge status={job.status} />
          <PriorityBadge priority={job.priority} />
        </div>
      </div>

      <Card className="sticky top-20 z-20 border border-slate-200 bg-white/95 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <CardContent className="p-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Button
              type="button"
              onClick={openScheduleDialog}
              className="bg-[#00214d] text-white hover:bg-[#00214d]/90"
              disabled={completing}
              data-testid="job-details-schedule-button"
            >
              <CalendarClock className="ml-2 h-4 w-4" />
              תזמן
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={!wazeUrl}
              onClick={() => {
                if (wazeUrl) window.open(wazeUrl, '_blank', 'noopener,noreferrer');
              }}
              data-testid="job-details-waze-button"
            >
              <Route className="ml-2 h-4 w-4" />
              Waze
            </Button>

            <Button
              type="button"
              variant={job.status === 'done' ? 'outline' : 'default'}
              disabled={job.status === 'done' || completing || scheduling}
              onClick={handleMarkDone}
              className={job.status === 'done' ? '' : 'bg-emerald-600 text-white hover:bg-emerald-700'}
              data-testid="job-details-mark-done-button"
            >
              <CheckCircle2 className="ml-2 h-4 w-4" />
              {job.status === 'done' ? 'בוצע' : completing ? 'מסמן...' : 'סמן כבוצע'}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(createPageUrl(`JobForm?id=${job.id}`))}
              disabled={completing}
              data-testid="job-details-edit-button"
            >
              <Edit className="ml-2 h-4 w-4" />
              ערוך עבודה
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
            <select
              data-testid="job-details-manual-status-select"
              value={manualStatus}
              onChange={(event) => setManualStatus(event.target.value)}
              disabled={statusUpdating || completing || scheduling}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {reachableStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              data-testid="job-details-manual-status-save"
              onClick={handleManualStatusUpdate}
              disabled={
                statusUpdating ||
                completing ||
                scheduling ||
                !manualStatus ||
                manualStatus === job.status
              }
            >
              {statusUpdating ? 'מעדכן...' : 'עדכן סטטוס ידנית'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3 lg:[direction:ltr]">
        <Card className="border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-900 lg:col-start-1 lg:col-span-2 lg:[direction:rtl]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">שורות שירות</CardTitle>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {lineItems.length} שורות
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {lineItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
                לא הוגדרו שורות שירות לעבודה זו.
              </div>
            ) : (
              <div className="space-y-4">
                {lineItems.map((line, idx) => {
                  const quantity = toNumber(line.quantity);
                  const unitPrice = toNumber(line.unit_price);
                  const lineTotal = toNumber(line.line_total) || quantity * unitPrice;

                  return (
                    <div key={line.id || idx} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{line.description || 'שירות'}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">שורה #{idx + 1}</p>
                        </div>
                        <div dir="ltr" className="text-lg font-bold text-[#00214d] dark:text-cyan-300">
                          ₪{formatMoney(lineTotal)}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                          <span className="text-slate-500 dark:text-slate-300">כמות: </span>
                          <span className="font-medium text-slate-800 dark:text-slate-100">{quantity}</span>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800" dir="ltr">
                          <span className="text-slate-500 dark:text-slate-300">מחיר יחידה: </span>
                          <span className="font-medium text-slate-800 dark:text-slate-100">₪{formatMoney(unitPrice)}</span>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800" dir="ltr">
                          <span className="text-slate-500 dark:text-slate-300">סה"כ שורה: </span>
                          <span className="font-medium text-slate-800 dark:text-slate-100">₪{formatMoney(lineTotal)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="rounded-2xl border border-[#00214d]/20 bg-gradient-to-br from-[#001335] to-[#00214d] p-4 text-white shadow-lg">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                      <p className="text-xs text-blue-100">לפני מע"מ</p>
                      <p dir="ltr" className="mt-1 text-lg font-semibold">₪{formatMoney(subtotal)}</p>
                    </div>
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                      <p className="text-xs text-blue-100">מע"מ (18%)</p>
                      <p dir="ltr" className="mt-1 text-lg font-semibold">₪{formatMoney(vatAmount)}</p>
                    </div>
                    <div className="rounded-xl bg-white/20 px-3 py-2 ring-1 ring-white/20">
                      <p className="text-xs text-blue-100">סה"כ כולל מע"מ</p>
                      <p dir="ltr" className="mt-1 text-xl font-bold">₪{formatMoney(totalWithVat)}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm lg:col-start-3 lg:[direction:rtl]">
          <CardHeader>
            <CardTitle className="text-lg">פרטי תפעול</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-300">לקוח</p>
              <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">{accountName}</p>
            </div>

            <div className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-300">כתובת עבודה</p>
              <p className="mt-1 font-medium text-slate-800 dark:text-slate-100">{job.address_text || 'לא הוזנה כתובת עבודה'}</p>
            </div>

            {clientPrimaryContact?.phone ? (
              <a
                href={`tel:${clientPrimaryContact.phone}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
              >
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-300">
                  <Phone className="h-4 w-4" />
                  טלפון לקוח
                </span>
                <span dir="ltr" className="font-medium text-blue-700 dark:text-cyan-300">
                  {clientPrimaryContact.phone}
                </span>
              </a>
            ) : null}

            {clientPrimaryContact?.email ? (
              <a
                href={`mailto:${clientPrimaryContact.email}`}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800"
              >
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-300">
                  <Mail className="h-4 w-4" />
                  אימייל לקוח
                </span>
                <span dir="ltr" className="font-medium text-blue-700 dark:text-cyan-300">
                  {clientPrimaryContact.email}
                </span>
              </a>
            ) : null}

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="text-slate-500 dark:text-slate-300">תזמון</span>
              <span>
                {scheduledDate ? format(scheduledDate, 'dd/MM/yyyy HH:mm', { locale: he }) : 'לא מתוזמן'}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="text-slate-500 dark:text-slate-300">סטטוס</span>
              <JobStatusBadge status={job.status} />
            </div>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <span className="text-slate-500 dark:text-slate-300">עדיפות</span>
              <span>{job.priority === 'urgent' ? 'דחוף' : 'רגיל'}</span>
            </div>

            {job.arrival_notes ? (
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-300">הערות הגעה</p>
                <p className="whitespace-pre-wrap">{job.arrival_notes}</p>
              </div>
            ) : null}

            {job.description ? (
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                <p className="mb-1 text-xs text-slate-500 dark:text-slate-300">תיאור עבודה</p>
                <p className="whitespace-pre-wrap">{job.description}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">אנשי קשר</CardTitle>
        </CardHeader>
        <CardContent>
          {jobContacts.length === 0 ? (
            <p className="text-sm text-slate-500">לא הוגדרו אנשי קשר נוספים.</p>
          ) : (
            <div className="space-y-3">
              {jobContacts.map((contact) => (
                <div key={contact.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800 dark:text-slate-100">{contact.full_name || 'איש קשר'}</span>
                    {contact.phone ? (
                      <a
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-1 text-sm text-blue-700 hover:underline dark:text-cyan-300"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {contact.phone}
                      </a>
                    ) : null}
                  </div>
                  {contact.notes ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{contact.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">ציר פעילות</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-500">אין אירועים להצגה.</p>
          ) : (
            <div className="space-y-3">
              {timeline.map((event) => (
                <div key={event.key} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                  <Clock3 className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{event.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      {format(new Date(event.date), 'dd/MM/yyyy HH:mm', { locale: he })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>תזמון עבודה</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="job-details-schedule-date">תאריך</Label>
              <Input
                id="job-details-schedule-date"
                data-testid="job-details-schedule-date"
                type="date"
                value={scheduleData.date}
                onChange={(event) => setScheduleData((prev) => ({ ...prev, date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="job-details-schedule-time">שעה (24H, קפיצות 10 דקות)</Label>
              <select
                id="job-details-schedule-time"
                data-testid="job-details-schedule-time"
                value={scheduleData.time}
                onChange={(event) => setScheduleData((prev) => ({ ...prev, time: event.target.value }))}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
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
              onClick={handleScheduleSave}
              disabled={scheduling || !scheduleData.date || !scheduleData.time}
              className="bg-[#00214d] text-white hover:bg-[#00214d]/90"
              data-testid="job-details-schedule-save"
            >
              {scheduling ? 'שומר...' : 'שמור תזמון'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {wazeUrl ? (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => window.open(wazeUrl, '_blank', 'noopener,noreferrer')}>
            <ExternalLink className="ml-1 h-4 w-4" />
            פתח ניווט ב-Waze
          </Button>
        </div>
      ) : null}
    </div>
  );
}
