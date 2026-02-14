import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { FileText, Search, Plus, Filter } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { listQuotes, getQuoteAccountName } from '@/data/quotesRepo';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EnhancedEmptyState from '@/components/shared/EnhancedEmptyState';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const QUOTE_STATUS_OPTIONS = [
  { value: 'all', label: 'כל הסטטוסים' },
  { value: 'draft', label: 'טיוטה' },
  { value: 'sent', label: 'נשלחה' },
  { value: 'approved', label: 'אושרה' },
  { value: 'rejected', label: 'נדחתה' },
];

const QUOTE_STATUS_CONFIG = {
  draft: { label: 'טיוטה', color: '#64748b' },
  sent: { label: 'נשלחה', color: '#8b5cf6' },
  approved: { label: 'אושרה', color: '#10b981' },
  rejected: { label: 'נדחתה', color: '#ef4444' },
};

export default function Quotes() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadQuotesPage() {
      try {
        const rows = await listQuotes();
        if (!mounted) return;
        setQuotes(rows);
      } catch (error) {
        console.error('Error loading quotes:', error);
        toast.error('שגיאה בטעינת הצעות מחיר', {
          description: getDetailedErrorReason(error, 'טעינת ההצעות נכשלה.'),
          duration: 9000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadQuotesPage();

    return () => {
      mounted = false;
    };
  }, [user]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((quote) => {
      if (statusFilter !== 'all' && quote.status !== statusFilter) return false;

      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const accountName = getQuoteAccountName(quote).toLowerCase();
      const notes = String(quote.notes || '').toLowerCase();
      return accountName.includes(query) || notes.includes(query);
    });
  }, [quotes, searchQuery, statusFilter]);

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  function formatCurrency(value) {
    return Number(value || 0).toLocaleString('he-IL', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <div dir="rtl" className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 lg:text-3xl">הצעות מחיר</h1>
          <p className="mt-1 text-slate-500">{quotes.length} הצעות במערכת</p>
        </div>
        <Button
          onClick={() => navigate(createPageUrl('QuoteForm'))}
          style={{ backgroundColor: '#00214d' }}
          className="shadow-lg hover:opacity-90"
        >
          <Plus className="ml-2 h-4 w-4" />
          הצעה חדשה
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="חיפוש לפי לקוח או הערות..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="border-slate-200 pr-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-52">
                <Filter className="ml-2 h-4 w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUOTE_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredQuotes.length === 0 ? (
        searchQuery || statusFilter !== 'all' ? (
          <EnhancedEmptyState
            icon={FileText}
            title="לא נמצאו תוצאות תואמות"
            description="נסה לשנות חיפוש או פילטר"
            variant="filtered"
            primaryAction={{
              label: 'נקה סינון',
              onClick: () => {
                setSearchQuery('');
                setStatusFilter('all');
              },
            }}
          />
        ) : (
          <EnhancedEmptyState
            icon={FileText}
            title="אין הצעות עדיין"
            description="צור הצעה ראשונה כדי להתחיל את תהליך המכירה"
            primaryAction={{
              label: 'צור הצעה ראשונה',
              onClick: () => navigate(createPageUrl('QuoteForm')),
            }}
          />
        )
      ) : (
        <div className="space-y-2.5">
          {filteredQuotes.map((quote) => {
            const statusCfg = QUOTE_STATUS_CONFIG[quote.status] || { label: quote.status, color: '#64748b' };
            const accountName = getQuoteAccountName(quote);
            const isReadyToConvert = quote.status === 'approved' && !quote.converted_job_id;
            const quoteItems = Array.isArray(quote.quote_items) ? quote.quote_items : [];
            const serviceItems = quoteItems.filter((item) => String(item?.description || '').trim());
            const quoteTitle = String(quote.title || '').trim() || serviceItems[0]?.description || 'הצעת מחיר ללא כותרת';
            const servicesPreview = serviceItems
              .slice(0, 2)
              .map((item) => {
                const description = String(item.description || '').trim();
                const quantity = Number(item.quantity || 0);
                return quantity > 1 ? `${description} ×${quantity}` : description;
              })
              .join(' • ');
            const extraServicesCount = Math.max(0, serviceItems.length - 2);

            return (
              <Card
                key={quote.id}
                className="cursor-pointer border border-slate-200/80 bg-white shadow-sm transition-all hover:border-[#00214d]/20 hover:shadow-md dark:border-slate-700 dark:bg-slate-900/80"
                onClick={() => navigate(createPageUrl(`QuoteDetails?id=${quote.id}`))}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{quoteTitle}</h4>
                        <Badge
                          variant="outline"
                          style={{
                            backgroundColor: `${statusCfg.color}20`,
                            color: statusCfg.color,
                            borderColor: statusCfg.color,
                          }}
                          className="h-6 font-medium"
                        >
                          {statusCfg.label}
                        </Badge>
                      </div>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                        {accountName} • #{String(quote.id || '').slice(0, 8)} • {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: he })}
                      </p>

                      <p className="mt-1 line-clamp-1 text-xs text-slate-700 dark:text-slate-200">
                        <span className="font-medium">שירותים:</span>{' '}
                        {servicesPreview || 'לא הוגדרו שירותים'}
                        {extraServicesCount > 0 ? ` • +${extraServicesCount} נוספים` : ''}
                      </p>

                      {quote.notes ? (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-300">{quote.notes}</p>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-left">
                      <p className="text-[11px] text-slate-500 dark:text-slate-300">כולל מע"מ</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-slate-100" dir="ltr">
                        ₪{formatCurrency(Number(quote.total || 0) * 1.18)}
                      </p>
                    </div>
                  </div>

                  {(isReadyToConvert || quote.converted_job_id) ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {isReadyToConvert ? (
                        <Badge className="border-emerald-300 bg-emerald-100 text-emerald-700" variant="outline">
                          מוכנה להמרה
                        </Badge>
                      ) : null}
                      {quote.converted_job_id ? (
                        <Badge className="border-blue-300 bg-blue-100 text-blue-700" variant="outline">
                          הומרה לעבודה
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
