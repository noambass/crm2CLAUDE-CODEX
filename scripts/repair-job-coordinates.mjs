import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { isUsableJobCoords, normalizeAddressText, parseCoord } from '../src/lib/geo/coordsPolicy.js';

const DEFAULT_LIMIT = 500;
const DEFAULT_CONCURRENCY = 3;
const NOMINATIM_USER_AGENT = 'OlamHatzipuyim-CRM/1.0';

function parseArgs(argv) {
  const options = {
    dryRun: true,
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
  };

  for (const arg of argv) {
    if (arg === '--apply') options.dryRun = false;
    if (arg === '--dry-run') options.dryRun = true;
    if (arg.startsWith('--limit=')) {
      const parsed = Number(arg.split('=')[1]);
      if (Number.isFinite(parsed) && parsed > 0) options.limit = Math.floor(parsed);
    }
    if (arg.startsWith('--concurrency=')) {
      const parsed = Number(arg.split('=')[1]);
      if (Number.isFinite(parsed) && parsed > 0) options.concurrency = Math.floor(parsed);
    }
  }

  return options;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const entries = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
      value = value.slice(1, -1);
    }
    entries[match[1]] = value;
  }
  return entries;
}

function resolveEnv() {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(scriptDir, '..');
  const envLocal = loadEnvFile(path.join(projectRoot, '.env.local'));

  return {
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || envLocal.SUPABASE_URL || envLocal.VITE_SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || envLocal.SUPABASE_SERVICE_ROLE_KEY,
    googleMapsServerKey: process.env.GOOGLE_MAPS_SERVER_API_KEY || envLocal.GOOGLE_MAPS_SERVER_API_KEY || null,
  };
}

function normalizeForGeocoding(input) {
  return normalizeAddressText(String(input || '').replace(/[;,]+/g, ', '));
}

function stripTrailingAddressSuffix(input) {
  return String(input || '')
    .replace(/\s*[,.-]?\s*(apartment|apt|floor|entrance|suite|unit|\u05D3\u05D9\u05E8\u05D4|\u05D3\u05D9\u05E8|\u05E7\u05D5\u05DE\u05D4|\u05DB\u05E0\u05D9\u05E1\u05D4)\s*[\p{L}\p{N}-]+$/iu, '')
    .trim();
}

function toQueries(rawAddress) {
  const normalized = normalizeForGeocoding(rawAddress);
  const noSuffix = stripTrailingAddressSuffix(normalized);
  const base = noSuffix || normalized;
  return Array.from(new Set([base, `${base}, \u05D9\u05E9\u05E8\u05D0\u05DC`, `${base}, Israel`].map((q) => q.trim()).filter(Boolean)));
}

async function geocodeWithGoogle(query, apiKey) {
  if (!apiKey) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url);
  if (!resp.ok) return null;

  const body = await resp.json().catch(() => null);
  const first = body?.results?.[0];
  const lat = parseCoord(first?.geometry?.location?.lat);
  const lng = parseCoord(first?.geometry?.location?.lng);
  if (!isUsableJobCoords(lat, lng)) return null;

  return {
    lat,
    lng,
    provider: 'google',
    resolvedAddress: first?.formatted_address || query,
  };
}

async function geocodeWithNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    headers: {
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });
  if (!resp.ok) return null;

  const body = await resp.json().catch(() => []);
  const first = body?.[0];
  const lat = parseCoord(first?.lat);
  const lng = parseCoord(first?.lon);
  if (!isUsableJobCoords(lat, lng)) return null;

  return {
    lat,
    lng,
    provider: 'nominatim',
    resolvedAddress: first?.display_name || query,
  };
}

async function geocodeAddress(addressText, googleMapsServerKey) {
  const queries = toQueries(addressText);
  if (queries.length === 0) return null;

  for (const query of queries) {
    const googleResult = await geocodeWithGoogle(query, googleMapsServerKey).catch(() => null);
    if (googleResult) return googleResult;
  }

  for (const query of queries) {
    const nominatimResult = await geocodeWithNominatim(query).catch(() => null);
    if (nominatimResult) return nominatimResult;
  }

  return null;
}

function hasAnyCoords(lat, lng) {
  return parseCoord(lat) != null || parseCoord(lng) != null;
}

function sameCoords(aLat, aLng, bLat, bLng) {
  const leftLat = parseCoord(aLat);
  const leftLng = parseCoord(aLng);
  const rightLat = parseCoord(bLat);
  const rightLng = parseCoord(bLng);
  if (leftLat == null || leftLng == null || rightLat == null || rightLng == null) return false;
  return leftLat === rightLat && leftLng === rightLng;
}

async function runWithConcurrency(items, concurrency, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const env = resolveEnv();
  if (!env.supabaseUrl || !env.serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const supabase = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
  const { data: rows, error } = await supabase
    .from('jobs')
    .select('id,title,address_text,lat,lng,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const candidates = (rows || [])
    .filter((job) => !isUsableJobCoords(job.lat, job.lng))
    .slice(0, options.limit);

  const summary = {
    scanned: candidates.length,
    fixed: 0,
    nulled: 0,
    failed: 0,
    skipped: 0,
  };

  const samples = [];

  await runWithConcurrency(candidates, options.concurrency, async (job) => {
    const hasCoordsNow = hasAnyCoords(job.lat, job.lng);
    const address = normalizeAddressText(job.address_text);

    if (!address) {
      if (!hasCoordsNow) {
        summary.skipped += 1;
        return;
      }

      if (!options.dryRun) {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ lat: null, lng: null })
          .eq('id', job.id);
        if (updateError) {
          summary.failed += 1;
          return;
        }
      }

      summary.nulled += 1;
      if (samples.length < 20) {
        samples.push({ id: job.id, action: 'nulled_no_address' });
      }
      return;
    }

    const geo = await geocodeAddress(address, env.googleMapsServerKey);
    if (geo && isUsableJobCoords(geo.lat, geo.lng)) {
      if (sameCoords(job.lat, job.lng, geo.lat, geo.lng)) {
        summary.skipped += 1;
        return;
      }

      if (!options.dryRun) {
        const { error: updateError } = await supabase
          .from('jobs')
          .update({ lat: geo.lat, lng: geo.lng })
          .eq('id', job.id);
        if (updateError) {
          summary.failed += 1;
          return;
        }
      }

      summary.fixed += 1;
      if (samples.length < 20) {
        samples.push({ id: job.id, action: 'fixed', provider: geo.provider, lat: geo.lat, lng: geo.lng });
      }
      return;
    }

    if (!hasCoordsNow) {
      summary.failed += 1;
      if (samples.length < 20) {
        samples.push({ id: job.id, action: 'geocode_failed_no_change' });
      }
      return;
    }

    if (!options.dryRun) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ lat: null, lng: null })
        .eq('id', job.id);
      if (updateError) {
        summary.failed += 1;
        return;
      }
    }

    summary.nulled += 1;
    if (samples.length < 20) {
      samples.push({ id: job.id, action: 'nulled_after_geocode_fail' });
    }
  });

  console.log(JSON.stringify({
    mode: options.dryRun ? 'dry-run' : 'apply',
    options,
    summary,
    samples,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: String(error?.message || error),
  }, null, 2));
  process.exit(1);
});
