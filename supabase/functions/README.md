# Supabase Edge Functions

这里保留的是旧 Edge Functions 的兼容实现和说明，不是当前后台主链。

当前公开仓库的管理后台、公共缓存失效与相关超管动作已经收口到 Vercel Serverless `/api/admin` 和对应的 `/api/admin-*` 兼容路由。

## 历史兼容函数

该目录下保留两个旧超管函数，用于历史部署排障和兼容参考。新部署不应依赖它们作为后台用户管理主链。

## 鉴权边界

- 两个旧函数都要求调用方携带 `Authorization: Bearer <access_token>`
- 函数会先校验调用方的 Supabase 用户身份
- 随后使用 service role client 读取 `profiles.role`
- 只有 `super_admin` 可以继续执行管理动作

## Service Role 使用边界

- service role 仅在函数内部用于：
  - `auth.admin.createUser`
  - `auth.admin.deleteUser`
  - 更新 / 读取 `profiles`
- 前端永远不直接接触 service role key
- 如果你仍在维护旧函数，请同步检查 `_shared/admin.ts`
