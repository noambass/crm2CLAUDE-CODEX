import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { FileText } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuoteStatusBadge } from '@/components/ui/DynamicStatusBadge';

function accountNameOfQuote(quote) {
  const relation = Array.isArray(quote?.accounts) ? quote.accounts[0] : quote?.accounts;
  return relation?.account_name || 'ללא לקוח';
}

export default function UnconvertedQuotesWidget({ data }) {
  const navigate = useNavigate();
  const { unconvertedQuotes } = data;

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/50">
            <FileText className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </span>
          הצעות מחיר שטרם הומרו לעבודה
          {unconvertedQuotes.length > 0 && (
            <span className="mr-auto rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
              {unconvertedQuotes.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {unconvertedQuotes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-700">
            <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-slate-400">אין כרגע הצעות ממתינות להמרה</p>
          </div>
        ) : (
          unconvertedQuotes.map((quote) => (
            <button
              key={quote.id}
              type="button"
              onClick={() => navigate(createPageUrl(`QuoteDetails?id=${quote.id}`))}
              className="w-full rounded-lg border border-slate-100 bg-slate-50 p-3 text-right transition-all hover:border-violet-200 hover:bg-violet-50/50 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-violet-800 dark:hover:bg-violet-950/20"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-800 dark:text-slate-200">
                    {quote.title || 'הצעת מחיר'}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{accountNameOfQuote(quote)}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    נוצרה: {format(new Date(quote.created_at), 'dd/MM/yyyy')}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <QuoteStatusBadge status={quote.status} />
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ₪{Number(quote.total || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  );
}
