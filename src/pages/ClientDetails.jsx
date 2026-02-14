import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Plus, Phone, Mail, MapPin, User } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { getClientProfile } from '@/data/clientsRepo';
import { listQuotesByAccount } from '@/data/quotesRepo';
import { listJobsByAccount } from '@/data/jobsRepo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { format } from 'date-fns';

export default function ClientDetails() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const accountId = urlParams.get('id');

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [jobs, setJobs] = useState([]);

  useEffect(() => {
    if (!user || !accountId) return;

    let mounted = true;

    async function loadPage() {
      try {
        const [clientProfile, accountQuotes, accountJobs] = await Promise.all([
          getClientProfile(accountId),
          listQuotesByAccount(accountId),
          listJobsByAccount(accountId),
        ]);

        if (!mounted) return;
        setProfile(clientProfile);
        setQuotes(accountQuotes || []);
        setJobs(accountJobs || []);
      } catch (error) {
        console.error('Error loading account details:', error);
        toast.error('שגיאה בטעינת לקוח', {
          description: getDetailedErrorReason(error, 'טעינת פרטי הלקוח נכשלה.'),
          duration: 9000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadPage();

    return () => {
      mounted = false;
    };
  }, [user, accountId]);

  const primary = profile?.primaryContact;
  const sortedQuotes = useMemo(() => [...quotes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [quotes]);
  const sortedJobs = useMemo(() => [...jobs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [jobs]);

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  if (!profile) {
    return <EmptyState icon={User} title="לקוח לא נמצא" description="לא נמצאו פרטי לקוח" />;
  }

  return (
    <div dir="rtl" className="space-y-6 p-4 lg:p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(createPageUrl('Clients'))} className="rounded-full">
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{profile.account.account_name}</h1>
          <p className="mt-1 text-slate-500">כרטיס לקוח</p>
        </div>
        <Button onClick={() => navigate(createPageUrl(`ClientForm?id=${profile.account.id}`))} variant="outline">
          עריכת לקוח
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate(createPageUrl(`QuoteForm?account_id=${profile.account.id}`))}>
          <FileText className="h-5 w-5" />
          <span>הצעה חדשה</span>
        </Button>
        <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate(createPageUrl(`JobForm?account_id=${profile.account.id}`))}>
          <Plus className="h-5 w-5" />
          <span>עבודה חדשה</span>
        </Button>
        {primary?.phone ? (
          <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => window.open(`tel:${primary.phone}`)}>
            <Phone className="h-5 w-5" />
            <span>התקשרות</span>
          </Button>
        ) : null}
        {primary?.email ? (
          <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => window.open(`mailto:${primary.email}`)}>
            <Mail className="h-5 w-5" />
            <span>אימייל</span>
          </Button>
        ) : null}
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>פרטים</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <div>סטטוס: <Badge variant="outline">{profile.account.status || 'active'}</Badge></div>
          {primary?.full_name ? <div>איש קשר: {primary.full_name}</div> : null}
          {primary?.phone ? <div dir="ltr">טלפון: {primary.phone}</div> : null}
          {primary?.email ? <div dir="ltr">אימייל: {primary.email}</div> : null}
          {primary?.address_text ? (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {primary.address_text}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>הצעות מחיר ({sortedQuotes.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedQuotes.length === 0 ? (
            <p className="text-sm text-slate-500">אין הצעות ללקוח זה</p>
          ) : (
            sortedQuotes.map((quote) => (
              <button
                type="button"
                key={quote.id}
                onClick={() => navigate(createPageUrl(`QuoteDetails?id=${quote.id}`))}
                className="w-full rounded-lg bg-slate-50 p-3 text-right hover:bg-slate-100"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">הצעה #{String(quote.id).slice(0, 8)}</span>
                  <Badge variant="outline">{quote.status}</Badge>
                </div>
                <div className="mt-1 text-xs text-slate-500">{format(new Date(quote.created_at), 'dd/MM/yyyy')}</div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>עבודות ({sortedJobs.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedJobs.length === 0 ? (
            <p className="text-sm text-slate-500">אין עבודות ללקוח זה</p>
          ) : (
            sortedJobs.map((job) => (
              <button
                type="button"
                key={job.id}
                onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                className="w-full rounded-lg bg-slate-50 p-3 text-right hover:bg-slate-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{job.title}</span>
                  <Badge variant="outline">{job.status}</Badge>
                </div>
                {job.scheduled_start_at ? (
                  <div className="mt-1 text-xs text-slate-500">{format(new Date(job.scheduled_start_at), 'dd/MM/yyyy HH:mm')}</div>
                ) : null}
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
