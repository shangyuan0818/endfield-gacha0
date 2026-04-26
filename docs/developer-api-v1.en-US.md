# Public Analytics API v1

This document is for approved developer applications. API v1 only grants `public.read`: public catalogs, announcements, pool data, and anonymous aggregate analytics. It never returns user email, platform binding identifiers, game UID level data, raw pull history, or private user data.

## 1. Quick Start

### Base URL

```text
https://your-site-domain
```

For local development:

```text
http://127.0.0.1:5173
```

### Authentication

Every `/api/dev/v1/*` public endpoint requires a developer API key. Prefer `X-API-Key`:

```http
X-API-Key: ek_live_xxx
```

Bearer auth is also supported:

```http
Authorization: Bearer ek_live_xxx
```

### First Request

```bash
curl -H "X-API-Key: ek_live_xxx" \
  "https://example.com/api/dev/v1/meta"
```

JavaScript example:

```js
async function getMeta(apiKey) {
  const response = await fetch('https://example.com/api/dev/v1/meta', {
    headers: {
      'X-API-Key': apiKey,
    },
  });
  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}
```

## 2. Response Contract

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "apiVersion": "v1",
    "generatedAt": "2026-04-26T00:00:00.000Z",
    "cache": "private, max-age=60, stale-while-revalidate=300",
    "rateLimit": {
      "action": "dev_api_catalog",
      "allowed": true,
      "remaining": null,
      "retryAfter": 0
    },
    "requestId": "..."
  }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "unauthorized",
    "message": "API key required"
  },
  "meta": {
    "apiVersion": "v1",
    "generatedAt": "2026-04-26T00:00:00.000Z",
    "cache": "no-store",
    "requestId": "..."
  }
}
```

Server-side SQL errors, Supabase raw errors, stack traces, and internal table names are never exposed.

## 3. Pagination

List endpoints use cursor pagination:

- `limit`: default `50`, maximum `100`
- `cursor`: `nextCursor` returned by the previous page

Typical page object:

```json
{
  "page": {
    "limit": 50,
    "nextCursor": null,
    "hasMore": false,
    "total": 42
  }
}
```

## 4. Rate Limits

Current rate-limit actions:

- `dev_api_catalog`: catalogs, characters, announcements, and site metadata
- `dev_api_stats_light`: cached global stats and rankings
- `dev_api_stats_heavy`: pool, item, trend, and distribution analytics
- `dev_api_public`: compatibility fallback

When receiving `429`, read `meta.rateLimit.retryAfter` and back off before retrying.

## 5. Catalog Endpoints

### `GET /api/dev/v1/meta`

Returns API version, scope, site URL, available endpoints, and documentation links.

### `GET /api/dev/v1/openapi`

Returns an OpenAPI 3.1 descriptor wrapped in the standard v1 response at `data.openapi`. Use it to generate clients, validate endpoint coverage, or synchronize internal documentation.

### `GET /api/dev/v1/pools`

Query:

- `type`: `limited | extra | standard | weapon`
- `status`: `active | upcoming | ended | permanent`
- `limit`
- `cursor`

Returns public pool DTOs with `id`, compatibility field `pool_id`, localized names, type, status, time range, featured entries, and public banner metadata.

### `GET /api/dev/v1/pool?id=POOL_ID`

Returns one public pool DTO.

### `GET /api/dev/v1/characters`

Query:

- `type`: `character | weapon`
- `rarity`: numeric rarity
- `limited`: `true | false`
- `q`: name or alias search
- `limit`
- `cursor`

Returns character or weapon DTOs with aliases, avatar, rarity, type, limited flag, and related public pool summaries.

### `GET /api/dev/v1/character?id=CHARACTER_ID`

Returns one public character or weapon DTO.

### `GET /api/dev/v1/announcements`

Query:

- `locale`: `zh-CN | en`
- `limit`
- `cursor`

Returns public announcements.

### `GET /api/dev/v1/site/overview`

Returns site URL, next-version countdown, active pools, upcoming pools, and configured current/next limited pool summaries.

## 6. Analytics Endpoints

### `GET /api/dev/v1/stats/global`

Returns anonymous global aggregate statistics such as total pulls, contributor count, rarity summary, resource summary, and average pull metrics.

### `GET /api/dev/v1/stats/rankings`

Returns public ranking aggregates grouped by limited character pools, extra pools, standard pools, weapon pools, and item summaries.

### `GET /api/dev/v1/stats/pools`

Query:

- `type`: `limited | extra | standard | weapon`
- `status`: `active | upcoming | ended | permanent`
- `from`: ISO timestamp filter based on public last-pull timestamp
- `to`: ISO timestamp filter based on public last-pull timestamp
- `limit`
- `cursor`

Returns public per-pool analytics.

### `GET /api/dev/v1/stats/pool?id=POOL_ID`

Returns single-pool public analytics: total pulls, rarity totals, target/off-target stats, average pull metrics, and distribution buckets.

### `GET /api/dev/v1/stats/items`

Query:

- `type`: `character | weapon`
- `rarity`: numeric rarity
- `poolType`: `limited | extra | standard | weapon`
- `limit`
- `cursor`

Returns aggregate drop counts for characters or weapons.

### `GET /api/dev/v1/stats/item?id=ITEM_ID`

Query:

- `id`: public character / weapon `id` or name
- `type`: optional `character | weapon` discriminator for same-name entries

Returns one character or weapon aggregate with total drops, rarity, limited flag, pool-type breakdown, and public per-pool occurrence counts.

### `GET /api/dev/v1/stats/trends`

Query:

- `metric`: `pulls | six_star | five_star`
- `granularity`: `day | week`
- `days`: `7 | 30 | 90`

Returns anonymous trend points.

### `GET /api/dev/v1/stats/distributions`

Query:

- `poolType`: `limited | extra | standard | weapon | character | all`

Returns pity bucket distributions.

## 7. Binding and Official Bot API Boundary

This section documents binding and official bot APIs that already exist, but they are not part of the third-party `public.read` contract. Approved developer keys can only call the public read-only endpoints in sections 5 and 6. Bound-user data is only available to official bot clients with `official_bot` + `bot.self.read`.

### 7.1 Site User Binding Endpoints

These endpoints use the signed-in site user's Supabase access token. They do not use developer API keys.

| Method | Endpoint | Purpose | Auth |
| --- | --- | --- | --- |
| `GET` | `/api/integrations/bindings/me` | Returns the current user's binding status for `discord / telegram / qq`. Pending challenges may include the challenge code; verified bindings do not expose `platform_user_id`. | `Authorization: Bearer <site user token>` |
| `POST` | `/api/integrations/bindings/challenge` | Creates or refreshes a short-lived binding challenge for one provider. | `Authorization: Bearer <site user token>` |
| `POST` | `/api/integrations/bindings/revoke` | Revokes the current user's active binding for one provider. | `Authorization: Bearer <site user token>` |

Create challenge request:

```json
{
  "provider": "telegram"
}
```

Revoke request:

```json
{
  "provider": "telegram"
}
```

### 7.2 Official Bot Binding Verification Endpoint

`POST /api/integrations/bindings/verify` only consumes a challenge and writes the verified binding. It uses a provider verifier secret, not the official bot read-only query key. This verifier credential cannot read analytics or bound-user data.

```http
X-API-Key: <provider verifier secret>
```

```json
{
  "provider": "telegram",
  "challengeCode": "ABCD2345",
  "platformUserId": "123456789",
  "displayHandle": "@example"
}
```

### 7.3 Official Bot Read-Only User Endpoints

These endpoints require an `official_bot` read-only key with `bot.self.read`. Requests must include `provider` and `platformUserId`; the server resolves the bound site user from that pair. The provider must match the client, so a Telegram bot key cannot query Discord bindings.

```http
X-API-Key: <official bot read-only key>
```

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/dev/v1/bot/dashboard` | Bound-user dashboard summary. |
| `GET` | `/api/dev/v1/bot/self-summary` | Legacy-compatible bound-user summary. |
| `GET` | `/api/dev/v1/bot/pools` | Pool index grouped by game account display name. |
| `GET` | `/api/dev/v1/bot/recent-pulls` | Recent high-rarity pull summaries. |
| `GET` | `/api/dev/v1/bot/pool-detail` | One-pool detail, timeline sections, and share payload. |
| `GET` | `/api/dev/v1/bot/analysis` | API-first analysis workspace with account and pool switching. |
| `GET` | `/api/dev/v1/bot/share-card` | Website-sourced single-pool share card image. |
| `GET` | `/api/dev/v1/bot/pool-log` | Detailed one-pool log file export. |

