import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Users,
  Briefcase,
  TrendingUp,
  Calendar,
  Plus,
  FileText,
  ArrowUpRight,
  AlertCircle,
} from 'lucide-react';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { JobStatusBadge, PriorityBadge, QuoteStatusBadge } from '@/components/ui/DynamicStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import WeeklyCalendar from '@/components/dashboard/WeeklyCalendar';

function getJobSubtotal(job) {
  if (!Array.isArray(job?.line_items)) return 0;
  return job.line_items.reduce((sum, item) => {
    const qty = Number(item?.quantity) || 0;
    const unit = Number(item?.unit_price) || 0;
    return sum + qty * unit;
  }, 0);
}

function accountNameOf(job) {
  const relation = Array.isArray(job?.accounts) ? job.accounts[0] : job?.accounts;
  return relation?.account_name || 'ללא לקוח';
}

function accountNameOfQuote(quote) {
  const relation = Array.isArray(quote?.accounts) ? quote.accounts[0] : quote?.accounts;
  return relation?.account_name || 'ללא לקוח';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalAccounts: 0,
    totalJobs: 0,
    openQuotes: 0,
    pendingJobs: 0,
    doneJobs: 0,
    monthlyRevenue: 0,
  });
  const [recentJobs, setRecentJobs] = useState([]);
  const [todayJobs, setTodayJobs] = useState([]);
  const [unscheduledJobs, setUnscheduledJobs] = useState([]);
  const [unconvertedQuotes, setUnconvertedQuotes] = useState([]);
  const [interestedAccounts, setInterestedAccounts] = useState([]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadDashboardData() {
      try {
        const [accountsRes, jobsRes, quotesRes] = await Promise.all([
          supabase.from('accounts').select('id, account_name').order('created_at', { ascending: false }),
          supabase
            .from('jobs')
            .select(
              'id, account_id, title, status, priority, scheduled_start_at, created_at, address_text, arrival_notes, line_items, accounts(account_name)'
            )
            .order('created_at', { ascending: false })
            .limit(200),
          supabase
            .from('quotes')
            .select('id, account_id, status, title, total, created_at, converted_job_id, accounts(account_name)')
            .order('created_at', { ascending: false })
            .limit(200),
        ]);

        if (accountsRes.error) throw accountsRes.error;
        if (jobsRes.error) throw jobsRes.error;
        if (quotesRes.error) throw quotesRes.error;

        const accounts = accountsRes.data || [];
        const jobs = jobsRes.data || [];
        const quotes = quotesRes.data || [];

        const openQuotesCount = quotes.filter((q) => ['draft', 'sent', 'approved'].includes(q.status) && !q.converted_job_id).length;
        const unconvertedQuotesList = quotes.filter((q) => !q.converted_job_id).slice(0, 6);
        const pendingJobs = jobs.filter((job) => job.status !== 'done');
        const doneJobs = jobs.filter((job) => job.status === 'done');

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyRevenue = doneJobs
          .filter((job) => {
            const baseDate = job.scheduled_start_at || job.created_at;
            return baseDate && new Date(baseDate) >= monthStart;
          })
          .reduce((sum, job) => sum + getJobSubtotal(job) * 1.18, 0);

        const todayIso = format(new Date(), 'yyyy-MM-dd');
        const todayJobsList = jobs.filter((job) => {
          if (!job.scheduled_start_at) return false;
          return format(new Date(job.scheduled_start_at), 'yyyy-MM-dd') === todayIso;
        });

        const unscheduledJobsList = jobs.filter((job) => !job.scheduled_start_at && job.status !== 'done');

        const accountsWithJobs = new Set(jobs.map((job) => job.account_id).filter(Boolean));
        const interested = accounts.filter((acc) => !accountsWithJobs.has(acc.id)).slice(0, 5);

        if (!mounted) return;

        setStats({
          totalAccounts: accounts.length,
          totalJobs: jobs.length,
          openQuotes: openQuotesCount,
          pendingJobs: pendingJobs.length,
          doneJobs: doneJobs.length,
          monthlyRevenue,
        });
        setRecentJobs(jobs.slice(0, 5));
        setTodayJobs(todayJobsList);
        setUnscheduledJobs(unscheduledJobsList.slice(0, 5));
        setUnconvertedQuotes(unconvertedQuotesList);
        setInterestedAccounts(interested);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      mounted = false;
    };
  }, [user]);

  if (isLoadingAuth) return <LoadingSpinner />;
  if (!user) return null;
  if (loading) return <LoadingSpinner />;

  return (
    <div dir="rtl" className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 lg:text-3xl">שלום, הנה מצב המערכת</h1>
          <p className="mt-1 text-slate-500">סקירה מהירה של לקוחות, הצעות ועבודות</p>
        </div>
        <Button
          onClick={() => navigate(createPageUrl('JobForm'))}
          className="w-full bg-[#00214d] text-white hover:opacity-90 sm:w-auto"
        >
          <Plus className="ml-2 h-4 w-4" />
          עבודה חדשה
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">לקוחות</p>
            <p className="text-2xl font-bold text-slate-800">{stats.totalAccounts}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">הצעות פתוחות</p>
            <p className="text-2xl font-bold text-violet-600">{stats.openQuotes}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">עבודות פתוחות</p>
            <p className="text-2xl font-bold text-amber-600">{stats.pendingJobs}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">עבודות שבוצעו</p>
            <p data-testid="kpi-value-done-jobs" className="text-2xl font-bold text-emerald-600">
              {stats.doneJobs}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-2 text-slate-700">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span>הכנסות חודשיות משוערות (כולל מע"מ)</span>
          </div>
          <span className="text-xl font-bold text-blue-700">₪{stats.monthlyRevenue.toFixed(2)}</span>
        </CardContent>
      </Card>

      <WeeklyCalendar />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Calendar className="h-5 w-5 text-emerald-500" />
              עבודות להיום
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayJobs.length === 0 ? (
              <p className="text-sm text-slate-500">אין עבודות מתוזמנות להיום.</p>
            ) : (
              todayJobs.slice(0, 5).map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                  className="w-full rounded-lg bg-slate-50 p-3 text-right hover:bg-slate-100"
                >
                  <div className="font-medium text-slate-800">{job.title}</div>
                  <div className="text-sm text-slate-500">{accountNameOf(job)}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <JobStatusBadge status={job.status} />
                    <span className="text-xs text-slate-500">
                      {format(new Date(job.scheduled_start_at), 'dd/MM HH:mm')}
                    </span>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              עבודות לא מתוזמנות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {unscheduledJobs.length === 0 ? (
              <p className="text-sm text-slate-500">כל העבודות מתוזמנות.</p>
            ) : (
              unscheduledJobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                  className="w-full rounded-lg bg-slate-50 p-3 text-right hover:bg-slate-100"
                >
                  <div className="font-medium text-slate-800">{job.title}</div>
                  <div className="text-sm text-slate-500">{accountNameOf(job)}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <JobStatusBadge status={job.status} />
                    <PriorityBadge priority={job.priority} />
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-violet-600" />
            הצעות מחיר שטרם הומרו לעבודה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {unconvertedQuotes.length === 0 ? (
            <p className="text-sm text-slate-500">אין כרגע הצעות ממתינות להמרה.</p>
          ) : (
            unconvertedQuotes.map((quote) => (
              <button
                key={quote.id}
                type="button"
                onClick={() => navigate(createPageUrl(`QuoteDetails?id=${quote.id}`))}
                className="w-full rounded-lg bg-slate-50 p-3 text-right hover:bg-slate-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-800">{quote.title || 'הצעת מחיר'}</div>
                    <div className="text-sm text-slate-500">{accountNameOfQuote(quote)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      נוצרה: {format(new Date(quote.created_at), 'dd/MM/yyyy')}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <QuoteStatusBadge status={quote.status} />
                    <div className="text-xs font-semibold text-slate-700">₪{Number(quote.total || 0).toFixed(2)}</div>
                  </div>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-5 w-5 text-slate-700" />
              עבודות אחרונות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                className="w-full rounded-lg bg-slate-50 p-3 text-right hover:bg-slate-100"
              >
                <div className="font-medium text-slate-800">{job.title}</div>
                <div className="text-sm text-slate-500">{accountNameOf(job)}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-blue-600" />
              לקוחות ללא עבודה
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {interestedAccounts.length === 0 ? (
              <p className="text-sm text-slate-500">אין כרגע לקוחות ללא עבודה.</p>
            ) : (
              interestedAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        {account.account_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-slate-800">{account.account_name}</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(createPageUrl('JobForm'))}
                  >
                    <Plus className="ml-1 h-4 w-4" />
                    עבודה
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 bg-[#00214d] shadow-sm">
        <CardContent className="flex flex-col items-start justify-between gap-4 p-6 text-white sm:flex-row sm:items-center">
          <div>
            <h3 className="text-xl font-bold">פעולות מהירות</h3>
            <p className="text-sm text-blue-100">יצירת רשומה חדשה בלחיצה אחת</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(createPageUrl('ClientForm'))}>
              <Users className="ml-1 h-4 w-4" /> לקוח
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(createPageUrl('QuoteForm'))}>
              <FileText className="ml-1 h-4 w-4" /> הצעת מחיר
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate(createPageUrl('JobForm'))}>
              <ArrowUpRight className="ml-1 h-4 w-4" /> עבודה
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
