import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { uploadJobAttachment, listJobAttachments, getJobAttachmentSignedUrl } from '@/lib/storage/storageProvider';
import {
  ArrowRight, MapPin, Calendar, User, Edit, Phone,
  Camera, FileText, Loader2, Image, MessageCircle, Navigation
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { JobStatusBadge, PriorityBadge } from "@/components/ui/DynamicStatusBadge";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import EmptyState from "@/components/shared/EmptyState";
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

import { STATUS_CONFIG, getNextAllowedStatuses } from '@/components/shared/StatusFlow';
import { getLineItemsSubtotal, normalizeJobLineItems } from '@/lib/jobLineItems';

// Status actions removed - using dynamic status from AppConfig

export default function JobDetails() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const { id: routeId } = useParams();
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = routeId || urlParams.get('id');

  const [job, setJob] = useState(null);
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [jobContacts, setJobContacts] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  // Smart scheduling
  const [smartOpen, setSmartOpen] = useState(false);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState([]);

  useEffect(() => {
    if (jobId && user) {
      loadJobData();
    }
  }, [jobId, user]);

  const loadAttachments = async (targetJobId) => {
    if (!user || !targetJobId) return;
    try {
      const items = await listJobAttachments({ userId: user.id, jobId: targetJobId });
      const signedItems = await Promise.all(
        items.map(async (item) => ({
          id: item.id,
          url: await getJobAttachmentSignedUrl({
            bucket: item.bucket,
            objectPath: item.object_path
          })
        }))
      );
      setAttachments(signedItems.filter(item => item.url));
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  };

  useEffect(() => {
    if (job && isEditingSchedule) {
      if (job.scheduled_at && (!job.scheduled_date || !job.scheduled_time)) {
        const scheduledDate = new Date(job.scheduled_at);
        setScheduledDate(format(scheduledDate, 'yyyy-MM-dd'));
        setScheduledTime(format(scheduledDate, 'HH:mm'));
      } else {
        setScheduledDate(job.scheduled_date || '');
        setScheduledTime(job.scheduled_time || '');
      }
    }
  }, [isEditingSchedule, job]);

  const loadJobData = async () => {
    if (!user || !jobId) return;
    try {
      const { data: jobData, error } = await supabase
        .from('jobs')
        .select('*, accounts(account_name)')
        .eq('id', jobId)
        .eq('owner_id', user.id)
        .single();
      if (error) throw error;
      if (jobData) {
        const scheduledDate = jobData.scheduled_at
          ? new Date(jobData.scheduled_at)
          : null;
        const normalizedLineItems = normalizeJobLineItems(jobData.line_items);
        setJob({
          ...jobData,
          account_name: Array.isArray(jobData.accounts) ? jobData.accounts[0]?.account_name : jobData.accounts?.account_name,
          scheduled_date: jobData.scheduled_date || (scheduledDate ? format(scheduledDate, 'yyyy-MM-dd') : null),
          scheduled_time: jobData.scheduled_time || (scheduledDate ? format(scheduledDate, 'HH:mm') : null),
          line_items: normalizedLineItems,
          created_date: jobData.created_date || jobData.created_at
        });
        await loadAttachments(jobData.id);

        const { data: contactsData, error: contactsError } = await supabase
          .from('job_contacts')
          .select('id, full_name, phone, relation, sort_order')
          .eq('job_id', jobData.id)
          .eq('owner_id', user.id)
          .order('sort_order', { ascending: true });
        if (contactsError && contactsError.code !== '42P01') throw contactsError;

        const normalizedContacts = contactsData || [];
        if (normalizedContacts.length > 0) {
          setJobContacts(normalizedContacts);
        } else if (jobData.contact_name || jobData.contact_phone) {
          setJobContacts([{
            id: `legacy-${jobData.id}`,
            full_name: jobData.contact_name || 'ללא שם',
            phone: jobData.contact_phone || '',
            relation: '',
          }]);
        } else {
          setJobContacts([]);
        }

        if (jobData.client_id) {
          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .select('*')
            .eq('id', jobData.client_id)
            .eq('owner_id', user.id)
            .single();
          if (clientError) throw clientError;
          setClient(clientData || null);
        }
      }
    } catch (error) {
      console.error('Error loading job:', error);
      toast.error('שגיאה בטעינת העבודה', {
        description: getDetailedErrorReason(error, 'טעינת העבודה נכשלה.'),
        duration: 9000
      });
    } finally {
      setLoading(false);
    }
  };

  const updateJobStatus = async (newStatus) => {
    if (!user) return;
    setUpdating(true);
    try {
      const updateData = {
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null
      };
      const { error } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId)
        .eq('owner_id', user.id);
      if (error) throw error;
      setJob(prev => ({ ...prev, ...updateData }));
      toast.success('סטטוס העבודה עודכן');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('שגיאה בעדכון סטטוס', {
        description: getDetailedErrorReason(error, 'עדכון הסטטוס נכשל.'),
        duration: 9000
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleScheduleJob = async () => {
    if (!scheduledDate || !scheduledTime) return;
    if (!user) return;
    setUpdating(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      const nextStatus = job?.status === 'waiting_schedule' ? 'waiting_execution' : job?.status;
      const finalStatus = job?.status === 'done' ? 'done' : nextStatus;
      const { error } = await supabase
        .from('jobs')
        .update({
          scheduled_at: scheduledAt,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          status: finalStatus,
          completed_at: finalStatus === 'done' ? (job?.completed_at || new Date().toISOString()) : null
        })
        .eq('id', jobId)
        .eq('owner_id', user.id);
      if (error) throw error;
      setJob(prev => ({
        ...prev,
        scheduled_at: scheduledAt,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        status: finalStatus,
        completed_at: finalStatus === 'done' ? (prev?.completed_at || new Date().toISOString()) : null
      }));
      setIsEditingSchedule(false);
      toast.success('התזמון נשמר בהצלחה');
    } catch (error) {
      console.error('Error scheduling job:', error);
      toast.error('שגיאה בעדכון תזמון', {
        description: getDetailedErrorReason(error, 'עדכון התזמון נכשל.'),
        duration: 9000
      });
    } finally {
      setUpdating(false);
    }
  };

  const HOME_BASE = { lat: 31.7892, lng: 34.6486 }; // Approx. Ashdod (אשדוד)
  const WORKDAY_START = '07:00';
  const WORKDAY_END = '20:00';
  const BUFFER_MIN = 20;

  const parseTimeToMinutes = (t) => {
    const [hh, mm] = String(t || '00:00').split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };

  const minutesToTime = (m) => {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const routeDurationSeconds = async ({ origin, destination, departureIso }) => {
    try {
      const resp = await fetch('/api/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destination, departureTime: departureIso }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return Number(data?.durationSeconds) || null;
    } catch {
      return null;
    }
  };

  const getSmartSuggestions = async () => {
    if (!user || !job) return;
    if (!job.address_lat || !job.address_lng) {
      toast.error('לא ניתן לחשב תזמון חכם', {
        description: 'אין כתובת מדויקת לעבודה זו, שמור כתובת עם נקודת מיקום כדי לחשב הצעות אופטימליות על מפה.',
        duration: 6000
      });
      return;
    }

    setSmartLoading(true);
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const { data: scheduledJobs, error } = await supabase
        .from('jobs')
        .select('id,title,scheduled_at,scheduled_date,scheduled_time,estimated_duration_minutes,address_lat,address_lng')
        .eq('owner_id', user.id)
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', end.toISOString())
        .neq('id', jobId);
      if (error) throw error;

      const durationMin = Number(job.estimated_duration_minutes) || 180;
      const jobLoc = { lat: Number(job.address_lat), lng: Number(job.address_lng) };

      const jobsByDay = new Map();
      (scheduledJobs || []).forEach((j) => {
        const d = new Date(j.scheduled_at);
        const key = format(d, 'yyyy-MM-dd');
        if (!jobsByDay.has(key)) jobsByDay.set(key, []);
        jobsByDay.get(key).push(j);
      });

      const suggestions = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const dayKey = format(day, 'yyyy-MM-dd');
        const dayJobs = (jobsByDay.get(dayKey) || []).slice().sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

        const dayStartMin = parseTimeToMinutes(WORKDAY_START);
        const dayEndMin = parseTimeToMinutes(WORKDAY_END);

        // Build timeline blocks
        const blocks = dayJobs.map((j) => {
          const start = parseTimeToMinutes(format(new Date(j.scheduled_at), 'HH:mm'));
          const dur = Number(j.estimated_duration_minutes) || 180;
          const endMin = start + dur;
          return { ...j, startMin: start, endMin };
        });

        const candidates = [];
        if (blocks.length === 0) {
          candidates.push({ kind: 'home', prev: null, next: null, startMin: dayStartMin });
        } else {
          // before first
          candidates.push({ kind: 'before', prev: null, next: blocks[0], startMin: dayStartMin });
          // between
          for (let b = 0; b < blocks.length - 1; b++) {
            candidates.push({ kind: 'between', prev: blocks[b], next: blocks[b + 1] });
          }
          // after last
          candidates.push({ kind: 'after', prev: blocks[blocks.length - 1], next: null });
        }

        for (const c of candidates) {
          const prevLoc = c.prev?.address_lat && c.prev?.address_lng
            ? { lat: Number(c.prev.address_lat), lng: Number(c.prev.address_lng) }
            : HOME_BASE;
          const nextLoc = c.next?.address_lat && c.next?.address_lng
            ? { lat: Number(c.next.address_lat), lng: Number(c.next.address_lng) }
            : null;

          let startMin = c.startMin;
          if (c.kind === 'between') {
            startMin = (c.prev?.endMin || dayStartMin) + BUFFER_MIN;
          }
          if (c.kind === 'after') {
            startMin = (c.prev?.endMin || dayStartMin) + BUFFER_MIN;
          }

          // route prev -> new (departure = day + startMin)
          const depPrev = new Date(day);
          depPrev.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
          const prevDrive = await routeDurationSeconds({ origin: prevLoc, destination: jobLoc, departureIso: depPrev.toISOString() });
          const prevDriveMin = Math.ceil((prevDrive || 0) / 60);
          const adjustedStart = Math.max(dayStartMin, startMin + prevDriveMin);
          const endMin = adjustedStart + durationMin;

          // must fit workday
          if (endMin > dayEndMin) continue;

          // if there is next job, ensure we can reach it
          let nextDriveMin = 0;
          if (nextLoc && c.next?.startMin != null) {
            const depNext = new Date(day);
            depNext.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
            const nextDrive = await routeDurationSeconds({ origin: jobLoc, destination: nextLoc, departureIso: depNext.toISOString() });
            nextDriveMin = Math.ceil((nextDrive || 0) / 60);
            const latestFinish = (c.next.startMin || dayEndMin) - BUFFER_MIN;
            if (endMin + nextDriveMin > latestFinish) continue;
          }

          const driveTotal = prevDriveMin + nextDriveMin;
          suggestions.push({
            date: dayKey,
            time: minutesToTime(adjustedStart),
            driveMinutes: driveTotal,
            score: driveTotal * 1000 + adjustedStart,
          });
        }
      }

      suggestions.sort((a, b) => a.score - b.score);
      setSmartSuggestions(suggestions.slice(0, 3));
      setSmartOpen(true);
    } catch (error) {
      console.error('Error building smart suggestions:', error);
      toast.error('שגיאה בחישוב תזמון חכם', { description: getDetailedErrorReason(error, 'חישוב התזמון החכם נכשל.'), duration: 9000 });
    } finally {
      setSmartLoading(false);
    }
  };

  const applySmartSuggestion = async (s) => {
    setScheduledDate(s.date);
    setScheduledTime(s.time);
    setSmartOpen(false);
    setIsEditingSchedule(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!user) return;

    setUploadingPhoto(true);
    try {
      const attachment = await uploadJobAttachment({ userId: user.id, jobId, file });
      const url = await getJobAttachmentSignedUrl({
        bucket: attachment.bucket,
        objectPath: attachment.object_path
      });
      if (url) {
        setAttachments(prev => [{ id: attachment.id, url }, ...prev]);
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('שגיאה בהעלאת תמונה', {
        description: getDetailedErrorReason(error, 'העלאת התמונה נכשלה.'),
        duration: 9000
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    if (!user) return;
    try {
      const notes = job.notes ? `${job.notes}\n\n[${format(new Date(), 'dd/MM/yyyy HH:mm')}]\n${newNote}` : `[${format(new Date(), 'dd/MM/yyyy HH:mm')}]\n${newNote}`;
      const { error } = await supabase
        .from('jobs')
        .update({ notes })
        .eq('id', jobId)
        .eq('owner_id', user.id);
      if (error) throw error;
      setJob(prev => ({ ...prev, notes }));
      setNewNote('');
    } catch (error) {
      console.error('Error adding note:', error);
      toast.error('שגיאה בהוספת הערה', {
        description: getDetailedErrorReason(error, 'הוספת ההערה נכשלה.'),
        duration: 9000
      });
    }
  };



  if (isLoadingAuth) return <LoadingSpinner />;
  if (!user) return null;
  if (loading) return <LoadingSpinner />;
  if (!job) return <EmptyState icon={FileText} title="עבודה לא נמצאה" description="העבודה המבוקשת לא נמצאה במערכת" />;

  const lineItems = Array.isArray(job.line_items) ? job.line_items : [];
  const lineItemsSubtotal = getLineItemsSubtotal(lineItems);

  return (
    <div dir="rtl" className="p-4 lg:p-8 space-y-6 max-w-4xl mx-auto">
        {/* Created Date */}
        <div className="text-sm text-slate-500">
          נוצרה: {format(new Date(job.created_date), 'dd/MM/yyyy', { locale: he })}
        </div>

        {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate(createPageUrl('Jobs'))}
          className="rounded-full"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-800">{job.title}</h1>
          <p className="text-slate-500 mt-1">{job.client_name || job.account_name || 'ללא לקוח'}</p>
        </div>
        {!job.quote_id ? (
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl(`JobForm?id=${job.id}`))}
          >
            <Edit className="w-4 h-4 ml-2" />
            עריכה
          </Button>
        ) : (
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl(`JobForm?id=${job.id}`))}
            className="text-amber-600 border-amber-300"
          >
            <Edit className="w-4 h-4 ml-2" />
            עריכת עבודה
          </Button>
        )}
      </div>

      {/* Status & Priority */}
       <div className="flex flex-wrap gap-3">
         <JobStatusBadge status={job.status} />
         <PriorityBadge priority={job.priority} />
       </div>

      {/* Status Flow */}
      {job.status !== 'done' && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-500 mb-3">קדם סטטוס:</p>
            <div className="flex flex-wrap gap-2">
              {getNextAllowedStatuses(job.status).map((nextStatus) => {
                const cfg = STATUS_CONFIG[nextStatus];
                return (
                  <Button
                    key={nextStatus}
                    size="sm"
                    disabled={updating}
                    onClick={() => updateJobStatus(nextStatus)}
                    style={{ backgroundColor: cfg.color }}
                    className="text-white hover:opacity-90"
                  >
                    {updating ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : null}
                    {cfg.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">שורות שירות</CardTitle>
          {job.quote_id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(createPageUrl(`QuoteDetails?id=${job.quote_id}`))}
              className="text-blue-600 border-blue-300"
            >
              <FileText className="w-4 h-4 ml-1" />
              פתח הצעת מחיר
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {lineItems.length === 0 ? (
            <p className="text-slate-500 text-sm">לא קיימות שורות שירות בעבודה זו.</p>
          ) : (
            <div className="space-y-3">
              {lineItems.map((item, idx) => (
                <div key={item.id || idx} className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-50 rounded-lg">
                  <div className="col-span-5 font-medium text-slate-800">{item.description}</div>
                  <div className="col-span-2 text-center text-slate-600">{item.quantity}</div>
                  <div className="col-span-2 text-center text-slate-600" dir="ltr">
                    {Number(item.unit_price || 0).toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                  </div>
                  <div className="col-span-3 text-left font-semibold text-slate-800" dir="ltr">
                    {((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)).toLocaleString('he-IL', { minimumFractionDigits: 2 })} ₪
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-3 p-4 bg-slate-800 text-white rounded-xl mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">סכום לפני מע"מ:</span>
              <span className="font-medium" dir="ltr">
                {lineItemsSubtotal.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">מע"מ (18%):</span>
              <span className="font-medium" dir="ltr">
                {(lineItemsSubtotal * 0.18).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪
              </span>
            </div>
            <div className="border-t border-white/20 pt-3 flex items-center justify-between">
              <span className="text-lg font-bold">סה"כ:</span>
              <span className="text-2xl font-bold" dir="ltr">
                {(lineItemsSubtotal * 1.18).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₪
              </span>
            </div>
          </div>
        </CardContent>
      </Card>


      <Dialog open={smartOpen} onOpenChange={setSmartOpen}>
        <DialogContent className="sm:max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>הצעות זמן (7 ימים קדימה)</DialogTitle>
          </DialogHeader>
          {smartSuggestions.length === 0 ? (
            <div className="text-sm text-slate-600">
              לא נמצאו חלונות זמן מתאימים. נסה יום אחר בטווח תאריכים/שעות העבודה שלך.
            </div>
          ) : (
            <div className="space-y-3">
              {smartSuggestions.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50">
                  <div>
                    <div className="font-semibold text-slate-800">{format(new Date(s.date), 'dd/MM/yyyy')} • {s.time}</div>
                    <div className="text-xs text-slate-500">אומדן נסיעה כולל: {s.driveMinutes} דק׳</div>
                  </div>
                  <Button onClick={() => applySmartSuggestion(s)} variant="outline">בחר</Button>
                </div>
              ))}
              <div className="text-xs text-slate-500">* החישוב מבוסס הערכת נסיעה משוערת (או שירות מסלול Google Routes) ולא הבטחת זמני אמת.</div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Client Info */}
      {client && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">פרטי לקוח ואיש קשר</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div 
              className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
              onClick={() => navigate(createPageUrl(`ClientDetails?id=${client.id}`))}
            >
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-emerald-100 text-emerald-700">
                  {job.client_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h4 className="font-semibold text-slate-800">{job.client_name || job.account_name || 'ללא לקוח'}</h4>
                <p className="text-sm text-slate-500" dir="ltr">{job.client_phone || client.phone}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  const phone = (job.client_phone || client.phone || '').replace(/\D/g, '');
                  window.open(`https://wa.me/${phone}`, '_blank');
                }}
                className="text-green-600 hover:text-green-700"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(`tel:${job.client_phone || client.phone}`);
                }}
              >
                <Phone className="w-4 h-4" />
              </Button>
            </div>

            {jobContacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {contact.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-xs text-blue-600 font-medium mb-1">איש קשר בעבודה</p>
                  <h4 className="font-semibold text-slate-800">{contact.full_name}</h4>
                  {contact.relation && (
                    <p className="text-xs text-slate-500 mt-1">{contact.relation}</p>
                  )}
                  {contact.phone && (
                    <p className="text-sm text-slate-500" dir="ltr">{contact.phone}</p>
                  )}
                </div>
                {contact.phone && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => window.open(`tel:${contact.phone}`)}
                  >
                    <Phone className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}

          </CardContent>
        </Card>
      )}

      {!client && jobContacts.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">אנשי קשר בעבודה</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {jobContacts.map((contact) => (
              <div key={contact.id} className="flex items-center gap-4 p-4 rounded-xl bg-blue-50 border border-blue-200">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-blue-100 text-blue-700">
                    {contact.full_name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h4 className="font-semibold text-slate-800">{contact.full_name}</h4>
                  {contact.relation && (
                    <p className="text-xs text-slate-500 mt-1">{contact.relation}</p>
                  )}
                  {contact.phone && (
                    <p className="text-sm text-slate-500" dir="ltr">{contact.phone}</p>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Job Details */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">פרטי העבודה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.description && (
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-500 mb-2 font-medium">תיאור העבודה</p>
              <p className="text-slate-700 leading-relaxed">{job.description}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-slate-500">כתובת</p>
                <p className="font-medium text-slate-800">{job.address}{job.city ? `, ${job.city}` : ''}</p>
                {job.arrival_notes && (
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{job.arrival_notes}</p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const addr = encodeURIComponent(`${job.address || ''}${job.city ? `, ${job.city}` : ''}`);
                  if (job.address_lat && job.address_lng) {
                    window.open(`https://waze.com/ul?ll=${job.address_lat},${job.address_lng}&navigate=yes`, '_blank');
                  } else {
                    window.open(`https://waze.com/ul?q=${addr}&navigate=yes`, '_blank');
                  }
                }}
                className="text-blue-600"
              >
                <Navigation className="w-4 h-4 ml-1" />
                נווט
              </Button>
            </div>

            {!isEditingSchedule ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">תזמון העבודה</p>
                  <p className="font-medium text-slate-800">
                    {job.scheduled_date ? (
                      <>
                          {format(new Date(job.scheduled_date), 'dd/MM/yyyy')}
                          {job.scheduled_time && ` • ${job.scheduled_time}`}
                        </>
                      ) : (
                        'לא נקבע תזמון'
                      )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={getSmartSuggestions}
                  disabled={smartLoading}
                >
                  {smartLoading ? 'טוען...' : 'תזמון חכם'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditingSchedule(true)}
                >
                  {job.scheduled_date ? 'שנה' : 'קבע'}
                </Button>
              </div>
            ) : (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <p className="text-sm font-medium text-slate-700">עדכון תזמון</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm text-slate-600">תאריך</label>
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm text-slate-600">שעה</label>
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleScheduleJob}
                    disabled={!scheduledDate || !scheduledTime || updating}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {updating ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : null}
                    שמור תזמון
                  </Button>
                  <Button
                    onClick={() => setIsEditingSchedule(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={updating}
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            )}

            {job.assigned_to_name && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500">משויך ל</p>
                  <p className="font-medium text-slate-800">{job.assigned_to_name}</p>
                </div>
              </div>
            )}

          </div>
        </CardContent>
      </Card>

      {/* Photos */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="w-5 h-5" />
            תמונות
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-4">
            {(attachments.length ? attachments.map(a => a.url) : (job.photos || [])).map((photo, idx) => (
              <a 
                key={idx} 
                href={photo} 
                target="_blank" 
                rel="noopener noreferrer"
                className="aspect-square rounded-xl overflow-hidden bg-slate-100"
              >
                <img 
                  src={photo} 
                  alt={`תמונה ${idx + 1}`}
                  className="w-full h-full object-cover hover:scale-105 transition-transform"
                />
              </a>
            ))}
          </div>
          
          <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-emerald-300 hover:bg-emerald-50 transition-colors">
            {uploadingPhoto ? (
              <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />
            ) : (
              <Image className="w-5 h-5 text-slate-400" />
            )}
            <span className="text-slate-500">
              {uploadingPhoto ? 'מעלה...' : 'העלה תמונה'}
            </span>
            <input 
              type="file" 
              accept="image/*" 
              className="hidden"
              onChange={handlePhotoUpload}
              disabled={uploadingPhoto}
            />
          </label>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">הערות</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.notes && (
            <div className="p-4 bg-slate-50 rounded-xl whitespace-pre-wrap text-slate-700">
              {job.notes}
            </div>
          )}
          
          <div className="flex gap-2">
            <Textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="הוסף הערה חדשה..."
              rows={2}
              className="flex-1"
            />
            <Button 
              onClick={addNote}
              disabled={!newNote.trim()}
              style={{ backgroundColor: '#00214d' }}
              className="hover:opacity-90"
            >
              הוסף
            </Button>
          </div>

          {job.internal_notes && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-medium text-amber-700 mb-2">הערות פנימיות</p>
              <p className="text-slate-700 whitespace-pre-wrap">{job.internal_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


