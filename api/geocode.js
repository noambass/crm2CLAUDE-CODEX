import crypto from 'crypto';
import { getGeoCacheByHash, upsertGeoCache } from './_cacheClient.js';
import { limitByIp } from './_rateLimit.js';

function normalizeAddress(input) {
  return String(input || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function addressHash(value) {
  return crypto.createHash('sha256').update(value.toLowerCase()).digest('hex');
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
    if (cached) {
      return res.status(200).json({
        lat: cached.lat,
        lng: cached.lng,
        normalizedAddress: cached.normalizedAddress || normalized,
        provider: 'cache',
      });
    }

    const rl = limitByIp(req, 'geocode', 40, 60_000);
    if (!rl.allowed) {
      res.setHeader('Retry-After', String(rl.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests' });
    }

    const query = `${normalized}, ישראל`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
    const nominatimResp = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'OlamHatzipuyim-CRM/1.0',
      },
    });

    if (!nominatimResp.ok) {
      return res.status(502).json({ error: 'Geocoding provider failed' });
    }

    const nominatimData = await nominatimResp.json();
    const first = nominatimData?.[0];
    if (!first?.lat || !first?.lon) {
      return res.status(404).json({ error: 'Address not found' });
    }

    const lat = Number(first.lat);
    const lng = Number(first.lon);
    const normalizedAddress = first.display_name || normalized;

    await upsertGeoCache({
      addressHash: hash,
      normalizedAddress,
      lat,
      lng,
      provider: 'nominatim',
    });

    return res.status(200).json({
      lat,
      lng,
      normalizedAddress,
      provider: 'nominatim',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', details: String(err?.message || err) });
  }
}
