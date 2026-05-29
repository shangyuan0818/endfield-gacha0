# Release Checklist

## 代码

- [ ] 版本号和 changelog 已更新
- [ ] 公开主链的变更已完成局部自测
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run build`
- [ ] `git diff --check`

## Git 历史与分支

- [ ] 从 `main` 切出 `release/vX.Y.Z`，本轮功能与修复先进入发布分支。
- [ ] 新功能使用 `feat/<task-id>-<name>`，修复使用 `fix/<task-id>-<name>`，只在对应分支提交相关文件。
- [ ] 功能分支合入 `release/*` 前整理为 1 个主题清晰的提交，修复分支按问题保持小提交。
- [ ] `release/*` 验证通过后再合入 `main`，并打 `vX.Y.Z` tag。
- [ ] 已推送到远端的 `main` 不做历史改写；需要纠错时新增修复提交或发布分支。

## 公开验证

- [ ] `npm test`
- [ ] `npm run test:public-api-boundary`
- [ ] `npm run test:bootstrap-cache`
- [ ] `npm run test:official-announcements-feed`
- [ ] `npm run test:ops-automation`
- [ ] `npm run perf:report`

## 文档

- [ ] README 已保持 GitHub 首页短摘要，并链接到专题文档
- [ ] `docs/PROJECT_GUIDE.md` 已同步部署、环境变量、数据库和维护命令
- [ ] `docs/ARCHITECTURE.md` 已同步架构、公共缓存、自动化和数据库边界
- [ ] `docs/CODEMAP.md` 已同步代码入口索引
- [ ] `supabase/README.md` 已同步 baseline 覆盖范围
- [ ] 若 UI 有变化，`docs/screenshots/` 已更新
- [ ] `.github/` 模板已覆盖当前提交流程

## 部署

- [ ] Supabase baseline / migration 状态已确认
- [ ] Vercel 部署已检查
- [ ] 公共页面首屏未出现浏览器直连 Supabase
- [ ] 公共缓存版本 / 失效链已验证

## 收尾

- [ ] 需要的话同步更新 `todo`
- [ ] 需要的话同步更新 `SESSION_HANDOFF.md`
- [ ] 如果有回归风险，准备对应 BUG 条目
