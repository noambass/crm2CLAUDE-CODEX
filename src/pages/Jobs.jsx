import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Search, Plus, List, BarChart3, Users as UsersIcon, Clock as ClockIcon, LayoutGrid, Rows3 } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { getLineItemsSubtotal } from '@/lib/jobLineItems';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EnhancedEmptyState from '@/components/shared/EnhancedEmptyState';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { useUiPreferences } from '@/lib/ui/useUiPreferences';
import { JobsListView, JobsByStatusView, JobsByClientsView, JobsByDateView } from '@/components/jobs/JobsViewMode';

function normalizeJob(job) {
  const accountRel = Array.isArray(job.accounts) ? job.accounts[0] : job.accounts;
  const lineItems = Array.isArray(job.line_items) ? job.line_items : [];
  return {
    id: job.id,
    title: job.title,
    description: job.description || '',
    status: job.status,
    priority: job.priority,
    address_text: job.address_text || '',
    arrival_notes: job.arrival_notes || '',
    scheduled_start_at: job.scheduled_start_at || null,
    created_at: job.created_at,
    account_name: accountRel?.account_name || 'ללא לקוח',
    line_items: lineItems,
    total: getLineItemsSubtotal(lineItems),
  };
}

export default function Jobs() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const { preferences, setPreference } = useUiPreferences();
  const isExpandedCards = preferences.jobsView === 'expanded_cards';

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('status');

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadJobs() {
      try {
        const { data, error } = await supabase
          .from('jobs')
          .select('id, title, description, status, priority, address_text, arrival_notes, scheduled_start_at, created_at, line_items, accounts(account_name)')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        setJobs((data || []).map(normalizeJob));
      } catch (error) {
        console.error('Error loading jobs:', error);
        toast.error('שגיאה בטעינת עבודות', {
          description: getDetailedErrorReason(error, 'טעינת העבודות נכשלה.'),
          duration: 9000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadJobs();

    return () => {
      mounted = false;
    };
  }, [user]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const haystack = `${job.title} ${job.account_name} ${job.address_text}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [jobs, searchQuery]);

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  const isFiltered = Boolean(searchQuery.trim());
  const resultsCount = filteredJobs.length;

  return (
    <div dir="rtl" className="app-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground lg:text-3xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-400">
              <Briefcase className="h-5 w-5" />
            </span>
            עבודות
          </h1>
          <p className="mt-1 text-muted-foreground">
            {isFiltered ? (
              <>
                מציג {resultsCount} מתוך {jobs.length} עבודות
              </>
            ) : (
              <>{jobs.length} עבודות במערכת</>
            )}
          </p>
        </div>

        <Button onClick={() => navigate(createPageUrl('JobForm'))} className="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90">
          <Plus className="ml-2 h-4 w-4" />
          עבודה חדשה
        </Button>
      </div>

      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="חיפוש לפי כותרת, לקוח או כתובת..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="border-border pr-10"
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <span className="text-sm font-medium text-muted-foreground">תצוגה:</span>
              <div className="rounded-xl bg-muted/30 p-1 dark:bg-muted/20">
                <div className="flex flex-wrap gap-1">
                  {[
                    { key: 'list', label: 'רשימה', icon: List },
                    { key: 'status', label: 'לפי סטטוס', icon: BarChart3 },
                    { key: 'clients', label: 'לפי לקוחות', icon: UsersIcon },
                    { key: 'date', label: 'לפי תאריך', icon: ClockIcon },
                  ].map((tab) => {
                    const isActive = viewMode === tab.key;
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setViewMode(tab.key)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          isActive
                            ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-1">
                <Button
                  type="button"
                  variant={isExpandedCards ? 'ghost' : 'default'}
                  size="sm"
                  className={!isExpandedCards ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                  onClick={() => setPreference('jobsView', 'compact_cards')}
                >
                  <Rows3 className="ml-1 h-4 w-4" />
                  קומפקטי
                </Button>
                <Button
                  type="button"
                  variant={isExpandedCards ? 'default' : 'ghost'}
                  size="sm"
                  className={isExpandedCards ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}
                  onClick={() => setPreference('jobsView', 'expanded_cards')}
                >
                  <LayoutGrid className="ml-1 h-4 w-4" />
                  מורחב
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredJobs.length === 0 ? (
        searchQuery ? (
          <EnhancedEmptyState
            icon={Briefcase}
            title="לא נמצאו תוצאות תואמות"
            description="נסה לשנות סינון או חיפוש"
            variant="filtered"
            primaryAction={{
              label: 'נקה סינון',
              onClick: () => {
                setSearchQuery('');
              },
            }}
          />
        ) : (
          <EnhancedEmptyState
            icon={Briefcase}
            title="אין עבודות עדיין"
            description="התחל ביצירת העבודה הראשונה"
            primaryAction={{
              label: 'צור עבודה ראשונה',
              onClick: () => navigate(createPageUrl('JobForm')),
            }}
          />
        )
      ) : viewMode === 'list' ? (
        <JobsListView jobs={filteredJobs} navigate={navigate} isExpandedCards={isExpandedCards} />
      ) : viewMode === 'status' ? (
        <JobsByStatusView jobs={filteredJobs} navigate={navigate} isExpandedCards={isExpandedCards} />
      ) : viewMode === 'clients' ? (
        <JobsByClientsView jobs={filteredJobs} navigate={navigate} isExpandedCards={isExpandedCards} />
      ) : (
        <JobsByDateView jobs={filteredJobs} navigate={navigate} isExpandedCards={isExpandedCards} />
      )}
    </div>
  );
}
