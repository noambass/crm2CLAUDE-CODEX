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
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  Filter,
  Search,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { JobStatusBadge, PriorityBadge } from '@/components/ui/DynamicStatusBadge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const STATUS_FILTERS = [
  { value: 'quote', label: 'הצעת מחיר' },
  { value: 'waiting_schedule', label: 'ממתין לתזמון' },
  { value: 'waiting_execution', label: 'ממתין לביצוע' },
  { value: 'done', label: 'בוצע' },
];

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

function normalizeMapJob(job) {
  const accountRel = Array.isArray(job.accounts) ? job.accounts[0] : job.accounts;
  const scheduledAt = job.scheduled_start_at ? new Date(job.scheduled_start_at) : null;

  return {
    id: job.id,
    account_id: job.account_id,
    account_name: accountRel?.account_name || 'ללא לקוח',
    assigned_to: job.assigned_to || 'owner',
    title: job.title || 'ללא כותרת',
    description: job.description || '',
    status: job.status || 'waiting_schedule',
    priority: job.priority || 'normal',
    address_text: job.address_text || '',
    arrival_notes: job.arrival_notes || '',
    lat: Number(job.lat),
    lng: Number(job.lng),
    hasCoords: Number.isFinite(Number(job.lat)) && Number.isFinite(Number(job.lng)),
    scheduled_start_at: job.scheduled_start_at || null,
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
  const sameDaySameAssignee = jobs
    .filter(
      (item) =>
        item.scheduled_start_at &&
        item.assigned_to === job.assigned_to &&
        isSameDay(new Date(item.scheduled_start_at), currentDate)
    )
    .sort(compareByScheduledAt);

  const idx = sameDaySameAssignee.findIndex((item) => item.id === job.id);
  if (idx > 0) return 'מהעבודה הקודמת';

  return OPS_MAP_DEFAULTS.dayStartOrigin.address;
}

export default function Map() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandStatusFilter, setExpandStatusFilter] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [mapCenter, setMapCenter] = useState(DEFAULT_CENTER);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleData, setScheduleData] = useState({ date: '', time: '' });

  useEffect(() => {
    if (!user) return;

    let mounted = true;

    async function loadJobs() {
      try {
        const rawJobs = await listMapJobs();
        const normalized = rawJobs.map(normalizeMapJob);

        const withCoords = await Promise.all(
          normalized.map(async (job) => {
            if (job.hasCoords || !job.address_text) return job;
            try {
              const geo = await geocodeAddress(job.address_text);
              if (!Number.isFinite(geo?.lat) || !Number.isFinite(geo?.lng)) return job;

              await updateMapJobCoordinates(job.id, geo.lat, geo.lng);
              return {
                ...job,
                lat: Number(geo.lat),
                lng: Number(geo.lng),
                hasCoords: true,
              };
            } catch (error) {
              console.error('Geocode failed for job', job.id, error);
              return job;
            }
          })
        );

        if (!mounted) return;
        setJobs(withCoords);
      } catch (error) {
        console.error('Error loading map jobs:', error);
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

      if (selectedStatuses.length > 0 && !selectedStatuses.includes(job.status)) return false;

      if (dateFrom && (!job.scheduled_start_at || new Date(job.scheduled_start_at) < new Date(`${dateFrom}T00:00:00`))) {
        return false;
      }

      if (dateTo && (!job.scheduled_start_at || new Date(job.scheduled_start_at) > new Date(`${dateTo}T23:59:59`))) {
        return false;
      }

      return true;
    });
  }, [jobs, searchQuery, selectedStatuses, dateFrom, dateTo]);

  function selectJob(job) {
    setSelectedJob(job);
    if (job.hasCoords) setMapCenter([job.lat, job.lng]);
  }

  async function handleScheduleJob() {
    if (!selectedJob || !scheduleData.date || !scheduleData.time) return;

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
    }
  }

  function toggleStatus(status) {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((value) => value !== status) : [...prev, status]
    );
  }

  if (isLoadingAuth || loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div data-testid="map-page" dir="rtl" className="flex h-[calc(100vh-64px)] flex-col lg:h-screen lg:flex-row">
      <aside className="order-2 flex h-1/2 flex-col border-l border-slate-200 bg-white lg:order-1 lg:h-full lg:w-[420px]">
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

            <button
              data-testid="map-status-toggle"
              type="button"
              onClick={() => setExpandStatusFilter((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <span>{selectedStatuses.length === 0 ? 'כל הסטטוסים' : `${selectedStatuses.length} סטטוסים`}</span>
              <Filter className="h-4 w-4" />
            </button>

            {expandStatusFilter ? (
              <div className="space-y-2 rounded-md border border-slate-200 p-2">
                {STATUS_FILTERS.map((status) => (
                  <label key={status.value} className="flex items-center gap-2 rounded p-2 hover:bg-slate-50">
                    <input
                      data-testid={`map-status-${status.value}`}
                      type="checkbox"
                      checked={selectedStatuses.includes(status.value)}
                      onChange={() => toggleStatus(status.value)}
                    />
                    <span className="text-sm text-slate-700">{status.label}</span>
                  </label>
                ))}
              </div>
            ) : null}

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
          </div>
        </div>

        {selectedJob ? (
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 font-semibold text-slate-800">{selectedJob.title}</div>
            <div className="text-sm text-slate-600">{selectedJob.account_name}</div>
            <div className="mt-2 text-xs text-slate-500">{selectedJob.address_text || 'ללא כתובת'}</div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                data-testid="map-selected-schedule-button"
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setScheduleData({
                    date: selectedJob.scheduled_date || '',
                    time: selectedJob.scheduled_time || '',
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
                    <div className="mt-1 truncate text-xs text-slate-500">{job.address_text}</div>
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
              <Input
                id="map-schedule-time"
                data-testid="map-schedule-time"
                type="time"
                value={scheduleData.time}
                onChange={(event) =>
                  setScheduleData((prev) => ({
                    ...prev,
                    time: event.target.value,
                  }))
                }
              />
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
