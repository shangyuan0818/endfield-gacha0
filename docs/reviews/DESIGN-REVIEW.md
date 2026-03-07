# 设计审查报告 — Endfield Gacha Analyzer

> 审查日期：2026-02-14
> 审查范围：全项目架构、状态管理、服务层、权限系统、组件层、卡池系统、导入功能、API 代理

---

## 问题总览

| 严重程度 | 数量 | 说明 |
|---------|------|------|
| **致命** | 2 | 安全漏洞，可被外部利用 |
| **高** | 16 | 运行时 Bug、数据不一致、大量重复代码 |
| **中** | 22 | 架构不合理、维护困难、性能隐患 |
| **低** | 11 | 死代码、代码卫生 |

---

## 一、安全问题

### [致命] S-01: history 表 SELECT 策略对所有用户开放

**位置**: `supabase/migrations/000_complete_schema.sql:114-116`

```sql
CREATE POLICY "history_select_policy" ON public.history
  FOR SELECT USING (true);
```

任何已登录用户都可以通过 Supabase 客户端查询**所有人的抽卡记录**，包括 `game_uid`（游戏内 UID）。INSERT/UPDATE 正确限制了 `auth.uid() = user_id`，但 SELECT 完全开放。

**修复**: 改为 `USING (auth.uid() = user_id)`，全服统计功能改用 RPC 函数或服务端聚合查询。

### [致命] S-02: 后端 server.js 并发请求 CORS 竞态条件

**位置**: `backend/server.js:717, 764-765`

```javascript
let currentRequestOrigin = '';  // 全局变量
// 每次请求覆盖
currentRequestOrigin = req.headers.origin || '';
```

Node.js 并发处理请求时，Request A 设置的 origin 会被 Request B 覆盖，导致 Request A 的响应设置了错误的 CORS 头。

**修复**: 将 origin 绑定到 request/response 对象上，不使用全局变量。

---

## 二、运行时 Bug

### [高] B-01: usePoolStore.getCurrentUserId 缺少 await

**位置**: `src/stores/usePoolStore.js:55-65`

```javascript
const getCurrentUserId = () => {
  const session = supabase.auth.getSession(); // 缺少 await，返回 Promise
  return session?.data?.session?.user?.id || null; // 永远返回 null
};
```

`getSession()` 返回 Promise，但没有 `await`。导致 `createPool` 和 `updatePool` 中的 `syncManager.enqueue()` 永远不会执行（因为 userId 永远为 null）。

### [高] B-02: usePoolOperations 和 useDataExportImport 读取不存在的 setSyncing

**位置**: `src/hooks/app/usePoolOperations.js:33`, `src/hooks/app/useDataExportImport.js:19`

```javascript
const setSyncing = useUIStore(state => state.setSyncing); // useUIStore 中不存在此方法
```

`useUIStore` 没有定义 `setSyncing`（它在 `useAuthStore` 中），调用时会导致运行时报错。而 `GachaAnalyzer.jsx:23` 从 `useAuthStore` 读取 `syncing` 状态，形成不一致。

### [高] B-03: AuthModal 定时器冲突导致倒计时双倍速

**位置**: `src/AuthModal.jsx:101-110, 300-310`

`handleForgotPassword` 函数中创建了独立的 `setInterval` 处理倒计时，但文件顶部 `useEffect` 已经有一个管理 `resendCooldown` 的 `setInterval`。两个定时器同时运行导致倒计时速度翻倍，且 `handleForgotPassword` 中的 timer 在组件卸载时不会被清理（内存泄漏）。

### [高] B-04: isStandard 归一化逻辑不一致

**位置**: 3 处实现，逻辑不同

| 文件 | 大小写处理 | 判断方式 |
|------|-----------|---------|
| `GachaAnalyzer.jsx:230-261` | 大小写敏感 | 字符串 `includes` |
| `useSummaryStats.js:28-60` | 大小写不敏感 (`toLowerCase`) | 字符串 `includes` |
| `useCloudSync.js:217-226` | 不比较角色名 | 仅按池类型推断 |

如果角色名大小写不一致，卡池分析页和统计汇总页的"不歪率"会不同。

### [高] B-05: 登录时数据加载竞态

**位置**: `src/hooks/app/useCloudSync.js:472-479`, `src/hooks/app/useAppInitialization.js:247-267`

