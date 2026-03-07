# Supabase Edge Functions

当前仓库版本化管理的 Edge Functions:

- `admin-create-user`
- `admin-delete-user`

## 鉴权边界

- 两个函数都要求调用方携带 `Authorization: Bearer <access_token>`
- 函数会先校验调用方的 Supabase 用户身份
- 随后使用 service role client 读取 `profiles.role`
- 只有 `super_admin` 可以继续执行管理动作

## Service Role 使用边界

- service role 仅在函数内部用于:
  - `auth.admin.createUser`
  - `auth.admin.deleteUser`
  - 更新 / 读取 `profiles`
- 前端永远不直接接触 service role key
- 如果你调整权限模型，请同步修改 `_shared/admin.ts`
