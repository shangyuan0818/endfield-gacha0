# "急"按钮点击统计功能 - 部署指南

## 功能说明

为倒计时页面的"急"按钮添加了全局点击统计功能，可以实时显示所有访问网站的用户累计点击次数。

## 实现特性

✅ **全局统计** - 统计所有用户的点击次数
✅ **实时同步** - 使用 Supabase 实时订阅，任何用户点击后所有在线用户都能看到最新数据
✅ **批量上传** - 用户连续点击时先在本地计数，停止点击 2 秒后批量上传，大幅减少服务器负载
✅ **防抖处理** - 防止用户过快重复点击
✅ **降级方案** - 即使 Supabase 未配置，也能使用本地缓存功能
✅ **数据一致性** - 使用原子操作确保并发点击时数据准确
✅ **智能清理** - 页面关闭时自动上传未提交的点击次数

## 部署步骤

### 方法 1: 使用迁移文件（推荐）

**适用于新部署或 CI/CD 自动化部署**

1. **执行迁移文件**
   - 登录 [Supabase 控制台](https://supabase.com/dashboard)
   - 进入 **SQL Editor**
   - 打开 `supabase/migrations/026_global_stats.sql`
   - 复制全部 SQL 代码并粘贴到 SQL Editor
   - 点击 **Run** 执行

2. **优势**
   - ✅ 自动化部署
   - ✅ 版本控制
   - ✅ 包含完整注释和故障排查说明
   - ✅ 支持 CI/CD 流程

### 方法 2: 使用快速安装脚本

**适用于手动部署**

1. 登录你的 [Supabase 控制台](https://supabase.com/dashboard)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 打开 `supabase-setup-urgent-button.sql` 文件
5. 复制全部 SQL 代码并粘贴到 SQL Editor
6. 点击 **Run** 执行

**注意**: `supabase-setup-urgent-button.sql` 和 `026_global_stats.sql` 功能相同，选择其一执行即可。

### 2. 验证数据库设置

在 SQL Editor 中运行以下查询来验证设置：

```sql
-- 查看统计表
SELECT * FROM public.global_stats WHERE stat_key = 'urgent_button_clicks';

-- 测试单次增加函数
SELECT public.increment_urgent_clicks();

-- 测试批量增加函数
SELECT public.increment_urgent_clicks_batch(5);
```

### 3. 启用 Realtime 功能（必需）

**⚠️ 重要**: "急"按钮的实时同步功能依赖 Supabase Realtime，必须启用！

#### 方法 1: 通过 Dashboard 启用（推荐）

1. 在 Supabase 控制台导航到 **Database** → **Replication**
2. 找到 `global_stats` 表
3. 启用 **Realtime** 开关（点击切换为绿色）
4. 等待几秒钟使配置生效

#### 方法 2: 通过 SQL 启用

在 SQL Editor 中执行：

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE global_stats;
```

#### 验证 Realtime 是否生效

1. 打开两个浏览器窗口访问应用首页
2. 在一个窗口中点击"急"按钮
3. 观察另一个窗口的点击次数是否自动更新
4. 如果实时更新，说明配置成功 ✅

### 4. 配置环境变量

确保 `.env` 文件包含以下必需配置：

```env
# Supabase 配置（必需）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# 应用 URL（必需 - 用于实时同步）
VITE_APP_URL=https://your-domain.vercel.app
```

**为什么需要 `VITE_APP_URL`?**
- 用于配置 Supabase Realtime 连接
- 确保"急"按钮实时统计正常工作
- 密码重置邮件的回调链接

## 文件说明

### 新增/修改的文件

1. **`supabase/migrations/026_global_stats.sql`** (新建 - v2.8.0)
   - 正式的数据库迁移文件
   - 包含完整的表、RPC 函数、RLS 策略、触发器
   - 支持自动化部署和版本控制
   - 包含详细的部署后操作说明

2. **`supabase-setup-urgent-button.sql`** (新建)
   - 快速安装脚本（与 026_global_stats.sql 功能相同）
   - 适合手动部署
   - 包含完整的设置说明和验证步骤

3. **`src/services/statsService.js`** (新建)
   - 处理"急"按钮点击统计的 API 服务
   - 包含获取、增加、订阅点击次数的函数
   - 实现了降级方案（本地缓存）
   - 批量上传优化（2秒延迟）

4. **`src/components/home/HomePage.jsx`** (修改)
   - 添加了点击统计的状态管理
   - 集成了实时订阅功能
   - 修改了倒计时组件和"急"按钮
   - 添加了页面卸载时的清理逻辑

5. **`.env.example`** (更新)
   - 添加 `VITE_APP_URL` 配置说明
   - 补充 Realtime 功能相关注释

## 功能演示

### 用户体验

1. 用户访问首页，看到公测倒计时
2. 倒计时下方有一个红色的"急"按钮
3. 按钮下方显示全球累计点击次数
4. 点击按钮后：
   - **本地计数立即 +1** （UI 即时响应）
   - 用户可以继续点击，数字持续增加
   - 停止点击 2 秒后，**批量上传所有点击**到服务器
   - 所有在线用户同步看到更新
5. 如果用户关闭页面，未上传的点击会立即提交

### 批量上传优化

**为什么使用批量上传？**

传统方式：每次点击都发送一次请求
```
点击 → 请求1 → 数据库
点击 → 请求2 → 数据库
点击 → 请求3 → 数据库
...（100 次点击 = 100 次请求）
```

优化后：累计点击，延迟批量上传
```
点击 → 本地 +1
点击 → 本地 +1
点击 → 本地 +1
... (用户疯狂点击)
停止 2 秒 → 批量请求(+100) → 数据库
（100 次点击 = 1 次请求！）
```

**性能提升：**
- 减少 99% 的网络请求
- 降低服务器负载
- 提升用户体验（无延迟）
- 减少数据库写入压力

### UI 效果

```
┌─────────────────────────┐
│  公测开启倒计时          │
│  XX 天 XX 时 XX 分 XX 秒 │
│                         │
│        ┌───┐            │
│        │ 急 │ ← 可点击   │
│        └───┘            │
│       12,345  ← 全球点击 │
└─────────────────────────┘
```

## 技术细节

### 数据表结构

```sql
global_stats
├── id (BIGSERIAL, 主键)
├── key (TEXT, 唯一键)
├── value (TEXT, 存储点击次数)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)
```

### RPC 函数

```sql
increment_urgent_clicks() → TEXT
increment_urgent_clicks_batch(increment_by BIGINT) → TEXT
```

- `increment_urgent_clicks()`: 单次增加（兼容性函数）
- `increment_urgent_clicks_batch()`: 批量增加（优化版）

两个函数都使用 `FOR UPDATE` 锁定行，确保并发安全。

### 安全策略

- **读取**: 任何人都可以读取统计数据
- **更新**: 只能通过 RPC 函数更新（防止直接篡改）
- **插入/删除**: 禁止直接操作

## 故障排除

### 问题 1: 点击后数字不更新

**症状**: 点击"急"按钮后，数字没有变化

**可能原因和解决方案:**

1. **数据库表未创建**
   - 检查: 在 SQL Editor 运行 `SELECT * FROM global_stats;`
   - 解决: 执行 `026_global_stats.sql` 或 `supabase-setup-urgent-button.sql`

2. **Supabase 配置错误**
   - 检查: `.env` 文件中的 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
   - 解决: 从 Supabase Dashboard → Project Settings → API 获取正确配置

3. **RPC 函数缺失**
   - 检查: 运行 `SELECT public.increment_urgent_clicks();`
   - 解决: 重新执行迁移脚本

4. **网络问题**
   - 检查: 打开浏览器控制台 (F12) 查看 Network 标签
   - 解决: 检查网络连接，刷新页面

**降级模式**: 即使 Supabase 未配置，statsService 会自动切换到本地缓存模式，点击仍然有效（仅本地可见）

### 问题 2: 实时更新不生效

**症状**: 在一个窗口点击，另一个窗口的数字不自动更新

**可能原因和解决方案:**

1. **Realtime 未启用** 🔴 最常见
   - 检查: Database → Replication → global_stats 的 Realtime 开关
   - 解决: 启用 Realtime 开关，或执行 `ALTER PUBLICATION supabase_realtime ADD TABLE global_stats;`

2. **VITE_APP_URL 未配置**
   - 检查: `.env` 文件中是否有 `VITE_APP_URL`
   - 解决: 添加 `VITE_APP_URL=https://your-domain.vercel.app`

3. **Supabase 订阅失败**
   - 检查: 打开控制台，查看是否有订阅错误信息
   - 解决: 刷新页面重新连接，或检查 Supabase 服务状态

4. **防火墙或代理问题**
   - 检查: Realtime 使用 WebSocket 连接，可能被防火墙阻止
   - 解决: 检查防火墙设置，允许 WebSocket 连接

**诊断命令**:
```javascript
// 在浏览器控制台运行
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
console.log('App URL:', import.meta.env.VITE_APP_URL);
```

### 问题 3: 数字显示为 0 或不显示

**症状**: 首页显示 0 次点击，或根本不显示数字

**可能原因和解决方案:**

1. **数据库未初始化**
   - 检查: `SELECT * FROM global_stats WHERE stat_key = 'urgent_button_clicks';`
   - 解决: 如果返回空，执行迁移脚本会自动插入初始值 0

2. **权限配置错误**
   - 检查: RLS 策略是否允许公开读取
   - 解决: 重新执行迁移脚本中的 RLS 策略部分

3. **字段名称不匹配**
   - 检查: 确认表使用 `stat_key` 和 `stat_value` 字段（v2.8.0+）
   - 解决: 如果使用旧版本的 `key` 和 `value`，需要更新迁移脚本

### 问题 4: statsService 错误提示

**症状**: 控制台显示 "statsService: 缺失 global_stats 表，降级到本地存储"

**这是正常的降级行为**:
- statsService 检测到数据库未配置
- 自动切换到本地缓存模式
- 功能仍然可用，但数据仅在本地保存

**如需云端同步**:
1. 执行数据库迁移脚本
2. 配置 Supabase 环境变量
3. 刷新页面

### 问题 5: 批量上传失败

**症状**: 点击很多次，但服务器上的数字远小于本地显示

**可能原因和解决方案:**

1. **上传延迟中断**
   - 原因: 在 2 秒延迟期间关闭了页面
   - 解决: 这是正常的，页面卸载时会自动上传未提交的点击

2. **并发冲突**
   - 原因: 多个用户同时批量上传
   - 解决: RPC 函数使用 `FOR UPDATE` 锁定行，会自动处理并发

3. **网络超时**
   - 原因: 批量上传请求超时
   - 解决: 检查网络连接，刷新页面重试

### 调试技巧

**启用详细日志** (开发环境):

在 `src/services/statsService.js` 中取消注释 console.log 语句

**检查 Realtime 连接状态**:

```javascript
// 在浏览器控制台运行
console.log('Supabase client:', supabase);
```

**手动测试 RPC 函数**:

```sql
-- 在 Supabase SQL Editor 执行
SELECT public.increment_urgent_clicks_batch(100);
SELECT stat_value FROM global_stats WHERE stat_key = 'urgent_button_clicks';
```

## 扩展建议

### 可选增强功能

1. **排行榜** - 显示点击最多的时间段
2. **每日重置** - 每天重置计数器
3. **动画升级** - 不同点击数触发不同特效
4. **成就系统** - 达到特定点击数解锁成就

### 性能优化配置

在 `HomePage.jsx` 中可以调整批量上传的延迟时间：

```javascript
const UPLOAD_DELAY = 2000; // 停止点击后 2 秒上传（默认值）
```

建议值：
- **2000ms (2秒)** - 平衡性能和实时性（推荐）
- **1000ms (1秒)** - 更快的数据同步，但增加请求数
- **3000ms (3秒)** - 更少的请求，但延迟更高

### 其他性能优化建议

1. **CDN 分发** - 将统计数据缓存到 CDN
2. **数据压缩** - 对大量点击数据进行压缩传输

## 许可和鸣谢

此功能基于 Supabase 实时数据库实现，感谢开源社区的支持！

---

**版本:** v2.8.0
**最后更新:** 2026-01-06
**作者:** Claude + 用户协作开发

**更新日志:**
- v2.8.0 (2025-12-29): 初始版本，"急"按钮全局点击统计
- v2.8.2 (2026-01-06): 添加迁移文件 026_global_stats.sql，完善部署文档
