import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { OPS_MAP_DEFAULTS } from '@/config/opsMapConfig';
import {
  geocodeAddress,
  listMapJobs,
  updateMapJobCoordinates,
  scheduleMapJob,
} from '@/data/mapRepo';
import { isUsableJobCoords, parseCoord } from '@/lib/geo/coordsPolicy';
import { buildTenMinuteTimeOptions, isTenMinuteSlot, toTenMinuteSlot } from '@/lib/time/timeSlots';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  Search,
  ArrowUpRight,
  LayoutGrid,
  Rows3,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { JobStatusBadge, NextActionBadge, PriorityBadge } from '@/components/ui/DynamicStatusBadge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { getDetailedErrorReason } from '@/lib/errorMessages';
import { useUiPreferences } from '@/lib/ui/useUiPreferences';

const DEFAULT_CENTER = [32.0853, 34.7818];

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (color) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3)"><div style="transform:rotate(45deg);margin:4px 0 0 9px;color:#fff;font-weight:700">•</div></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
};

const STATUS_COLORS = {
  quote: '#6366f1',
  waiting_schedule: '#f59e0b',
  waiting_execution: '#3b82f6',
  done: '#10b981',
};

const GEO_BACKFILL_MAX = 20;
const GEO_BACKFILL_CONCURRENCY = 2;
const GEO_RETRY_MS = 24 * 60 * 60 * 1000;
const GEO_RETRY_PREFIX = 'map-geocode-retry-until:';
const TIME_OPTIONS_10_MIN = buildTenMinuteTimeOptions();