用户登录时，`useAppInitialization` 的主 effect 调用 `loadCloudData`，同时 `useCloudSync` 的 effect 监听 `user` 变化也调用 `handlePostLogin`（内部也调用 `loadCloudData`）。两者并发执行导致：相同数据加载两次、`setPools`/`setHistory` 被覆盖两次、网络请求加倍。

---

## 三、架构设计问题

### [高] A-01: 服务层形同虚设，Supabase 操作散落在 22 个文件中

只有 admin 模块（`poolService.js`, `characterService.js`）通过 service 层封装了数据库操作。其余模块直接在 hooks、组件、store 中操作 Supabase：

| 文件 | 层级 | 直接操作的表 |
|------|------|------------|
| `useCloudSync.js` | Hook | pools, history, profiles |
| `useAdminData.js` | Hook | profiles, blacklist, announcements, page_content |
| `useUserDataViewer.js` | Hook | pools, history |
| `useUserRole.js` | Hook | profiles |
| `ImportManager.jsx` | 组件 | pools, history |
| `TicketPanel.jsx` | 组件 | tickets |
| `GachaSimulator.jsx` | 组件 | pools, pool_characters, characters |
| `usePoolStore.js` | Store | supabase.auth |

### [高] A-02: GachaAnalyzer 是巨型 prop 中转站

**位置**: `src/GachaAnalyzer.jsx:17-86`

从 5 个 Zustand store 解构约 70 个状态/方法，再通过 props 传递给子组件。完全消除了 Zustand 作为全局状态管理的优势。例如：
- `AppHeader` 接收 12 个 props
- `GachaModals` 接收 20+ 个 props（且自己也从 store 读取，形成双重数据来源）

子组件应该直接从 store 读取所需状态。

### [高] A-03: Vercel Serverless 和独立后端约 500 行代码重复

**位置**: `api/hg-proxy.js` 和 `backend/server.js`

| 函数 | hg-proxy.js | server.js |
|------|-------------|-----------|
| handleGrant | 110-187行 | 169-225行 |
| handleBindings | 193-317行 | 230-339行 |
| handleU8Token | 324-395行 | 344-409行 |
| handleRecords | 401-491行 | 634-693行 |
| fetchRecordsInternal | 519-594行 | 414-468行 |
| handleRecordsBatch | 610-699行 | 530-590行 |

两份代码逻辑几乎一致但有微妙差异，维护时极易出现不一致。应抽取为共享模块。

### [高] A-04: 三套平行的卡池创建路径

| 路径 | 文件 | 方式 | 创建的字段 |
|------|------|------|-----------|
| API 导入 | `ImportManager.jsx:76-114` | 直连 Supabase | pool_id, name, type（缺少 up_character, start_time, end_time） |
| 管理员 | `usePools.js` | 直连 Supabase | 完整字段 |
| 用户侧 | `usePoolOperations.js:40-72` | 本地+云同步 | 部分字段 |

三条路径各自为政，创建的字段不一致。管理员 CRUD 的核心场景仅是补充导入时缺失的字段。另外 `usePoolStore.js` 中的 `getOrCreatePool`/`getOrCreatePools` 是完全的死代码。

### [高] A-05: ImportManager 组件混合约 290 行业务逻辑

**位置**: `src/features/import/ImportManager.jsx:76-363`

组件内直接包含：卡池查询和创建、历史记录批量写入和去重、isStandard 推断、record_id 哈希计算。这些逻辑应抽取到 service 层。

### [中] A-06: 池类型归一化方向不一致

至少 4 处使用不同的归一化映射：

| 文件 | 方向 |
|------|------|
| `useCloudSync.js` | `limited_character → limited` |
| `useSummaryStats.js` | `limited → limited`, `limited_character → limited` |
| `usePoolStore.POOL_TYPE_MAP` | `special → limited_character` |
| `usePoolStore.getPoolsByType` | `limited → limited_character` |

有的地方 `limited` 是规范类型，有的地方 `limited_character` 是。容易导致卡池分组错误。

### [中] A-07: 表单状态不应放在全局 store

**位置**: `src/stores/useUIStore.js:25-44`

`newPoolNameInput`, `newPoolTypeInput`, `isLimitedWeaponPool`, `drawerName`, `selectedCharName` 是纯粹的局部表单状态，只在创建/编辑弹窗中使用，不应提升为全局状态。