Bot clients should prefer the `accountRef` and `poolRef` values returned by `/api/dev/v1/bot/analysis` for buttons and menus. `gameUid` and `poolId` are legacy compatibility parameters and must not be shown in user-visible text.

### 7.4 Third-Party Developer Boundary

Third-party developer v1 does not provide personal user-data authorization. Developer keys cannot access bound-user summaries, share cards, or log exports. If third-party user-data access is introduced later, it will use new scopes, an authorization screen, and a revocation model instead of being mixed into `public.read`.

See `docs/integration-api.md` for the full internal integration boundary.

## 8. Privacy Boundary

The public API does not provide:

- Raw `history` records
- Email addresses
- `user_id`
- `platform_user_id`
- Game UID level personal data
- Raw history record IDs
- Third-party user-data authorization

If personal authorization is introduced later, it will use new scopes and a separate authorization model instead of being mixed into `public.read`.

## 9. Common Errors

### `401 unauthorized`

The key is missing, malformed, expired, revoked, or hash verification failed.

### `403 forbidden`

The client is not active or does not have `public.read`.

### `429 rate_limited`

The request hit a rate limit. Read `meta.rateLimit.retryAfter` and retry later.

### `500 internal_error`

Internal server error. The response will not include stack traces; provide `meta.requestId` when contacting maintainers.
