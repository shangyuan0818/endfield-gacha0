# Supabase Schema Guide

`supabase/` 现在按“可重复前向部署”和“仅手工执行”分层维护：

- `baseline/`
  - 新环境的基线 schema。当前入口是 `baseline/000_complete_schema.sql`
  - 由 `npm run generate:supabase-baseline` 从 `archive/migrations/` + `migrations/` 自动生成
- `archive/`
  - 已归档的历史标准迁移链，仅用于审计与重新生成 baseline
- `migrations/`
  - 当前仍在追加的标准前向迁移链
- `manual/`
  - 不进入默认部署链的脚本
  - `destructive/`: 会清空或重建数据结构
  - `high-risk/`: 会改主键、删列或要求人工审查
  - `data-backfill/`: 数据回填 / 搬运脚本
  - `legacy/`: 历史重构脚本，仅供排障参考
  - `rollbacks/`: 回滚脚本，不应作为前向迁移执行
- `docs/`
  - 迁移说明、历史功能指南

## 新环境部署

1. 先查看 `baseline/000_complete_schema.sql` 头部的“覆盖范围”
2. 新环境默认直接执行 `baseline/000_complete_schema.sql`
3. 仅当仓库里存在“编号高于 baseline 覆盖范围”的新迁移时，再补执行这些较新的 `migrations/` 文件
4. 仅在明确场景下手工执行 `manual/` 中的脚本

当前仓库内的 baseline 已覆盖到 `active/098_add_pool_name_en.sql`，因此不要再把 `001~098` 这批标准迁移重复叠加执行在同版本 baseline 上。

当前标准链已在后段显式移除 `admin_applications` 历史遗留表；不要再把管理员申请流重新写回 baseline 或新迁移。

## 维护约束

- 不要把说明文档放回 `migrations/`
- 不要把 destructive / rollback SQL 放回标准链
- 新迁移必须保持编号唯一
- 修改 `archive/migrations/` 或 `migrations/` 后，如果希望刷新新环境基线，请执行 `npm run generate:supabase-baseline`
- baseline 刷新后请同步执行 `npm run test:supabase-baseline`，确认头部覆盖范围与首尾 migration 标记一致
- `generate-supabase-baseline` 与 `verify-supabase-baseline` 现已统一输出 POSIX 路径；不要再手工把 `archive/001...` 改回 Windows 反斜杠，否则 GitHub Actions 会在 Linux 上失败
- 已验证 `npm run test:supabase-baseline:smoke` 可在临时 PostgreSQL 容器内注入最小 Supabase `auth` stub 后真实运行 baseline；如需复跑，请先确保 Docker daemon 可访问
- 若要评估 `history.character_id / legacy_pool_id` 的退役准备度，请执行 `npm run audit:canonical-retirement-readiness`；当前 canonical 数据审计与兼容字段退场窗口以这支脚本和 `DATA-NEW-008` 为准，而不是旧的 FEAT-007 历史文档

## 当前与部署相关的边界

- 当前管理后台主链使用的是 Vercel Serverless `api/admin.js`，通过 `vercel.json` rewrite 兼容旧的 `admin-*` 路径
- 不要在部署说明里再要求额外部署 `admin-create-user`、`admin-delete-user` 这类旧 Supabase Edge Function
- `supabase/functions/` 仍保留其他确有需要的 Edge Function 说明，但它们不再是当前后台用户管理主路径
