# Contributing

欢迎提交 Issue 和 Pull Request。

## 提交前

- 先确认改动是否属于当前公开主链，还是只应该留在私有环境。
- 触及公开页面、统计、导入、缓存、自动化或部署配置时，优先对齐现有代码和文档边界。
- 不要提交秘密、真实 token、生产数据库连接串、私有后端地址或临时调试账号。

## 最低验证

公开主链改动建议至少跑：

```bash
npm run lint
npm run test:unit
npm run build
git diff --check
```

如果改到了公共数据、缓存或自动化，再补跑对应的专项验证，例如：

```bash
npm test
npm run test:public-api-boundary
npm run test:bootstrap-cache
npm run test:ops-automation
npm run test:official-announcements-feed
```

## 文档要求

- UI 或路由变更请同步更新 README、截图或代码地图。
- 环境变量、部署方式、Supabase baseline、公共缓存版本和自动化入口变更时，请同步更新对应文档。
- 如果改动会影响 GitHub 页面展示，优先更新 README 顶部、预览图和更新日志。

## 提交建议

- 单个 PR 聚焦一个主题，避免把功能、修复、依赖和文档整理混在一起。
- 从 `v4.5.0` 起按 [Git Workflow](docs/GIT_WORKFLOW.md) 执行：功能走 `feat/vX.Y-*`，修复走 `fix/vX.Y-*`，版本收口走 `release/vX.Y.Z`。
- 提交信息保持简洁明确，优先使用 `feat:`、`fix:`、`perf:`、`docs:`、`test:`、`chore:`。
- 功能分支合入发布分支前整理为 1 个主题清晰的提交；修复分支按问题保持小提交。
- 如果改动只影响文档，也请说明测试未运行或为何不需要运行。