### [中] A-08: 错误处理返回值格式不统一

- `poolService.js` 返回 `{ success: boolean, error: string }`
- `characterService.js` 返回 `{ data: Array, error: Error }`（Error 对象 vs 字符串）
- `statsService.js` 直接返回数据或 `null`
- `useAdminData.js` 直接 throw error

### [中] A-09: currentPoolId 持久化重复执行

**位置**: `GachaAnalyzer.jsx:373-375` 和 `usePoolStore.js:136`

每次切换卡池，`localStorage.setItem` 被调用两次。更严重的是初始状态 `currentPoolId` 为 `null` 时，GachaAnalyzer 的 effect 会将字符串 `"null"` 写入 localStorage。

### [中] A-10: onAuthStateChange 中无条件调用 fetchGlobalStats

**位置**: `src/hooks/app/useAppInitialization.js:278-286`

Token 自动刷新时也会触发 `fetchGlobalStats`，造成不必要的请求。应该只在 SIGNED_IN/SIGNED_OUT 事件时刷新。

---

## 四、卡池系统过度设计

### [高] P-01: pool_characters 表对核心功能零贡献

`pool_characters` 表仅在管理员界面编辑和模拟器角色列表加载中使用。普通用户的统计分析（`usePoolStats.js`）完全不依赖它。模拟器有后备方案（查询失败自动从 `characters` 表读取）。

### [高] P-02: 轮换机制仅影响模拟器角色名字

`limited_rotation_count`, `removes_after`, `rotation_processed` 这些字段只在模拟器中被消费。`usePoolStats.js` 中没有任何对轮换的引用。去掉轮换机制对真实数据分析完全无影响，但维护成本高（管理员需定期手动处理）。

### [高] P-03: UP 池倒计时使用硬编码而非数据库数据

**位置**: `src/constants/index.js:62-81`, `src/constants/characterPools.js:372-397`

数据库 `pools` 表已存储 `up_character`, `start_time`, `end_time`，管理后台也有完整 CRUD 功能。但 `HeaderPoolTimeInfo` 组件从硬编码的 `LIMITED_POOL_SCHEDULE` 读取数据，不使用数据库。而且存在**两份格式不同的硬编码时间表**（ISO 8601 vs Date 对象），每次卡池轮换需要同时改两个文件并发版本。

### [中] P-04: Pool Realtime Subscription 极低频过度设计

**位置**: `src/hooks/app/usePoolRealtimeSubscription.js`

仅在管理员界面使用，真实场景仅为"超管锁定卡池时通知管理员"。频率极低（一周可能几次），完全可以用页面刷新替代。

### [中] P-05: recalculateIsStandard 应自动触发

**位置**: `src/hooks/admin/usePools.js:328-343`

管理员编辑 `up_character` 后需要手动点击"重算限定/常驻"按钮。应在编辑保存时自动触发重算。

---

## 五、组件层问题

### [高] C-01: normalizedPoolHistory 归一化逻辑在 5 处重复实现

| 文件 | 行号 |
|------|------|
| `GachaAnalyzer.jsx` | 230-261 |
| `DashboardView.jsx` | 80-111 |
| `MobileDashboardView.jsx` | 57-81 |
| `ImportManager.jsx` | 268-280 |
| `useSummaryStats.js` | 28-60 |

核心模式完全相同，应提取为共享工具函数 `normalizeIsStandard(history, poolType, upCharacter)`。

### [高] C-02: 移动端与桌面端大量组件几乎完全复制

| 桌面端 | 移动端 | 行数 | 差异 |
|--------|--------|------|------|
| `LoadingScreen.jsx` (235行) | `MobileLoadingScreen.jsx` (242行) | ~480行 | 仅默认验证码模式不同 |
| `CharacterWaterfallChart.jsx` (197行) | `MobileCharacterWaterfallChart.jsx` (189行) | ~386行 | 仅 CSS 尺寸不同 |
| `DashboardView.jsx` (618行) | `MobileDashboardView.jsx` (777行) | ~1395行 | 统计计算完全重复 |

`MobileDashboardView` 自己重新实现了 `usePoolStats` hook 的全部逻辑（8 个 useMemo），应直接复用 hook。

### [高] C-03: 超大组件文件

