# Binding and Official Bot API

This document covers controlled binding and official bot query endpoints.

These endpoints are not third-party `public.read` APIs. They are split by credential type:

- Site user endpoints use a normal Supabase user access token.
- Official bot query endpoints use an `official_bot` API key with `bot.self.read`.
- Binding verification uses a provider-specific verifier secret, not the read-only bot key.

## Site User Binding Endpoints

### `GET /api/integrations/bindings/me`

Authentication:

```http
Authorization: Bearer <site user access token>
```

Returns the current user's binding status for `discord`, `telegram`, and `qq`.

Pending challenges include `challenge_code`; verified bindings do not expose `platform_user_id`.

### `POST /api/integrations/bindings/challenge`

Authentication:

```http
Authorization: Bearer <site user access token>
```

Body:

```json
{
  "provider": "telegram"
}
```

Creates or refreshes a short-lived binding challenge.

### `POST /api/integrations/bindings/revoke`

Authentication:

```http
Authorization: Bearer <site user access token>
```

Body:

```json
{
  "provider": "telegram"
}
```

Revokes the current user's active binding for that provider.

## Bot Binding Verification Endpoint

### `POST /api/integrations/bindings/verify`

Authentication:

```http
X-API-Key: <provider verifier secret>
```

Body:

```json
{
  "provider": "telegram",
  "challengeCode": "ABCD2345",
  "platformUserId": "123456789",
  "displayHandle": "@example"
}
```

This endpoint only consumes a binding challenge and marks the binding verified. It cannot read user analytics.

## Official Bot Query Endpoints

Authentication:

```http
X-API-Key: <official bot read-only key>
```

Required scope:

```text
bot.self.read
```

All endpoints require:

- `provider`
- `platformUserId`

The provider must match the official bot client provider. For example, a Telegram bot key cannot query a Discord binding.

### `GET /api/dev/v1/bot/dashboard`

Returns bound-user dashboard summary.

### `GET /api/dev/v1/bot/self-summary`

Legacy-compatible bound-user summary endpoint.

### `GET /api/dev/v1/bot/pools`

Returns bound-user pool index grouped by game account display name.

### `GET /api/dev/v1/bot/recent-pulls`

Query:

- `limit`: default `10`, max controlled by server

Returns recent high-rarity pull summaries.

### `GET /api/dev/v1/bot/pool-detail`

Query:

- `poolId`
- `gameUid` optional internal selector

Returns one bound user's pool detail, timeline sections, and share payload.

## Privacy Boundary

User-visible and third-party outputs must not include:

- Email
- `platform_user_id`
- `user_id`
- Raw history record IDs
- Raw history dumps

Official bot callbacks may carry internal routing refs such as `gameUid` and `poolId`, but public text should display pool names and game nicknames instead.

## Runtime Data Source

Official bot runtime code should obtain display data through the HTTP API layer:

- Bound-user data: `/api/dev/v1/bot/*`
- Public site/catalog data: `/api/dev/v1/site/overview` and public catalog/stat endpoints
- Binding verification: `/api/integrations/bindings/verify`

Bot adapters and notification senders should not call dashboard/catalog builder functions directly. If an API route needs to aggregate database data, that aggregation should remain inside the API handler layer.
