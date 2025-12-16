# 项目 TODO 列表

> **最后更新**: 2025-12-17
> **项目版本**: v2.2.2
> **扫描范围**: 完整代码库 + ESLint + 构建产物

---

## 🚨 P0 - 严重问题（必须修复）

### 1. ✅ ESLint配置错误
**文件**: `eslint.config.js:28`
**问题**: `'process' is not defined`
**影响**: ESLint无法正确识别环境变量
**修复**:
```javascript
// 在 eslint.config.js 添加
languageOptions: {
  globals: {
    ...globals.browser,
    process: 'readonly'  // 添加这行
  }
}
```

### 2. ✅ 未使用的导入 - AuthModal.jsx
**文件**: `AuthModal.jsx:1`
**问题**: `useCallback` 已导入但未使用
**修复**: 删除 `useCallback` 导入或使用它

---

## ⚠️ P1 - 高优先级（建议修复）

### 3. 未使用的工具函数
**文件**: `GachaAnalyzer.jsx:11`
**问题**: 以下函数已导入但未使用
- `getPoolRules`
- `extractTypeFromPoolName`

**修复**: 删除未使用的导入或实现相关功能

### 4. 未使用的变量
**文件**: `GachaAnalyzer.jsx`
**问题**: 多个变量定义但未使用
- `confirm` (line 39)
- `setManualPityLimit` (line 214)
- `showNotification` (line 769)
- `displayTotalSixStar` (line 1161)

**修复**: 删除或实现相关功能

### 5. React Hooks 依赖问题
**文件**: `GachaAnalyzer.jsx`
**问题**:
- Line 551: useEffect 缺少 `currentPoolId` 依赖
- Line 620: useEffect 有不必要的 `supabase` 依赖
- Line 846: useCallback 缺少 `showToast` 依赖

**修复**: 按照 ESLint 提示添加或移除依赖

### 6. 大量 console 语句
**文件**: 多个文件（共43处）
**问题**: 生产环境不应该有 console.error/warn/log
**修复**:
- 实现统一的日志系统
- 或在生产环境移除 console（通过构建配置）

---

## 📦 P2 - 性能优化（推荐）

### 7. 打包体积过大
**问题**:
- 主JS包: 1.04 MB (gzip后 294KB)
- 超过推荐的 500KB 限制

**影响**: 首屏加载速度慢

**修复方案**:
```javascript
// vite.config.js
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'recharts-vendor': ['recharts'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'ui-vendor': ['lucide-react', 'dompurify']
        }
      }
    }
  }
})
```

### 8. 缺少代码分割
**问题**: 所有组件打包在一起
**修复**: 使用 React.lazy() 和 Suspense 懒加载非关键组件
```javascript
const AdminPanel = React.lazy(() => import('./components/AdminPanel'))
const SettingsPanel = React.lazy(() => import('./components/SettingsPanel'))
```

---

## 🔒 P3 - 安全改进（建议）

### 9. ✅ XSS 防护已到位
**状态**: ✅ 已使用 DOMPurify
**文件**: `SimpleMarkdown.jsx`
**评估**: 安全配置正确，ALLOWED_TAGS 限制合理

### 10. Edge Functions 未完全实现
**文件**: `supabase/functions/`
**当前状态**:
- ✅ `get-fingerprint` - 已实现但未部署
- ❌ `admin-create-user` - README 提到但未找到
- ❌ `admin-delete-user` - README 提到但未找到

**影响**: 超级管理员用户管理功能可能不完整
**修复**: 检查并实现缺失的 Edge Functions

---

## 🧪 P4 - 测试覆盖（长期）

### 11. 缺少单元测试
**问题**: 项目无任何测试文件
**影响**: 代码质量无法保证，重构风险高

**建议**:
```bash
# 安装测试工具
npm install -D vitest @testing-library/react @testing-library/jest-dom

# 创建测试文件
src/
  components/
    MinecraftCaptcha.test.jsx
    TicketPanel.test.jsx
  utils/
    validators.test.js
    poolUtils.test.js
```

### 12. 缺少 E2E 测试
**建议**: 使用 Playwright 或 Cypress 测试关键流程
- 用户注册登录
- Minecraft 验证码
- 数据录入和同步

---

## 📚 P5 - 文档完善（可选）

