import { expect, test } from '@playwright/test';

async function ensureApiAvailable(response, endpointName) {
  if (response.ok()) return;
  const status = response.status();
  const body = await response.text();
  test.skip(status === 404, `נתיב ${endpointName} לא זמין בסביבת בדיקה זו (סטטוס ${status}).`);
  throw new Error(`קריאת ${endpointName} נכשלה בסטטוס ${status}: ${body}`);
}

test.describe('Map infra APIs', () => {
  test('geocode cache and route cache behavior', async ({ request }) => {
    const addressText = 'אגס 3, אשדוד';

    const firstGeocode = await request.post('/api/geocode', {
      data: { addressText },
      headers: { 'Content-Type': 'application/json' },
    });
    await ensureApiAvailable(firstGeocode, '/api/geocode');
    const firstGeocodeBody = await firstGeocode.json();
    expect(typeof firstGeocodeBody.lat).toBe('number');
    expect(typeof firstGeocodeBody.lng).toBe('number');

    const secondGeocode = await request.post('/api/geocode', {
      data: { addressText },
      headers: { 'Content-Type': 'application/json' },
    });
    await ensureApiAvailable(secondGeocode, '/api/geocode');
    const secondGeocodeBody = await secondGeocode.json();
    expect(secondGeocodeBody.provider).toBe('cache');

    const routePayload = {
      origin: { lat: 32.0853, lng: 34.7818 },
      destination: { lat: 32.109333, lng: 34.855499 },
      departureTime: '2026-02-13T08:00:00.000Z',
    };

    const firstRoute = await request.post('/api/route', {
      data: routePayload,
      headers: { 'Content-Type': 'application/json' },
    });
    await ensureApiAvailable(firstRoute, '/api/route');
    const firstRouteBody = await firstRoute.json();
    expect(typeof firstRouteBody.durationSeconds).toBe('number');
    expect(typeof firstRouteBody.distanceMeters).toBe('number');
    expect(['osrm', 'fallback']).toContain(firstRouteBody.provider);

    const secondRoute = await request.post('/api/route', {
      data: routePayload,
      headers: { 'Content-Type': 'application/json' },
    });
    await ensureApiAvailable(secondRoute, '/api/route');
    const secondRouteBody = await secondRoute.json();
    expect(secondRouteBody.durationSeconds).toBe(firstRouteBody.durationSeconds);
    expect(secondRouteBody.distanceMeters).toBe(firstRouteBody.distanceMeters);
    expect(['osrm', 'fallback']).toContain(secondRouteBody.provider);
  });

  test('route fallback on impossible driving path', async ({ request }) => {
    const fallbackRoute = await request.post('/api/route', {
      data: {
        origin: { lat: 32.0853, lng: 34.7818 },
        destination: { lat: 40.7128, lng: -74.006 },
        departureTime: '2026-02-13T10:30:00.000Z',
      },
      headers: { 'Content-Type': 'application/json' },
    });
    await ensureApiAvailable(fallbackRoute, '/api/route');
    const fallbackBody = await fallbackRoute.json();
    expect(fallbackBody.provider).toBe('fallback');
    expect(fallbackBody.durationSeconds).toBeGreaterThan(0);
    expect(fallbackBody.distanceMeters).toBeGreaterThan(0);
  });
});
