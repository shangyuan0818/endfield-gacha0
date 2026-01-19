# 游戏数据导入模块架构说明

## 📁 已创建的文件结构

```
gacha-analyzer/
├── src/
│   ├── features/
│   │   └── import/
│   │       └── OfficialAPIImport.jsx      # 方案A：官网API导入（占位）
│   └── utils/
│       ├── importTypes.js                  # 统一数据类型定义
│       ├── importParsers.js                # 数据解析工具集
│       ├── arkImportAdapter.js             # 明日方舟参考实现
│       ├── ocrEngine.js                    # OCR 引擎客户端
│       └── ocrParser.js                    # OCR 结果解析器
│
└── python-services/
    └── ocr/
        ├── ocr_service.py                  # Python OCR 服务
        └── requirements.txt                # Python 依赖

EndfieldRecord/                             # 明日方舟参考项目
└── src-bex/
    └── hypergryphConnect.js                # API调用参考
```

## ✅ 已完成的功能

### 1. 核心类型定义 (`importTypes.js`)

定义了完整的类型系统：
- **导入方式枚举**: `OFFICIAL_API`, `GAME_PAGE`, `SCREENSHOT_OCR`, `MANUAL_PASTE`
- **导入状态**: `IDLE`, `INITIALIZING`, `FETCHING`, `PARSING`, `VALIDATING`, `SUCCESS`, `ERROR`, `CANCELLED`
- **统一数据结构**: `GachaRecord`, `ImportResult`, `ImportProgress`, `ImportConfig`
- **ImportAdapter 接口**: 所有导入适配器的基类
- **验证规则**: 字段验证、稀有度范围、时间戳范围、卡池ID白名单
- **错误类型**: 网络错误、认证错误、解析错误、OCR错误等

### 2. 数据解析工具 (`importParsers.js`)

提供了完整的数据处理功能：
- ✅ `validateRecord()` - 验证单条记录
- ✅ `validateRecords()` - 批量验证
- ✅ `deduplicateRecords()` - 去重
- ✅ `mergeRecords()` - 合并新旧记录
- ✅ `groupByPool()` - 按卡池分类统计
- ✅ `generateBatchId()` - 生成批次ID
- ✅ `assignBatchIds()` - 分配批次ID
- ✅ `autoDetectPoolType()` - 自动识别卡池类型
- ✅ `parseCSV()` - 解析CSV格式
- ✅ `parseJSON()` - 解析JSON格式
- ✅ `normalizeRecord()` - 标准化记录格式
- ✅ `calculateImportSummary()` - 生成统计摘要

### 3. 明日方舟参考实现 (`arkImportAdapter.js`)

完整的API导入适配器：
- ✅ 实现 `ImportAdapter` 接口
- ✅ Token 验证逻辑
- ✅ 分页数据获取
- ✅ 增量导入优化
- ✅ 进度回调支持
- ✅ 错误处理和重试
- ✅ 请求延迟防止限流
- ✅ 数据解析和标准化

**关键代码示例**:
```javascript
const adapter = new ArkImportAdapter();
await adapter.initialize({ token: 'your-token' });
const result = await adapter.import((progress) => {
  console.log(`${progress.percentage}% - ${progress.message}`);
});
```

### 4. OCR 识别服务 (`ocr_service.py`)

基于 PaddleOCR + OpenCV 的 Python 服务：
- ✅ Flask API 服务器
- ✅ 单张图片识别 (`/ocr/recognize`)
- ✅ 批量图片识别 (`/ocr/batch`)
- ✅ 图像预处理（去噪、二值化、增强）
- ✅ 颜色检测辅助识别稀有度
- ✅ 角色名称模糊匹配
- ✅ 健康检查端点 (`/health`)

**安装依赖**:
```bash
cd python-services/ocr
pip install -r requirements.txt
```

**启动服务**:
```bash
python ocr_service.py
# 服务将运行在 http://localhost:5000
```

### 5. OCR 引擎客户端 (`ocrEngine.js`)

前端调用 Python OCR 服务的封装：
- ✅ `OcrEngine` 类
- ✅ 服务可用性检查
- ✅ 图片验证（格式、大小）
- ✅ Base64 转换
- ✅ 单张图片识别
- ✅ 批量图片识别
- ✅ 进度回调
- ✅ 取消支持
- ✅ 错误处理

**使用示例**:
```javascript
import { OcrEngine } from '@/utils/ocrEngine';

const ocrEngine = new OcrEngine();

// 检查服务
const { available } = await ocrEngine.checkServiceAvailability();

// 识别图片
const result = await ocrEngine.recognizeImage(imageFile, {
  preprocess: true,
  onProgress: (progress) => {
    console.log(progress.message);
  }
});
```

### 6. OCR 结果解析器 (`ocrParser.js`)

