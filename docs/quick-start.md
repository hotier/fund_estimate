# 快速设置指南 - 用户认证与权限控制（代码层实现）

## 📋 概述

本方案通过代码层实现用户认证和权限控制，不使用数据库的 RLS 功能。

---

## 🚀 快速开始（3步）

### 第一步：设置数据库

在 Supabase SQL Editor 中执行以下 SQL：

```sql
-- 执行文件：lib/supabase/user-auth-schema-simple.sql
```

这会创建：
- `user_profiles` - 用户配置表
- `user_groups` - 用户分组表
- `user_favorites` - 自选基金表
- 自动触发器和函数

### 第二步：配置环境变量

在 `.env.local` 中添加：

```bash
SUPABASE_SERVICE_ROLE_KEY=你的service-role-key
```

⚠️ 从 Supabase Dashboard → Settings → API 中获取

### 第三步：初始化管理员

```bash
node scripts/init-admin.js admin@example.com admin123456
```

---

## ✅ 完成！

现在你可以：

1. **登录管理员账号**
   - 访问 `http://localhost:3000/auth/signin`
   - 使用刚才创建的管理员账号登录

2. **创建普通用户**
   - 使用管理员 API 创建用户
   - 或用户自行注册

3. **管理用户**
   - 使用 `/api/admin/users` 相关 API
   - 创建、更新、删除、重置密码

---

## 📚 详细文档

- **完整指南**：`docs/auth-no-rls-guide.md`
- **数据库 Schema**：`lib/supabase/user-auth-schema-simple.sql`
- **认证服务**：`lib/supabase/auth-service.ts`
- **管理员 API**：
  - `app/api/admin/users/route.ts`
  - `app/api/admin/users/[id]/route.ts`
  - `app/api/admin/users/[id]/reset-password/route.ts`

---

## 🔐 权限控制

所有 API 路由都通过 `validateUserAccess()` 函数验证权限：

```typescript
// 验证用户登录
const { user } = await validateUserAccess(false);

// 验证管理员权限
const { user } = await validateUserAccess(true);
```

---

## 📊 用户角色

| 角色 | 权限 |
|------|------|
| **user** | 只能访问自己的数据 |
| **admin** | 可以查看和管理所有用户数据 |

---

## 🎯 下一步

1. ✅ 执行数据库 SQL
2. ✅ 配置环境变量
3. ✅ 初始化管理员
4. ✅ 登录测试
5. ✅ 开始使用

---

## ⚠️ 重要提示

- **Service Role Key** 只能在服务器端使用
- **不要提交到代码仓库**
- **定期轮换**
- **限制访问权限**

---

## 🆘 常见问题

### Q: 如何创建管理员？

A: 运行 `node scripts/init-admin.js admin@example.com admin123456`

### Q: 如何创建普通用户？

A: 使用管理员 API：

```typescript
POST /api/admin/users
{
  "email": "user@example.com",
  "password": "password123",
  "role": "user"
}
```

### Q: 如何禁用用户？

A: 使用管理员 API：

```typescript
PUT /api/admin/users/[id]
{
  "is_active": false
}
```

---

## 📞 联系支持

详细文档请查看 `docs/auth-no-rls-guide.md`