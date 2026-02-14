import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, Plus, Phone, MapPin, FileText, Briefcase, Trash2 } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { deleteClient, listClientProfiles, getAccountLabel } from '@/data/clientsRepo';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EnhancedEmptyState from '@/components/shared/EnhancedEmptyState';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const STATUS_BADGE = {
  lead: 'ליד',
  active: 'פעיל',
  inactive: 'לא פעיל',
};

export default function Clients() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [accountToDelete, setAccountToDelete] = useState(null);

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    async function loadClientsPage() {
      try {
        const rows = await listClientProfiles('');
        if (!mounted) return;
        setProfiles(rows);
      } catch (error) {
        console.error('Error loading clients:', error);
        toast.error('שגיאה בטעינת לקוחות', {
          description: getDetailedErrorReason(error, 'טעינת הלקוחות נכשלה.'),
          duration: 9000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadClientsPage();

    return () => {
      mounted = false;
    };
  }, [user]);

  const filtered = useMemo(() => {
    return profiles.filter((profile) => {
      const accountName = getAccountLabel(profile.account);
      const contact = profile.primaryContact;

      if (statusFilter !== 'all' && (profile.account.status || 'active') !== statusFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const haystack = `${accountName} ${contact?.full_name || ''} ${contact?.phone || ''} ${contact?.email || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [profiles, searchQuery, statusFilter]);

  async function handleDelete() {
    if (!accountToDelete) return;

    try {
      await deleteClient(accountToDelete.id);
      setProfiles((prev) => prev.filter((profile) => profile.account.id !== accountToDelete.id));
      toast.success('הלקוח נמחק בהצלחה');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('שגיאה במחיקת לקוח', {
        description: getDetailedErrorReason(error, 'מחיקת הלקוח נכשלה.'),
      });
    } finally {
      setAccountToDelete(null);
    }
  }

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div dir="rtl" className="space-y-6 p-4 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 lg:text-3xl">לקוחות</h1>
          <p className="mt-1 text-slate-500">{profiles.length} לקוחות במערכת</p>
        </div>
        <Button onClick={() => navigate(createPageUrl('ClientForm'))} style={{ backgroundColor: '#00214d' }} className="hover:opacity-90">
          <Plus className="ml-2 h-4 w-4" />
          לקוח חדש
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="חיפוש לפי לקוח, איש קשר או טלפון"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pr-10"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <option value="all">כל הסטטוסים</option>
              <option value="lead">ליד</option>
              <option value="active">פעיל</option>
              <option value="inactive">לא פעיל</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EnhancedEmptyState
          icon={Users}
          title={searchQuery || statusFilter !== 'all' ? 'לא נמצאו לקוחות תואמים' : 'אין לקוחות עדיין'}
          description={searchQuery || statusFilter !== 'all' ? 'נסה לשנות את החיפוש או הסינון' : 'צור לקוח ראשון כדי להתחיל תהליך מכירה'}
          primaryAction={{
            label: 'לקוח חדש',
            onClick: () => navigate(createPageUrl('ClientForm')),
          }}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((profile) => {
            const account = profile.account;
            const contact = profile.primaryContact;
            const status = account.status || 'active';

            return (
              <Card key={account.id} className="border-0 shadow-sm transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => navigate(createPageUrl(`ClientDetails?id=${account.id}`))}
                      className="min-w-0 flex-1 text-right"
                    >
                      <h4 className="font-semibold text-slate-800">{getAccountLabel(account)}</h4>
                      {contact?.full_name ? <p className="mt-1 text-sm text-slate-500">{contact.full_name}</p> : null}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {contact?.phone ? (
                          <span className="flex items-center gap-1" dir="ltr">
                            <Phone className="h-3 w-3" />
                            {contact.phone}
                          </span>
                        ) : null}

                        {contact?.address_text ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {contact.address_text}
                          </span>
                        ) : null}
                      </div>
                    </button>

                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline">{STATUS_BADGE[status] || status}</Badge>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(createPageUrl(`QuoteForm?account_id=${account.id}`))}
                        >
                          <FileText className="ml-1 h-4 w-4" /> הצעה
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(createPageUrl(`JobForm?account_id=${account.id}`))}
                        >
                          <Briefcase className="ml-1 h-4 w-4" /> עבודה
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => setAccountToDelete({ id: account.id, label: getAccountLabel(account) })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={Boolean(accountToDelete)} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת לקוח</AlertDialogTitle>
            <AlertDialogDescription>
              למחוק את "{accountToDelete?.label}"? פעולה זו תמחק גם אנשי קשר, עבודות והצעות הקשורות ללקוח זה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>מחיקה</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
