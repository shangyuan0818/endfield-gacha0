# Frontend Code Map

这份文档只记录当前在线主链，不覆盖已退役或兼容残链。

## 1. 入口与路由

### 应用入口

- `src/main.jsx`
  - React 挂载点
  - 顶层 provider、主题、路由初始化
- `src/AppRouter.jsx`
  - 桌面端 `/`
  - 移动端 `/m/*`
  - 法律页 `/privacy`、`/terms`
  - 密码重置页 `/reset-password`
  - 设备重定向 guard

### 桌面端路由

- `src/App.jsx`
  - 桌面端壳层
- `src/GachaAnalyzer.jsx`
  - 桌面端总装配入口
  - 负责：
    - 顶栏
    - 全局 toast / confirm
    - 云同步主链
    - 初始化与 realtime
    - 当前卡池上下文
- `src/components/app/DesktopAppRoutes.jsx`
  - `home -> HomePage`
  - `summary -> SummaryView`
  - `dashboard -> DesktopDashboardWorkspace`
  - `simulator -> GachaSimulator`
  - `settings -> SettingsPanel`
  - `about -> AboutPanel`
  - `tickets -> TicketPanel`
  - `admin -> AdminPanel`

### 移动端路由

- `src/mobile/MobileApp.jsx`
  - 移动端壳层
- `src/mobile/layouts/MobileLayout.jsx`
  - `home -> MobileHomePageView`
  - `summary -> MobileSummaryView`
  - `dashboard -> MobileDashboardView`
  - `simulator -> MobileSimulatorView`
  - `settings -> MobileSettingsView`
  - `about -> MobileAboutView`
  - `tickets -> MobileTicketView`
  - `admin -> MobileAdminView`

### 共享路由映射

- `src/constants/appRoutes.js`
  - 桌面端 / 移动端 tab <-> path 真源
  - `PlatformSwitcher` 依赖它做跨端同页跳转

## 2. 全局状态层

### Zustand stores

- `src/stores/useAuthStore.js`
  - 当前用户
  - 当前角色
  - 同步状态 / 最近同步时间
  - 登录弹窗开关
- `src/stores/usePoolStore.js`
  - 卡池目录
  - 当前卡池
  - 当前游戏账号
  - 池组聚合模式
- `src/stores/useHistoryStore.js`
  - 抽卡记录
  - 历史筛选
  - 分页
- `src/stores/useAppStore.js`
  - 全服统计
  - 公告
  - 站点全局状态

### 当前在线主链的 store -> hook 组合

- 卡池上下文：
  - `src/hooks/app/useCurrentPoolData.js`
- 云同步：
  - `src/hooks/app/useCloudSync.js`
- 启动初始化：
  - `src/hooks/app/useAppInitialization.js`
- 用户角色：
  - `src/hooks/app/useUserRole.js`
- 通知 / 公告 / 未读工单：
  - `src/hooks/app/useNotificationBadges.js`

## 3. 页面主路径

### 首页

- 桌面端：
  - `src/components/home/HomePage.jsx`
- 移动端：
  - `src/mobile/views/MobileHomePageView.jsx`
- 关键子卡片：
  - `src/components/home/RotationScheduleCard.jsx`
  - `src/components/home/CountdownCard.jsx`
  - `src/components/home/MechanicsOverviewCard.jsx`
  - `src/components/home/RoadmapCard.jsx`

首页依赖的数据主链：

- 公共卡池：
  - `src/services/bootstrapService.js`
  - `src/services/poolReadService.js`
- 动态轮换与倒计时：
  - `src/utils/poolTimeUtils.js`

### 统计页

- 桌面端：
  - `src/components/SummaryView.jsx`
- 移动端：
  - `src/mobile/views/MobileSummaryView.jsx`
- 视图主状态：
  - `src/hooks/summary/useSummaryViewState.js`
- 全服统计归一化：
  - `src/services/statsService.js`
- 资源卡：
  - `src/components/resources/ResourceSummaryPanel.jsx`

### 卡池详情页

- 桌面端：
  - `src/components/dashboard/DashboardView.jsx`
  - `src/components/app/DesktopDashboardWorkspace.jsx`
- 移动端：
  - `src/mobile/views/MobileDashboardView.jsx`
- 关键组件：
  - `src/components/dashboard/PoolAnalysisCard.jsx`
  - `src/components/dashboard/PoolTimelinePanel.jsx`
  - `src/components/dashboard/AveragePullStatsPanel.jsx`
- 关键数据构建：
  - `src/utils/poolTimelineView.js`
  - `src/utils/dashboardTimelineSections.js`
  - `src/hooks/app/usePoolStats.js`
  - `src/hooks/app/useCurrentPoolGroupedHistory.js`

### 模拟器

- 入口：
  - `src/features/simulator/GachaSimulator.jsx`
- 控制器：
  - `src/features/simulator/useGachaSimulatorController.js`
