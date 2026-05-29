# Code Map

这份文件只保留“从哪里开始读代码”的索引。系统边界、数据流、缓存和数据库分层详见 [ARCHITECTURE.md](ARCHITECTURE.md)；部署、环境变量和维护命令详见 [PROJECT_GUIDE.md](PROJECT_GUIDE.md)。

## 前端入口

| 范围 | 文件 |
|------|------|
| React 挂载、Provider、观测 | `src/main.jsx` |
| 桌面 / 移动 / 法律页路由 | `src/AppRouter.jsx` |
| 桌面壳层 | `src/App.jsx`、`src/GachaAnalyzer.jsx` |
| 桌面页面映射 | `src/components/app/DesktopAppRoutes.jsx` |
| 移动壳层 | `src/mobile/MobileApp.jsx`、`src/mobile/layouts/MobileLayout.jsx` |
| 路由常量 | `src/constants/appRoutes.js` |

## 页面主入口

| 页面 | 桌面端 | 移动端 |
|------|--------|--------|
| 首页 | `src/components/home/HomePage.jsx` | `src/mobile/views/MobileHomePageView.jsx` |
| 全服统计 | `src/components/SummaryView.jsx` | `src/mobile/views/MobileSummaryView.jsx` |
| 卡池详情 | `src/components/app/DesktopDashboardWorkspace.jsx` | `src/mobile/views/MobileDashboardView.jsx` |
| 模拟器 | `src/features/simulator/GachaSimulator.jsx` | `src/mobile/views/MobileSimulatorView.jsx` |
| 设置 | `src/components/SettingsPanel.jsx` | `src/mobile/views/MobileSettingsView.jsx` |
| 工单 | `src/components/TicketPanel.jsx` | `src/mobile/views/MobileTicketView.jsx` |
| 后台 | `src/components/AdminPanel.jsx` | `src/mobile/views/MobileAdminView.jsx` |

## 状态与数据

| 范围 | 文件 |
|------|------|
| auth / pool / history / app 状态 | `src/stores/*` |
| 启动初始化 | `src/hooks/app/useAppInitialization.js` |
| 当前卡池上下文 | `src/hooks/app/useCurrentPoolData.js` |
| 云同步 | `src/hooks/app/useCloudSync.js` |
| 公共资源客户端 | `src/services/publicResourceClient.js` |
| bootstrap / 卡池公开读取 | `src/services/bootstrapService.js`、`src/services/poolReadService.js` |
| 全服统计归一化 | `src/services/statsService.js` |
| 云写入 | `src/services/cloudWriteService.js` |
| 文件导入草稿恢复 | `src/hooks/app/useDataExportImport.js`、`src/utils/importPendingDraft.js` |
| Toast / 持久通知模型 | `src/hooks/useToast.js`、`src/components/ui/Toast.jsx`、`src/utils/notificationModel.js` |

## Vercel API

| 范围 | 文件 |
|------|------|
| 单一 API 入口 | `api/router.js` |
| 路由表 | `api/_routes/index.js` |
| 公共缓存 helper | `api/_lib/publicCache.js` |
| 邮件防刷 / 入队 / worker / webhook / 模板 / 运行期开关 | `api/_lib/mailAbuseGuards.js`、`api/_lib/mailOutbox.js`、`api/_lib/mailOutboxWorker.js`、`api/_lib/mailProviderAdapter.js`、`api/_lib/mailTemplateRenderer.js`、`api/_lib/mailDeliveryFeedback.js`、`api/_lib/mailInboundEvents.js`、`api/_lib/mailSmokeTest.js`、`api/_lib/mailRuntimeConfig.js` |
| 认证 CAPTCHA / 风险桶 / 脱敏审计 | `api/_lib/authSecurityGuards.js` |
| 认证邮件 / 账号恢复状态 | `api/_routes/root/auth-email-action.js`、`api/_routes/root/account-recovery-request.js`、`api/_routes/root/account-security-state.js` |
| bootstrap / stats / announcements / pool-rosters | `api/_routes/root/*.js` |
| 后台管理 | `api/_routes/root/admin.js` |
| 运营自动化 | `api/_routes/root/ops-automation.js`、`api/_lib/runOpsAutomation.js` |
| BOT / 开发者接口 | `api/_routes/dev/**/*`、`api/_routes/integrations/**/*` |

## 维护脚本

| 范围 | 文件 |
|------|------|
| 邮件防刷 / 入队验证 | `scripts/verify-mail-abuse-guards.mjs`、`scripts/verify-mail-outbox-enqueue.mjs` |
| 邮件 worker / webhook 验证 / 手动入口 | `scripts/verify-mail-outbox-worker.mjs`、`scripts/verify-mail-delivery-feedback.mjs`、`scripts/verify-mail-inbound.mjs`、`scripts/verify-mail-service-entrypoints.mjs`、`scripts/run-mail-outbox-worker.mjs` |
| 公共 API / cache 验证 | `scripts/verify-public-api-boundary.mjs`、`scripts/verify-bootstrap-cache-partial.mjs`、`scripts/verify-public-pool-analytics-cache.mjs` |
| baseline / 数据库验证 | `scripts/verify-supabase-baseline.mjs`、`scripts/verify-supabase-baseline-smoke.mjs` |

## Supabase 与资源

| 范围 | 路径 |
|------|------|
| 新环境 schema 入口 | `supabase/baseline/000_complete_schema.sql` |
| 已合并进 baseline 的迁移 | `supabase/archive/migrations/` |
| 未来新增迁移 | `supabase/migrations/` |
| 手工危险 / 回填 / 回滚脚本 | `supabase/manual/` |
| 邮件 outbox / suppression / 预算表 | `supabase/migrations/116_add_mail_outbox_and_abuse_controls.sql` |
| 账号恢复强制改密状态 | `supabase/migrations/117_add_account_recovery_state_metadata.sql` |
| 认证安全审计事件 | `supabase/migrations/119_add_auth_security_events.sql` |
| 邮件 outbox 原子入队 RPC | `supabase/migrations/120_add_mail_outbox_enqueue_rpc.sql` |
| 邮件登录事件与运行期开关 | `supabase/migrations/123_add_email_login_mail_event_type.sql`、`supabase/migrations/124_seed_mail_runtime_config.sql` |
| 静态头像 | `public/avatars/` |
| 版本日历静态图 | `public/game-calendar/` |

## 仍需治理的复杂点

- `SIM-004`：`src/features/simulator/useGachaSimulatorController.js` 仍承担较多模拟器 UI、资源、继承和分享状态。
- `ARCH-021`：桌面 / 移动端 dashboard 与 settings 仍有重复控制器逻辑。
- `DB-OPTIMIZE-001`：线上数据库体积治理要先做索引使用审计和查询计划验证，本轮未直接变更生产 schema 语义。
