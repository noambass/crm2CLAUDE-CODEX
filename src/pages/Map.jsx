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
  ChevronDown,
  ChevronUp,
  Minus,
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
import { useIsMobile } from '@/lib/ui/useIsMobile';
import { normalizeScheduledAt, parseValidScheduledAt } from '@/lib/jobs/scheduleValidity';

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
const MOBILE_SHEET_HEIGHT = Object.freeze({
  collapsed: '136px',
  half: '52vh',
  full: '84vh',
});

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
  const scheduledSource = normalizeScheduledAt(job.scheduled_start_at);
  const scheduledAt = parseValidScheduledAt(scheduledSource);
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
  const aTime = parseValidScheduledAt(a.scheduled_start_at)?.getTime() || 0;
  const bTime = parseValidScheduledAt(b.scheduled_start_at)?.getTime() || 0;
  return aTime - bTime;
}

function getEtaSourceText(job, jobs) {
  const currentDate = parseValidScheduledAt(job?.scheduled_start_at);
  if (!currentDate) return 'אין מקור ETA כי העבודה לא מתוזמנת';

  const sameDayJobs = jobs
    .filter(
      (item) => {
        const itemDate = parseValidScheduledAt(item.scheduled_start_at);
        return itemDate && isSameDay(itemDate, currentDate);
      }
    )
    .sort(compareByScheduledAt);

  const idx = sameDayJobs.findIndex((item) => item.id === job.id);
  if (idx > 0) return 'מהעבודה הקודמת';

  return OPS_MAP_DEFAULTS.dayStartOrigin.address;
}

function getLocationStatusText(job) {
  if (job.hasCoords) return null;
  if (!job.hasAddress) return 'מיקום לא זמין: לא הוזנה כתובת';
  if (job.invalid_coords) return 'מיקום לא זמין: נקלטו קואורדינטות לא תקינות';
  if (job.geocode_failed) return 'מיקום לא זמין: לא הצלחנו לאתר את הכתובת';
  return 'מיקום לא זמין: הכתובת ממתינה לאימות';
}

