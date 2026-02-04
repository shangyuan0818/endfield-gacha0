# gacha-analyzer 清理计划（草案）

依据 2026-02-04 代码检索结果，标注当前未被引用或可再生的文件/目录，按“可直接删除”和“需确认后再删”分类。

## 可直接删除（未被引用，或为可再生产物）
- OCR 相关：`src/utils/ocrEngine.js`、`src/utils/ocrParser.js`、`src/utils/importTypes.js`、`src/utils/importParsers.js`  
  - 交叉检索：`rg -n "ocrEngine"` / `rg -n "ocrParser"` / `rg -n "ImportMethod"` 均仅命中文件自身，无其他 import。
- 旧导入示例：`src/utils/arkImportAdapter.js`（`rg -n "ArkImportAdapter"` 仅本文件出现）。
- 旧池子迁移工具：`src/utils/poolIdGenerator.js`、`src/utils/poolIdMigrator.js`（只互相引用/挂到 window，`rg -n "generateSemanticPoolId"` 无外部调用）。
- `python-services/ocr/`：独立 Python OCR 服务；前端仅在 `ocrEngine` 预留 `VITE_OCR_SERVICE_URL`，当前无实际调用。
- 产物目录：`dist/`（构建输出，可删后 `npm run build` 重建）、`node_modules/`（依赖，可删后 `npm install` 还原）。

## 需确认后再删/迁移
- `supabase/functions/get-fingerprint/`：`rg -n "fingerprint" src` 无结果，前端未调用。如不做服务端指纹限流，可移除。

## 保留
- `api/` 目录（Serverless Functions）、`src/` 主体代码、`supabase/migrations/` 数据库脚本等仍在使用。

## 建议执行顺序
1) 先清理可再生目录：`dist/`、`node_modules/`；必要时重新安装/构建验证。  
2) 删除未引用的 OCR / 旧导入 / 池子迁移工具及 `python-services/ocr/`。  
3) 依据实际部署抉择`supabase/functions/get-fingerprint/` 的保留或迁移。  
4) 运行 `npm run build && npm run lint`，确认无缺失引用或类型错误。

> 如后续需要恢复 OCR 或自建代理，可从版本历史或独立备份恢复。
