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
        <div className="space-y-3">
          {filteredQuotes.map((quote) => {
            const statusCfg = QUOTE_STATUS_CONFIG[quote.status] || { label: quote.status, color: '#64748b' };
            const accountName = getQuoteAccountName(quote);
            const isReadyToConvert = quote.status === 'approved' && !quote.converted_job_id;

            return (
              <Card
                key={quote.id}
                className="cursor-pointer border-0 shadow-sm transition-all hover:shadow-md"
                onClick={() => navigate(createPageUrl(`QuoteDetails?id=${quote.id}`))}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-slate-800">{accountName}</h4>
                      {quote.notes ? (
                        <p className="mt-1 truncate text-sm text-slate-500">{quote.notes}</p>
                      ) : null}
                      <div className="mt-2 text-sm text-slate-400">
                        {format(new Date(quote.created_at), 'dd/MM/yyyy', { locale: he })}
                      </div>
                    </div>

                    <div className="mr-4 flex flex-col items-end gap-2">
                      <Badge
                        variant="outline"
                        style={{
                          backgroundColor: `${statusCfg.color}20`,
                          color: statusCfg.color,
                          borderColor: statusCfg.color,
                        }}
                        className="font-medium"
                      >
                        {statusCfg.label}
                      </Badge>

                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs text-slate-500">כולל מע"מ</span>
                        <span className="text-lg font-bold text-slate-800" dir="ltr">
                          ₪{(Number(quote.total || 0) * 1.18).toFixed(2)}
                        </span>
                      </div>

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
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
