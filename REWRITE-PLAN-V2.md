# 卡池详情系统重写计划 V2

## 背景

当前系统存在以下问题：
1. **数据库 schema 不完整**：`history` 表缺少 `character_name`, `batch_id`, `seq_id`, `pity` 等字段
2. **sync 字段遗漏**：`syncService.js` 的 `syncHistory()` 漏掉了 `batch_id` 字段
3. **旧设计残留**：按抽卡人分组、手动录入功能、`specialType: 'gift'` 等
4. **数据流断裂**：导入 -> 解析 -> 上传 -> 读取 -> 展示 链路不通

## 用户确认的需求

- [x] **手动录入**：完全移除
- [x] **卡池组织**：按官方卡池类型分组（限定角色、常驻、新手、武器），删除按抽卡人分组
- [x] **旧数据**：清空重导
- [x] **多账号**：需要支持（同一用户导入多个游戏账号）

---

## 第一阶段：数据库 Schema 重构

### 1.1 新增迁移文件 `042_v2_schema_upgrade.sql`

#### pools 表更新
```sql
-- 添加新字段（支持多账号）
ALTER TABLE public.pools ADD COLUMN IF NOT EXISTS game_uid TEXT;        -- 游戏账号 UID
ALTER TABLE public.pools ADD COLUMN IF NOT EXISTS nick_name TEXT;       -- 游戏昵称
ALTER TABLE public.pools ADD COLUMN IF NOT EXISTS up_character TEXT;    -- UP 角色名称
ALTER TABLE public.pools ADD COLUMN IF NOT EXISTS banner_url TEXT;      -- Banner 图片 URL
ALTER TABLE public.pools ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ; -- 卡池开始时间
ALTER TABLE public.pools ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;   -- 卡池结束时间

-- 修改 type 约束以支持新类型
-- limited_character | standard | beginner | limited_weapon
```

#### history 表更新
```sql
-- 添加官方 API 返回的字段
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS character_name TEXT;   -- 角色/武器名称
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS batch_id TEXT;         -- 批次 ID（十连分组）
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS seq_id TEXT;           -- 官方序列号（去重用）
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS pity INTEGER DEFAULT 0; -- 当前保底计数
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS is_new BOOLEAN;        -- 是否首次获得
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS is_free BOOLEAN;       -- 是否免费抽取
ALTER TABLE public.history ADD COLUMN IF NOT EXISTS game_uid TEXT;         -- 关联的游戏账号
```

#### 新增 game_accounts 表（多账号支持）
```sql
CREATE TABLE IF NOT EXISTS public.game_accounts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game_uid TEXT NOT NULL,
  nick_name TEXT,
  server_id TEXT DEFAULT '1',
  last_import_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, game_uid)
);
```

---

## 第二阶段：核心服务重写

### 2.1 重写 `syncService.js`

**目标**：修复字段映射，支持所有新字段

```javascript
// syncHistory 方法的完整字段映射
{
  user_id: r.user_id,
  record_id: r.id,
  pool_id: r.poolId,
  rarity: r.rarity,
  is_standard: r.isStandard || false,
  // 新增字段 ↓
  character_name: r.character_name || r.name,
  batch_id: r.batchId,
  seq_id: r.seqId,
  pity: r.pity || 0,
  is_new: r.isNew || false,
  is_free: r.isFree || false,
  game_uid: r.gameUid,
  // ↑ 新增字段
  timestamp: r.timestamp,
  updated_at: new Date().toISOString()
}
```

### 2.2 重写 `useHistoryStore.js`

**移除**：
- `historyFilter: 'gift'` 筛选选项
- `specialType` 相关逻辑

**新增**：
- `getPoolHistoryByGameAccount(poolId, gameUid)` - 按游戏账号筛选

### 2.3 重写 `usePoolStore.js`

