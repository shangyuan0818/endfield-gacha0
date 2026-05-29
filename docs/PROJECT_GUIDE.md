# Project Guide

这份文档承接 README 中不适合放在 GitHub 首页的部署、环境变量、数据库和维护细节。

## 功能范围

- 官方抽卡记录导入、去重、云同步和区服纠错。
- 首页 bootstrap、公告、全服统计、卡池目录和阵容公开读取。
- 桌面端 / 移动端双入口、抽卡模拟器、分享卡和后台管理。
- 运营自动化：公告、卡池轮换、Wiki catalog 的 job graph、partial、review bundle 和审计。
- 可观测性：Vercel Analytics、Speed Insights、性能预算报告。

## 本地开发

```bash
npm install
cp .env.example .env
npm run dev
```

私有代理和旧后端不在公开仓库内。`npm run dev:backend*`、`npm run test:harness` 在缺少私有目录时会安全退出。

## 验证矩阵

| 命令 | 用途 |
|------|------|
| `npm test` | 公开验证链 |
| `npm run test:unit` | Vitest 单元测试 |
| `npm run lint` | ESLint |
| `npm run build` | 生产构建 |
| `npm run perf:report` | 包体和资源预算 |
| `npm run test:public-api-boundary` | 首屏公共读取不直连 Supabase |
| `npm run test:bootstrap-cache` | 公共 cache partial / stale 行为 |
| `npm run test:supabase-baseline` | baseline 覆盖范围和首尾 marker |
| `npm run test:mail-abuse-guards` | 自建邮件防刷 guard、预算桶、幂等和脱敏 |
| `npm run test:mail-outbox-enqueue` | 自建邮件 outbox 入队、幂等、预算和 RPC 边界 |
| `npm run test:mail-outbox-worker` | 自建邮件 outbox 队列处理器、provider adapter、演练 / 真实发送回写和脱敏 |
| `npm run test:mail-inbound` | 自建邮件入站 webhook 脱敏记录和 secret 鉴权 |
| `npm run test:mail-service-entrypoints` | 网站侧邮件 worker endpoint、后台测试邮件入口和脱敏边界 |
| `npm run test:ops-automation` | 运营自动化 job graph |
| `npm run test:official-announcements-feed` | 官方公告 feed |

## 环境变量

```env
# Supabase
SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx

# App / cache
VITE_APP_URL=https://your-domain.vercel.app
VITE_APP_FORCE_REFRESH_TOKEN=2026-05-22-release-refresh
VITE_PUBLIC_DATA_DIRECT_SUPABASE_FALLBACK=false
MAIL_ABUSE_HASH_SECRET=replace-me-with-long-random-secret
MAIL_PROVIDER=stalwart
AUTH_MAIL_ACTIONS_ENABLED=false
ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED=false
DEVELOPER_API_REVIEW_MAIL_OUTBOX_ENABLED=false
TICKET_REPLY_MAIL_OUTBOX_ENABLED=false
ADMIN_ALERT_MAIL_OUTBOX_ENABLED=false
MAIL_OUTBOX_WORKER_ENABLED=false
MAIL_WORKER_DRY_RUN=true
MAIL_WORKER_BATCH_SIZE=10
MAIL_WORKER_MAX_ATTEMPTS=3
MAIL_WORKER_RETRY_DELAY_SECONDS=900
MAIL_PROVIDER_TIMEOUT_MS=15000
MAIL_OUTBOX_GLOBAL_KILL_SWITCH=true
MAIL_OUTBOX_WORKER_SECRET=replace-me
STALWART_SMTP_HOST=mail.example.com
STALWART_SMTP_PORT=587
STALWART_SMTP_USERNAME=replace-me
STALWART_SMTP_PASSWORD=replace-me
STALWART_JMAP_URL=https://mail.example.com
STALWART_WEBHOOK_SECRET=replace-me
MAIL_DELIVERY_WEBHOOK_SECRET=replace-me
MAIL_INBOUND_WEBHOOK_SECRET=replace-me
MAIL_SENDING_DOMAIN=mail.example.com
ACCOUNT_RECOVERY_TEMP_PASSWORD_TTL_HOURS=24

# Optional proxies and puzzle player
VITE_PROXY_URL_CN=https://your-cn-proxy.example.com
VITE_PROXY_URL_INTL=https://your-intl-proxy.example.com
VITE_PUZZLE_PLAYER_URL=https://your-player.example.com

# Ops automation
CRON_SECRET=replace-me
OPS_AUTOMATION_ANNOUNCEMENTS_URL=https://example.com/announcements.json
OPS_AUTOMATION_ANNOUNCEMENTS_TAG=official-json
OPS_AUTOMATION_POOL_SCHEDULE_URL=https://example.com/pools.json
OPS_AUTOMATION_POOL_SCHEDULE_TAG=official-json
OPS_AUTOMATION_WIKI_CATALOG_URL=https://example.com/wiki.json
OPS_AUTOMATION_WIKI_CATALOG_TAG=official-json

# Official bot
TELEGRAM_OFFICIAL_BOT_TOKEN=replace-me
TELEGRAM_OFFICIAL_BOT_PROXY_URL=http://127.0.0.1:7890
TELEGRAM_OFFICIAL_BOT_PUBLIC_API_KEY=replace-me
TELEGRAM_OFFICIAL_BOT_VERIFIER_SECRET=replace-me
TELEGRAM_OFFICIAL_BOT_POLL_INTERVAL_MS=1500
TELEGRAM_OFFICIAL_BOT_LONG_POLL_SECONDS=20
```