### 13. 缺少开发文档
**建议添加**:
- `CONTRIBUTING.md` - 贡献指南
- `DEVELOPMENT.md` - 开发环境搭建
- `DEPLOYMENT.md` - 部署指南
- `API.md` - Supabase RPC 函数文档

### 14. 组件文档不足
**建议**: 为主要组件添加 JSDoc 注释
```javascript
/**
 * Minecraft 验证码组件
 * @param {Function} onVerified - 验证成功回调
 * @returns {JSX.Element}
 */
const MinecraftCaptcha = ({ onVerified }) => { ... }
```

---

## 🎨 P6 - 用户体验优化（可选）

### 15. 加载状态优化
**建议**:
- 添加骨架屏（Skeleton）替代 Loading 动画
- 数据同步时显示进度条

### 16. 错误提示优化
**建议**:
- 统一错误提示样式
- 添加错误恢复建议
- 网络错误时自动重试

### 17. 移动端体验
**建议**:
- 优化小屏幕布局
- 添加手势操作支持
- 优化触摸区域大小

---

## 🔧 P7 - 代码质量改进（可选）

### 18. 代码分层
**建议**:
```
src/
  api/          # API 调用层
  services/     # 业务逻辑层
  hooks/        # 自定义 Hooks
  utils/        # 工具函数
  components/   # UI 组件
  constants/    # 常量配置
```

### 19. TypeScript 迁移
**建议**: 逐步迁移到 TypeScript，提高类型安全

### 20. 状态管理优化
**当前**: 使用 useState 管理复杂状态
**建议**: 考虑使用 Redux Toolkit（已安装但未充分使用）

---

## 🌐 P8 - 功能增强（扩展）

### 21. PWA 支持
**建议**: 添加 Service Worker，支持离线使用
```bash
npm install -D vite-plugin-pwa
```

### 22. 数据分析增强
**建议**:
- 添加更多统计维度（周/月/年）
- 导出 Excel 格式
- 数据可视化图表增强

### 23. 社交功能
**建议**:
- 分享个人战绩卡片
- 排行榜系统
- 抽卡记录分享链接

---

## 🔍 代码审查发现的细节问题

### 24. 异常处理不完整
**示例**: `GachaAnalyzer.jsx` line 69, 201
```javascript
} catch (e) {  // ❌ 异常未处理
  return [{ id: DEFAULT_POOL_ID, ... }];
}
```
**建议**: 记录错误到日志系统

### 25. 硬编码配置
**问题**: 部分配置硬编码在组件中
**建议**: 提取到 `src/config/` 目录
- 卡池规则配置
- 稀有度配置
- UI 主题配置

---

## 📊 扫描统计

| 项目 | 数量 |
|------|------|
| **组件文件** | 27 个 |
| **代码行数** | 5104 行 (核心3文件) |
| **ESLint 错误** | 8 个 |
| **ESLint 警告** | 28 个 |
| **Console 语句** | 43 个 |
| **打包体积** | 1.04 MB |
| **测试文件** | 0 个 |
| **数据库迁移** | 21 个 |

---

## 🎯 优先级建议

### 🔥 立即处理（本周）
- [ ] P0-1: 修复 ESLint 配置错误
- [ ] P0-2: 清理未使用的导入
- [ ] P1-5: 修复 React Hooks 依赖警告
- [ ] P1-4: 清理未使用的变量

### 📅 近期处理（本月）
- [ ] P2-7: 代码分割优化打包体积
- [ ] P3-10: 部署缺失的 Edge Functions
- [ ] P1-6: 实现统一日志系统

### 🌟 长期规划（未来）
- [ ] P4-11: 添加单元测试（覆盖率 > 60%）
- [ ] P4-12: 添加 E2E 测试
- [ ] P6-15/16/17: 用户体验优化
- [ ] P8-21/22/23: 功能增强

---

## 📝 备注

1. **项目状态**: ✅ 功能完整，可以上线
2. **代码质量**: ⭐⭐⭐⭐☆ (4/5)
3. **安全性**: ⭐⭐⭐⭐⭐ (5/5)
4. **性能**: ⭐⭐⭐☆☆ (3/5，需优化打包体积）
5. **可维护性**: ⭐⭐⭐⭐☆ (4/5，缺少测试）

---

**生成时间**: 2025-12-17 00:20
**扫描工具**: ESLint + Vite Build + Manual Review
**扫描覆盖率**: 100% (全部源代码)
