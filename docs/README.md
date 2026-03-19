# Docs Layout

仓库内的补充文档统一收口到 `docs/`：

- `docs/CODEMAP.md`：前端代码地图与端到端主路径
- `docs/screenshots/`：README 和发布页引用的产品截图
- `docs/reviews/`：设计评审、架构审计、阶段性复盘

私有 `backend/` 不在当前公开仓库主链中；与其相关的 `npm run dev:backend* / test:harness` 已改为可选入口，缺少私有目录时会输出提示并安全退出。

源码根目录只保留真实入口、构建配置和面向开发者的顶层说明；一次性分析、归档材料和构建产物不要再直接堆在仓库根目录。
