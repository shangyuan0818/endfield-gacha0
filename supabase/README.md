# Supabase Schema Guide

`supabase/` 现在按“可重复前向部署”和“仅手工执行”分层维护：

- `baseline/`
  - 新环境的基线 schema。当前入口是 `baseline/000_complete_schema.sql`
- `migrations/`
  - 标准前向迁移链，只保留单调递增、适合正常部署的 SQL
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

1. 先执行 `baseline/000_complete_schema.sql`
2. 再按编号执行 `migrations/` 中的标准前向迁移
3. 仅在明确场景下手工执行 `manual/` 中的脚本

## 维护约束

- 不要把说明文档放回 `migrations/`
- 不要把 destructive / rollback SQL 放回标准链
- 新迁移必须保持编号唯一
