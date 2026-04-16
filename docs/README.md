# Docs Layout

仓库内的补充文档统一收口到 `docs/`：

- `docs/CODEMAP.md`：前端代码地图与端到端主路径
- `docs/screenshots/`：README 和发布页引用的产品截图
- `docs/reviews/`：设计评审、架构审计、阶段性复盘
- `docs/email-template/`：认证邮件模板与 SMTP 配置说明

私有 `backend/` 不在当前公开仓库主链中；与其相关的 `npm run dev:backend* / test:harness` 已改为可选入口，缺少私有目录时会输出提示并安全退出。

当前公开文档维护约束：

- 根目录 `README.md` 负责对外说明：功能、部署、环境变量、版本日志
- `supabase/README.md` 负责数据库迁移链、baseline 与手工脚本说明
- 与真实代码状态冲突的“历史计划 / 旧部署方式”不要继续保留在 README 正文里
- 新增迁移、CI、Serverless 路由、字体链或官方公告采集链后，应同步更新对应 README，而不是只改代码

源码根目录只保留真实入口、构建配置和面向开发者的顶层说明；一次性分析、归档材料和构建产物不要再直接堆在仓库根目录。