- 本地持久化：
  - `src/utils/simulatorStorage.js`
- 分享卡：
  - `src/features/simulator/SimulatorShareCard.jsx`
  - `src/utils/simulatorShare.js`

### 设置页

- 桌面端：
  - `src/components/SettingsPanel.jsx`
- 移动端：
  - `src/mobile/views/MobileSettingsView.jsx`

当前设置页主链：

- 修改密码：
  - `supabase.auth.updateUser`
- 删除我的抽卡数据：
  - `useCloudSync.deleteUserDataFromCloud`
- 自助注销账号：
  - `api/self-delete-account.js`
  - `src/services/selfAccountService.js`
  - `src/utils/finalizeDeletedAccountSession.js`

### 关于页 / 工单 / 管理后台

- 关于页：
  - `src/components/AboutPanel.jsx`
  - `src/mobile/views/MobileAboutView.jsx`
- 工单：
  - `src/components/TicketPanel.jsx`
  - `src/mobile/views/MobileTicketView.jsx`
- 管理后台：
  - `src/components/AdminPanel.jsx`
  - `src/hooks/admin/useAdminData.js`

## 4. 认证与权限边界

### 登录 / 注册 / 账号恢复

- 登录弹窗：
  - `src/AuthModal.jsx`
  - `src/components/auth/AuthModalView.jsx`
  - `src/hooks/auth/useAuthModalState.js`

### 权限判断

- 前端角色状态：
  - `useAuthStore.userRole`
- 管理员入口限制：
  - `DesktopAppRoutes.jsx`
  - `MobileLayout.jsx`
- 服务端超管能力：
  - `api/admin-reset-recovery-password.js`
  - `supabase/functions/admin-create-user`
  - `supabase/functions/admin-delete-user`

### 当前账号恢复主链

- 邮箱注册状态检查：
  - `api/auth-account-status.js`
- 匿名恢复申请：
  - `api/account-recovery-request.js`
- 超管审核与临时密码：
  - `src/components/admin/panels/AccountRecoveryPanel.jsx`
  - `src/services/admin/accountRecoveryService.js`
  - `api/admin-reset-recovery-password.js`

## 5. 导入 / 导出 / 分享

### 官方导入

- UI:
  - `src/features/import/ImportManager.jsx`
  - `src/features/import/OfficialAPIImport.jsx`
- 官方记录整形与云写入前处理：
  - `src/features/import/importPersistence.js`
- 云回填：
  - `src/utils/cloudDataSync.js`

导入主路径：

1. `OfficialAPIImport` 获取官方记录
2. `ImportManager` 调 `prepareOfficialImportPersistenceData`
3. 通过 `cloudWriteService.upsertPools / upsertHistory` 写入
4. 再通过 `applyCloudDataToStores` 回填前端 store
5. 跳转到 `dashboard`

### JSON / CSV 导入导出

- Hook：
  - `src/hooks/app/useDataExportImport.js`
- 导出：
  - `src/utils/dataExport.js`
- 导入：
  - `src/utils/dataImport.js`

### 分享

- 详情页分享：
  - `src/utils/dashboardShare.js`
  - `src/components/dashboard/DashboardShareCard.jsx`
- 模拟器分享：
  - `src/utils/simulatorShare.js`
  - `src/features/simulator/SimulatorShareCard.jsx`

## 6. 前端到后端的主要边界

### 站内 Serverless API

- `api/bootstrap.js`
  - 公开聚合只读数据
- `api/auth-rate-limit.js`
  - 认证入口限流
- `api/auth-account-status.js`
  - 账号恢复邮箱状态检查
- `api/account-recovery-request.js`
  - 匿名恢复申请
- `api/admin-reset-recovery-password.js`
  - 超管设置临时密码
- `api/self-delete-account.js`
  - 已登录用户自助删号

### Supabase 主路径

- 浏览器直连：
  - `src/supabaseClient.js`
- 统一请求超时：
  - `src/services/supabaseRequest.js`
- 云写入：
  - `src/services/cloudWriteService.js`
- 公开卡池读取：
  - `src/services/poolReadService.js`

### 私有后端

- 目录：
  - `backend/`
- 主入口：
  - `backend/server.js`
- 说明文档：
  - `backend/ARCHITECTURE.md`

## 7. 当前应避免再走的旧链

- `redirect_after_import + window.location.reload()` 导入回跳
- `processRotation / rotation_processed` 作为前端运行时轮换真源
- 客户端 `.from('pools').select(...)` 拉全表后自行过滤公开卡池
- 统计页分享主线
- 邮件找回密码主线

## 8. 读图顺序建议

如果要继续排查线上问题，建议按这个顺序读：

1. `AppRouter.jsx`
2. `DesktopAppRoutes.jsx` / `MobileLayout.jsx`
3. 对应页面组件
4. 页面主 hook
5. `stores/`
6. `services/`
7. `api/` 或 `backend/ARCHITECTURE.md`
