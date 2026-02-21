import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Plus, Settings, Calendar as CalendarIcon } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PageHeader from '@/components/shared/PageHeader';
import { isScheduledAtValid, parseValidScheduledAt } from '@/lib/jobs/scheduleValidity';
import { useDashboardLayout } from '@/components/dashboard/useDashboardLayout';
import { WIDGET_REGISTRY } from '@/components/dashboard/widgetRegistry';
import DashboardEditor from '@/components/dashboard/DashboardEditor';

function getJobSubtotal(job) {
  if (!Array.isArray(job?.line_items)) return 0;
  return job.line_items.reduce((sum, item) => {
    const qty = Number(item?.quantity) || 0;
    const unit = Number(item?.unit_price) || 0;
    return sum + qty * unit;
  }, 0);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);

  const {
    layout,
    toggleWidget,
    reorderWidgets,
    resizeWidget,
    resetLayout,
    visibleWidgets,
  } = useDashboardLayout();

  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalAccounts: 0,
      totalJobs: 0,
      openQuotes: 0,
      pendingJobs: 0,
      doneJobs: 0,
      monthlyRevenue: 0,
    },
    recentJobs: [],
    todayJobs: [],
    unscheduledJobs: [],
    unconvertedQuotes: [],
    interestedAccounts: [],
    allJobs: [],
    allQuotes: [],
  });

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

        const openQuotesCount = quotes.filter(
          (q) => ['draft', 'sent', 'approved'].includes(q.status) && !q.converted_job_id
        ).length;
        const unconvertedQuotesList = quotes.filter((q) => !q.converted_job_id).slice(0, 6);
        const pendingJobs = jobs.filter((job) => job.status !== 'done');
        const doneJobs = jobs.filter((job) => job.status === 'done');

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const monthlyRevenue = doneJobs
          .filter((job) => {
            const scheduledDate = parseValidScheduledAt(job.scheduled_start_at);
            const createdDate = job.created_at ? new Date(job.created_at) : null;
            const baseDate =
              scheduledDate || (createdDate && !Number.isNaN(createdDate.getTime()) ? createdDate : null);
            return baseDate && baseDate >= monthStart;
          })
          .reduce((sum, job) => sum + getJobSubtotal(job) * 1.18, 0);

        const todayIso = format(new Date(), 'yyyy-MM-dd');
        const todayJobsList = jobs.filter((job) => {
          const scheduledDate = parseValidScheduledAt(job.scheduled_start_at);
          if (!scheduledDate) return false;
          return format(scheduledDate, 'yyyy-MM-dd') === todayIso;
        });

        const unscheduledJobsList = jobs.filter(
          (job) => !isScheduledAtValid(job.scheduled_start_at) && job.status !== 'done'
        );

        const accountsWithJobs = new Set(jobs.map((job) => job.account_id).filter(Boolean));
        const interested = accounts.filter((acc) => !accountsWithJobs.has(acc.id)).slice(0, 5);

        if (!mounted) return;

        setDashboardData({
          stats: {
            totalAccounts: accounts.length,
            totalJobs: jobs.length,
            openQuotes: openQuotesCount,
            pendingJobs: pendingJobs.length,
            doneJobs: doneJobs.length,
            monthlyRevenue,
          },
          recentJobs: jobs.slice(0, 5),
          todayJobs: todayJobsList,
          unscheduledJobs: unscheduledJobsList.slice(0, 5),
          unconvertedQuotes: unconvertedQuotesList,
          interestedAccounts: interested,
          allJobs: jobs,
          allQuotes: quotes,
        });
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

  const today = new Date();
  const greeting = today.getHours() < 12 ? 'בוקר טוב' : today.getHours() < 17 ? 'צהריים טובים' : 'ערב טוב';

  // Group visible widgets into rows for the grid layout
  const widgetRows = [];
  let currentRow = [];
  let currentRowWidth = 0;

  visibleWidgets.forEach((widget) => {
    const widthUnits = widget.size === 'half' ? 1 : 2;

    if (currentRowWidth + widthUnits > 2) {
      if (currentRow.length > 0) widgetRows.push(currentRow);
      currentRow = [widget];
      currentRowWidth = widthUnits;
    } else {
      currentRow.push(widget);
      currentRowWidth += widthUnits;
    }
  });
  if (currentRow.length > 0) widgetRows.push(currentRow);

  return (
    <div dir="rtl" className="app-page">
            {/* Header */}
      <PageHeader
        title={greeting}
        subtitle={format(today, 'EEEE, dd MMMM yyyy', { locale: he })}
        icon={CalendarIcon}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditorOpen(true)}
              className="gap-2"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">עריכת דשבורד</span>
            </Button>
            <Button onClick={() => navigate(createPageUrl('JobForm'))} className="app-cta">
              <Plus className="ml-2 h-4 w-4" />
              עבודה חדשה
            </Button>
          </>
        }
      />

      {/* Widget Grid */}
      {widgetRows.map((row, rowIndex) => {
        const isMultiColumn = row.length > 1 || (row.length === 1 && row[0].size === 'half');

        return (
          <div
            key={rowIndex}
            className={isMultiColumn ? 'grid gap-6 lg:grid-cols-2' : ''}
          >
            {row.map((widgetLayout) => {
              const widgetConfig = WIDGET_REGISTRY[widgetLayout.id];
              if (!widgetConfig) return null;
              const WidgetComponent = widgetConfig.component;

              return (
                <div key={widgetLayout.id} className={widgetLayout.size === 'full' ? 'lg:col-span-2' : ''}>
                  <WidgetComponent data={dashboardData} />
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Dashboard Editor Sheet */}
      <DashboardEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        layout={layout}
        onToggle={toggleWidget}
        onReorder={reorderWidgets}
        onResize={resizeWidget}
        onReset={resetLayout}
      />
    </div>
  );
}
