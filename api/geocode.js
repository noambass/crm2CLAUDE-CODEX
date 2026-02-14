import crypto from 'crypto';
import { getGeoCacheByHash, upsertGeoCache } from './_cacheClient.js';
import { limitByIp } from './_rateLimit.js';
import {
  buildAddressQueryVariants,
  isUsableJobCoords,
  normalizeAddressText,
  parseCoord,
} from '../src/lib/geo/coordsPolicy.js';

function normalizeAddress(input) {
  return normalizeAddressText(String(input || '').replace(/[;,]+/g, ', '));
}

function stripTrailingAddressSuffix(input) {
  return String(input || '')
    .replace(/\s*[,.-]?\s*(apartment|apt|floor|entrance|suite|unit|\u05D3\u05D9\u05E8\u05D4|\u05D3\u05D9\u05E8|\u05E7\u05D5\u05DE\u05D4|\u05DB\u05E0\u05D9\u05E1\u05D4)\s*[\p{L}\p{N}-]+$/iu, '')
    .trim();
}

function addressHash(value) {
  return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex');
}

function toQueries(normalized) {
  const noSuffix = stripTrailingAddressSuffix(normalized);
  const raw = noSuffix || normalized;
  const withVariants = buildAddressQueryVariants(raw);
  return withVariants.length > 0
    ? withVariants
    : Array.from(new Set([raw, `${raw}, \u05D9\u05E9\u05E8\u05D0\u05DC`].map((q) => q.trim()).filter(Boolean)));
}

async function geocodeWithGoogle(query) {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) return null;

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, { method: 'GET' });
  if (!resp.ok) return null;

  const body = await resp.json();
  const first = body?.results?.[0];
  const lat = parseCoord(first?.geometry?.location?.lat);
  const lng = parseCoord(first?.geometry?.location?.lng);
  if (!isUsableJobCoords(lat, lng)) return null;

  return {
    lat,
    lng,
    resolvedAddress: first.formatted_address || query,
    provider: 'google',
  };
}

async function geocodeWithNominatim(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'OlamHatzipuyim-CRM/1.0',
    },
  });
  if (!resp.ok) return null;

  const body = await resp.json();
  const first = body?.[0];
  const lat = parseCoord(first?.lat);
  const lng = parseCoord(first?.lon);
  if (!isUsableJobCoords(lat, lng)) return null;

  return {
    lat,
    lng,
    resolvedAddress: first.display_name || query,
    provider: 'nominatim',
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { addressText } = req.body || {};
    const normalized = normalizeAddress(addressText);
    if (!normalized) {
      return res.status(400).json({ error: 'addressText is required' });
    }

    const hash = addressHash(normalized);
    const cached = await getGeoCacheByHash(hash);
    const cachedLat = parseCoord(cached?.lat);
    const cachedLng = parseCoord(cached?.lng);
    if (cached && isUsableJobCoords(cachedLat, cachedLng)) {
      const resolvedAddress = cached.normalizedAddress || normalized;
      return res.status(200).json({
        lat: cachedLat,
        lng: cachedLng,
        normalizedAddress: resolvedAddress,
        resolvedAddress,
        provider: 'cache',
      });
    }

    const rl = limitByIp(req, 'geocode', 40, 60_000);
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests' });
    }

    const queries = toQueries(normalized);
    let resolved = null;
    let providerFailed = false;

    for (const query of queries) {
      try {
        resolved = await geocodeWithGoogle(query);
      } catch {
        providerFailed = true;
      }
      if (resolved) break;
    }

    if (!resolved) {
      for (const query of queries) {
        try {
          resolved = await geocodeWithNominatim(query);
        } catch {
          providerFailed = true;
        }
        if (resolved) break;
      }
    }

    if (!resolved) {
      if (providerFailed) {
        return res.status(502).json({ error: 'Geocoding provider failed' });
      }
      return res.status(404).json({ error: 'Address not found in IL' });
    }

    const lat = resolved.lat;
    const lng = resolved.lng;
    const resolvedAddress = resolved.resolvedAddress || normalized;

    await upsertGeoCache({
      addressHash: hash,
      normalizedAddress: resolvedAddress,
      lat,
      lng,
      provider: resolved.provider,
    });

    return res.status(200).json({
      lat,
      lng,
      normalizedAddress: resolvedAddress,
      resolvedAddress,
      provider: resolved.provider,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', details: String(err?.message || err) });
  }
}
