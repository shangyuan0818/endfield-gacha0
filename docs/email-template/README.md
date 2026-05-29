# 终末地抽卡分析器 - Supabase 邮件模板

> 当前目录是历史 Supabase 邮件模板资产。后续账号安全、自建邮件平台、邮件防刷和 outbox 架构以 `../SELF_HOSTED_MAIL.md` 为准；不要再把第三方 SMTP 免费额度视为生产主线假设。

本文件夹包含了用于 Supabase 认证系统的自定义邮件模板，采用《明日方舟：终末地》工业科技风格设计。

## 📁 文件说明

| 文件名 | 用途 | Supabase 模板类型 |
|--------|------|-------------------|
| `confirm-signup.html` | 注册确认邮件 | Confirm signup |
| `magic-link.html` | 魔法链接登录邮件 | Magic Link |
| `reset-password.html` | 密码重置邮件 | Change Email Address / Reset Password |

## 🎨 设计特点

- **配色方案**：
  - 主色：`#fbbf24` 终末地标志性黄色
  - 深色背景：`#18181b` → `#27272a` 渐变
  - 文字：`#0f172a` / `#475569`

- **设计元素**：
  - 方正无圆角设计（border-radius: 0）
  - 工业网格背景纹理
  - Roboto Mono 等宽字体标题
  - 4px 黄色底边装饰

- **响应式设计**：
  - 最大宽度 600px
  - 支持桌面端和移动端邮件客户端

## 🚀 使用方法

### 1. 登录 Supabase Dashboard

访问 [Supabase Dashboard](https://app.supabase.com) 并选择您的项目。

### 2. 进入邮件模板设置

```
Project → Authentication → Email Templates
```

### 3. 复制模板代码

根据需要修改的邮件类型，打开对应的 HTML 文件，复制全部内容。

### 4. 粘贴并保存

在 Supabase 的对应模板编辑器中粘贴代码，点击保存。

## 📝 模板配置建议

### 邮件主题（Subject）

- **Confirm signup**：`【终末地分析器】验证您的邮箱 - Verify Your Email`
- **Magic Link**：`【终末地分析器】您的登录链接 - Sign In Link`
- **Reset Password**：`【终末地分析器】重置密码请求 - Password Reset`

### 发件人设置

- **发件人名称**：`终末地抽卡分析器` 或 `Endfield Gacha Analyzer`
- **回复邮箱**：设置一个可用的客服邮箱

### 重定向 URL

在 **Authentication → URL Configuration** 中配置：
- **Site URL**：您的应用主域名
- **Redirect URLs**：添加允许的回调地址

## 🔧 自定义修改

### 修改颜色

如需更改主题色，搜索并替换以下颜色值：

```css
/* 主黄色 */
#fbbf24 → 您的颜色

/* 深色背景 */
#18181b, #27272a → 您的颜色

/* 文字颜色 */
#0f172a, #475569 → 您的颜色
```

### 修改 Logo

在 `.logo-text` 区域修改：

```html
<div class="logo-box">
  <span class="logo-text">EF</span>  <!-- 修改为您的文字 -->
</div>
```

或替换为图片：

```html
<div class="logo-box">
  <img src="您的Logo链接" alt="Logo" style="height: 30px;">
</div>
```

### 修改文案

在对应的 HTML 文件中搜索以下内容进行修改：

- `指挥官，您好！` - 欢迎语
- `终末地抽卡分析器` - 应用名称
- Footer 链接和版权信息

## 🧪 测试建议

1. **测试邮件发送**：
   - 在 Supabase 中注册测试账号
   - 检查邮件是否正常接收
   - 确认按钮链接是否可用

2. **多端测试**：
   - Gmail
   - Outlook
   - QQ 邮箱/网易邮箱
   - 移动端邮件客户端

3. **垃圾邮件检查**：
   - 确认邮件未被标记为垃圾邮件
   - 必要时配置 SPF/DKIM 记录

## 📦 变量说明

模板中使用的 Supabase 内置变量：

| 变量 | 说明 |
|------|------|
| `{{ .ConfirmationURL }}` | 验证/登录/重置链接 |
| `{{ .Token }}` | 验证令牌（如需单独使用） |
| `{{ .Email }}` | 用户邮箱地址 |
| `{{ .SiteURL }}` | 网站主地址 |

## ⚠️ 注意事项

1. **链接有效期**：
   - 注册确认：24 小时
   - 魔法链接：1 小时
   - 密码重置：1 小时

2. **邮件客户端兼容性**：
   - 避免使用过于复杂的 CSS
   - 使用内联样式确保最佳兼容性
   - 本模板已针对主流客户端优化

3. **安全性**：
   - 链接包含安全令牌
   - 每个链接只能使用一次
   - 过期后自动失效

## 🔗 相关链接

- [Supabase 邮件模板文档](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase 认证配置](https://supabase.com/docs/guides/auth)

## 📄 许可证

本邮件模板作为终末地抽卡分析器项目的一部分，可自由使用和修改。

---

**© 2025 终末地抽卡分析器 | Endfield Gacha Analyzer**
