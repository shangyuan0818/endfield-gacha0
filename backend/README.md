# Endfield Gacha Proxy Server

独立部署的鹰角 API 代理服务器，用于替代 Vercel Serverless Functions（解决超时限制问题）。

## 部署方式

### 方式一：Railway（推荐，最简单）

1. 注册 [Railway](https://railway.app/) 账号
2. 点击 "New Project" → "Deploy from GitHub repo"
3. 选择你的仓库，设置根目录为 `backend/`
4. 添加环境变量：
   - `ALLOWED_ORIGINS`: 你的前端域名，如 `https://your-app.vercel.app`
5. 部署完成后获取域名，如 `https://xxx.railway.app`

### 方式二：Render

1. 注册 [Render](https://render.com/) 账号
2. 点击 "New" → "Web Service"
3. 连接 GitHub 仓库
4. 设置：
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `node server.js`
5. 添加环境变量 `ALLOWED_ORIGINS`

### 方式三：Docker

```bash
cd backend
docker build -t endfield-proxy .
docker run -p 3001:3001 -e ALLOWED_ORIGINS="https://your-app.vercel.app" endfield-proxy
```

### 方式四：VPS 直接运行

```bash
cd backend
npm install
PORT=3001 ALLOWED_ORIGINS="*" node server.js
```

使用 PM2 保持运行：
```bash
npm install -g pm2
pm2 start server.js --name endfield-proxy
pm2 save
pm2 startup
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务器端口 | `3001` |
| `ALLOWED_ORIGINS` | 允许的跨域来源（逗号分隔多个） | `*` |

## API 端点

所有端点都在 `/api/hg-proxy` 路径下：

- `POST /api/hg-proxy?action=grant` - 获取 app_token
- `GET /api/hg-proxy?action=bindings&appToken=xxx` - 获取绑定列表
- `POST /api/hg-proxy?action=u8token` - 获取 u8_token
- `GET /api/hg-proxy?action=records&u8Token=xxx` - 获取抽卡记录（单页）
- `POST /api/hg-proxy?action=records-batch` - 批量并发获取所有卡池记录

健康检查：`GET /health`

## 前端配置

部署后，需要在前端配置后端地址。在 `.env` 或 `.env.production` 中添加：

```env
VITE_PROXY_URL=https://your-backend-domain.railway.app
```

然后修改 `src/utils/endfieldAuthChain.js`，将：

```javascript
const PROXY_BASE = '/api/hg-proxy';
```

改为：

```javascript
const PROXY_BASE = import.meta.env.VITE_PROXY_URL 
  ? `${import.meta.env.VITE_PROXY_URL}/api/hg-proxy`
  : '/api/hg-proxy';
```
