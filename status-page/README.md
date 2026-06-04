# 独立服务状态页

这个目录是 `STATUS-001` 的独立部署骨架。它是纯静态页面，只读取主站公开接口：

```text
https://ef-gacha.mogujun.icu/api/site-status
```

目标是让主站之外也能访问服务状态，方便用户判断“是自己网络问题，还是站点服务异常”。页面不直接连接数据库、邮件服务器、SSH、内网后端或任何管理员接口。

## 本地预览

直接打开 `index.html` 即可预览页面结构。若要测试真实数据，浏览器需要能访问上面的公开状态接口。

## 部署方式

首期建议新建一个单独的 Vercel 项目，把 `status-page/` 作为项目根目录部署。这样主站构建或路由异常时，状态页仍尽量可访问。

部署前需要确认：

- 状态页域名，例如 `status.example.com`。
- 公开状态接口地址，默认是 `https://ef-gacha.mogujun.icu/api/site-status`。
- 是否继续使用 Vercel 静态部署，还是改用 Cloudflare Pages 等静态托管。

如需改接口地址，可在部署平台注入或替换 `window.STATUS_PAGE_CONFIG.endpoint`，也可以在 `index.html` 里修改默认值。不要把管理员接口、服务端密钥、数据库连接串或内部域名写入这里。

## 验证

```bash
npm run test:independent-status-page
```

验证会检查：

- 页面只引用本目录静态文件。
- 默认接口是公开 `/api/site-status`。
- 不出现后台凭据、内部服务名称、数据库私有域名、内网地址或管理员接口等敏感内容。
- 不引用主站管理员 API 或私有 API。
