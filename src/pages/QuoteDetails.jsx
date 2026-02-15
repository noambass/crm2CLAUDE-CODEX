import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Edit,
  FileText,
  Loader2,
  Briefcase,
  ExternalLink,
  MapPin,
  ListChecks,
  Clock3,
  User,
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { QUOTE_ALLOWED_TRANSITIONS } from '@/lib/workflow/statusPolicy';

const QUOTE_STATUSES = [
  { value: 'draft', label: 'טיוטה', color: '#64748b' },
  { value: 'sent', label: 'נשלחה', color: '#8b5cf6' },
  { value: 'approved', label: 'אושרה', color: '#10b981' },
  { value: 'rejected', label: 'נדחתה', color: '#ef4444' },
];
const QUOTE_STATUS_ORDER = ['draft', 'sent', 'approved', 'rejected'];

function findQuoteTransitionPath(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) return null;
  if (fromStatus === toStatus) return [];

  const visited = new Set([fromStatus]);
  const queue = [{ status: fromStatus, path: [] }];

  while (queue.length > 0) {
    const current = queue.shift();
    const nextStatuses = QUOTE_ALLOWED_TRANSITIONS[current.status] || [];

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

function formatDateSafe(value) {
  if (!value) return 'לא זמין';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'לא זמין';
  return format(parsed, 'dd/MM/yyyy', { locale: he });
}

function formatDateTimeSafe(value) {
  if (!value) return 'לא מתוזמן';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'לא מתוזמן';
  return format(parsed, 'dd/MM/yyyy HH:mm', { locale: he });
}

export default function QuoteDetails() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isLoadingAuth } = useAuth();
  const { id: routeQuoteId } = useParams();

  const urlParams = new URLSearchParams(window.location.search);
  const quoteId = routeQuoteId || urlParams.get('id');

  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [manualUpdating, setManualUpdating] = useState(false);
  const [advancedStatusOpen, setAdvancedStatusOpen] = useState(false);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    if (!quoteId || !user) return;
    loadQuote();
  }, [quoteId, user]);

  async function loadQuote() {
    if (!quoteId) return;

    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*, accounts(account_name), quote_items(*)')
        .eq('id', quoteId)
        .single();

      if (error) throw error;
      setQuote(data);
    } catch (error) {
      console.error('Error loading quote:', error);
      toast.error('שגיאה בטעינת הצעת המחיר', {
        description: getDetailedErrorReason(error, 'טעינת הצעת המחיר נכשלה.'),
        duration: 9000,
      });
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(nextStatus) {
    if (!quoteId) return;
    setUpdating(true);

    try {
      const { error } = await supabase.from('quotes').update({ status: nextStatus }).eq('id', quoteId);
      if (error) throw error;

      setQuote((prev) => ({ ...prev, status: nextStatus }));
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('הסטטוס עודכן בהצלחה');
    } catch (error) {
      console.error('Error updating quote status:', error);
      toast.error('שגיאה בעדכון סטטוס', {
        description: getDetailedErrorReason(error, 'עדכון הסטטוס נכשל.'),
        duration: 9000,
      });
    } finally {
      setUpdating(false);
    }
  }

  async function convertToJob() {
    if (!quote || !quoteId) return;

    if (quote.converted_job_id) {
      toast.error('הצעה זו כבר הומרה לעבודה');
      return;
    }

    if (quote.status === 'rejected') {
      toast.error('לא ניתן להמיר הצעה שנדחתה לעבודה');
      return;
    }

    setConverting(true);

    try {
      // Conversion RPC requires approved status, so approve implicitly first.
      if (quote.status !== 'approved') {
        const { error: approveError } = await supabase
          .from('quotes')
          .update({ status: 'approved' })
          .eq('id', quoteId);
        if (approveError) throw approveError;
      }

      const { data, error } = await supabase.rpc('convert_quote_to_job', { p_quote_id: quoteId });
      if (error) throw error;

      const createdJobId = typeof data === 'string' ? data : data?.id || data;
      if (!createdJobId) throw new Error('convert_quote_to_job returned empty id');

      setQuote((prev) => ({ ...prev, converted_job_id: createdJobId }));
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });

      toast.success('ההצעה הומרה לעבודה בהצלחה');
      navigate(createPageUrl(`JobDetails?id=${createdJobId}`));
    } catch (error) {
      console.error('Error converting quote to job:', error);
      toast.error('שגיאה בהמרה לעבודה', {
        description: getDetailedErrorReason(error, 'המרת ההצעה לעבודה נכשלה.'),
        duration: 9000,
      });
    } finally {
      setConverting(false);
    }
  }

  const statusCfg = useMemo(() => {
    if (!quote) return { label: '', color: '#64748b' };
    return QUOTE_STATUSES.find((s) => s.value === quote.status) || { label: quote.status, color: '#64748b' };
  }, [quote]);

  const lineItems = useMemo(() => {
    if (!quote) return [];
    const fromItemsTable = Array.isArray(quote.quote_items) ? quote.quote_items : [];
    return [...fromItemsTable].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }, [quote]);

  const manualStatusOptions = useMemo(() => {
    if (!quote || quote.converted_job_id) return [];
    return QUOTE_STATUS_ORDER
      .filter((status) => status !== quote.status)
      .filter((status) => findQuoteTransitionPath(quote.status, status) !== null)
      .map((status) => {
        const statusCfg = QUOTE_STATUSES.find((item) => item.value === status);
        return {
          value: status,
          label: statusCfg?.label || status,
          color: statusCfg?.color || '#64748b',
        };
      });
  }, [quote]);

  async function updateStatusManually(targetStatus) {
    if (!quoteId || !quote) return;
    if (quote.converted_job_id) {
      toast.error('לא ניתן לשנות סטטוס אחרי שהצעה הומרה לעבודה');
      return;
    }
    if (targetStatus === quote.status) return;

    const transitionPath = findQuoteTransitionPath(quote.status, targetStatus);
    if (!transitionPath) {
      toast.error('מעבר הסטטוס שבחרת אינו חוקי');
      return;
    }

    setManualUpdating(true);
    try {
      for (const nextStatus of transitionPath) {
        const { error } = await supabase
          .from('quotes')
          .update({ status: nextStatus })
          .eq('id', quoteId);
        if (error) throw error;
      }

      setQuote((prev) => (prev ? { ...prev, status: targetStatus } : prev));
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('סטטוס ההצעה עודכן ידנית');
    } catch (error) {
      console.error('Error updating quote status manually:', error);
      toast.error('שגיאה בעדכון סטטוס הצעה', {
        description: getDetailedErrorReason(error, 'עדכון הסטטוס הידני נכשל.'),
        duration: 9000,
      });
    } finally {
      setManualUpdating(false);
    }
  }

  if (isLoadingAuth) return <LoadingSpinner />;
  if (!user) return null;
  if (loading) return <LoadingSpinner />;

  if (!quote) {
    return (
      <EmptyState
        icon={FileText}
        title="הצעה לא נמצאה"
        description="הצעת המחיר המבוקשת לא נמצאה במערכת"
      />
    );
  }

  const canEdit = quote.status === 'draft' && !quote.converted_job_id;
  const canConvert = !quote.converted_job_id && quote.status !== 'rejected';
  const canReject = !quote.converted_job_id
    && quote.status !== 'rejected'
    && findQuoteTransitionPath(quote.status, 'rejected') !== null;
  const statusControlsLocked = Boolean(quote.converted_job_id);
  const subtotal = Number(quote.total || 0);
  const vatAmount = subtotal * 0.18;
  const grossTotal = subtotal + vatAmount;
  const quoteNumber = quote.id ? String(quote.id).split('-')[0].toUpperCase() : '---';
  const hasAnyDetails = Boolean(
    quote.title
    || quote.description
    || quote.address_text
    || quote.arrival_notes
    || quote.scheduled_start_at,
  );

  return (
    <div dir="rtl" className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8">
      <Card className="overflow-hidden border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 p-4 sm:p-5 dark:border-slate-800">
            <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Quotes'))} className="rounded-full">
              <ArrowRight className="h-5 w-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">פרטי הצעת מחיר</h1>
              <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <User className="h-4 w-4" />
                {quote.accounts?.account_name || 'ללא לקוח'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? (
                <Button
                  data-testid="quote-edit-draft"
                  variant="outline"
                  className="border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  onClick={() => navigate(createPageUrl(`QuoteForm?id=${quote.id}`))}
                >
                  <Edit className="ml-2 h-4 w-4" />
                  ערוך טיוטה
                </Button>
              ) : null}
              {quote.converted_job_id ? (
                <Button
                  variant="outline"
                  className="border-slate-300 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                  onClick={() => navigate(createPageUrl(`JobDetails?id=${quote.converted_job_id}`))}
                >
                  <ExternalLink className="ml-2 h-4 w-4" />
                  פתח עבודה
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs text-slate-500 dark:text-slate-300">מספר הצעה</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{quoteNumber}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs text-slate-500 dark:text-slate-300">סטטוס נוכחי</p>
              <Badge
                variant="outline"
                style={{
                  backgroundColor: `${statusCfg.color}20`,
                  color: statusCfg.color,
                  borderColor: statusCfg.color,
                }}
                className="mt-1 font-medium"
              >
                {statusCfg.label}
              </Badge>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/70">
              <p className="text-xs text-slate-500 dark:text-slate-300">נוצרה בתאריך</p>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatDateSafe(quote.created_at)}</p>
            </div>
            <div className="rounded-xl border border-[#00214d]/20 bg-gradient-to-br from-[#001335] to-[#00214d] px-3 py-2 text-white dark:border-cyan-500/30 dark:from-slate-900 dark:to-[#1b4f84]">
              <p className="text-xs text-blue-100">סה"כ כולל מע"מ</p>
              <p className="mt-1 text-lg font-bold" dir="ltr">₪{grossTotal.toFixed(2)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <Card className="border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">שורות שירות</CardTitle>
                <Badge variant="outline" className="border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <ListChecks className="ml-1 h-3.5 w-3.5" />
                  {lineItems.length} שורות
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {lineItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  אין שורות בהצעה זו
                </div>
              ) : (
                <div className="space-y-4">
                  {lineItems.map((item, idx) => {
                    const qty = Number(item.quantity) || 0;
                    const unit = Number(item.unit_price) || 0;
                    const lineTotal = Number(item.line_total) || qty * unit;

                    return (
                      <div
                        key={item.id || idx}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-100">{item.description || 'שירות'}</p>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">שורה #{idx + 1}</p>
                          </div>
                          <div className="rounded-xl bg-[#00214d]/10 px-3 py-1.5 dark:bg-cyan-500/15">
                            <p dir="ltr" className="text-lg font-bold text-[#00214d] dark:text-cyan-300">
                              ₪{lineTotal.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs sm:px-3 sm:text-sm dark:border-slate-700 dark:bg-slate-800">
                            <span className="text-slate-500 dark:text-slate-300">כמות: </span>
                            <span className="font-medium text-slate-800 dark:text-slate-100">{qty}</span>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs sm:px-3 sm:text-sm dark:border-slate-700 dark:bg-slate-800" dir="ltr">
                            <span className="text-slate-500 dark:text-slate-300">יחידה: </span>
                            <span className="font-medium text-slate-800 dark:text-slate-100">₪{unit.toFixed(2)}</span>
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs sm:px-3 sm:text-sm dark:border-slate-700 dark:bg-slate-800" dir="ltr">
                            <span className="text-slate-500 dark:text-slate-300">סה"כ: </span>
                            <span className="font-medium text-slate-800 dark:text-slate-100">₪{lineTotal.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="rounded-2xl border border-[#00214d]/20 bg-gradient-to-br from-[#001335] to-[#00214d] p-3 text-white shadow-lg sm:p-4 dark:border-cyan-500/30 dark:from-slate-900 dark:to-[#1b4f84]">
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div className="rounded-xl bg-white/10 px-2 py-2 sm:px-3">
                        <p className="text-[10px] text-blue-100 sm:text-xs">לפני מע"מ</p>
                        <p dir="ltr" className="mt-1 text-sm font-semibold sm:text-lg">₪{subtotal.toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl bg-white/10 px-2 py-2 sm:px-3">
                        <p className="text-[10px] text-blue-100 sm:text-xs">מע"מ (18%)</p>
                        <p dir="ltr" className="mt-1 text-sm font-semibold sm:text-lg">₪{vatAmount.toFixed(2)}</p>
                      </div>
                      <div className="rounded-xl bg-white/20 px-2 py-2 ring-1 ring-white/20 sm:px-3">
                        <p className="text-[10px] text-blue-100 sm:text-xs">סה"כ כולל מע"מ</p>
                        <p dir="ltr" className="mt-1 text-base font-bold sm:text-xl">₪{grossTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {quote.notes ? (
            <Card className="border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <CardHeader>
                <CardTitle className="text-lg">הערות</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">{quote.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6 xl:col-span-4">
          <Card className="border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">פעולות סטטוס</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusControlsLocked ? (
                <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200">
                  ההצעה כבר הומרה לעבודה ולכן פעולות סטטוס מהירות נעולות.
                </p>
              ) : (canReject || canConvert) ? (
                <div className="flex flex-wrap gap-2">
                  {canReject ? (
                    <Button
                      data-testid="quote-status-rejected"
                      size="sm"
                      disabled={updating || converting}
                      onClick={() => updateStatus('rejected')}
                      className="bg-red-600 text-white hover:bg-red-700"
                    >
                      סמן כנדחתה
                    </Button>
                  ) : null}

                  {canConvert ? (
                    <Button
                      data-testid="quote-convert-to-job"
                      size="sm"
                      onClick={convertToJob}
                      disabled={converting || updating}
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      {converting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Briefcase className="ml-2 h-4 w-4" />}
                      המר לעבודה
                    </Button>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  אין פעולות סטטוס מהירות זמינות לסטטוס הנוכחי.
                </p>
              )}

              <Collapsible open={advancedStatusOpen} onOpenChange={setAdvancedStatusOpen} className="border-t border-slate-200 pt-3 dark:border-slate-700">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="w-full justify-between" data-testid="quote-manual-status-toggle">
                    <span>שינוי סטטוס ידני (מתקדם)</span>
                    {advancedStatusOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  {statusControlsLocked ? (
                    <p className="text-xs text-slate-500 dark:text-slate-300">שינוי סטטוס ידני חסום לאחר המרה לעבודה.</p>
                  ) : manualStatusOptions.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-300">אין מעברי סטטוס ידניים זמינים מהסטטוס הנוכחי.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {manualStatusOptions.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant="outline"
                          data-testid={`quote-manual-status-${option.value}`}
                          disabled={manualUpdating || updating || converting}
                          onClick={() => updateStatusManually(option.value)}
                          style={{ borderColor: option.color, color: option.color }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">פרטי הצעה</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!hasAnyDetails ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  לא הוזנו פרטים נוספים להצעה זו.
                </p>
              ) : (
                <>
                  {quote.title ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                      <p className="text-xs text-slate-500 dark:text-slate-300">כותרת</p>
                      <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{quote.title}</p>
                    </div>
                  ) : null}

                  {quote.description ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                      <p className="text-xs text-slate-500 dark:text-slate-300">תיאור</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{quote.description}</p>
                    </div>
                  ) : null}

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                      <MapPin className="h-3.5 w-3.5" />
                      כתובת
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{quote.address_text || 'לא הוזנה כתובת'}</p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                    <p className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                      <CalendarClock className="h-3.5 w-3.5" />
                      תזמון
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{formatDateTimeSafe(quote.scheduled_start_at)}</p>
                  </div>

                  {quote.arrival_notes ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-700 dark:bg-slate-900/60">
                      <p className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-300">
                        <Clock3 className="h-3.5 w-3.5" />
                        הערות הגעה
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{quote.arrival_notes}</p>
                    </div>
                  ) : null}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