将 OCR 识别结果转换为标准格式：
- ✅ `parseOcrResult()` - 解析单张图片结果
- ✅ `parseBatchOcrResult()` - 解析批量结果
- ✅ `calculatePityForOcrRecords()` - 计算保底进度
- ✅ `correctOcrRecords()` - 校正识别错误
- ✅ `filterLowConfidenceRecords()` - 过滤低置信度记录
- ✅ `inferTimestampFromFilename()` - 从文件名推测时间
- ✅ `assignTimestampsToOcrRecords()` - 分配时间戳
- ✅ `generateOcrParseReport()` - 生成解析报告

## 🔄 数据流程图

### 方案A：官网API导入

```
用户登录官网
    ↓
浏览器获取Token
    ↓
EndfieldOfficialApiAdapter.initialize(token)
    ↓
adapter.validate() - 验证Token
    ↓
adapter.import(onProgress)
    ├─ fetchAllRecords() - 分页获取数据
    ├─ parseRecords() - 解析数据
    ├─ validateRecords() - 验证数据
    ├─ mergeRecords() - 合并去重
    └─ assignBatchIds() - 分配批次ID
    ↓
返回 ImportResult
```

### 方案B2：截图OCR识别

```
用户截图上传
    ↓
OcrEngine.validateImage() - 验证图片
    ↓
OcrEngine.recognizeImage()
    ├─ fileToBase64() - 转换图片
    ├─ 调用 Python OCR 服务
    │   ├─ preprocess_image() - 图像预处理
    │   ├─ PaddleOCR.ocr() - 文字识别
    │   ├─ detect_rarity_by_color() - 颜色检测
    │   └─ fuzzy_match_character() - 名称匹配
    └─ 返回识别结果
    ↓
parseOcrResult() - 解析结果
    ↓
assignTimestampsToOcrRecords() - 分配时间
    ↓
calculatePityForOcrRecords() - 计算保底
    ↓
返回标准记录
```

## 📝 环境变量配置

需要在 `.env` 文件中添加：

```env
# OCR 服务地址
VITE_OCR_SERVICE_URL=http://localhost:5000
```

## 🚀 下一步工作

### 待完成的UI组件：

1. **ImportManager.jsx** - 导入管理器主组件
   - 导入方式选择
   - 流程协调
   - 进度显示

2. **ScreenshotUpload.jsx** - 截图上传组件
   - 拖拽上传
   - 粘贴剪贴板
   - 多文件选择

3. **ImagePreview.jsx** - 图片预览组件
   - 缩略图显示
   - 大图预览
   - 识别结果标注

4. **ImportGuide.jsx** - 导入指南组件
   - 步骤说明
   - 常见问题

### 待完善的适配器：

1. **OfficialAPIImport.jsx** - 终末地官网API适配器
   - ⚠️ 需要游戏上线后抓包分析
   - 参考 `arkImportAdapter.js` 实现
   - 更新 API 端点和数据格式

2. **GamePageImport.jsx** - 游戏页面抓取适配器（可选）
   - 需要桌面客户端或浏览器插件

## 📊 测试计划

### OCR 服务测试

1. **启动 OCR 服务**:
```bash
cd python-services/ocr
python ocr_service.py
```

2. **测试健康检查**:
```bash
curl http://localhost:5000/health
```

3. **测试图片识别**（等待用户提供测试图片）

### 前端集成测试

1. 创建测试页面
2. 上传测试图片
3. 验证识别结果
4. 调整识别参数

## 🎯 成果总结

### 已完成 (FEAT-005 阶段1)：

✅ **架构设计**
- 统一的数据类型定义
- ImportAdapter 接口标准
- 支持三种导入方案的框架

✅ **核心工具**
- 完整的数据解析工具集
- 验证、去重、合并功能
- 格式转换（CSV/JSON）

✅ **参考实现**
- 明日方舟适配器（可运行）
- 完整的API调用流程
- 错误处理和进度回调

✅ **OCR 支持**
- Python OCR 服务（PaddleOCR + OpenCV）
- 前端 OCR 客户端
- OCR 结果解析器
- 图像预处理和颜色检测

### 预计完成时间：

- ✅ 阶段1（导入架构）：**已完成**
- ⏳ 阶段2（UI组件）：预计 1 天
- ⏳ 阶段3（官网API）：开服后 3.5 天

## 💡 使用建议

1. **开发顺序**：
   - 先完成 UI 组件框架
   - 使用现有批量粘贴测试数据流
   - 等游戏上线后完善官网API
   - 用测试图片验证OCR功能

2. **测试策略**：
   - 使用明日方舟适配器测试框架
   - 模拟数据测试解析工具
   - 准备多种格式的测试数据

3. **风险控制**：
   - OCR 准确率目标 >93%
   - 官网API需要实时调整
   - 准备多种导入方案备选

---

**文档创建时间**: 2026-01-10
**架构版本**: v1.0
**状态**: ✅ 框架搭建完成，等待UI实现和测试
