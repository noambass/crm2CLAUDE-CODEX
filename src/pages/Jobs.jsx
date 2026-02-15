import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Search, Plus, List, BarChart3, Users as UsersIcon, Clock as ClockIcon } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EnhancedEmptyState from '@/components/shared/EnhancedEmptyState';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { JobsListView, JobsByStatusView, JobsByClientsView, JobsByDateView } from '@/components/jobs/JobsViewMode';

function normalizeJob(job) {
  const accountRel = Array.isArray(job.accounts) ? job.accounts[0] : job.accounts;
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
  };
}

export default function Jobs() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

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
          .select('id, title, description, status, priority, address_text, arrival_notes, scheduled_start_at, created_at, accounts(account_name)')
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

  return (
    <div dir="rtl" className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 lg:text-3xl">עבודות</h1>
          <p className="mt-1 text-slate-500">{jobs.length} עבודות במערכת</p>
        </div>

        <Button onClick={() => navigate(createPageUrl('JobForm'))} className="bg-[#00214d] text-white hover:opacity-90">
          <Plus className="ml-2 h-4 w-4" />
          עבודה חדשה
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="חיפוש לפי כותרת, לקוח או כתובת..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="border-slate-200 pr-10"
                />
              </div>

            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <span className="flex-shrink-0 text-sm text-slate-600">תצוגה:</span>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
                style={viewMode === 'list' ? { backgroundColor: '#00214d' } : {}}
              >
                <List className="ml-1 h-4 w-4" /> רשימה
              </Button>

              <Button
                variant={viewMode === 'status' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('status')}
                style={viewMode === 'status' ? { backgroundColor: '#00214d' } : {}}
              >
                <BarChart3 className="ml-1 h-4 w-4" /> לפי סטטוס
              </Button>

              <Button
                variant={viewMode === 'clients' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('clients')}
                style={viewMode === 'clients' ? { backgroundColor: '#00214d' } : {}}
              >
                <UsersIcon className="ml-1 h-4 w-4" /> לפי לקוחות
              </Button>

              <Button
                variant={viewMode === 'date' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('date')}
                style={viewMode === 'date' ? { backgroundColor: '#00214d' } : {}}
              >
                <ClockIcon className="ml-1 h-4 w-4" /> לפי תאריך
              </Button>
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
        <JobsListView jobs={filteredJobs} navigate={navigate} />
      ) : viewMode === 'status' ? (
        <JobsByStatusView jobs={filteredJobs} navigate={navigate} />
      ) : viewMode === 'clients' ? (
        <JobsByClientsView jobs={filteredJobs} navigate={navigate} />
      ) : (
        <JobsByDateView jobs={filteredJobs} navigate={navigate} />
      )}
    </div>
  );
}