| 文件 | 行数 |
|------|------|
| `GachaSimulator.jsx` | **1549行** |
| `HomePage.jsx` | **1482行** |
| `AuthModal.jsx` | **787行** |
| `MobileDashboardView.jsx` | **777行** |
| `SummaryView.jsx` | **694行** |
| `DashboardView.jsx` | **618行** |

`GachaSimulator.jsx` 包含约 30 个 useState 和多个 useEffect，应将卡池加载逻辑和模拟器状态管理抽取为自定义 Hook。
`AuthModal.jsx` 混合了业务逻辑（邮箱白名单 47 行、频率限制、后端验证）和 UI。

### [中] C-04: 全局 22 处 img 标签均未使用 loading="lazy"

角色头像在列表渲染中会批量加载，涉及 `DashboardView`, `MobileDashboardView`, `CharacterWaterfallChart`, `RankingCard` 等组件。

### [中] C-05: 饼图数据生成逻辑重复 3 次

- `useAppInitialization.js:51-71`
- `useSummaryStats.js:188-208`
- `SummaryView.jsx:97-118`

### [中] C-06: DashboardView 中 useMemo 依赖项不精确

**位置**: `src/components/dashboard/DashboardView.jsx:221`

```javascript
const checkLimitedInFirstN = useMemo(() => { ... }, [history, currentPoolId]);
```

依赖项使用了整个 `history` 数组，但内部实际遍历 `normalizedPoolHistory`。任何卡池的历史变化都会触发重算。

---

## 六、权限和安全

### [高] R-01: 管理面板仅靠前端条件渲染守卫

**位置**: `src/GachaAnalyzer.jsx:408`

`AdminPanel` 的显示仅通过 `activeTab === 'admin' && isSuperAdmin`，没有路由级权限守卫。用户可以通过浏览器控制台修改 Zustand store 状态暴露管理面板 UI（虽然 RLS 保护了实际数据操作）。

### [中] R-02: profiles 表 SELECT 对所有人开放

**位置**: `supabase/migrations/000_complete_schema.sql:29-30`

`FOR SELECT USING (true)` 意味着任何认证用户可读取所有用户的 profile。

### [中] R-03: useAdminData 未验证调用者角色

**位置**: `src/hooks/admin/useAdminData.js:37-38`

`fetchData` 函数并行请求 5 张表的全部数据，没有先检查当前用户是否为超管。

### [中] R-04: 编辑用户时角色下拉框包含 super_admin 选项

**位置**: `src/components/admin/panels/UsersPanel.jsx:160`

创建用户时有条件渲染隐藏了 super_admin 选项，但编辑已有用户时仍然可见。

### [中] R-05: Vercel hg-proxy 缺乏 IP 级速率限制

**位置**: `api/hg-proxy.js` 全文

代理层没有保护自身，恶意用户可以利用代理向鹰角 API 发起大量请求。

### [中] R-06: 后端 parseBody 无请求体大小限制

**位置**: `backend/server.js:736-748`

`body += chunk` 无限读取，恶意用户可发送超大请求体导致内存耗尽。

---

## 七、导入功能问题

### [中] I-01: 两套不同的 upsert 冲突约束

| 路径 | 冲突约束 |
|------|---------|
| `ImportManager.jsx:164` | `user_id, game_uid, pool_id, seq_id` |
| `syncService.js:297` | `user_id, record_id` |
| `useCloudSync.js:299` | `user_id, record_id` |

同一条记录通过不同路径写入时可能产生重复。

### [中] I-02: simpleStringHash 哈希范围仅 0-999

**位置**: `src/features/import/ImportManager.jsx:604-611`

`Math.abs(hash % 1000)` 仅 1000 个可能值，不同 poolId 极易碰撞。如果两个不同卡池碰撞且有相同 seqId，会产生相同的 record_id。

### [中] I-03: getExistingSeqIds 无分页限制

**位置**: `src/features/import/ImportManager.jsx:181-204`

查询用户在该 game_uid 下的所有 history 记录的 seq_id，无分页。大数据量（10000+ 条）时查询慢。

---

## 八、死代码和冗余

### [低] D-01: 僵尸状态和未使用的函数

| 文件:行号 | 内容 |
|-----------|------|
| `useAppStore.js:31-36` | `showAnnouncement` 状态及相关方法从未被读取 |
| `useAppStore.js:15-27` | store 中的 `fetchGlobalStats` 从未被调用 |
| `usePoolStore.js` | `getOrCreatePool`/`getOrCreatePools` 无外部调用者 |

