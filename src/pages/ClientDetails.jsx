import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, Plus, Phone, Mail, User, Pencil, Trash2, Star, X, Check } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import {
  getClientProfile,
  addContact,
  updateContactById,
  deleteContactById,
  setPrimaryContact,
  setAccountStatus,
  setAccountClientType,
} from '@/data/clientsRepo';
import { listQuotesByAccount } from '@/data/quotesRepo';
import { listJobsByAccount } from '@/data/jobsRepo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClientStatusBadge, ClientTypeBadge } from '@/components/ui/DynamicStatusBadge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { format } from 'date-fns';

const EMPTY_CONTACT_FORM = () => ({ full_name: '', role: '', phone: '', email: '' });

export default function ClientDetails() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const urlParams = new URLSearchParams(window.location.search);
  const accountId = urlParams.get('id');

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [jobs, setJobs] = useState([]);

  // Contact editing state
  const [editingId, setEditingId] = useState(null); // contactId | 'new' | null
  const [editForm, setEditForm] = useState(EMPTY_CONTACT_FORM());
  const [saving, setSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingType, setUpdatingType] = useState(false);

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
        setContacts(clientProfile.allContacts || []);
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

  const primary = contacts.find((c) => c.is_primary) || contacts[0] || null;
  const sortedQuotes = useMemo(() => [...quotes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [quotes]);
  const sortedJobs = useMemo(() => [...jobs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [jobs]);

  // ─── Contact actions ───────────────────────────────────────────────────────

  function startEdit(contact) {
    setEditingId(contact.id);
    setEditForm({
      full_name: contact.full_name || '',
      role: contact.role || '',
      phone: contact.phone || '',
      email: contact.email || '',
    });
  }

  function startNew() {
    setEditingId('new');
    setEditForm(EMPTY_CONTACT_FORM());
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_CONTACT_FORM());
  }

  async function handleSaveContact() {
    if (!editForm.full_name.trim()) {
      toast.error('שם הוא שדה חובה');
      return;
    }
    setSaving(true);
    try {
      if (editingId === 'new') {
        const newContact = await addContact(accountId, editForm);
        setContacts((prev) => [...prev, newContact]);
        toast.success('איש קשר נוסף');
      } else {
        await updateContactById(editingId, editForm);
        setContacts((prev) =>
          prev.map((c) => (c.id === editingId ? { ...c, ...editForm } : c))
        );
        toast.success('איש קשר עודכן');
      }
      cancelEdit();
    } catch (error) {
      toast.error('שגיאה בשמירת איש קשר', {
        description: getDetailedErrorReason(error, 'השמירה נכשלה.'),
        duration: 9000,
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteContact(contact) {
    const isPrimary = contact.is_primary;
    try {
      await deleteContactById(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      toast.success('איש קשר נמחק', {
        description: isPrimary ? 'איש הקשר הראשי הוסר.' : undefined,
      });
    } catch (error) {
      toast.error('שגיאה במחיקת איש קשר', {
        description: getDetailedErrorReason(error, 'המחיקה נכשלה.'),
        duration: 9000,
      });
    }
  }

  async function handleSetPrimary(contact) {
    if (contact.is_primary) return;
    try {
      await setPrimaryContact(accountId, contact.id);
      setContacts((prev) =>
        prev.map((c) => ({ ...c, is_primary: c.id === contact.id }))
      );
    } catch (error) {
      toast.error('שגיאה בעדכון איש קשר ראשי', {
        description: getDetailedErrorReason(error, 'העדכון נכשל.'),
        duration: 9000,
      });
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  async function handleStatusToggle() {
    if (!profile?.account?.id) return;
    const current = profile.account.status || 'active';
    const nextStatus = current === 'lead' ? 'active' : 'lead';
    setUpdatingStatus(true);
    try {
      await setAccountStatus(profile.account.id, nextStatus);
      setProfile((prev) => (prev ? { ...prev, account: { ...prev.account, status: nextStatus } } : prev));
      toast.success(nextStatus === 'lead' ? 'הלקוח הועבר ללידים' : 'הליד הומר ללקוח פעיל');
    } catch (error) {
      toast.error('שגיאה בעדכון סטטוס לקוח', {
        description: getDetailedErrorReason(error, 'עדכון הסטטוס נכשל.'),
        duration: 9000,
      });
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleClientTypeChange(nextType) {
    if (!profile?.account?.id) return;
    const currentType = profile.account.client_type || 'private';
    if (nextType === currentType) return;
    setUpdatingType(true);
    try {
      await setAccountClientType(profile.account.id, nextType);
      setProfile((prev) => (prev ? { ...prev, account: { ...prev.account, client_type: nextType } } : prev));
      toast.success('סוג הלקוח עודכן');
    } catch (error) {
      toast.error('שגיאה בעדכון סוג לקוח', {
        description: getDetailedErrorReason(error, 'עדכון סוג הלקוח נכשל.'),
        duration: 9000,
      });
    } finally {
      setUpdatingType(false);
    }
  }

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  if (!profile) {
    return <EmptyState icon={User} title="לקוח לא נמצא" description="לא נמצאו פרטי לקוח" />;
  }

  return (
    <div dir="rtl" className="space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl((profile.account.status || 'active') === 'lead' ? 'Leads' : 'Clients'))}
          className="rounded-full"
        >
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{profile.account.account_name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <ClientStatusBadge status={profile.account.status || 'active'} />
            <ClientTypeBadge type={profile.account.client_type || 'private'} />
          </div>
        </div>
        <Button onClick={() => navigate(createPageUrl(`ClientForm?id=${profile.account.id}`))} variant="outline">
          עריכת לקוח
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleStatusToggle}
            disabled={updatingStatus}
            data-testid="client-details-toggle-status"
          >
            {(profile.account.status || 'active') === 'lead' ? 'הפוך ללקוח פעיל' : 'הפוך לליד'}
          </Button>

          <div className="sm:w-56">
            <Select
              value={profile.account.client_type || 'private'}
              onValueChange={handleClientTypeChange}
              disabled={updatingType}
            >
              <SelectTrigger data-testid="client-details-client-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">לקוח פרטי</SelectItem>
                <SelectItem value="company">חברה</SelectItem>
                <SelectItem value="bath_company">חברת אמבטיות</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
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

      {/* Contacts card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>אנשי קשר ({contacts.length})</CardTitle>
          {editingId === null ? (
            <Button variant="outline" size="sm" onClick={startNew} className="gap-1">
              <Plus className="h-4 w-4" />
              הוסף
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          {contacts.length === 0 && editingId !== 'new' ? (
            <p className="py-2 text-sm text-slate-500">אין אנשי קשר — לחץ "הוסף" להוספה</p>
          ) : null}

          {contacts.map((contact) =>
            editingId === contact.id ? (
              /* Edit inline form */
              <div key={contact.id} className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="שם מלא *"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  />
                  <Input
                    placeholder="תפקיד"
                    value={editForm.role}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  />
                  <Input
                    placeholder="טלפון"
                    value={editForm.phone}
                    dir="ltr"
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="אימייל"
                    value={editForm.email}
                    dir="ltr"
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" onClick={handleSaveContact} disabled={saving} className="gap-1" style={{ backgroundColor: '#00214d' }}>
                    <Check className="h-3.5 w-3.5" />
                    שמור
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              /* Display row */
              <div key={contact.id} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
                <button
                  type="button"
                  title={contact.is_primary ? 'ראשי' : 'הפוך לראשי'}
                  onClick={() => handleSetPrimary(contact)}
                  className={`flex-shrink-0 ${contact.is_primary ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
                >
                  <Star className="h-4 w-4" fill={contact.is_primary ? 'currentColor' : 'none'} />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-slate-800">{contact.full_name}</span>
                    {contact.role ? (
                      <span className="text-xs text-slate-500">{contact.role}</span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} dir="ltr" className="text-xs text-blue-600 hover:underline">
                        {contact.phone}
                      </a>
                    ) : null}
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} dir="ltr" className="text-xs text-blue-600 hover:underline">
                        {contact.email}
                      </a>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(contact)}>
                    <Pencil className="h-3.5 w-3.5 text-slate-500" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDeleteContact(contact)}
                    disabled={contact.is_primary && contacts.length > 1}
                    title={contact.is_primary && contacts.length > 1 ? 'לא ניתן למחוק את הראשי כל עוד יש אנשי קשר נוספים' : 'מחק'}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                  </Button>
                </div>
              </div>
            )
          )}

          {/* New contact inline form */}
          {editingId === 'new' ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="שם מלא *"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, full_name: e.target.value }))}
                />
                <Input
                  placeholder="תפקיד"
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                />
                <Input
                  placeholder="טלפון"
                  value={editForm.phone}
                  dir="ltr"
                  onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
                <Input
                  placeholder="אימייל"
                  value={editForm.email}
                  dir="ltr"
                  onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" onClick={handleSaveContact} disabled={saving} className="gap-1" style={{ backgroundColor: '#00214d' }}>
                  <Check className="h-3.5 w-3.5" />
                  הוסף
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : null}

          {profile.account.notes ? (
            <p className="mt-2 text-xs text-slate-500 border-t pt-2">הערות: {profile.account.notes}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* Quotes */}
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

      {/* Jobs */}
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
