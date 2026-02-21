# API Runtime Status

## Active Infrastructure Endpoints
- `api/geocode.js`
- `api/route.js`
- `api/_cacheClient.js`
- `api/_rateLimit.js`

Used by:
- `src/data/mapRepo.ts`
- `e2e/map_route_infra.spec.mjs`

## Dormant / Future-Ready Endpoints
- `api/ai/chat.js`
- `api/ai/bi.js`
- `api/lib/ai/*`
- `api/webhooks/whatsapp.js`

Current state:
- Kept intentionally for upcoming integrations.
- No frontend runtime path depends on them today.