### [低] D-02: 未使用的常量

| 文件:行号 | 常量 |
|-----------|------|
| `constants/index.js:2-6` | `POOL_TYPES` — 从未被 import |
| `constants/index.js:214-227` | `USER_ROLES`, `ROLE_LABELS` — 从未被 import |
| `constants/index.js:141` | `CURRENT_UP_POOL_INFO` — 标注"兼容旧代码"但无外部使用 |

### [低] D-03: 未使用的组件

| 文件 | 说明 |
|------|------|
| `src/components/InputSection.jsx` | 手动输入组件，已被 API 导入功能替代 |

### [低] D-04: 死代码链

`characterPools.js` → `probabilityEngine.js`：`probabilityEngine.js` 没有被任何文件导入，构成死代码链。

### [低] D-05: 公告查询逻辑重复

`useNotificationBadges.js:23-69` 和 `useAppStore.js:38-55` 都查询 `announcements` 表，store 中的方法未被使用。

### [低] D-06: Vite 项目中使用 process.env.NODE_ENV

**位置**: `src/services/syncService.js:407`

Vite 项目中应使用 `import.meta.env.DEV`。

---

## 九、修复优先级建议

### P0 — 立即修复（安全 + 运行时 Bug）

| 编号 | 问题 | 预估改动 |
|------|------|---------|
| S-01 | history 表 RLS SELECT 策略 | 1 个迁移文件 |
| S-02 | 后端并发 CORS 竞态 | server.js 改为 request-scoped |
| B-01 | getCurrentUserId 缺少 await | usePoolStore.js 1 行 |
| B-02 | setSyncing 读取不存在的方法 | 2 个文件修正 import 源 |
| B-03 | AuthModal 定时器冲突 | 删除重复的 setInterval |

### P1 — 短期修复（数据一致性 + 核心架构）

| 编号 | 问题 | 预估改动 |
|------|------|---------|
| B-04 | isStandard 归一化逻辑不一致 | 提取为 1 个共享工具函数，替换 5 处调用 |
| B-05 | 登录时数据加载竞态 | 合并为单一加载入口 |
| A-04 | 三套卡池创建路径 | 统一到 service 层 |
| A-06 | 池类型归一化不一致 | 建立统一映射函数 |
| P-03 | UP 池倒计时硬编码 | 改为从数据库读取 |
| C-01 | normalizedPoolHistory 5 处重复 | 提取共享工具函数 |

### P2 — 中期重构

| 编号 | 问题 | 预估改动 |
|------|------|---------|
| A-01 | 服务层形同虚设 | 建立完整数据访问层 |
| A-02 | GachaAnalyzer prop 中转站 | 子组件直接读 store |
| A-03 | 双端代理代码重复 | 抽取共享模块 |
| C-02 | 移动端/桌面端组件复制 | 共享 hooks + 参数化组件 |
| C-03 | 超大组件文件 | 拆分 + 抽取 hooks |
| A-05 | ImportManager 业务逻辑外移 | 抽取到 importService |

### P3 — 长期优化

| 编号 | 问题 | 建议 |
|------|------|------|
| P-01 | pool_characters 表 | 评估是否保留 |
| P-02 | 轮换机制 | 评估是否保留 |
| P-04 | Realtime Subscription | 可移除 |
| D-01~D-06 | 死代码清理 | 批量删除 |
| R-01 | 管理面板权限守卫 | 添加路由级检查 |

---

## 十、架构改进方向

### 当前数据流问题

```
[组件] ──直连──→ [Supabase]
[Hook]  ──直连──→ [Supabase]
[Store] ──直连──→ [Supabase]
[Service] ─────→ [Supabase]  （仅 admin 模块经过此层）
```

### 建议数据流

```
[组件] ──→ [Hook] ──→ [Service] ──→ [Supabase]
                          ↑
[Store] ──→ 纯状态管理（不含 DB 操作）
```

### 移动端策略

保持当前独立移动端组件策略，但：
1. 共享业务逻辑统一到 `hooks/` 目录（如 `usePoolStats` 应被移动端复用）
2. 纯展示差异通过 props 参数化或 CSS 媒体查询解决
3. 逻辑完全相同的组件（`LoadingScreen`、`CharacterWaterfallChart`）合并为单一组件
