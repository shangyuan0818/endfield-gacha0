# 快速调试："认证失败: OK" 错误

## 🔍 立即检查 - 浏览器开发者工具

### 步骤 1: 打开浏览器控制台

1. 按 `F12` 打开开发者工具
2. 切换到 **Network (网络)** 标签
3. 勾选 **Preserve log (保留日志)**
4. 清空现有日志

### 步骤 2: 重现错误

1. 在网站上重新执行导入操作
2. 等待出现 "认证失败: OK" 错误

### 步骤 3: 查找失败的请求

在 Network 标签中:
1. 筛选 `hg-proxy` 或 `XHR/Fetch`
2. 找到状态码为 **400** 或 **500** 的红色请求
3. 点击该请求

### 步骤 4: 查看响应详情

在右侧面板中:

**Headers (请求头)**
```
Request URL: https://你的域名.vercel.app/api/hg-proxy?action=u8token
Status Code: 400 Bad Request
```

**Payload (请求体)**
```json
{
  "uid": "12345678",
  "appToken": "eyJhbGc..."
}
```

**Response (响应体)** - 这是关键!
```json
{
  "success": false,
  "error": "OK",
  "data": {
    "code": 1,
    "msg": "OK",
    "status": 0
  }
}
```

## 🎯 根据响应判断问题

### 情况 1: `{ "code": 1, "msg": "OK" }`

**含义**: 鹰角 API 返回了业务错误

**可能原因**:
- ✗ `uid` 和 `appToken` 不匹配
- ✗ Token 已过期 (24位token有效期约1小时)
- ✗ 账号未绑定终末地游戏

**解决方法**:
1. 重新获取 24 位 token (刷新鹰角官网页面)
2. 确认账号已绑定终末地
3. 检查是否选择了正确的账号

### 情况 2: 响应为 HTML 页面

**含义**: Vercel 返回了错误页面而非 JSON

**可能原因**:
- ✗ Serverless 函数崩溃
- ✗ 路由配置错误
- ✗ 函数超时 (>10秒)

**解决方法**:
1. 查看 Vercel 部署日志
2. 检查 `vercel.json` 配置
3. 确认最新代码已部署

### 情况 3: 网络错误 (Failed to fetch)

**含义**: 无法连接到服务器

**可能原因**:
- ✗ Vercel 服务暂时不可用
- ✗ 网络连接问题
- ✗ CORS 配置错误

**解决方法**:
1. 检查网络连接
2. 尝试刷新页面
3. 检查 Vercel 服务状态: https://www.vercel-status.com/

## 📊 Vercel 日志查看 (3种方法)

### 方法 1: Vercel Dashboard (最简单)

```
1. 访问: https://vercel.com/dashboard
2. 选择项目: endfield-gacha
3. 点击: Deployments → 最新部署 → Functions
4. 搜索: "hg-proxy" 或 "error"
```

### 方法 2: Vercel CLI (最详细)

```bash
# 安装 CLI
npm i -g vercel

# 登录
vercel login

# 实时查看日志
vercel logs --follow

# 查看最近1小时的日志
vercel logs --since=1h

# 只看错误
vercel logs | grep -i error
```

### 方法 3: 直接访问日志页面

```
https://vercel.com/你的用户名/endfield-gacha/logs
```

## 🛠️ 临时修复方案

### 方案 1: 增强错误信息 (推荐)

修改 `api/hg-proxy.js` 第 307-313 行:

```javascript
if (data.code !== 0) {
  const errorMsg = data.msg || data.message || 'Unknown error';
  
  // 添加详细日志
  console.error('[hg-proxy] U8Token failed:', {
    code: data.code,
    status: data.status,
    msg: errorMsg,
    uid: uid?.substring(0, 8) + '...',
    fullResponse: JSON.stringify(data)
  });
  
  return res.status(400).json({
    success: false,
    error: `U8Token 获取失败: ${errorMsg} (错误码: ${data.code})`,
    details: {
      code: data.code,
      status: data.status,
      hint: data.code === 1 ? 'Token可能已过期或账号不匹配' : '未知错误'
    }
  });
}
```

### 方案 2: 添加响应验证

在 `handleU8Token` 函数的 `fetch` 后添加:

```javascript
const response = await fetch(ENDPOINTS.U8TOKEN, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  },
  body: JSON.stringify({
    uid: uid,
    token: appToken
  })
});

// 新增: 检查响应类型
const contentType = response.headers.get('content-type');
if (!contentType || !contentType.includes('application/json')) {
  const text = await response.text();
  console.error('[hg-proxy] Non-JSON response from HyperGryph:', text.substring(0, 200));
  return res.status(500).json({
    success: false,
    error: '鹰角服务器返回了异常响应',
    preview: text.substring(0, 100)
  });
}

const data = await response.json();
```

## 🔄 部署修复后的代码

```bash
cd gacha-analyzer

# 提交修改
git add api/hg-proxy.js
git commit -m "fix: 增强 u8token 错误信息和响应验证"

# 推送到远程 (Vercel 会自动部署)
git push origin main
```

## 📞 如果问题仍未解决

请提供以下信息:

1. **浏览器 Network 面板截图**
   - 包含失败请求的 Response 内容

2. **Vercel 日志**
   ```bash
   vercel logs --since=1h > logs.txt
   ```

3. **错误发生时间**
   - 精确到分钟

4. **操作步骤**
   - 详细描述如何触发错误

---

**创建时间**: 2026-01-29  
**适用版本**: v3.0.0-Public
