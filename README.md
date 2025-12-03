# Endfield Gacha Analyzer (终末地抽卡分析器)

一个功能完善的抽卡记录分析工具，专为《明日方舟：终末地》设计，支持云端同步、多用户协作和全服数据统计。

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

### 数据可视化
- **看板**：实时展示各稀有度占比、不歪率、距离保底抽数、保底进度条
- **汇总**：
  - 支持切换「全服数据」和「我的数据」
  - 按卡池类型筛选（全部/限定池/武器池/常驻池/角色池合并）
  - 稀有度饼图和6星出货垫刀分布堆叠柱状图
  - 全服统计包含总抽数、用户数、平均出货等指标
- **记录**：详细日志，支持按组查看/编辑/删除

### 高效录入
- **十连编辑器**：点击快速切换星级，一键保存
- **单抽补录**：快捷按钮补录漏记的抽卡
- **智能识别**：自动识别保底、赠送等特殊情况

### 用户系统（完全重构 v2.1.0）
- **账户认证**：
  - ✅ 邮箱注册/登录（Supabase Auth）
  - ✅ 实时邮箱格式验证
  - ✅ 重复注册检测，智能引导登录
  - ✅ 密码强度指示器（弱/中/强）
  - ✅ 密码确认验证，防止输入错误
  - ✅ 邮件方式密码重置

- **权限管理**：4级权限体系
  - **游客**：仅查看全服数据
  - **用户**：查看数据，可申请管理员
  - **管理员**：录入和编辑数据
  - **超级管理员**：
    - 用户管理（创建/编辑/删除用户）
    - 审批管理员申请
    - 公告管理

- **云端同步**：登录后数据自动同步到云端

### 数据管理
- **本地存储**：离线也能使用，数据保存在浏览器
- **云端备份**：登录用户数据自动同步
- **导入/导出**：支持 JSON（完整备份）和 CSV（表格分析）格式
- **手动同步**：设置面板支持一键同步云端数据
- **数据清理**：支持删除本地或云端数据

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

### 🔥 SMTP 配置（重要！）

**⚠️ Supabase 免费版邮件限制：仅 2 封/小时**

为确保用户注册和密码重置功能正常，**必须配置自定义 SMTP 服务**。

推荐服务商：
- **Resend**（推荐）：3,000 封/月免费，无需信用卡
- **SendGrid**：3,000 封/月免费，行业标准
- **阿里云邮件推送**：6,000 封/月免费，适合国内用户

详细配置指南：查看项目根目录 `../email-template/SMTP配置指南.md`

邮件模板已准备：
- 注册确认邮件
- 密码重置邮件
- 魔法链接登录邮件

### Supabase 数据库结构

需要创建以下表：
- `profiles` - 用户信息和角色
- `pools` - 卡池数据
- `history` - 抽卡记录
- `admin_applications` - 管理员申请
- `announcements` - 系统公告

### 数据库迁移文件

项目包含以下迁移文件（位于 `supabase/migrations/`）：

| 文件 | 说明 |
|------|------|
| `002_global_stats_function.sql` | 基础全服统计 RPC 函数 |
| `003_global_stats_with_charts.sql` | 扩展全服统计，支持图表数据（分池类型统计、出货分布） |
| `015_superadmin_user_management.sql` | 超级管理员用户管理功能 |

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
| 后端服务 | Supabase (认证 + PostgreSQL 数据库 + RPC 函数 + Edge Functions) |
| 状态管理 | Redux Toolkit |
| 部署平台 | Vercel |

## 📂 项目结构

```
gacha-analyzer/
├── src/
│   ├── GachaAnalyzer.jsx        # 主组件（核心逻辑+UI）
│   ├── AuthModal.jsx            # 登录/注册弹窗（增强版）
│   ├── LoadingScreen.jsx        # 加载动画组件
│   ├── supabaseClient.js        # Supabase 客户端配置
│   ├── components/
│   │   ├── AdminPanel.jsx       # 超级管理员面板
│   │   ├── SettingsPanel.jsx    # 设置面板
│   │   ├── SummaryView.jsx      # 汇总视图
│   │   ├── InputSection.jsx     # 录入组件
│   │   ├── BatchCard.jsx        # 十连卡片
│   │   ├── TicketPanel.jsx      # 申请面板
│   │   ├── SimpleMarkdown.jsx   # Markdown 渲染
│   │   └── ui/
│   │       ├── Toast.jsx        # 提示组件
│   │       └── ConfirmDialog.jsx # 确认对话框
│   ├── main.jsx                 # 应用入口
│   ├── index.css                # 全局样式
│   └── assets/                  # 静态资源
├── public/
│   ├── announcements.json       # 公告配置文件
│   └── avatar.png               # 默认头像
├── supabase/
│   └── migrations/              # 数据库迁移文件
├── .env.example                 # 环境变量模板
└── dist/                        # 构建输出
```

## 🔧 主要功能模块

### 用户认证流程
1. **注册**：
   - 实时邮箱格式验证
   - 密码强度指示
   - 密码确认验证
   - 重复邮箱检测 + 智能引导登录
   - 发送验证邮件

2. **登录**：
   - 邮箱密码登录
   - 自动记住登录状态

3. **密码重置**：
   - 邮件方式重置
   - 安全验证链接

### GachaAnalyzer.jsx 组件结构
- **DashboardView** - 仪表盘视图，展示当前卡池统计
- **SummaryView** - 汇总视图，支持全服/个人数据对比
- **RecordsView** - 记录视图，详细抽卡历史
- **SettingsPanel** - 设置面板，数据管理和用户设置
- **AdminPanel** - 超级管理员面板（用户管理/申请审批/公告管理）
- **TenPullEditor** - 十连编辑器，快速录入
- **SinglePullButtons** - 单抽按钮，补录漏记

## 🎨 UI 设计特色

- **终末地风格**：
  - 工业科技感设计语言
  - 标志性黄色主题色 (`#fbbf24`)
  - 方正无圆角设计
  - 网格纹理背景

- **响应式设计**：
  - 完美适配桌面端和移动端
  - 暗色模式支持

- **交互体验**：
  - 即时反馈和验证
  - 友好的错误提示
  - 流畅的动画效果

## 📝 更新日志

### v2.1.0 (2024-12-04)
- ✨ 增强注册功能：实时邮箱验证、密码强度指示、密码确认
- ✨ 重复注册检测，智能引导登录
- ✨ 邮件方式密码重置
- ✨ 超级管理员用户管理（创建/编辑/删除用户）
- ✨ 用户搜索和角色筛选
- 🐛 修复登录弹窗×按钮不可点击问题
- 📧 添加自定义邮件模板（Endfield 风格）
- 📚 完善 SMTP 配置指南

### v2.0.0
- 初始版本发布

## 👥 制作团队

### 项目发起人
**蘑菇菌__** - 产品设计 & 项目管理
- [B站主页](https://space.bilibili.com/14932613)

### AI 开发助手
- **Claude** (Anthropic Claude Sonnet 4.5) - 架构设计 & 全栈开发 & 功能实现
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