**移除**：
- `extractDrawerFromPoolName` 抽卡人提取
- `getGroupedPools` 按抽卡人分组
- `collapsedDrawers` 折叠状态
- `getKnownDrawers` 已知抽卡人列表

**新增**：
- `getPoolsByType()` - 按官方类型分组
- `getPoolsByGameAccount(gameUid)` - 按游戏账号筛选

---

## 第三阶段：导入流程重写

### 3.1 重写 `ImportManager.jsx`

**移除**：
- `ImportMethod.MANUAL_PASTE` 批量粘贴
- `ImportMethod.SCREENSHOT_OCR` 截图识别
- 所有手动解析逻辑

**保留并增强**：
- `ImportMethod.OFFICIAL_API` 官网 API 导入

**新增**：
- 多账号选择/切换 UI
- 导入进度详情
- 导入历史记录

### 3.2 增强 `OfficialAPIImport.jsx`

**现有问题修复**：
- 确保 `batchId` 正确传递
- 确保 `seqId` 用于去重

**新增**：
- 显示当前导入的游戏账号信息
- 支持切换账号重新导入
- 导入前检查是否有重复数据

### 3.3 重写 `endfieldImportAdapter.js`

**验证所有字段映射**：
```javascript
export function convertRecord(apiRecord, recordType) {
  return {
    name: apiRecord.charName || apiRecord.weaponName,
    character_name: apiRecord.charName || apiRecord.weaponName,
    rarity: apiRecord.rarity,
    timestamp: parseInt(apiRecord.gachaTs, 10),
    pool: mapPoolType(apiRecord.poolId),
    pool_id: apiRecord.poolId,
    pool_name: apiRecord.poolName,
    isNew: apiRecord.isNew || false,
    isFree: apiRecord.isFree || false,
    isLimited: isLimitedPool(apiRecord.poolId),
    seqId: apiRecord.seqId,
    recordType: recordType
  };
}
```

---

## 第四阶段：卡池选择器重写

### 4.1 重写 `PoolSelector.jsx`

**新设计**：
- 顶层：游戏账号选择器（如果有多个账号）
- 按类型分组：限定角色池 | 常驻池 | 新手池 | 武器池
- 每个卡池显示：名称、UP角色、抽数、6星数

**移除**：
- 按抽卡人分组
- 模拟数据开关（如果不需要模拟器功能）
- 手动创建卡池入口

**UI 结构**：
```
┌─────────────────────────────────┐
│ [账号选择器] UID: 123456 ▼     │
├─────────────────────────────────┤
│ ★ 限定角色池 (3)               │
│   ├─ 熔火灼痕 (莱万汀)  245抽  │
│   ├─ 冰霜绽放 (伊芙琳)  180抽  │
│   └─ ...                        │
│ ═ 常驻池 (1)                    │
│   └─ 基础寻访           89抽   │
│ ═ 新手池 (1)                    │
│   └─ 启程寻访           50抽   │
│ ⚔ 武器池 (2)                    │
│   └─ ...                        │
├─────────────────────────────────┤
│ [导入数据...]                   │
└─────────────────────────────────┘
```

---

## 第五阶段：显示组件更新

### 5.1 更新 `DashboardView.jsx`

**确认显示字段**：
- 使用 `character_name` 作为主要显示字段
- 使用 `pity` 显示每条记录的保底进度
- 使用 `batch_id` 进行十连分组

**移除**：
- `specialType: 'gift'` 赠送显示
- `specialType: 'guaranteed'` 保底标记

### 5.2 更新 `RecordsView.jsx`

**确认**：
- 按 `batch_id` 分组显示
- 显示 `character_name`
- 显示 `pity` 值

### 5.3 更新 `BatchCard.jsx`

**确认**：
- 使用 `character_name || name` 显示名称
- 保留现有 UI 样式

---

## 第六阶段：GachaAnalyzer.jsx 精简

### 6.1 移除的功能

