# Public Analytics API v1

> Canonical bilingual sources:
>
> - `docs/developer-api-v1.zh-CN.md`
> - `docs/developer-api-v1.en-US.md`
>
> The in-app wiki is available at `/developer-api` after a developer application is approved.

API-002 v1 is a read-only developer API for public catalog data and anonymous aggregate analytics.

Private user data, raw history records, platform bindings, email addresses, and game UID level data are not part of this API.

## Authentication

Every `/api/dev/v1/*` public endpoint requires a developer API key with `public.read`.

Use one of:

```http
X-API-Key: egk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Authorization: Bearer egk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

The displayed `key_prefix` is only an identifier. It is not the full secret and cannot call the API.

Inactive, revoked, expired, or scope-missing keys return a standard error response.

## Response Contract

Success:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "apiVersion": "v1",
    "generatedAt": "2026-04-24T00:00:00.000Z",
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
    "generatedAt": "2026-04-24T00:00:00.000Z",
    "cache": "private, max-age=60, stale-while-revalidate=300",
    "requestId": "..."
  }
}
```

Server-side SQL errors, stack traces, internal table names, and Supabase raw errors are not exposed.

## Pagination

List endpoints use cursor pagination.

Common query parameters:

- `limit`: default `50`, max `100`
- `cursor`: opaque cursor from the previous response

Responses include:

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

## Rate Limit Actions

- `dev_api_catalog`: catalog and site metadata endpoints
- `dev_api_stats_light`: cached global stats and rankings
- `dev_api_stats_heavy`: aggregate analytics endpoints
- `dev_api_public`: compatibility fallback

## Catalog Endpoints

### `GET /api/dev/v1/meta`

Returns API version, scope, site URL, and the public endpoint list.

### `GET /api/dev/v1/pools`

Query:

- `type`: `limited | extra | standard | weapon`
- `status`: `active | upcoming | ended | permanent`
- `limit`
- `cursor`

Returns public pool DTOs with `id`, `pool_id` compatibility field, localized names, type, status, time range, featured entries, and banner metadata.

### `GET /api/dev/v1/pool?id=POOL_ID`

Returns a single public pool DTO.

### `GET /api/dev/v1/characters`

Query:

- `type`: `character | weapon`
- `rarity`: numeric rarity
- `limited`: `true | false`
- `q`: name or alias search
- `limit`
- `cursor`

Returns public character or weapon DTOs with alias, avatar, rarity, type, limited flag, and related public pool summaries.

### `GET /api/dev/v1/character?id=CHARACTER_ID`

Returns a single public character or weapon DTO.

### `GET /api/dev/v1/announcements`

Query:

- `locale`: `zh-CN | en`
- `limit`
- `cursor`

Returns active public announcement DTOs. Each DTO includes `type` (`update` or `temporary`) and `severity` (`info`, `maintenance`, `warning`, or `critical`).

### `GET /api/dev/v1/site/overview`

Returns site URL, next version countdown, active pools, upcoming pools, and configured current/next limited pool summaries.

## Analytics Endpoints

### `GET /api/dev/v1/stats/global`

Returns cached global statistics plus the public analytics summary. The output is anonymous aggregate data only.

### `GET /api/dev/v1/stats/rankings`

Returns public ranking aggregates and item top aggregates.

### `GET /api/dev/v1/stats/pools`

Query:

- `type`: `limited | extra | standard | weapon`
- `status`: `active | upcoming | ended | permanent`
- `from`: ISO date/time filter based on last public pull timestamp
- `to`: ISO date/time filter based on last public pull timestamp
- `limit`
- `cursor`

Returns per-pool aggregate analytics. v1 uses bounded count queries for the returned page and does not scan the full raw history table during public API requests. Target/off-target, average pity, and per-pool distribution buckets require a future pre-aggregate.

### `GET /api/dev/v1/stats/pool?id=POOL_ID`

Returns a single pool aggregate analytics DTO with total pulls and rarity totals. Target/off-target, average pity, and per-pool distribution buckets are not computed from raw history at request time.

### `GET /api/dev/v1/stats/items`

Query:

- `type`: `character | weapon`
- `rarity`: numeric rarity
- `poolType`: `limited | extra | standard | weapon`
- `limit`
- `cursor`

Returns character/weapon aggregate drop counts. Public ranking cache is used first; catalog items outside the ranking cache may have `totalPulls: null`.

### `GET /api/dev/v1/stats/trends`

Query:

- `metric`: `pulls | six_star | five_star`
- `granularity`: `day | week`
- `days`: `7 | 30 | 90`

Returns anonymous aggregate trend points. Without a dedicated precomputed trend cache, `points` is an empty array with a `source` note rather than a live raw-history scan.

### `GET /api/dev/v1/stats/distributions`

Query:

- `poolType`: `limited | extra | standard | weapon | character | all`

Returns pity bucket distributions.

## Explicit Non-Goals

- No raw `history` endpoint.
- No email, platform binding identifier, user ID, game UID, or raw history record ID.
- No third-party user authorization or personal-data scope in v1.
- `/api/bootstrap` and `/api/stats` remain internal site endpoints and are not developer API contracts.

## Related Private APIs

Account binding and official bot self-query endpoints exist, but they are not part of the third-party `public.read` contract. See `docs/integration-api.md` for the controlled binding and official bot API boundary.
