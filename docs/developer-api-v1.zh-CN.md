# Public Analytics API v1

本文档面向已通过审核的开发者应用。API v1 只提供 `public.read`：公开目录、公开公告、公开卡池信息、匿名聚合统计。它不会返回用户邮箱、平台绑定标识、游戏 UID、原始抽卡记录或任何个人私有数据。

## 1. 快速开始

### Base URL

```text
https://你的站点域名
```

本地开发可使用：

```text
http://127.0.0.1:5173
```

### 鉴权

所有 `/api/dev/v1/*` 公开 API 都必须带开发者 Key。推荐使用 `X-API-Key`：

```http
X-API-Key: ek_live_xxx
```

也支持 Bearer：

```http
Authorization: Bearer ek_live_xxx
```

### 第一个请求

```bash
curl -H "X-API-Key: ek_live_xxx" \
  "https://example.com/api/dev/v1/meta"
```

JavaScript 示例：

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

## 2. 响应格式

成功响应固定为：

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

失败响应固定为：

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

服务端不会向调用方暴露 SQL 错误、Supabase 原始错误、堆栈或内部表名。

## 3. 分页

列表端点使用 cursor 分页：

- `limit`：默认 `50`，最大 `100`
- `cursor`：上一页返回的 `nextCursor`

典型分页字段：

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

## 4. 限流

当前限流 action：

- `dev_api_catalog`：目录、角色、公告、站点元数据
- `dev_api_stats_light`：缓存型全局统计、排行
- `dev_api_stats_heavy`：按池、按物品、趋势、分布等聚合分析
- `dev_api_public`：兼容兜底

收到 `429` 时，请读取 `meta.rateLimit.retryAfter` 并退避重试。

## 5. 目录端点

### `GET /api/dev/v1/meta`

返回 API 版本、scope、站点地址、可用端点与文档入口。

### `GET /api/dev/v1/openapi`

返回 OpenAPI 3.1 描述对象，包在标准 v1 响应的 `data.openapi` 中。适合用于生成客户端、校验 endpoint 清单或同步内部文档。

### `GET /api/dev/v1/pools`

查询参数：

- `type`：`limited | extra | standard | weapon`
- `status`：`active | upcoming | ended | permanent`
- `limit`
- `cursor`

返回公开卡池 DTO：`id`、兼容字段 `pool_id`、本地化名称、类型、状态、时间范围、featured 名单与公开 banner 信息。

### `GET /api/dev/v1/pool?id=POOL_ID`

返回单个公开卡池 DTO。

### `GET /api/dev/v1/characters`

查询参数：

- `type`：`character | weapon`
- `rarity`：数字稀有度
- `limited`：`true | false`
- `q`：名称或别名搜索
- `limit`
- `cursor`

返回角色或武器 DTO：别名、头像、稀有度、类型、限定标记与关联公开卡池摘要。

### `GET /api/dev/v1/character?id=CHARACTER_ID`

返回单个角色或武器 DTO。

### `GET /api/dev/v1/announcements`

查询参数：

- `locale`：`zh-CN | en`
- `limit`
- `cursor`

返回公开公告列表。

### `GET /api/dev/v1/site/overview`

返回站点 URL、下版本倒计时、当前开放卡池、未来卡池与配置化当前/下期限定池摘要。

## 6. 公开分析端点

### `GET /api/dev/v1/stats/global`

返回匿名全站聚合统计，例如总抽数、贡献人数、稀有度汇总、资源汇总与平均出货摘要。

### `GET /api/dev/v1/stats/rankings`

返回公开排行聚合，按限定角色池、附加池、常驻池、武器池等分组。

### `GET /api/dev/v1/stats/pools`

查询参数：

- `type`：`limited | extra | standard | weapon`
- `status`：`active | upcoming | ended | permanent`
- `from`：基于公开最后出货时间的 ISO 时间过滤
- `to`：基于公开最后出货时间的 ISO 时间过滤
- `limit`
- `cursor`

返回按卡池聚合的公开分析。

### `GET /api/dev/v1/stats/pool?id=POOL_ID`

返回单卡池公开分析：总抽数、稀有度汇总、目标 / 偏移统计、平均出货与分布桶。

### `GET /api/dev/v1/stats/items`

查询参数：

- `type`：`character | weapon`
- `rarity`：数字稀有度
- `poolType`：`limited | extra | standard | weapon`
- `limit`
- `cursor`

返回角色 / 武器出货聚合。

### `GET /api/dev/v1/stats/item?id=ITEM_ID`

查询参数：

- `id`：角色 / 武器的公开 `id` 或名称
- `type`：可选，`character | weapon`，用于同名条目消歧

返回单个角色 / 武器的公开出货聚合，包含总出货次数、稀有度、限定标记、按池类型统计，以及公开卡池维度的出现次数。

### `GET /api/dev/v1/stats/trends`

查询参数：

- `metric`：`pulls | six_star | five_star`
- `granularity`：`day | week`
- `days`：`7 | 30 | 90`

返回匿名趋势点。

### `GET /api/dev/v1/stats/distributions`

查询参数：

- `poolType`：`limited | extra | standard | weapon | character | all`

返回保底分布桶。

## 7. 官方 BOT 与绑定接口

官方 BOT 私有接口不属于第三方 `public.read` 契约。它们使用 `official_bot` client 与 `bot.self.read`，并且平台绑定验证使用独立 verifier secret。

相关边界见站内文档 `integration-api.md`。第三方开发者 v1 暂不开放用户个人数据读取。

## 8. 隐私边界

公开 API 不提供：

- 原始 `history` 明细
- 邮箱
- `user_id`
- `platform_user_id`
- 游戏 UID 级个人数据
- 原始 history record id
- 第三方应用读取用户本人数据的授权能力

若未来开放个人授权读取，将使用新的 scope 与新的授权模型，不会混入当前 `public.read`。

## 9. 常见错误

### `401 unauthorized`

Key 缺失、格式错误、已过期、已撤销或 hash 不匹配。

### `403 forbidden`

客户端未启用，或没有 `public.read` scope。

### `429 rate_limited`

触发限流。请读取 `meta.rateLimit.retryAfter` 后退避重试。

### `500 internal_error`

服务端内部错误。响应不会包含内部堆栈；请带 `meta.requestId` 联系维护者排查。
