import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Search, Plus, Phone, MapPin, FileText, Briefcase, Trash2, User, Building2, Bath } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  deleteClient,
  getAccountLabel,
  listClientProfiles,
  setAccountClientType,
  setAccountStatus,
} from '@/data/clientsRepo';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { ClientTypeBadge } from '@/components/ui/DynamicStatusBadge';
import EnhancedEmptyState from '@/components/shared/EnhancedEmptyState';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const TYPE_TABS = [
  { key: 'all', label: 'הכול', icon: UserPlus },
  { key: 'private', label: 'פרטי', icon: User },
  { key: 'company', label: 'חברה', icon: Building2 },
  { key: 'bath_company', label: 'חברת אמבטיות', icon: Bath },
];

const CLIENT_TYPE_OPTIONS = [
  { value: 'private', label: 'פרטי' },
  { value: 'company', label: 'חברה' },
  { value: 'bath_company', label: 'חברת אמבטיות' },
];

const DELETE_UNDO_MS = 5000;

function normalizeProfileForSort(profile) {
  return new Date(profile?.account?.updated_at || profile?.account?.created_at || 0).getTime();
}

export default function Leads() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const pendingDeletionRef = useRef(new Map());

  const typeCounts = useMemo(() => {
    return profiles.reduce(
      (acc, profile) => {
        const type = profile.account.client_type || 'private';
        acc.all += 1;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      },
      { all: 0, private: 0, company: 0, bath_company: 0 },
    );
  }, [profiles]);

  useEffect(() => {
    if (!user) return;

    let mounted = true;
    async function loadLeadsPage() {
      try {
        const rows = await listClientProfiles({ statuses: ['lead'] });
        if (!mounted) return;
        const sorted = rows.slice().sort((a, b) => normalizeProfileForSort(b) - normalizeProfileForSort(a));
        setProfiles(sorted);
      } catch (error) {
        console.error('Error loading leads:', error);
        toast.error('שגיאה בטעינת לידים', {
          description: getDetailedErrorReason(error, 'טעינת הלידים נכשלה.'),
          duration: 9000,
        });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadLeadsPage();

    return () => {
      mounted = false;
      for (const entry of pendingDeletionRef.current.values()) {
        clearTimeout(entry.timer);
      }
      pendingDeletionRef.current.clear();
    };
  }, [user]);

  const filtered = useMemo(() => {
    return profiles.filter((profile) => {
      const accountName = getAccountLabel(profile.account);
      const contact = profile.primaryContact;
      const clientType = profile.account.client_type || 'private';
      if (typeFilter !== 'all' && clientType !== typeFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const haystack = `${accountName} ${contact?.phone || ''} ${contact?.email || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [profiles, searchQuery, typeFilter]);

  function restoreDeletedProfile(accountId) {
    const pending = pendingDeletionRef.current.get(accountId);
    if (!pending) return;
    clearTimeout(pending.timer);
    pendingDeletionRef.current.delete(accountId);
    setProfiles((prev) => {
      if (prev.some((item) => item.account.id === accountId)) return prev;
      const merged = [...prev, pending.profile];
      return merged.sort((a, b) => normalizeProfileForSort(b) - normalizeProfileForSort(a));
    });
  }

  function scheduleDelete(profile) {
    const accountId = profile.account.id;
    const accountLabel = getAccountLabel(profile.account);
    const existing = pendingDeletionRef.current.get(accountId);
    if (existing) {
      clearTimeout(existing.timer);
      pendingDeletionRef.current.delete(accountId);
    }

    setProfiles((prev) => prev.filter((item) => item.account.id !== accountId));

    const timer = window.setTimeout(async () => {
      const snapshot = pendingDeletionRef.current.get(accountId);
      if (!snapshot) return;
      pendingDeletionRef.current.delete(accountId);

      try {
        await deleteClient(accountId);
        toast.success('הליד נמחק בהצלחה');
      } catch (error) {
        console.error('Error deleting lead:', error);
        setProfiles((prev) => {
          if (prev.some((item) => item.account.id === accountId)) return prev;
          const merged = [...prev, snapshot.profile];
          return merged.sort((a, b) => normalizeProfileForSort(b) - normalizeProfileForSort(a));
        });
        toast.error('שגיאה במחיקת ליד', {
          description: getDetailedErrorReason(error, 'מחיקת הליד נכשלה.'),
        });
      }
    }, DELETE_UNDO_MS);

    pendingDeletionRef.current.set(accountId, { timer, profile });

    toast('הליד יסומן למחיקה', {
      description: `הליד "${accountLabel}" יימחק בעוד ${DELETE_UNDO_MS / 1000} שניות.`,
      action: {
        label: 'בטל',
        onClick: () => restoreDeletedProfile(accountId),
      },
      duration: DELETE_UNDO_MS,
    });
  }

  async function convertToActive(profile) {
    const accountId = profile.account.id;
    setProfiles((prev) => prev.filter((item) => item.account.id !== accountId));
    try {
      await setAccountStatus(accountId, 'active');
      toast.success('הליד הומר ללקוח פעיל');
    } catch (error) {
      setProfiles((prev) => {
        if (prev.some((item) => item.account.id === accountId)) return prev;
        const merged = [...prev, profile];
        return merged.sort((a, b) => normalizeProfileForSort(b) - normalizeProfileForSort(a));
      });
      toast.error('שגיאה בהמרת ליד ללקוח', {
        description: getDetailedErrorReason(error, 'המרת הליד נכשלה.'),
      });
    }
  }

  async function changeClientType(profile, nextType) {
    const accountId = profile.account.id;
    const previousType = profile.account.client_type || 'private';
    if (previousType === nextType) return;

    setProfiles((prev) =>
      prev.map((item) =>
        item.account.id === accountId
          ? { ...item, account: { ...item.account, client_type: nextType } }
          : item,
      ),
    );

    try {
      await setAccountClientType(accountId, nextType);
      toast.success('סוג הליד עודכן');
    } catch (error) {
      setProfiles((prev) =>
        prev.map((item) =>
          item.account.id === accountId
            ? { ...item, account: { ...item.account, client_type: previousType } }
            : item,
        ),
      );
      toast.error('שגיאה בעדכון סוג ליד', {
        description: getDetailedErrorReason(error, 'עדכון סוג הליד נכשל.'),
      });
    }
  }

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div dir="rtl" className="app-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 lg:text-3xl">לידים</h1>
          <p className="mt-1 text-slate-500">{profiles.length} לידים במערכת</p>
        </div>
        <Button
          data-testid="lead-new-button"
          onClick={() => navigate(createPageUrl('ClientForm?status=lead'))}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="ml-2 h-4 w-4" />
          ליד חדש
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="rounded-xl bg-muted/30 p-1 dark:bg-muted/20">
            <div className="flex flex-wrap gap-1">
              {TYPE_TABS.map((tab) => {
                const isActive = typeFilter === tab.key;
                const count = typeCounts[tab.key] || 0;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setTypeFilter(tab.key)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                        isActive ? 'bg-white/25' : 'bg-muted'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="חיפוש לפי שם, טלפון או אימייל"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="pr-10"
            />
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EnhancedEmptyState
          icon={UserPlus}
          title={searchQuery || typeFilter !== 'all' ? 'לא נמצאו לידים תואמים' : 'אין לידים להצגה'}
          description={
            searchQuery || typeFilter !== 'all'
              ? 'נסה לשנות את פילטרי החיפוש.'
              : 'לידים יכולים להיווצר ידנית או דרך ה-AI.'
          }
          primaryAction={{
            label: 'ליד חדש',
            onClick: () => navigate(createPageUrl('ClientForm?status=lead')),
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((profile) => {
            const account = profile.account;
            const contact = profile.primaryContact;
            const clientType = account.client_type || 'private';

            return (
              <Card key={account.id} data-testid={`lead-card-${account.id}`} className="border-0 shadow-sm transition-all hover:shadow-md">
                <CardContent className="flex flex-col gap-4 p-4">
                  <button
                    type="button"
                    onClick={() => navigate(createPageUrl(`ClientDetails?id=${account.id}`))}
                    className="text-right"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-slate-800">{getAccountLabel(account)}</h4>
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        ליד
                      </span>
                      <ClientTypeBadge type={clientType} />
                    </div>
                    <div className="space-y-1 text-xs text-slate-500">
                      {contact?.phone ? (
                        <div className="flex items-center gap-1" dir="ltr">
                          <Phone className="h-3 w-3 shrink-0" />
                          {contact.phone}
                        </div>
                      ) : null}
                      {contact?.email ? (
                        <div className="truncate" dir="ltr">
                          {contact.email}
                        </div>
                      ) : null}
                      {contact?.address_text ? (
                        <div className="flex items-start gap-1">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="line-clamp-2">{contact.address_text}</span>
                        </div>
                      ) : null}
                    </div>
                  </button>

                  <NativeSelect
                    data-testid={`lead-client-type-${account.id}`}
                    value={clientType}
                    onChange={(event) => changeClientType(profile, event.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"
                  >
                    {CLIENT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </NativeSelect>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                    <Button type="button" size="sm" variant="outline" onClick={() => navigate(createPageUrl(`QuoteForm?account_id=${account.id}`))}>
                      <FileText className="ml-1 h-4 w-4" />
                      הצעה
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => navigate(createPageUrl(`JobForm?account_id=${account.id}`))}>
                      <Briefcase className="ml-1 h-4 w-4" />
                      עבודה
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      data-testid={`lead-convert-${account.id}`}
                      onClick={() => convertToActive(profile)}
                    >
                      <UserPlus className="ml-1 h-4 w-4" />
                      הפוך ללקוח
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => scheduleDelete(profile)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