function readRetryUntil(jobId) {
  try {
    const raw = localStorage.getItem(`${GEO_RETRY_PREFIX}${jobId}`);
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

function setRetryUntil(jobId, ts) {
  try {
    localStorage.setItem(`${GEO_RETRY_PREFIX}${jobId}`, String(ts));
  } catch {
    // Ignore storage failures in private mode.
  }
}

function clearRetryUntil(jobId) {
  try {
    localStorage.removeItem(`${GEO_RETRY_PREFIX}${jobId}`);
  } catch {
    // Ignore storage failures in private mode.
  }
}

function normalizeMapJob(job) {
  const accountRel = Array.isArray(job.accounts) ? job.accounts[0] : job.accounts;
  const scheduledSource = job.scheduled_start_at || null;
  const scheduledAt = scheduledSource ? new Date(scheduledSource) : null;
  const lat = parseCoord(job.lat);
  const lng = parseCoord(job.lng);
  const normalizedAddress = String(job.address_text || job.address || '').trim();
  const hasAddress = Boolean(normalizedAddress);
  const hasRawCoords = lat != null || lng != null;
  const hasCoords = isUsableJobCoords(lat, lng);

  return {
    id: job.id,
    account_id: job.account_id || null,
    account_name: accountRel?.account_name || job.account_name || job.client_name || 'ללא לקוח',
    title: job.title || job.subject || 'ללא כותרת',
    description: job.description || job.notes || '',
    status: job.status || 'waiting_schedule',
    priority: job.priority || 'normal',
    address_text: normalizedAddress,
    arrival_notes: job.arrival_notes || '',
    lat,
    lng,
    hasAddress,
    hasCoords,
    invalid_coords: hasRawCoords && !hasCoords,
    geocode_failed: false,
    scheduled_start_at: scheduledSource,
    scheduled_date: scheduledAt ? format(scheduledAt, 'yyyy-MM-dd') : '',
    scheduled_time: scheduledAt ? format(scheduledAt, 'HH:mm') : '',
  };
}

function compareByScheduledAt(a, b) {
  return new Date(a.scheduled_start_at).getTime() - new Date(b.scheduled_start_at).getTime();
}

function getEtaSourceText(job, jobs) {
  if (!job?.scheduled_start_at) return 'אין מקור ETA כי העבודה לא מתוזמנת';

  const currentDate = new Date(job.scheduled_start_at);
  const sameDayJobs = jobs
    .filter(
      (item) =>
        item.scheduled_start_at &&
        isSameDay(new Date(item.scheduled_start_at), currentDate)
    )
    .sort(compareByScheduledAt);

  const idx = sameDayJobs.findIndex((item) => item.id === job.id);
  if (idx > 0) return 'מהעבודה הקודמת';

  return OPS_MAP_DEFAULTS.dayStartOrigin.address;
}

export default function JobsMapPage() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const { preferences, setPreference } = useUiPreferences();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' });
  const isCompactSidebar = preferences.mapSidebarMode !== 'expanded';

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadJobs() {
      try {
        const rawJobs = await listMapJobs();
        const normalized = rawJobs.map(normalizeMapJob);
        const now = Date.now();
        const pending = normalized
          .filter((job) => !job.hasCoords && job.address_text.trim())
          .filter((job) => readRetryUntil(job.id) <= now)
          .slice(0, GEO_BACKFILL_MAX);

        const nextById = new Map(normalized.map((job) => [job.id, job]));
        const queue = [...pending];
        const workers = Array.from({ length: GEO_BACKFILL_CONCURRENCY }, async () => {
          while (queue.length > 0) {
            const job = queue.shift();
            if (!job) break;

            try {
              const geo = await geocodeAddress(job.address_text);
              const lat = parseCoord(geo?.lat);
              const lng = parseCoord(geo?.lng);
              if (!isUsableJobCoords(lat, lng)) {
                setRetryUntil(job.id, now + GEO_RETRY_MS);
                nextById.set(job.id, { ...job, geocode_failed: true });
                continue;
              }

              try {
                await updateMapJobCoordinates(job.id, lat, lng);
              } catch (persistError) {
                console.error('Failed to persist geocoded coordinates for job', job.id, persistError);
              }
              clearRetryUntil(job.id);
              nextById.set(job.id, {
                ...job,
                lat,
                lng,
                hasCoords: true,
                invalid_coords: false,
                geocode_failed: false,
              });
            } catch (error) {
              console.error('Geocode failed for job', job.id, error);
              setRetryUntil(job.id, Date.now() + GEO_RETRY_MS);
              nextById.set(job.id, { ...job, geocode_failed: true });
            }
          }
        });

        await Promise.all(workers);
        const withCoords = normalized.map((job) => nextById.get(job.id) || job);

        if (!mounted) return;
        setJobs(withCoords);
        const firstWithCoords = withCoords.find((job) => job.hasCoords);
        if (firstWithCoords) {
          setMapCenter([firstWithCoords.lat, firstWithCoords.lng]);
        } else {
          setMapCenter(DEFAULT_CENTER);
        }
      } catch (error) {
        console.error('Error loading map jobs:', error);
        if (mounted) {
          toast.error('טעינת המפה נכשלה', {
            description: getDetailedErrorReason(error, 'טעינת נתוני המפה נכשלה.'),
            duration: 9000,
          });
        }
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

      if (dateFrom && (!job.scheduled_start_at || new Date(job.scheduled_start_at) < new Date(`${dateFrom}T00:00:00`))) {
        return false;
      }

      if (dateTo && (!job.scheduled_start_at || new Date(job.scheduled_start_at) > new Date(`${dateTo}T23:59:59`))) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, dateFrom, dateTo]);

  function selectJob(job) {
    setSelectedJob(job);
    if (job.hasCoords) setMapCenter([job.lat, job.lng]);
  }

  async function handleScheduleJob() {
    if (!selectedJob || !scheduleData.date || !scheduleData.time) return;
    if (!isTenMinuteSlot(scheduleData.time)) {
      toast.error('יש לבחור שעה בקפיצות של 10 דקות');
      return;
    }

    try {
      const scheduledStartAt = new Date(`${scheduleData.date}T${scheduleData.time}`).toISOString();
      const result = await scheduleMapJob(selectedJob.id, scheduledStartAt, selectedJob.status);

      setJobs((prev) =>
        prev.map((job) =>
          job.id === selectedJob.id
            ? {
                ...job,
                scheduled_start_at: result.scheduled_start_at,
                scheduled_date: scheduleData.date,
                scheduled_time: scheduleData.time,
                status: result.status,
              }
            : job
        )
      );

      setSelectedJob((prev) =>
        prev
          ? {
              ...prev,
              scheduled_start_at: result.scheduled_start_at,
              scheduled_date: scheduleData.date,
              scheduled_time: scheduleData.time,
              status: result.status,
            }
          : prev
      );

      setScheduleDialogOpen(false);
      setScheduleData({ date: '', time: '' });
    } catch (error) {
      console.error('Schedule failed:', error);
      toast.error('שגיאה בעדכון תזמון', {
        description: getDetailedErrorReason(error, 'עדכון התזמון נכשל.'),
        duration: 7000,
      });
    }
  }

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div data-testid="map-page" dir="rtl" className="flex h-[calc(100vh-64px)] flex-col lg:h-screen lg:flex-row">
      <aside className="order-2 flex h-1/2 flex-col border-l border-slate-200 bg-white lg:order-1 lg:h-full lg:w-[420px] dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 p-4">
          <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800">
            <MapPin className="h-6 w-6 text-emerald-600" />
            מפת עבודות
          </h1>

          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input
                data-testid="map-search-input"
                placeholder="חיפוש לפי עבודה, לקוח או כתובת..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="border-0 bg-slate-50 pr-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                data-testid="map-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
              />
              <Input
                data-testid="map-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
              <Button
                type="button"
                size="sm"
                variant={isCompactSidebar ? 'default' : 'ghost'}
                className={isCompactSidebar ? 'bg-[#00214d] text-white hover:bg-[#00214d]/90' : ''}
                onClick={() => setPreference('mapSidebarMode', 'compact')}
              >
                <Rows3 className="ml-1 h-4 w-4" />
                קומפקטי
              </Button>
              <Button
                type="button"
                size="sm"
                variant={isCompactSidebar ? 'ghost' : 'default'}
                className={!isCompactSidebar ? 'bg-[#00214d] text-white hover:bg-[#00214d]/90' : ''}
                onClick={() => setPreference('mapSidebarMode', 'expanded')}
              >
                <LayoutGrid className="ml-1 h-4 w-4" />
                מורחב
              </Button>
            </div>
          </div>
        </div>

        {selectedJob ? (
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 font-semibold text-slate-800">{selectedJob.title}</div>
            <div className="text-sm text-slate-600">{selectedJob.account_name}</div>
            <div className="mt-2 text-xs text-slate-500">{selectedJob.address_text || 'ללא כתובת'}</div>
            <div className="mt-2">
              <NextActionBadge status={selectedJob.status} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                data-testid="map-selected-schedule-button"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setScheduleData({
                    date: selectedJob.scheduled_date || '',
                    time: toTenMinuteSlot(selectedJob.scheduled_time || ''),
                  });
                  setScheduleDialogOpen(true);
                }}
              >
                <Clock className="ml-1 h-4 w-4" /> תזמון
              </Button>

              <Button
                data-testid="map-selected-open-calendar"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigate(createPageUrl(`Calendar?job_id=${selectedJob.id}`))}
              >
                <Calendar className="ml-1 h-4 w-4" /> ללוח שנה
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={() => navigate(createPageUrl(`JobDetails?id=${selectedJob.id}`))}
              >
                <Briefcase className="ml-1 h-4 w-4" /> פרטי עבודה
              </Button>
            </div>

            <p data-testid="map-eta-source" className="mt-3 text-xs text-slate-500">
              מקור ETA: {getEtaSourceText(selectedJob, jobs)}
            </p>
          </div>
        ) : null}

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {filteredJobs.map((job) => (
            <Card
              key={job.id}
              data-testid={`map-job-card-${job.id}`}
              className={`cursor-pointer border-0 shadow-sm transition-all ${
                selectedJob?.id === job.id ? 'ring-2 ring-emerald-500' : 'hover:shadow-md'
              }`}
              onClick={() => selectJob(job)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-slate-800">{job.title}</div>
                    <div className="truncate text-sm text-slate-500">{job.account_name}</div>
                    {!isCompactSidebar ? <div className="mt-1 truncate text-xs text-slate-500">{job.address_text}</div> : null}
                    <div className="mt-1">
                      <NextActionBadge status={job.status} />
                    </div>
                    {job.geocode_failed ? (
                      <div className="mt-1 text-xs text-amber-600">מיקום לא אותר</div>
                    ) : null}
                    {job.invalid_coords ? (
                      <div className="mt-1 text-xs text-amber-600">מיקום לא תקין</div>
                    ) : null}
                    {!job.hasCoords && !job.hasAddress ? (
                      <div className="mt-1 text-xs text-slate-500">אין כתובת למיקום</div>
                    ) : null}
                    {job.scheduled_start_at ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {format(new Date(job.scheduled_start_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <JobStatusBadge status={job.status} />
                    <PriorityBadge priority={job.priority} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </aside>

      <section className="order-1 h-1/2 flex-1 lg:order-2 lg:h-full">
        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredJobs
            .filter((job) => job.hasCoords)
            .map((job) => (
              <Marker
                key={job.id}
                position={[job.lat, job.lng]}
                icon={createCustomIcon(STATUS_COLORS[job.status] || '#64748b')}
                eventHandlers={{ click: () => selectJob(job) }}
              >
                <Popup maxWidth={320}>
                  <div dir="rtl" className="w-full p-2 text-right">
                    <div className="mb-1 font-bold text-slate-800">{job.title}</div>
                    <div className="mb-2 text-sm text-slate-600">{job.account_name}</div>
                    <div className="mb-2 text-xs text-slate-500">{job.address_text}</div>
                    <div className="mb-2 flex gap-2">
                      <JobStatusBadge status={job.status} />
                      <NextActionBadge status={job.status} />
                      <PriorityBadge priority={job.priority} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(createPageUrl(`JobDetails?id=${job.id}`))}
                    >
                      <ArrowUpRight className="ml-1 h-4 w-4" /> פרטים
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      </section>

      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>תזמון עבודה</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="map-schedule-date">תאריך</Label>
              <Input
                id="map-schedule-date"
                data-testid="map-schedule-date"
                type="date"
                value={scheduleData.date}
                onChange={(event) =>
                  setScheduleData((prev) => ({
                    ...prev,
                    date: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="map-schedule-time">שעה</Label>
              <select
                id="map-schedule-time"
                data-testid="map-schedule-time"
                value={scheduleData.time}
                onChange={(event) =>
                  setScheduleData((prev) => ({
                    ...prev,
                    time: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">בחר שעה...</option>
                {TIME_OPTIONS_10_MIN.map((time) => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              data-testid="map-schedule-save"
              onClick={handleScheduleJob}
              disabled={!scheduleData.date || !scheduleData.time}
              className="bg-[#00214d] text-white hover:opacity-90"
            >
              שמירה
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setScheduleDialogOpen(false);
                setScheduleData({ date: '', time: '' });
              }}
            >
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
