# Endfield Gacha Analyzer (终末地抽卡分析器)

A full-featured gacha pull tracker and analytics tool for *Arknights: Endfield*, with cloud sync, multi-user collaboration, and server-wide statistics.

一个功能完善的抽卡记录分析工具，专为《明日方舟：终末地》设计，支持云端同步、多用户协作和全服数据统计。

[![Version](https://img.shields.io/github/package-json/v/MoguJunn/endfield-gacha?filename=package.json)](https://github.com/MoguJunn/endfield-gacha/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![React](https://img.shields.io/badge/React-19-61DAFB.svg)
![Vite](https://img.shields.io/badge/Vite-7-646CFF.svg)
![Supabase](https://img.shields.io/badge/Supabase-Cloud-3ECF8E.svg)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC.svg)

<p align="center">
  <a href="https://ef-gacha.mogujun.icu/">在线体验 / Live Demo</a>
</p>

## 预览 / Preview

| 桌面端首页 | 全服统计 |
|:---:|:---:|
| ![Homepage](docs/screenshots/homepage.png) | ![Statistics](docs/screenshots/statistics.png) |

| 抽卡模拟器 | 移动端 |
|:---:|:---:|
| ![Simulator](docs/screenshots/simulator.png) | ![Mobile](docs/screenshots/mobile-home.png) |

## 核心功能 / Features

- **多卡池支持** — 限定角色池（80 保底 / 120 硬保 / 240 赠送）、武器池（40 保底 / 80 硬保）、常驻池（80 保底 / 300 自选）
- **官方 API 导入** — 通过 Token 一键导入完整抽卡记录，智能去重、实时进度、区服纠错
- **数据可视化** — 全服 / 个人数据对比、稀有度分布、出货趋势、保底进度与时间线
- **抽卡模拟器** — 真实还原游戏内概率模型（含软保底机制）、资源系统与分享导出
- **双语界面** — `zh-CN / en-US` 切换、字体链分流、桌面端与移动端共用 i18n 基座
- **移动端重写** — 独立移动端路由与工业风 UI，支持亮暗主题、底栏导航、移动端详情/统计/模拟器
- **云端同步** — 登录后数据自动同步，支持 JSON / CSV 导入导出、账号级导入新鲜度
- **用户系统** — 邮箱认证、4 级权限体系（游客→用户→管理员→超管）、账号恢复申请、人机验证
- **公告与自动化** — 官方公告 feed、站内公告双语输入、运营自动化运行审计、公告图片站内代理
- **管理后台** — 角色/武器数据同步、卡池管理、公告管理、用户管理、站点配置、自动化审计

## 技术栈 / Tech Stack

| 类别 | 技术 |
|------|------|
| 核心框架 | React 19 + Vite 7 |
| UI 样式 | Tailwind CSS v4 + Lucide React |
| 数据可视化 | Recharts 3 |
| 状态管理 | Zustand 5 |
| 后端服务 | Supabase (Auth + PostgreSQL + Realtime + Edge Functions) |
| 部署 | Vercel (前端 + Serverless) + Supabase |

## 快速开始 / Getting Started

### 在线使用

访问 **[ef-gacha.mogujun.icu](https://ef-gacha.mogujun.icu/)** 即可直接使用（无需安装）。

### 本地开发

前提版本：

- Node.js: `^20.19.0 || >=22.12.0`
- npm: `>=10.8.2 <12`（仓库当前锁定 `packageManager: npm@11.2.0`）

```bash
git clone https://github.com/MoguJunn/endfield-gacha.git
cd gacha-analyzer
npm install
cp .env.example .env  # 编辑 .env 填入 Supabase 配置
npm run dev            # 启动前端（公开仓库默认可运行）
```

公开仓库默认包含前端、Serverless API、Supabase migrations 和 Edge Functions。

仓库当前使用 `package-lock.json` 作为唯一包管理锁文件；建议使用 `npm`，并通过 `.nvmrc` / `.npmrc` 对齐运行时与安装行为。

涉及游戏数据抓取的本地代理 / 独立后端因为合规与版权风险默认不纳入本仓库。如需导入链路，请在私有环境中接入单独维护的代理服务；否则公开仓库仍可用于基础浏览、统计、登录、云同步和管理功能开发。

### 可选私有后端脚本

以下脚本现在都改成了“私有 backend 存在时执行，不存在时输出提示并退出”，因此 fresh clone 不会再直接报路径错误：

```bash
npm run dev:backend
npm run dev:backend:cn
npm run dev:backend:intl
npm run test:harness
```

如果你的本地工作区没有 `backend/`，这些命令会明确提示“当前公开仓库不包含私有 backend”，而不会把公开仓库直接跑成死链。

### 公开仓库验证入口

```bash
npm test
```

当前会顺序执行公开仓库内可复跑的核心验证脚本（模拟器继承、情报书资源口径、导入导出 round-trip、导入持久化、bootstrap cache、Supabase baseline）。私有 `backend/test-harness` 仍通过 `npm run test:harness` 单独维护。

补充验证入口：

```bash
npm run lint
npm run test:unit
npm run build
```

当前 GitHub Actions 也执行这三类检查，并额外覆盖 `npm run test:dashboard-ordering`。`verify-supabase-baseline` 已修正为跨平台路径一致，不再因 Windows / Linux 路径分隔符差异误报。

若需对 Supabase baseline 做一次真实数据库 smoke，可在本机启动 Docker Desktop 后执行：

```bash
npm run test:supabase-baseline:smoke
```

该脚本会拉起临时 PostgreSQL 容器，注入最小 Supabase `auth` stub，再执行 `baseline/000_complete_schema.sql`。

### 本地静态头像同步

为降低 Supabase `Cached Egress` 与 Storage 占用，头像主链已改为优先落到站点静态目录 `public/avatars/`，再把 `characters.avatar_url` 写成站点本地路径。

```bash
npm run sync:local-avatars        # 基于 Warfarin Wiki 同步站点本地头像
npm run fetch:skland-images       # 基于森空岛图鉴同步站点本地头像
```

两条脚本都会把图片下载到 `public/avatars/`，随后更新数据库中的 `avatar_url`。完成后仍需把本地静态文件提交并推送，部署后线上才会真正切到本地头像。

## 环境变量

```env
VITE_SUPABASE_URL=你的Supabase项目URL
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx       # 浏览器端只读公开 key；旧 VITE_SUPABASE_ANON_KEY 仍兼容
VITE_APP_URL=https://your-domain.vercel.app           # 站点公开地址 / Auth 回跳 / Serverless allow-origin
VITE_PROXY_URL_CN=https://your-cn-proxy.example.com   # 可选，国服导入代理
VITE_PROXY_URL_INTL=https://your-intl-proxy.example.com # 可选，国际服导入代理
VITE_PUZZLE_PLAYER_URL=https://your-player.example.com  # 可选，验证码玩家站
SUPABASE_SECRET_KEY=sb_secret_xxx                     # 仅服务端使用；旧 SUPABASE_SERVICE_ROLE_KEY 仍兼容
```

**账号恢复边界**：当前版本不再提供邮件找回密码。用户需先提交账号恢复申请，经超管核验后以临时密码方式恢复登录；临时密码通过 QQ 群 `1080983185` 线下发放。

**SMTP 配置**：仅在你仍需要邮箱注册确认等邮件能力时再配置。账号恢复流程本身不依赖 SMTP。

**导出与分享边界**：JSON / CSV 导出用于备份与再导入，保留结构化记录字段；站内分享卡与分享文本默认采用脱敏口径，不包含账号、UID、精确时间戳与原始抽卡明细。

## 部署 / Deployment

### Vercel 部署

1. Fork 仓库 → 在 [Supabase](https://supabase.com) 创建项目
2. 新环境可直接执行 `supabase/baseline/000_complete_schema.sql` 起库；当前基线已覆盖到 `098_add_pool_name_en.sql`
3. 启用 `global_stats` 表的 Realtime
4. 如需账号恢复 / bootstrap / 受限管理接口，给 Vercel Serverless Functions 配置 `SUPABASE_SECRET_KEY`（旧 `SUPABASE_SERVICE_ROLE_KEY` 仍兼容）
5. 若要启用邮箱注册确认，再额外配置 SMTP
6. 在 [Vercel](https://vercel.com) 导入仓库，配置环境变量后部署

### 私有代理（可选）

涉及游戏数据抓取的代理/后端不属于当前公开仓库主链的审计与发布范围。若你确实需要导入链路，请在私有仓库或私有部署环境中单独维护，并通过 `VITE_PROXY_URL_CN / VITE_PROXY_URL_INTL`（或单一 `VITE_PROXY_URL` 兼容口）接入。

### 数据库

需要的表：`profiles`、`pools`、`history`、`characters`、`announcements`、`global_stats`、`rate_limits`、`tickets`、`ticket_replies`、`site_config`

数据库脚本现已分层：

- `supabase/baseline/`：新环境基线 schema（由 `npm run generate:supabase-baseline` 从归档链 + 当前迁移链生成）
- `supabase/archive/`：历史标准迁移归档，仅用于审计与生成 baseline
- `supabase/migrations/`：当前标准前向迁移链
- `supabase/manual/`：破坏性 / 高风险 / 回滚 / 数据回填脚本，仅手工执行
- `supabase/docs/`：迁移说明文档

当前 `baseline/000_complete_schema.sql` 已覆盖到 `098_add_pool_name_en.sql`。新环境可直接执行 baseline 起库；若后续新增了编号更高的迁移，再只补执行“覆盖范围之后”的标准前向迁移。不要再把同一批 `migrations/` 叠加执行在同版本 baseline 之上。

当前后台管理接口主链已收口到 Vercel Serverless `api/admin.js`，并通过 `vercel.json` rewrite 兼容旧的 `admin-users / admin-delete-user / admin-user-reset-password / admin-ops-automation` 路径；不再要求额外部署同名 Supabase Edge Functions。

## 项目结构

```
gacha-analyzer/
├── api/                    # Vercel Serverless Functions
├── supabase/
│   ├── baseline/           # 新环境基线 schema
│   ├── migrations/         # 标准前向迁移链
│   ├── manual/             # 仅手工执行的危险 / 历史脚本
│   ├── docs/               # Supabase 迁移说明
│   └── functions/          # Supabase Edge Functions
├── scripts/                # 公开仓库内的开发辅助脚本
├── src/
│   ├── components/         # UI 组件
│   │   ├── admin/          # 管理面板 (panels/)
│   │   ├── common/         # 通用组件
│   │   ├── dashboard/      # 卡池分析
│   │   ├── home/           # 首页模块
│   │   └── layout/         # 布局 (Header, Footer, Sidebar)
│   ├── hooks/              # 自定义 Hooks (admin/ app/ summary/)
│   ├── services/           # 业务逻辑层 (admin/ cache/ sync/ stats)
│   ├── stores/             # Zustand 状态管理
│   ├── utils/              # 工具函数
│   ├── features/           # 功能模块 (simulator/ import/)
│   ├── mobile/             # 移动端 (components/ layouts/ views/)
│   └── constants/          # 常量配置
├── docs/                   # 补充文档（screenshots/、reviews/）
├── vite.config.js
├── vercel.json
└── .env.example
```

## 更新日志 / Changelog

### v4.0.0 (2026-04-16)
- 接入中文 `Judou Sans SE`、英文 `Space Grotesk` 与数字 `IBM Plex Mono` 字体链；前瞻特别节目倒计时卡继续保留 `Noto Serif SC`
- 站内公告补齐英文标题 / 英文正文输入；前台英文环境优先显示英文，空字段自动回退中文
- 官方游戏公告改为前端优先直连 feed，并补齐稳定摘要派生、公告图片站内代理、防盗链规避与代理路径归一化修复
- 管理后台用户管理补齐全量加载、用户名/邮箱/用户 ID 搜索、删除用户、管理员重置密码与虚拟滚动；后台默认改为按页签延迟读取，避免首次整表拉取
- 建立最小可用 CI 与前端单测底座，公开验证链现覆盖 `lint / dashboard-ordering / npm test / test:unit / build`
- 移动端主路由与新壳层已进入主线：`/m`、`/m/overview`、`/m/details`、`/m/stats`、`/m/simulator`；移动端语言切换、亮暗主题、首页子页、总览 / 统计 / 详情主链已接入
- 卡池英文名链路已打通：数据库新增 `pools.name_en`，管理页可维护英文卡池名，公开读取链与展示链同步支持
- 分享链继续收口：紧凑统计布局、本地资源图标、时间线简化、二维码品牌区、Firefox 首次“预生成”卡死修复
- Vercel Hobby 12 个函数上限已收口：5 个 `admin-*` 函数合并为单个 `api/admin.js`

### v3.5.0 (2026-03-12)
- 增加公共 bootstrap 只读代理，聚合站点配置与公共卡池，并把全服统计改为按需拉取
- 加载界面改为预热 + 限时等待 + 后台补齐，修复 trusted session 刷新卡死并补长加载提示
- 记录页导出增强，支持按时间 / 卡池 / 账号过滤，JSON / CSV 同步扩展元数据
- 国际服导入改为公开 token 入口 + 全后端代跑，支持国服 / 国际服分流与双后端部署
- 真实卡池详情补齐情报书来源标记，出货统计保留原柱状图
- 统一资源统计口径：武器池只统计总消耗，武库配额获得仅按角色池计算
- 头像同步改为站点本地静态资源链，停止依赖 Supabase Storage avatars bucket
- 修复模拟器跨池 120 抽硬保循环、继承后资源异常与武库配额负值归零

### v3.3.1 (2026-02-24)
- 修复移动端登出不完整（未清除 Supabase 会话）
- 统一桌面端/移动端主题持久化
- 新增移动端工单系统
- 移动端管理面板路由接入
- 站点配置可编辑化（数据库驱动）

### v3.3.0 (2026-02-05)
- 移动端 UI 全面重构（Endfield 工业设计语言）
- XSS 防护升级（rehype-sanitize）
- 全服统计精度校准（歪率判定重构）
- SummaryView 模块化拆分

### v3.2.0 (2026-02-05)
- 武器池数据导入修复（seqId 去重增加 pool_id 维度）
- 大文件拆分重构（PoolManagement 缩减 85%）
- CSS 动画收敛、代码库清理（删除 22 个未使用文件）

### v3.1.0 (2026-02-01)
- 请求队列管理器 + 指数退避重试
- 模拟器切换卡池状态修复
- 导入排队实时信息展示

### v3.0.0 (2026-02-01)
- 官方 API 数据导入功能
- 移除手动录入，统一使用 API 导入

### v2.8.0 (2025-12-29)
- "急"按钮全局点击统计（Realtime 同步）

### v2.5.0 - v2.7.3 (2025-12)
- 首页重构、页面内容管理、公告更新检测
- Markdown 编辑器升级、限定 6 星彩虹渐变主题
- 大量 UI 优化和 Bug 修复

### v2.0.0 - v2.4.x (2024-12 ~ 2025-12)
- 初始版本发布、架构重构、安全加固

## 安全特性

- Supabase Auth + 账号恢复申请 / 超管核验 / 临时密码人工发放
- RLS 行级安全策略
- API 频率限制 + 前后端参数验证
- DOMPurify + rehype-sanitize XSS 防护

## 制作团队

**蘑菇菌__** - 项目发起人 / 产品设计 & 项目管理 — [Bilibili](https://space.bilibili.com/14932613)

AI 开发助手：
- **Claude** (Anthropic) - 架构设计 & 全栈开发
- **Gemini** (Google) - UI 设计咨询

## 贡献

欢迎提交 Issue 或 Pull Request！

1. Fork 仓库 → 创建特性分支 → 提交更改 → 发起 PR

## 引用与鸣谢

本项目的开发离不开以下项目和服务：

**数据来源**
- [Warfarin Wiki](https://warfarin.wiki) — 角色 / 武器数据及静态资源图片

**基础设施**
- [Supabase](https://supabase.com) — 认证、数据库与实时功能
- [Vercel](https://vercel.com) — 前端部署与 Serverless Functions

**素材**
- [Transparent Textures](https://www.transparenttextures.com/) — 背景纹理
- [Lucide](https://lucide.dev/) — 图标库

**特别感谢**
- [上海鹰角网络科技有限公司](https://www.hypergryph.com/) — 感谢创造了《明日方舟：终末地》这款优秀的游戏

## 许可证

MIT License — 详见 [LICENSE](LICENSE)

## 联系方式

- 项目主页：https://github.com/MoguJunn/endfield-gacha
- 问题反馈：[GitHub Issues](https://github.com/MoguJunn/endfield-gacha/issues)

---

*本项目为粉丝自制工具，与游戏官方无关。游戏内容版权归 Gryphline / HyperGryph 所有。*