旧变量别名 `VITE_SUPABASE_ANON_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 仍可兼容，但新配置应使用 publishable / secret key 口径。

## 部署

1. 在 Supabase 创建项目。
2. 执行 `supabase/baseline/000_complete_schema.sql` 起库。
3. 启用 `global_stats` 表 Realtime。
4. 在 Vercel 配置 `VITE_SUPABASE_*`、`SUPABASE_SECRET_KEY`、`CRON_SECRET` 和需要的自动化 / BOT 环境变量。
5. 导入仓库部署。

当前管理后台主链已收口到 Vercel Serverless `/api/admin`，并通过 `vercel.json` rewrite 兼容旧 `admin-*` 路径。不再要求额外部署同名 Supabase Edge Functions。

邮件发送分为两层：认证邮件使用受控同源 `/api/auth-email-action`，支持注册验证、密码重置和邮件登录；通知类和人工恢复队列继续走 provider-independent outbox / 队列处理器。认证邮件入口必须同时启用 `AUTH_MAIL_ACTIONS_ENABLED=true`、`MAIL_OUTBOX_WORKER_ENABLED=true`，且未命中环境级紧急停发开关 `MAIL_OUTBOX_GLOBAL_KILL_SWITCH` 才会调用 provider adapter；它会先做 origin、CAPTCHA、内存限流、账号存在性判断和脱敏审计，未知邮箱的重置 / 邮件登录仍返回通用状态。当前 `api/_lib/mailOutbox.js` 只允许服务端 service-role 经过防刷、suppression、幂等和 `enqueue_mail_outbox_event()` RPC 写入私有 `mail_outbox`；`api/_lib/mailOutboxWorker.js` 和 `api/_lib/mailProviderAdapter.js` 已提供 Stalwart-first 的队列处理器 / provider 边界。`api/_lib/mailTemplateRenderer.js` 是统一 HTML + plaintext 邮件模板入口，注册验证、邮件登录、密码重置、账号恢复队列处理器、开发者 API 审核通知、工单回复通知、管理员告警和后台测试邮件都应复用它。开发者 API 审核结果已可在 `DEVELOPER_API_REVIEW_MAIL_OUTBOX_ENABLED=true` 且 `MAIL_OUTBOX_WORKER_ENABLED=true` 时写入 outbox；工单 staff 回复已通过 `/api/tickets/reply` 服务端路由写入回复，并可在 `TICKET_REPLY_MAIL_OUTBOX_ENABLED=true` 且 `MAIL_OUTBOX_WORKER_ENABLED=true` 时为工单所有者写入 `ticket.reply` outbox；后台“邮件状态”页可在 `ADMIN_ALERT_MAIL_OUTBOX_ENABLED=true` 且队列处理器开启时把 `admin.alert` 受控入队给当前超级管理员自己的账号邮箱。通知类入队失败都不会阻断原业务操作，响应只回传 queued / deduped / disabled / skipped / blocked / error 等脱敏状态，不返回收件邮箱或 guard decision。`/api/mail-outbox-worker` 是内部队列处理 endpoint，同时接受 `MAIL_OUTBOX_WORKER_SECRET` 和 `CRON_SECRET` 鉴权；`vercel.json` 已配置每日一次 Vercel Cron 触发该 endpoint，外部 cron 或受控运维脚本可使用独立 worker secret，后台“邮件状态”页也能由超级管理员手动调用 `/api/admin?route=mail-outbox-drain` 处理到期队列。`/api/mail-delivery-feedback` 是内部投递反馈入口，用服务端 secret 接收单条 hard bounce / complaint / invalid recipient / domain pause，也能接收 Stalwart Telemetry Webhook `{ events: [...] }` 批量投递事件；永久失败会写入 `mail_suppression`，成功和临时失败只写入脱敏 `mail_delivery_events`。`/api/mail-inbound` 是内部入站邮件事件入口，用服务端 secret 接收 Stalwart Webhooks / MTA Hooks 或受控桥接脚本的入站摘要，并只写入脱敏 `mail_delivery_events`，不保存原始正文或自动生成工单。后台“站点健康”和“邮件状态”面板通过 `/api/admin?route=site-health` 汇总内容更新时间、公共缓存、自动化、邮件队列、入站事件、suppression、发送预算高水位和待处理事项；“邮件状态”页还提供超级管理员测试邮件入口，用当前 provider adapter 发送受控测试邮件，并只记录脱敏投递事件。邮件状态页可在线编辑 `mail_abuse_budget_config` 的窗口、上限和启用状态，并能展开查看最近失败 / suppressed outbox 的脱敏错误摘要。所有响应不返回原始邮箱、SMTP 密码、webhook secret、Stalwart 原始 event id / queue id 或预算 bucket hash。真实投递前必须先设置 `MAIL_ABUSE_HASH_SECRET`、保持环境级紧急停发开关可用，并确认 `docs/SELF_HOSTED_MAIL.md` 中的 DNS、suppression、预算和投递监控检查项完成。

账号恢复现在优先走自助重置邮件：登录弹窗的“账号恢复”会先调用 `/api/auth-email-action` 发送密码重置邮件；只有多次收不到邮件、邮箱不可访问或需要注销旧账号时，才提交人工恢复申请。人工恢复申请仍只返回通用 `received` 状态；超管核验后可设置临时密码；临时密码过期时间由 `ACCOUNT_RECOVERY_TEMP_PASSWORD_TTL_HOURS` 控制；用户登录后会从私有 `account_security_states` 读取强制改密状态，并在设置页改密成功后清除。只有 `ACCOUNT_RECOVERY_MAIL_OUTBOX_ENABLED=true` 且 `MAIL_OUTBOX_WORKER_ENABLED=true` 时，人工恢复申请中的 `password_reset` 才会写入 `mail_outbox` 并标记为 `mail_reset_queued`；防刷阻断、入队异常或状态回写失败时仍保留人工恢复 fallback。认证预检和恢复申请会写入私有 `auth_security_events`，只保存 hash、风险桶、CAPTCHA 摘要和脱敏 metadata。不要把强制改密状态放进公开 profile 字段，也不要在响应、日志或审计包中保存明文临时密码、原始邮箱、验证码 token 或 `game_uid`。

受控队列处理器可用 `npm run worker:mail-outbox` 手动运行，也可调用 `/api/mail-outbox-worker`，或在后台“邮件状态”页点击“处理到期队列”。这些路径默认都需要 `MAIL_OUTBOX_WORKER_ENABLED=true` 且未命中紧急停发开关才会处理队列；每日 Vercel Cron 只负责触发，不会绕过队列处理器开关、演练模式或紧急停发开关。当前已接入 Stalwart SMTP 真实传输、Stalwart Telemetry Webhook 批量投递事件归一、入站事件记录、后台健康汇总、发送预算高水位摘要和站内测试邮件入口；在关闭演练模式前仍必须完成 DNS、收件端认证结果审计、Stalwart 管理端 Webhook 真实事件小测试、紧急停发灰度和更细的投递监控。未配置 SMTP 主机、账号或密码时会以 `stalwart_smtp_not_configured` 安全失败，不会伪装投递成功。

邮件运行期开关存放在 `site_config.mail_runtime_config`，由后台“邮件状态”页通过 `/api/admin?route=mail-runtime-config` 保存。它用于临时暂停全局发信、单独关闭认证邮件 / 账号恢复 outbox / 开发者 API 审核 / 工单回复 / 管理员告警，以及追加禁用事件和暂停域名。该配置只能进一步收紧：环境变量关闭时运行期“允许”不会启用发信，环境级紧急停发开启时运行期“关闭紧急停发”不会绕过停发；SMTP 密码、Webhook secret 和 Vercel env 仍只放在部署环境变量里。

## 数据库维护

- `supabase/baseline/`：新环境基线 schema。
- `supabase/archive/migrations/`：已合并进 baseline 的历史标准迁移，仅用于审计和重建 baseline。
- `supabase/migrations/`：当前 active 标准迁移源文件，以及未来新增、尚未合并进 baseline 的前向迁移。
- `supabase/manual/`：危险、回滚、回填和历史诊断脚本，不进入默认部署链。

刷新 baseline：

```bash
npm run generate:supabase-baseline
npm run test:supabase-baseline
```

数据库体积治理的现状：远端 `history` 体积主要来自索引。删除字段或索引前必须先做线上读写路径、RPC 查询计划、回滚脚本和实际基准验证；本轮只整理 baseline 和迁移归档，不直接改生产表结构。

## 静态资源维护

- 头像主链优先使用 `public/avatars/` 本地静态路径，减少 Supabase Storage egress。
- 版本日历等大图优先使用压缩后的 Web 友好格式。
- `src/generated/fonts/harmony/` 由 `npm run fonts:prepare` 生成，不进入 Git。
- 新增截图或大图后应运行 `npm run perf:report` 检查资源预算。

## Changelog 摘要

### v4.4.0

- 账号邮件系统进入主线：注册邮箱验证、自助密码重置、邮件登录、邮箱更换验证和统一 HTML 邮件模板。
- 后台新增站点健康与邮件状态面板，可查看邮件队列、发送预算、投递反馈、入站事件和关键运行期开关。
- 验证链路升级为 Turnstile / 自建 PoW 双轨，并接入注册、登录、重置、恢复等账号入口。
- 首页版本前瞻、倒计时、路线图、卡池 / 角色 / 武器管理和导入恢复体验完成本轮收口。
- 公共卡池分析补齐预聚合缓存、趋势点和更完整指标，依赖、Node 26 兼容与 CI 链路完成复查。

### v4.3.0

- `CACHE-001 / ARCH-022`：公共数据访问统一到同源 `/api/*`，接入公共缓存版本、响应 `meta` 和显式失效。
- `OPS-006`：运营自动化补齐 job graph、partial 语义、手动重跑、审计详情和缓存失效回写。
- Speed Insights：接入 `@vercel/speed-insights` 并修复生产 bundle 动态配置透传。
- 文档与数据库 baseline 同步到当前主线。

### v4.2.0

- 接入角色图鉴全服聚合、个人图鉴、手动补录与角色详情资源统计。
- 补齐复刻混池与附加寻访的配额规则。
- 优化统计页与角色图鉴的桌面端 / 移动端布局。

### v4.0.0

- 建立自定义字体链、公告多语言、官方游戏公告 feed、管理后台用户管理、CI 和移动端主路由。
