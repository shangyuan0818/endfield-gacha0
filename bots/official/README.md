# Official Bot

第一阶段目标：

- 私聊内完成账号绑定验证码验证
- 只读查询本人抽卡摘要
- 只读查询本人各池当前概率与最近卡池状态
- 只读查询最近出货
- 读取公开榜单
- 查询下版本预计开启时间与下一限定池
- 提供回到网页的快捷按钮（主页 / 分析 / 分享 / 导入）

当前实现状态：

- `Telegram`：提供可直接运行的轮询版 BOT
- `Discord`：提供交互 payload 适配层，便于后续接 slash command webhook
- `QQ`：提供事件适配层，便于后续接官方频道/私聊消息回调

## 环境变量

基础配置：

- `OFFICIAL_BOT_BASE_URL`：站点 API 根地址，例如 `https://example.com`
- `OFFICIAL_BOT_SITE_URL`：站点前台地址，用于给用户回链
- `OFFICIAL_BOT_PUBLIC_API_KEY`：官方 BOT 只读 API Key
- `OFFICIAL_BOT_VERIFIER_SECRET`：官方 BOT 绑定验证 Secret

可按平台覆盖：

- `TELEGRAM_OFFICIAL_BOT_PUBLIC_API_KEY`
- `TELEGRAM_OFFICIAL_BOT_VERIFIER_SECRET`
- `DISCORD_OFFICIAL_BOT_PUBLIC_API_KEY`
- `DISCORD_OFFICIAL_BOT_VERIFIER_SECRET`
- `QQ_OFFICIAL_BOT_PUBLIC_API_KEY`
- `QQ_OFFICIAL_BOT_VERIFIER_SECRET`

Telegram 运行所需：

- `TELEGRAM_OFFICIAL_BOT_TOKEN`
- `TELEGRAM_OFFICIAL_BOT_POLL_INTERVAL_MS`（可选）
- `TELEGRAM_OFFICIAL_BOT_LONG_POLL_SECONDS`（可选）

## 本地启动 Telegram BOT

```bash
npm run bot:official:telegram
```

## 命令

- `/bind`
- `/verify ABCD1234`
- `/me`
- `/pools`
- `/current`
- `/next`
- `/recent 5`
- `/rank`
- `/help`

## 说明

- BOT 的常规查询始终只读，走 `/api/dev/v1/bot/*` 和公开只读接口
- 绑定验证单独走 `/api/integrations/bindings/verify`
- 导入完成通知中的“当前池”入口也通过官方 BOT 只读 API 解析，不直接复用站内聚合 builder
- `/pools` 会汇总当前绑定账号下各游戏账号、各卡池的抽数 / 当前垫抽 / 当前六星概率
- `/current` 会结合站点当前开放卡池，显示你在最近相关卡池上的概率状态
- `/next` 会读取站点配置中的首页下版本倒计时，并展示下一限定池（若已配置）
- Telegram 消息会附带网页跳转按钮，可直接打开首页、仪表盘、分享态或导入弹窗
- 网页导入成功后，若当前账号已绑定 Telegram，站点会向该 BOT 私聊推送一次“已更新”提示
- Discord / QQ 目前先提供统一命令适配层，等平台凭据和部署方式稳定后再接真实 webhook / gateway
