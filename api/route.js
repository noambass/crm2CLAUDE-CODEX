import { getRouteCache, upsertRouteCache, toDepartureBucketIso } from './_cacheClient.js';

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function fallbackRoute(origin, destination) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = Math.round(earthRadius * c);
  const avgSpeedMps = 45_000 / 3600;
  const durationSeconds = Math.max(60, Math.round(distanceMeters / avgSpeedMps));

  return { durationSeconds, distanceMeters, provider: 'fallback' };
}

function normalizeCoordinate(value) {
  return Number(value.toFixed(6));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const rawOrigin = req.body?.origin || {};
    const rawDestination = req.body?.destination || {};

    const origin = {
      lat: toNumber(rawOrigin.lat),
      lng: toNumber(rawOrigin.lng),
    };
    const destination = {
      lat: toNumber(rawDestination.lat),
      lng: toNumber(rawDestination.lng),
    };

    if (origin.lat == null || origin.lng == null || destination.lat == null || destination.lng == null) {
      return res.status(400).json({ error: 'origin and destination are required' });
    }

    const departureBucket = toDepartureBucketIso(req.body?.departureTime);
    const cacheKey = {
      originLat: normalizeCoordinate(origin.lat),
      originLng: normalizeCoordinate(origin.lng),
      destLat: normalizeCoordinate(destination.lat),
      destLng: normalizeCoordinate(destination.lng),
      departureBucket,
    };

    const cached = await getRouteCache(cacheKey);
    if (cached) {
      return res.status(200).json({
        durationSeconds: cached.durationSeconds,
        distanceMeters: cached.distanceMeters,
        provider: cached.provider,
      });
    }

    const osrmUrl =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${cacheKey.originLng},${cacheKey.originLat};${cacheKey.destLng},${cacheKey.destLat}` +
      `?overview=false&alternatives=false&steps=false`;

    try {
      const osrmResponse = await fetch(osrmUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'OlamHatzipuyim-CRM/1.0',
        },
      });

      if (osrmResponse.ok) {
        const osrmBody = await osrmResponse.json();
        const route = osrmBody?.routes?.[0];

        if (route?.duration > 0 && route?.distance > 0) {
          const result = {
            durationSeconds: Math.round(route.duration),
            distanceMeters: Math.round(route.distance),
            provider: 'osrm',
          };

          await upsertRouteCache(cacheKey, result);
          return res.status(200).json(result);
        }
      }
    } catch (osrmError) {
      console.error('OSRM route error:', osrmError);
    }

    const fallback = fallbackRoute(origin, destination);
    await upsertRouteCache(cacheKey, fallback);
    return res.status(200).json(fallback);
  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected error',
      details: String(error?.message || error),
    });
  }
}
