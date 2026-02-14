import { createClient } from '@supabase/supabase-js';

const memoryCache = new Map();

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getGeoCacheByHash(addressHash) {
  if (!addressHash) return null;

  const memKey = `geo:${addressHash}`;
  if (memoryCache.has(memKey)) return memoryCache.get(memKey);

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from('geo_cache')
    .select('normalized_address, lat, lng')
    .eq('address_hash', addressHash)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const result = {
    normalizedAddress: data.normalized_address,
    lat: Number(data.lat),
    lng: Number(data.lng),
    provider: data.provider || 'nominatim',
  };
  memoryCache.set(memKey, result);
  return result;
}

export async function upsertGeoCache({ addressHash, normalizedAddress, lat, lng, provider = 'nominatim' }) {
  if (!addressHash || lat == null || lng == null) return;

  const memKey = `geo:${addressHash}`;
  memoryCache.set(memKey, {
    normalizedAddress,
    lat: Number(lat),
    lng: Number(lng),
    provider,
  });

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from('geo_cache').upsert([{
    address_hash: addressHash,
    normalized_address: normalizedAddress,
    lat,
    lng,
    provider,
  }], { onConflict: 'address_hash' });
}

export async function getRouteCache(key) {
  const { originLat, originLng, destLat, destLng, departureBucket } = key;
  const memKey = `route:${originLat}:${originLng}:${destLat}:${destLng}:${departureBucket}`;
  if (memoryCache.has(memKey)) return memoryCache.get(memKey);

  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from('route_cache')
    .select('duration_seconds, distance_meters, provider')
    .eq('origin_lat', originLat)
    .eq('origin_lng', originLng)
    .eq('dest_lat', destLat)
    .eq('dest_lng', destLng)
    .eq('departure_bucket', departureBucket)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const result = {
    durationSeconds: Number(data.duration_seconds),
    distanceMeters: Number(data.distance_meters),
    provider: data.provider || 'osrm',
  };
  memoryCache.set(memKey, result);
  return result;
}

export async function upsertRouteCache(key, value) {
  const { originLat, originLng, destLat, destLng, departureBucket } = key;
  const { durationSeconds, distanceMeters, provider = 'osrm' } = value;

  const memKey = `route:${originLat}:${originLng}:${destLat}:${destLng}:${departureBucket}`;
  memoryCache.set(memKey, { durationSeconds, distanceMeters, provider });

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from('route_cache').upsert([{
    origin_lat: originLat,
    origin_lng: originLng,
    dest_lat: destLat,
    dest_lng: destLng,
    departure_bucket: departureBucket,
    duration_seconds: durationSeconds,
    distance_meters: distanceMeters,
    provider,
  }], {
    onConflict: 'origin_lat,origin_lng,dest_lat,dest_lng,departure_bucket',
  });
}

export function toDepartureBucketIso(departureTime) {
  const source = departureTime ? new Date(departureTime) : new Date();
  const date = new Date(source);
  date.setMinutes(Math.floor(date.getMinutes() / 30) * 30, 0, 0);
  return date.toISOString();
}