- 手动录入相关的 Modal（createPool、editPool）
- 按抽卡人分组的逻辑
- `InputSection` 组件引用
- `specialType: 'gift'` 和 `guaranteed` 相关计算
- `bonusGifts` 赠送机制计算

### 6.2 保留的功能

- 云同步（`loadCloudData`, `saveHistoryToCloud`）
- 统计计算（但简化移除赠送逻辑）
- 全局状态管理

### 6.3 字段映射修复

**`loadCloudData` 返回格式**：
```javascript
const formattedHistory = allHistory.map(h => ({
  id: h.record_id,
  poolId: h.pool_id,
  rarity: h.rarity,
  isStandard: h.is_standard,
  timestamp: h.timestamp,
  // 新增字段
  name: h.character_name,
  character_name: h.character_name,
  batchId: h.batch_id,
  seqId: h.seq_id,
  pity: h.pity,
  isNew: h.is_new,
  isFree: h.is_free,
  gameUid: h.game_uid
}));
```

**`saveHistoryToCloud` 字段**：
```javascript
const cloudRecords = records.map(r => ({
  user_id: user.id,
  record_id: r.id,
  pool_id: r.poolId,
  rarity: r.rarity,
  is_standard: r.isStandard,
  timestamp: r.timestamp,
  // 新增字段
  character_name: r.character_name || r.name,
  batch_id: r.batchId,
  seq_id: r.seqId,
  pity: r.pity,
  is_new: r.isNew,
  is_free: r.isFree,
  game_uid: r.gameUid
}));
```

---

## 第七阶段：constants 和 utils 清理

### 7.1 移除 `constants/index.js` 中的

- `PRESET_POOLS` - 预设卡池列表
- `extractDrawerFromPoolName` - 抽卡人提取
- `POOL_TYPE_KEYWORDS` - 卡池类型关键字
- 手动录入相关的常量

### 7.2 保留/更新

- `RARITY_CONFIG` - 稀有度配置
- `LIMITED_POOL_RULES` - 限定池规则（更新为官方规则）

---

## 文件修改清单

### 新增文件
| 文件 | 说明 |
|------|------|
| `supabase/migrations/042_v2_schema_upgrade.sql` | 数据库 schema 升级 |

### 重写文件
| 文件 | 改动程度 |
|------|----------|
| `src/services/syncService.js` | 中度 - 修复字段映射 |
| `src/stores/usePoolStore.js` | 大幅 - 移除抽卡人分组 |
| `src/stores/useHistoryStore.js` | 中度 - 移除 gift 筛选 |
| `src/features/import/ImportManager.jsx` | 大幅 - 移除手动导入 |
| `src/components/pool/PoolSelector.jsx` | 大幅 - 重写分组逻辑 |
| `src/GachaAnalyzer.jsx` | 大幅 - 移除手动录入 |

### 可能移除的文件
| 文件 | 原因 |
|------|------|
| `src/components/InputSection.jsx` | 手动录入入口 |
| `src/components/modals/EditItemModal.jsx` | 编辑单条记录 |

---

## 执行顺序

1. **数据库迁移** - 创建并执行 `042_v2_schema_upgrade.sql`
2. **syncService.js 修复** - 确保同步字段完整
3. **stores 重写** - usePoolStore, useHistoryStore
4. **ImportManager 重写** - 移除手动导入，保留 API 导入
5. **PoolSelector 重写** - 新分组逻辑
6. **GachaAnalyzer 精简** - 移除手动录入相关代码
7. **显示组件验证** - 确保 DashboardView, RecordsView 正常
8. **清理旧数据** - Supabase 中清空 pools 和 history 表
9. **测试完整流程** - 导入 -> 同步 -> 显示

---

## 预期结果

1. 用户只需粘贴 24 位 token 即可导入所有历史记录
2. 卡池按官方类型（限定角色、常驻、新手、武器）分组
3. 支持多游戏账号管理
4. 数据正确同步到云端并正确显示
5. 移除所有手动录入相关功能