export default function JobsMapPage() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const { preferences, setPreference } = useUiPreferences();
  const isMobile = useIsMobile();

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
  const mobileSheetMode = preferences.mobileMapSheet || 'half';

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
        const firstWithCoords = withCoords.find((job) => isUsableJobCoords(job.lat, job.lng));
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

  useEffect(() => {
    if (!isMobile) return;
    if (!preferences.mobileMapSheet) {
      setPreference('mobileMapSheet', 'half');
    }
  }, [isMobile, preferences.mobileMapSheet, setPreference]);

  const filteredJobs = useMemo(() => {
    const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
    const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

    return jobs.filter((job) => {
      if (job.status === 'done') return false;

      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const haystack = `${job.title} ${job.account_name} ${job.address_text}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      const scheduledDate = parseValidScheduledAt(job.scheduled_start_at);

      if (fromDate && (!scheduledDate || scheduledDate < fromDate)) {
        return false;
      }

      if (toDate && (!scheduledDate || scheduledDate > toDate)) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, dateFrom, dateTo]);

  const markerJobs = useMemo(
    () => filteredJobs.filter((job) => isUsableJobCoords(job.lat, job.lng)),
    [filteredJobs],
  );

  const safeMapCenter = useMemo(() => {
    const lat = parseCoord(Array.isArray(mapCenter) ? mapCenter[0] : null);
    const lng = parseCoord(Array.isArray(mapCenter) ? mapCenter[1] : null);
    if (isUsableJobCoords(lat, lng)) return [lat, lng];
    return DEFAULT_CENTER;
  }, [mapCenter]);

  function selectJob(job) {
    setSelectedJob(job);
    const lat = parseCoord(job.lat);
    const lng = parseCoord(job.lng);
    if (isUsableJobCoords(lat, lng)) {
      setMapCenter([lat, lng]);
    }
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
      const normalizedSchedule = normalizeScheduledAt(result.scheduled_start_at);
      const parsedSchedule = parseValidScheduledAt(normalizedSchedule);

      setJobs((prev) =>
        prev.map((job) =>
          job.id === selectedJob.id
            ? {
                ...job,
                scheduled_start_at: normalizedSchedule,
                scheduled_date: parsedSchedule ? format(parsedSchedule, 'yyyy-MM-dd') : '',
                scheduled_time: parsedSchedule ? format(parsedSchedule, 'HH:mm') : '',
                status: result.status,
              }
            : job
        )
      );

      setSelectedJob((prev) =>
        prev
          ? {
              ...prev,
              scheduled_start_at: normalizedSchedule,
              scheduled_date: parsedSchedule ? format(parsedSchedule, 'yyyy-MM-dd') : '',
              scheduled_time: parsedSchedule ? format(parsedSchedule, 'HH:mm') : '',
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

  function setMobileSheet(mode) {
    setPreference('mobileMapSheet', mode);
  }

  function renderFilters({ mobile = false } = {}) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <Input
            data-testid="map-search-input"
            placeholder="חיפוש לפי עבודה, לקוח או כתובת..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="border-0 bg-slate-50 pr-10 dark:bg-slate-800"
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

        {!mobile ? (
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
        ) : null}
      </div>
    );
  }

  function renderSelectedJobPanel({ compact = false } = {}) {
    if (!selectedJob) return null;
    const locationStatus = getLocationStatusText(selectedJob);

    return (
      <div className={`border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60 ${compact ? 'space-y-2' : ''}`}>
        <div className="mb-2 font-semibold text-slate-800 dark:text-slate-100">{selectedJob.title}</div>
        <div className="text-sm text-slate-600 dark:text-slate-300">{selectedJob.account_name}</div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-300">{selectedJob.address_text || 'ללא כתובת'}</div>
        {locationStatus ? (
          <div className="mt-1 text-xs text-amber-600">{locationStatus}</div>
        ) : null}
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

        {!compact ? (
          <p data-testid="map-eta-source" className="mt-3 text-xs text-slate-500 dark:text-slate-300">
            מקור ETA: {getEtaSourceText(selectedJob, jobs)}
          </p>
        ) : null}
      </div>
    );
  }

  function renderJobsList({ compact = false } = {}) {
    return (
      <div className="space-y-3">
        {filteredJobs.map((job) => {
          const locationStatus = getLocationStatusText(job);
          const scheduledDate = parseValidScheduledAt(job.scheduled_start_at);
          return (
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
                    <div className="truncate font-medium text-slate-800 dark:text-slate-100">{job.title}</div>
                    <div className="truncate text-sm text-slate-500 dark:text-slate-300">{job.account_name}</div>
                    {!compact ? <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-300">{job.address_text}</div> : null}
                    <div className="mt-1">
                      <NextActionBadge status={job.status} />
                    </div>
                    {locationStatus ? (
                      <div className="mt-1 text-xs text-amber-600">{locationStatus}</div>
                    ) : null}
                    {scheduledDate ? (
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                        {format(scheduledDate, 'dd/MM/yyyy HH:mm')}
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
          );
        })}
      </div>
    );
  }

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div
      data-testid="map-page"
      dir="rtl"
      className={isMobile ? 'relative h-[calc(100dvh-8.4rem)] overflow-hidden' : 'flex h-[calc(100vh-64px)] lg:h-screen lg:flex-row'}
    >
      {!isMobile ? (
        <aside className="order-2 flex h-full flex-col border-l border-slate-200 bg-white lg:order-1 lg:w-[420px] dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 p-4 dark:border-slate-700">
            <h1 className="mb-4 flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
              <MapPin className="h-6 w-6 text-emerald-600" />
              מפת עבודות
            </h1>
            {renderFilters()}
          </div>
          {renderSelectedJobPanel()}
          <div className="flex-1 overflow-y-auto p-4">{renderJobsList({ compact: isCompactSidebar })}</div>
        </aside>
      ) : null}

      <section className={isMobile ? 'h-full w-full' : 'order-1 h-full flex-1 lg:order-2'}>
        <div dir="ltr" className="h-full w-full">
        <MapContainer center={safeMapCenter} zoom={12} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {markerJobs.map((job) => (
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
        </div>
      </section>

      {isMobile ? (
        <div
          className="absolute inset-x-0 bottom-0 z-[450] transition-[height] duration-300"
          style={{
            height: MOBILE_SHEET_HEIGHT[mobileSheetMode] || MOBILE_SHEET_HEIGHT.half,
            paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex h-full flex-col overflow-hidden rounded-t-3xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
            <div className="border-b border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMobileSheet(mobileSheetMode === 'collapsed' ? 'half' : 'collapsed')}
                  className="mx-auto h-1.5 w-16 rounded-full bg-slate-300 dark:bg-slate-600"
                  aria-label="שינוי מצב חלונית המפה"
                />
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant={mobileSheetMode === 'collapsed' ? 'default' : 'outline'}
                    size="icon"
                    className={mobileSheetMode === 'collapsed' ? 'h-7 w-7 bg-[#00214d] text-white' : 'h-7 w-7'}
                    onClick={() => setMobileSheet('collapsed')}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant={mobileSheetMode === 'half' ? 'default' : 'outline'}
                    size="icon"
                    className={mobileSheetMode === 'half' ? 'h-7 w-7 bg-[#00214d] text-white' : 'h-7 w-7'}
                    onClick={() => setMobileSheet('half')}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant={mobileSheetMode === 'full' ? 'default' : 'outline'}
                    size="icon"
                    className={mobileSheetMode === 'full' ? 'h-7 w-7 bg-[#00214d] text-white' : 'h-7 w-7'}
                    onClick={() => setMobileSheet('full')}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">עבודות במפה</h2>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {filteredJobs.length} עבודות
                </span>
              </div>
            </div>

            {mobileSheetMode !== 'collapsed' ? (
              <>
                <div className="border-b border-slate-200 p-3 dark:border-slate-700">
                  {renderFilters({ mobile: true })}
                </div>
                {renderSelectedJobPanel({ compact: true })}
                <div className="flex-1 overflow-y-auto p-3">
                  {renderJobsList({ compact: false })}
                </div>
              </>
            ) : (
              <div className="p-3">
                {selectedJob ? (
                  <button
                    type="button"
                    className="w-full rounded-xl bg-slate-50 p-3 text-right dark:bg-slate-800"
                    onClick={() => setMobileSheet('half')}
                  >
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{selectedJob.title}</p>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-300">{selectedJob.account_name}</p>
                  </button>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-300">בחר עבודה ברשימה להצגת פרטים מהירים</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

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
