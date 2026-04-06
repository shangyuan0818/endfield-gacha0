# FEAT-007 数据库迁移指南

> [!WARNING]
> 本文是 FEAT-007 早期阶段的历史迁移指南，只用于理解 `027~030` 这批迁移的原始意图。
> 当前主线已经切到 canonical id / alias 数据治理；`history.character_id` 与 `legacy_pool_id` 的保留或退役，必须以 `DATA-NEW-008` 的审计结果和 `npm run audit:canonical-retirement-readiness` 为准。
> 不要再直接照本文执行删列、回滚或“固定时间窗口后删除兼容字段”的旧建议。

## 迁移文件清单

本次重构共创建了 4 个数据库迁移文件：

| 文件名 | 功能 | 影响表 |
|--------|------|--------|
| `027_add_character_info.sql` | 为 history 表添加角色字段 | `history` |
| `028_create_characters_table.sql` | 创建角色映射表 | `characters` (新建) |
| `029_enhance_pools_metadata.sql` | 扩展 pools 表元数据字段 | `pools` |
| `030_migrate_pool_ids.sql` | 准备ID迁移兼容字段 | `pools`, `history` |

---

## 执行顺序

**⚠️ 重要**：必须按照文件编号顺序执行，因为存在依赖关系。

### 方式1：Supabase CLI（推荐）

如果您使用 Supabase CLI 管理项目：

```bash
# 1. 确保已登录
supabase login

# 2. 链接到您的项目
supabase link --project-ref your-project-ref

# 3. 推送迁移文件到云端
supabase db push

# 4. 验证迁移
supabase db diff
```

### 方式2：Supabase Dashboard（手动）

如果您使用 Supabase 网页控制台：

1. 登录 [Supabase Dashboard](https://app.supabase.com/)
2. 选择您的项目
3. 进入 `SQL Editor`
4. 按顺序执行以下文件内容：
   - 复制 `027_add_character_info.sql` 的内容，点击 `Run`
   - 复制 `028_create_characters_table.sql` 的内容，点击 `Run`
   - 复制 `029_enhance_pools_metadata.sql` 的内容，点击 `Run`
   - 复制 `030_migrate_pool_ids.sql` 的内容，点击 `Run`

5. 检查执行结果，确保每个迁移都有 `✅ Migration xxx: ...` 的成功提示

---

## 验证迁移

执行完所有迁移后，运行以下SQL验证表结构：

```sql
-- 1. 验证 history 表新字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'history'
AND column_name IN ('character_name', 'avatar_url');

-- 期望结果：2行记录

-- 2. 验证 characters 表存在
SELECT COUNT(*) as character_count FROM public.characters;

-- 期望结果：至少8个初始角色

-- 3. 验证 pools 表新字段
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'pools'
AND column_name IN ('description', 'start_time', 'end_time', 'banner_url', 'featured_characters');

-- 期望结果：5行记录

-- 4. 验证索引
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('history', 'pools', 'characters')
AND (indexname LIKE '%character%' OR indexname LIKE '%featured%');

-- 期望结果：多个索引记录

-- 5. 验证RLS策略
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE tablename = 'characters';

-- 期望结果：2条策略（characters_select_all, characters_manage_super_admin）

-- 6. 当前主线不再要求验证 migrate_pool_id
-- 该函数仅属于早期 ID 迁移阶段，已不在现行标准 schema 中保留
```

---

## 历史回滚示意（当前主干不要直接执行）

如果需要回滚迁移，按照**相反顺序**执行：

```sql
-- 回滚 030
-- 当前主线已退役 legacy_pool_id / migrate_pool_id，不再保留旧兼容字段的回滚示例

-- 回滚 029
ALTER TABLE public.pools DROP COLUMN IF EXISTS description;
ALTER TABLE public.pools DROP COLUMN IF EXISTS start_time;
ALTER TABLE public.pools DROP COLUMN IF EXISTS end_time;
ALTER TABLE public.pools DROP COLUMN IF EXISTS banner_url;
ALTER TABLE public.pools DROP COLUMN IF EXISTS featured_characters;

-- 回滚 028
DROP TABLE IF EXISTS public.characters CASCADE;

-- 回滚 027
ALTER TABLE public.history DROP COLUMN IF EXISTS character_name;
ALTER TABLE public.history DROP COLUMN IF EXISTS avatar_url;
```

⚠️ **警告**：以上 SQL 仅保留作历史阶段参考。当前仓库已引入 canonical alias / baseline / backfill 审计链，直接照本文删 `legacy_pool_id` 或 `history.character_id` 会与现行主线冲突。

---

## 常见问题

### Q1: 执行迁移时报错 "permission denied"

**原因**：当前用户没有修改数据库结构的权限。

**解决方案**：
- 使用 Supabase Dashboard 的 SQL Editor（自动使用超级管理员权限）
- 或者联系项目管理员授予权限

### Q2: characters 表初始数据为空

**原因**：`ON CONFLICT DO NOTHING` 导致重复执行时跳过插入。

**解决方案**：
```sql
-- 手动插入初始数据
INSERT INTO public.characters (id, name, rarity, type, is_limited, aliases)
VALUES ('char_levantin', '莱万汀', 6, 'character', true, ARRAY['Levantin'])
ON CONFLICT (id) DO NOTHING;
```

### Q3: 旧数据如何处理？

**答**：旧数据不受影响，新字段默认为 NULL。前端需要处理空值情况：
- `character_name` 为 NULL 时，显示"未知角色"
- `avatar_url` 为 NULL 时，显示占位图标

### Q4: 什么时候清理 legacy_pool_id 字段？

**答**：这条旧回答已经失效。当前不应按固定兼容窗口直接删列，而应先完成：

1. 真实库 canonical 审计；
2. `history / pool_characters / featured_characters` 的 alias-backed 引用复核；
3. `npm run audit:canonical-retirement-readiness` 显示运行时、baseline、tooling、文档都已脱钩；
4. `DATA-NEW-008` 的最终人工验收。

---

## 下一步

迁移完成后，继续执行 **阶段2：角色映射和工具** 的开发任务。

参考计划文件：`FEAT-007-PLAN.md`
