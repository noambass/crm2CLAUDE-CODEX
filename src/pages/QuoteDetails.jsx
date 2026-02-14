import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  ArrowRight,
  Edit,
  FileText,
  Loader2,
  Briefcase,
  ExternalLink,
  User,
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';

const QUOTE_STATUSES = [
  { value: 'draft', label: 'טיוטה', color: '#64748b' },
  { value: 'sent', label: 'נשלחה', color: '#8b5cf6' },
  { value: 'approved', label: 'אושרה', color: '#10b981' },
  { value: 'rejected', label: 'נדחתה', color: '#ef4444' },
];

const QUOTE_ALLOWED_TRANSITIONS = {
  draft: ['sent'],
  sent: ['approved', 'rejected'],
  approved: [],
  rejected: ['draft'],
};

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

    if (quote.status !== 'approved') {
      toast.error('ניתן להמיר לעבודה רק הצעה שאושרה');
      return;
    }

    if (quote.converted_job_id) {
      toast.error('הצעה זו כבר הומרה לעבודה');
      return;
    }

    setConverting(true);

    try {
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
  const canConvert = quote.status === 'approved' && !quote.converted_job_id;
  const allowedNextStatuses = QUOTE_ALLOWED_TRANSITIONS[quote.status] || [];

  return (
    <div dir="rtl" className="mx-auto max-w-4xl space-y-6 p-4 lg:p-8">
      <div className="text-sm text-slate-500">נוצרה: {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: he })}</div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Quotes'))} className="rounded-full">
          <ArrowRight className="h-5 w-5" />
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">הצעת מחיר</h1>
          <p className="mt-1 text-blue-600">
            <User className="ml-1 inline h-4 w-4" />
            {quote.accounts?.account_name || 'ללא לקוח'}
          </p>
        </div>

        <div className="text-2xl font-bold text-slate-800" dir="ltr">
          ₪{Number(quote.total || 0).toFixed(2)}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">סטטוס:</span>
        <Badge
          variant="outline"
          style={{
            backgroundColor: `${statusCfg.color}20`,
            color: statusCfg.color,
            borderColor: statusCfg.color,
          }}
          className="px-3 py-1 text-base font-medium"
        >
          {statusCfg.label}
        </Badge>
      </div>

      {allowedNextStatuses.length > 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="mb-3 text-sm text-slate-500">קדם סטטוס:</p>
            <div className="flex flex-wrap gap-2">
              {allowedNextStatuses.map((nextValue) => {
                const nextStatusCfg = QUOTE_STATUSES.find((status) => status.value === nextValue);
                if (!nextStatusCfg) return null;

                return (
                  <Button
                    key={nextStatusCfg.value}
                    data-testid={`quote-status-${nextStatusCfg.value}`}
                    size="sm"
                    disabled={updating}
                    onClick={() => updateStatus(nextStatusCfg.value)}
                    style={{ backgroundColor: nextStatusCfg.color }}
                    className="text-white hover:opacity-90"
                  >
                    {nextStatusCfg.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {canEdit ? (
          <Button data-testid="quote-edit-draft" variant="outline" onClick={() => navigate(createPageUrl(`QuoteForm?id=${quote.id}`))}>
            <Edit className="ml-2 h-4 w-4" />
            ערוך טיוטה
          </Button>
        ) : null}

        {canConvert ? (
          <Button
            data-testid="quote-convert-to-job"
            onClick={convertToJob}
            disabled={converting}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {converting ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : <Briefcase className="ml-2 h-4 w-4" />}
            המר לעבודה
          </Button>
        ) : null}

        {quote.converted_job_id ? (
          <Button variant="outline" onClick={() => navigate(createPageUrl(`JobDetails?id=${quote.converted_job_id}`))}>
            <ExternalLink className="ml-2 h-4 w-4" />
            פתח עבודה
          </Button>
        ) : null}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">שורות שירות</CardTitle>
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <p className="py-4 text-center text-slate-500">אין שורות בהצעה זו</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-12 gap-2 border-b px-2 pb-2 text-sm font-medium text-slate-500">
                <div className="col-span-5">תיאור</div>
                <div className="col-span-2 text-center">כמות</div>
                <div className="col-span-2 text-center">מחיר יחידה</div>
                <div className="col-span-3 text-left">סה"כ</div>
              </div>

              {lineItems.map((item, idx) => {
                const qty = Number(item.quantity) || 0;
                const unit = Number(item.unit_price) || 0;
                const lineTotal = Number(item.line_total) || qty * unit;

                return (
                  <div key={item.id || idx} className="grid grid-cols-12 items-center gap-2 rounded-lg bg-slate-50 p-3">
                    <div className="col-span-5 font-medium text-slate-800">{item.description}</div>
                    <div className="col-span-2 text-center text-slate-600">{qty}</div>
                    <div className="col-span-2 text-center text-slate-600" dir="ltr">
                      ₪{unit.toFixed(2)}
                    </div>
                    <div className="col-span-3 text-left font-semibold text-slate-800" dir="ltr">
                      ₪{lineTotal.toFixed(2)}
                    </div>
                  </div>
                );
              })}

              <div className="space-y-2 rounded-xl bg-slate-800 p-4 text-white">
                <div className="flex items-center justify-between text-sm">
                  <span>סכום לפני מע"מ:</span>
                  <span dir="ltr">₪{Number(quote.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>מע"מ (18%):</span>
                  <span dir="ltr">₪{(Number(quote.total || 0) * 0.18).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/20 pt-2 text-lg font-bold">
                  <span>סה"כ הצעה:</span>
                  <span dir="ltr">₪{(Number(quote.total || 0) * 1.18).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {quote.notes ? (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">הערות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-slate-700">{quote.notes}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
