# Endfield Gacha Analyzer (终末地抽卡分析器)

一个功能完善的抽卡记录分析工具，专为《明日方舟：终末地》设计，支持云端同步、多用户协作和全服数据统计。

![Version](https://img.shields.io/badge/version-2.8.1-blue.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![Vite](https://img.shields.io/badge/Vite-7-646CFF.svg)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-3ECF8E.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC.svg)

## ✨ 核心功能

### 多卡池支持
- **限定角色池**：80抽6星保底、120抽硬保必出限定、每240抽赠送限定角色
- **武器池**：40抽6星保底、首轮80抽必出限定、阶梯赠送机制（100/180/260...）
- **常驻池**：80抽6星保底、300抽赠送自选角色

### 页面结构 (v2.5.0+)
- **首页**：欢迎页面、使用指南、卡池机制速览、常驻公告
- **统计**：全服/个人数据对比、稀有度饼图、出货分布图表
- **卡池详情**：实时统计、保底进度、详细日志（可折叠）
- **全局页脚**：版权信息、制作者链接

### 数据可视化
- **统计面板**：
  - 支持切换「全服数据」和「我的数据」
  - 按卡池类型筛选（全部/限定池/武器池/常驻池/角色池合并）
  - 稀有度饼图和6星出货垫刀分布堆叠柱状图
  - 全服统计包含总抽数、用户数、平均出货等指标
- **卡池详情**：实时展示各稀有度占比、不歪率、距离保底抽数、保底进度条
- **详细日志**：支持按组查看/编辑/删除

### 高效录入
- **十连编辑器**：点击快速切换星级，一键保存
- **单抽补录**：快捷按钮补录漏记的抽卡
- **批量粘贴**：支持批量导入抽卡数据
- **智能识别**：自动识别保底、赠送等特殊情况

### 用户系统
- **账户认证**：
  - 邮箱注册/登录（Supabase Auth）
  - 实时邮箱格式验证 + 域名白名单
  - 重复注册检测，智能引导登录
  - 密码强度指示器（弱/中/强）
  - 邮件方式密码重置
  - 人机验证（Cloudflare 风格）

- **权限管理**：4级权限体系
  - **游客**：仅查看全服数据
  - **用户**：查看数据，可申请管理员
  - **管理员**：录入和编辑数据
  - **超级管理员**：
    - 用户管理（创建/编辑/删除/查看在线时间）
    - 审批管理员申请
    - 公告管理（Markdown 编辑器）
    - 页面内容管理

- **云端同步**：登录后数据自动同步到云端

### 数据管理
- **本地存储**：离线也能使用，数据保存在浏览器
- **云端备份**：登录用户数据自动同步
- **导入/导出**：支持 JSON（完整备份）和 CSV（表格分析）格式
- **手动同步**：设置面板支持一键同步云端数据
- **数据清理**：支持删除本地或云端数据

### 视觉特效 (v2.5.1+)
- **限定6星彩虹渐变**：限定角色使用彩虹渐变主题
- **UP角色动态显示**：跟随轮换计划自动更新
- **公告常驻化**：首页常驻显示最新公告

## 🚀 快速开始

### 在线使用
访问部署地址即可直接使用（无需安装）

### 本地开发

1. 克隆项目：
```bash
git clone https://github.com/MoguJunn/endfield-gacha.git
cd gacha-analyzer
```

2. 安装依赖：
```bash
npm install
```

3. 配置环境变量（必需，用于云端功能）：
```bash
cp .env.example .env
# 编辑 .env 填入 Supabase 配置
```

4. 启动开发服务器：
```bash
npm run dev
```

5. 构建生产版本：
```bash
npm run build
```

## ⚙️ 环境变量配置

### Supabase 配置

```env
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
```

### 应用配置（必需）

```env
VITE_APP_URL=https://your-domain.vercel.app
```

**⚠️ 重要**: `VITE_APP_URL` 用于:
- 密码重置邮件的回调链接
- "急"按钮实时统计功能
- 必须配置为应用的公开访问域名

### SMTP 配置（重要！）

**⚠️ Supabase 免费版邮件限制：仅 2 封/小时**

为确保用户注册和密码重置功能正常，**必须配置自定义 SMTP 服务**。

推荐服务商：
- **Resend**（推荐）：3,000 封/月免费，无需信用卡
- **SendGrid**：3,000 封/月免费，行业标准
- **阿里云邮件推送**：6,000 封/月免费，适合国内用户

详细配置指南：查看项目根目录 `../email-template/SMTP配置指南.md`

## 📦 部署指南

### 部署到 Vercel

1. **Fork 并克隆仓库**
   ```bash
   git clone https://github.com/your-username/endfield-gacha.git
   cd gacha-analyzer
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置 Supabase 项目**
   - 在 [Supabase](https://supabase.com) 创建新项目
   - 记录项目的 URL 和 anon key

4. **执行数据库迁移**
   - 登录 Supabase Dashboard
   - 进入 SQL Editor
   - 按顺序执行 `supabase/migrations/` 中的所有迁移文件
   - 特别注意执行 `026_global_stats.sql`（v2.8.0 新增）

5. **启用 Realtime 功能**
   - 导航到: Database → Replication
   - 找到 `global_stats` 表
   - 启用 Realtime 开关
   - 或执行 SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE global_stats;`

6. **配置 SMTP 服务**
   - 推荐使用 Resend (3,000 封/月免费)
   - 在 Supabase: Authentication → Email Templates
   - 配置 SMTP 设置
   - 详见 `../email-template/SMTP配置指南.md`

7. **部署 Edge Functions（可选，超管功能需要）**
   ```bash
   # 部署用户管理函数
   supabase functions deploy admin-create-user
   supabase functions deploy admin-delete-user
   ```

8. **部署到 Vercel**
   - 访问 [Vercel Dashboard](https://vercel.com)
   - 导入 GitHub 仓库
   - 配置环境变量:
     ```
     VITE_SUPABASE_URL=https://your-project.supabase.co
     VITE_SUPABASE_ANON_KEY=your-anon-key
     VITE_APP_URL=https://your-app.vercel.app
     ```
   - 点击 Deploy

9. **部署后验证清单**
   - [ ] 访问部署的应用 URL
   - [ ] 测试用户注册功能
   - [ ] 测试邮件发送（确认邮件、密码重置）
   - [ ] 测试"急"按钮实时统计（多个浏览器窗口验证同步）
   - [ ] 测试数据录入和云端同步
   - [ ] 检查图表数据显示正常
   - [ ] 测试管理员权限申请流程
   - [ ] 超管测试用户管理功能

### 故障排查

#### "急"按钮统计不工作
- 检查 `VITE_APP_URL` 是否配置正确
- 确认 `global_stats` 表已创建（执行 026_global_stats.sql）
- 确认 Realtime 已启用
- 打开浏览器控制台查看错误信息

#### 邮件发送失败
- Supabase 免费版限制: 2 封/小时
- 配置自定义 SMTP 服务
- 检查 SMTP 设置是否正确

#### 数据同步失败
- 检查 Supabase URL 和 Key 是否正确
- 确认用户已登录
- 检查 RLS 策略是否正确配置

#### 图表不显示
- 确认执行了 `003_global_stats_with_charts.sql`
- 检查是否有抽卡数据
- 打开控制台查看错误

### Supabase 数据库结构

需要创建以下表：
- `profiles` - 用户信息和角色（含 email、last_seen_at）
- `pools` - 卡池数据
- `history` - 抽卡记录
- `admin_applications` - 管理员申请
- `announcements` - 系统公告
- `blacklist` - 黑名单
- `page_content` - 页面内容管理
- `rate_limits` - 频率限制

### 数据库迁移文件

项目包含以下迁移文件（位于 `supabase/migrations/`）：

| 文件 | 说明 |
|------|------|
| `002_global_stats_function.sql` | 基础全服统计 RPC 函数 |
| `003_global_stats_with_charts.sql` | 扩展全服统计，支持图表数据 |
| `015_superadmin_user_management.sql` | 超级管理员用户管理功能 |
| `024_user_management_enhancement.sql` | 用户管理增强（邮箱+在线时间） |
| `025_page_content.sql` | 页面内容管理表 |
| `026_global_stats.sql` | "急"按钮全局点击统计功能 (v2.8.0) |

**重要**: 新部署时必须按顺序执行所有迁移文件

### Edge Functions（可选）

超级管理员功能需要以下 Edge Functions：
- `admin-create-user` - 创建新用户
- `admin-delete-user` - 删除用户

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 核心框架 | React 19 + Vite 7 |
| UI 样式 | Tailwind CSS v4 |
| 图表库 | Recharts 3 |
| 图标库 | Lucide React |
| 后端服务 | Supabase (Auth + PostgreSQL + RPC + Edge Functions) |
| 状态管理 | Zustand 5 |
| Markdown 编辑 | @uiw/react-md-editor |
| 部署平台 | Vercel |

## 📂 项目结构

```
gacha-analyzer/
├── src/
│   ├── GachaAnalyzer.jsx        # 主组件（路由+状态协调）
│   ├── AuthModal.jsx            # 登录/注册弹窗
│   ├── LoadingScreen.jsx        # 加载动画组件
│   ├── supabaseClient.js        # Supabase 客户端配置
│   ├── components/
│   │   ├── home/
│   │   │   └── HomePage.jsx     # 首页组件
│   │   ├── dashboard/
│   │   │   └── DashboardView.jsx # 卡池详情视图
│   │   ├── records/
│   │   │   └── RecordsView.jsx  # 记录视图
│   │   ├── layout/
│   │   │   └── Footer.jsx       # 全局页脚
│   │   ├── modals/
│   │   │   └── EditItemModal.jsx # 编辑弹窗
│   │   ├── AdminPanel.jsx       # 超级管理员面板
│   │   ├── SettingsPanel.jsx    # 设置面板
│   │   ├── SummaryView.jsx      # 统计视图
│   │   ├── InputSection.jsx     # 录入组件
│   │   ├── BatchCard.jsx        # 十连卡片
│   │   ├── PoolSelector.jsx     # 卡池选择器
│   │   ├── TicketPanel.jsx      # 工单面板
│   │   ├── AboutPanel.jsx       # 关于面板
│   │   └── SimpleMarkdown.jsx   # Markdown 渲染
│   ├── stores/
│   │   └── useGachaStore.js     # Zustand 状态管理
│   ├── constants/
│   │   └── index.js             # 常量配置
│   ├── utils/
│   │   └── validators.js        # 验证工具
│   ├── main.jsx                 # 应用入口
│   └── index.css                # 全局样式（含彩虹渐变）
├── public/
│   └── avatar.png               # 默认头像
├── supabase/
│   └── migrations/              # 数据库迁移文件
├── .env.example                 # 环境变量模板
└── dist/                        # 构建输出
```

## 🎨 UI 设计特色

- **终末地风格**：
  - 工业科技感设计语言
  - 标志性黄色主题色 (`#fbbf24`)
  - 方正无圆角设计
  - 网格纹理背景

- **限定6星彩虹特效**：
  - 渐变背景、边框、文字
  - UP角色动态高亮

- **响应式设计**：
  - 完美适配桌面端和移动端
  - 暗色模式支持

- **交互体验**：
  - 即时反馈和验证
  - 友好的错误提示
  - 流畅的动画效果
  - 加载进度条

## 📝 更新日志

### v2.8.1 (2025-12-29)
- 🔧 DEP-002: 添加缺失的 canvas-confetti 依赖

### v2.8.0 (2025-12-29)
- ✨ FEAT-007: "急"按钮全局点击统计
  - 全局统计所有用户的点击次数
  - Supabase 实时订阅，所有在线用户同步更新
  - 批量上传优化（用户停止点击2秒后批量提交，减少99%网络请求）
  - 防抖处理，防止过快重复点击
  - 降级方案：未配置Supabase时使用本地缓存
  - 智能清理：页面关闭时自动上传未提交的点击
- ✨ UI-013: 首页布局优化
  - 隐藏三测倒计时，添加三测已结束提示框
  - 公测倒计时放大显示，改为终末地风格
  - 将"卡池机制速览"改名为"三测卡池机制速览"
- ⚡ PERF-003: 性能优化
  - CountdownTimer组件移到外部并使用React.memo
  - 避免重复渲染，点击按钮不会导致倒计时重置

### v2.7.3 (2025-12-19)
- 🐛 FIX-007: 更新测试结束时间为12/29 14:00
- 🐛 FIX-008: 更新公告链接文本和描述

### v2.7.2 (2025-12-19)
- 📅 DATA-001: 更新卡池轮换时间表（使用官方公告时间）
  - 莱万汀：11/28 11:00 - 12/12 13:59
  - 伊冯：12/12 14:00 - 12/26 13:59
  - 洁尔佩塔：12/26 14:00 - 12/29 14:00 (测试结束)
- 🔧 更新 getCurrentUpPool() 函数适配新数据结构
- 🔧 首页轮换时间线显示精确到分钟

### v2.7.1 (2025-12-18)
- 🐛 FIX-001: 修复公告NEW标签不显示问题（添加2秒延迟标记已读）
- 🐛 FIX-002: 修复使用指南/卡池速览折叠动画（CSS Grid方案）
- 🐛 FIX-003: 优化公告Markdown渲染（回退SimpleMarkdown + 增强样式）
- ✨ UI-004: 增强SimpleMarkdown组件样式（链接、标题、列表视觉优化）
- ✨ UI-005: 升级倒计时组件（主题配置、外链按钮、描述文本）
- ✨ UI-006: AboutPanel页面全面UI重构（现代化设计风格）
- ✨ UI-007: 首页添加功能路线图卡片
- ✨ UI-008: 使用指南卡片UI重构（现代简约风格）
- ✨ UI-009: 功能路线图改为横向时间轴布局（支持折叠+动画）
- ✨ UI-010: 卡池机制速览卡片样式统一（悬停渐变条+英文标签）
- 🐛 FIX-004: 图表Tooltip深浅色模式适配（响应式监听主题切换）
- ✨ UI-011: 图表彩虹渐变效果与饼图分布优化（SVG渐变+增强显示占比）
- 🐛 FIX-005: 修复统计页面全服数据饼图不显示（generateChartData缺少displayValue）
- 🐛 FIX-006: 修复功能路线图折叠状态无法记录（storageUtils遗漏roadmap）
- ✨ UI-012: 更新关于页面AI助手官方Logo（Claude/Gemini官方SVG）

### v2.7.0 (2025-12-18)
- ✨ UX-005: 首页折叠状态记忆 + 公告更新检测
  - 创建 src/utils/storageUtils.js 工具函数
  - localStorage 保存用户折叠偏好（公告/指南/卡池速览）
  - 对比公告 updated_at 与用户上次查看时间
  - 公告有更新时显示 NEW 标签（红色动画）
  - 有更新时公告默认展开
- ✨ UX-006: 页面更新提示气泡
  - 创建 NotificationBadge 气泡组件
  - 首页按钮：有新公告时显示红点
  - 管理按钮：待审批申请显示数字气泡（仅超管）
  - 工单按钮：未读工单显示数字气泡
  - 点击后自动标记为已查看

### v2.6.1 (2025-12-18)
- ✨ ADMIN-002: Markdown 编辑器升级
  - 使用 @uiw/react-md-editor 替换简单 textarea
  - 公告管理和页面内容管理支持实时预览
  - 工具栏支持加粗、斜体、链接、图片等
  - 支持明暗主题自动切换

### v2.6.0 (2025-12-18)
- ✨ ADMIN-001: 页面内容管理（超管可编辑首页内容）
- ✨ ADMIN-003: 用户管理增强
  - 用户列表显示邮箱
  - 显示最后在线时间（友好格式化）
- 🗄️ 新增数据库迁移文件 024、025

### v2.5.1 (2025-12-17)
- ✨ UI-001: 限定6星彩虹渐变主题
- ✨ UI-002: 公告常驻化（移至首页）
- ✨ UI-003: UP角色动态显示

### v2.5.0 (2025-12-17)
- ✨ PAGE-001: 新增首页（使用指南 + 卡池机制速览）
- ✨ PAGE-002: 合并看板和记录 → 卡池详情
- ✨ PAGE-003: 页面重命名（汇总→统计）
- ✨ PAGE-004: 全局页脚组件

### v2.2.x - v2.4.x (2025-12)
- 🏗️ 架构重构：引入 Zustand 状态管理
- 🧩 组件拆分：DashboardView、RecordsView、PoolSelector 等
- 🔒 安全加固：RLS 策略、频率限制、参数验证
- 🐛 修复多个运行时错误
- 🧹 代码质量优化：ESLint 规则增强、console 清理

### v2.1.0 (2024-12-04)
- ✨ 增强注册功能：实时邮箱验证、密码强度指示
- ✨ 超级管理员用户管理
- 📧 自定义邮件模板

### v2.0.0
- 初始版本发布

## 🔒 安全特性

- **认证安全**：Supabase Auth + 邮箱域名白名单
- **数据安全**：RLS 行级安全策略
- **频率限制**：API 请求频率限制（不可预测 ID）
- **输入验证**：前后端双重参数验证
- **XSS 防护**：DOMPurify 内容净化
- **CSRF 防护**：Supabase 内置保护

## 👥 制作团队

### 项目发起人
**蘑菇菌__** - 产品设计 & 项目管理
- [B站主页](https://space.bilibili.com/14932613)

### AI 开发助手
- **Claude** (Anthropic Claude Opus 4.5) - 架构设计 & 全栈开发 & 功能实现
- **Gemini** (Google Gemini 3 Pro) - UI 设计咨询

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

### 贡献指南
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📄 许可证

MIT License

## 📞 联系方式

- 项目主页：https://github.com/MoguJunn/endfield-gacha
- 问题反馈：[GitHub Issues](https://github.com/MoguJunn/endfield-gacha/issues)

---

*本项目为粉丝自制工具，与游戏官方无关。*
*游戏内容版权归 Gryphline / HyperGryph 所有。*
*抽卡机制基于现有网络信息，实际请以游戏上线为准。*
