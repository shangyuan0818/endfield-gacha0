# Edge Function 部署指南

## get-fingerprint 函数

### 功能
生成基于服务端的用户指纹，用于频率限制验证，防止客户端ID被篡改。

### 环境变量

在Supabase Dashboard中配置以下环境变量：

```bash
FINGERPRINT_SALT=your-random-secret-salt-here
```

**生成随机盐值**:
```bash
# 方法1: 使用openssl
openssl rand -base64 32

# 方法2: 使用Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 部署步骤

#### 1. 使用Supabase CLI部署

```bash
# 登录Supabase
supabase login

# 链接到你的项目
supabase link --project-ref your-project-ref

# 部署Edge Function
supabase functions deploy get-fingerprint

# 设置环境变量
supabase secrets set FINGERPRINT_SALT=your-secret-salt
```

#### 2. 手动在Dashboard部署

1. 进入Supabase Dashboard → Edge Functions
2. 点击"Create a new function"
3. 函数名称: `get-fingerprint`
4. 复制 `supabase/functions/get-fingerprint/index.ts` 的内容
5. 点击Deploy

### 测试

```bash
# 测试Edge Function
curl -X POST https://your-project.supabase.co/functions/v1/get-fingerprint \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"

# 预期响应:
# {
#   "fingerprint": "a1b2c3d4e5f6g7h8",
#   "allowed": true,
#   "timestamp": "2025-12-16T12:00:00.000Z"
# }
```

### 使用方法

在前端调用:

```javascript
// src/LoadingScreen.jsx
useEffect(() => {
  const verifyFingerprint = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-fingerprint`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (!data.allowed) {
        // 频率限制触发，显示错误
        alert('访问过于频繁，请稍后再试');
        return;
      }

      // 验证通过，继续加载
      console.log('Fingerprint verified:', data.fingerprint);
    } catch (error) {
      // 降级策略：Edge Function失败时允许访问
      console.warn('Fingerprint verification failed, fallback to allow');
    }
  };

  verifyFingerprint();
}, []);
```

### 安全说明

1. **指纹组成**: IP地址 + User-Agent + 密钥盐值
2. **频率限制**: 复用现有的 `check_and_log_rate_limit` RPC函数
3. **降级策略**: 如果Edge Function失败，允许访问（避免服务中断）
4. **隐私保护**: 不存储原始IP和User-Agent，仅存储哈希值

### 注意事项

⚠️ **FINGERPRINT_SALT** 必须保密，定期更换（建议每季度）

⚠️ 用户更换网络/设备会导致指纹变化，这是正常现象

⚠️ 不应完全依赖指纹验证，应配合Minecraft验证码使用
