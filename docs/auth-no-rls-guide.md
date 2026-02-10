# 用户认证与权限控制 - 代码层实现指南

## 概述

本方案通过代码层实现用户认证和权限控制，不使用数据库的 RLS（Row Level Security）功能。

---

## 第一步：设置数据库

### 1. 在 Supabase SQL Editor 执行以下 SQL

执行文件：`lib/supabase/user-auth-schema-simple.sql`

这个 SQL 文件会创建：
- `user_profiles` - 用户配置表
- `user_groups` - 用户分组表
- `user_favorites` - 自选基金表
- 自动触发器和函数

### 2. 配置 Supabase Auth

1. 在 Supabase Dashboard 进入 Authentication → Settings
2. 启用 Email 认证
3. 配置重定向 URL：
   - `http://localhost:3000/auth/callback`
   - `https://yourdomain.com/auth/callback`

### 3. 获取 Service Role Key

1. 在 Supabase Dashboard 进入 Settings → API
2. 复制 `service_role` secret key
3. 在 `.env.local` 中添加：

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

⚠️ **重要**：Service Role Key 只能在服务器端使用，不要提交到代码仓库！

---

## 第二步：初始化第一个管理员

### 使用初始化脚本

```bash
# 在项目根目录运行
node scripts/init-admin.js admin@example.com admin123456
```

这会创建一个管理员账号，可以直接登录使用。

---

## 第三步：配置 AuthProvider

在 `app/layout.tsx` 中包裹应用：

```tsx
'use client';

import { AuthProvider } from '@/contexts/AuthContext';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
```

---

## 第四步：创建登录/注册页面

### 登录页面 (`app/auth/signin/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function SignInPage() {
  const { signIn, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await signIn(email, password);
      window.location.href = '/';
    } catch (err: any) {
      setError(err.message || '登录失败');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-center mb-6">登录</h2>
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary text-white rounded-md"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <p className="text-center mt-4">
          还没有账号？{' '}
          <Link href="/auth/signup" className="text-primary hover:underline">
            注册
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### 注册页面 (`app/auth/signup/page.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

export default function SignUpPage() {
  const { signUp, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码至少需要6位');
      return;
    }

    try {
      await signUp(email, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || '注册失败');
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow text-center">
          <div className="text-green-500 text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold mb-2">注册成功！</h2>
          <p className="text-gray-600 mb-6">
            您的账号已创建，可以直接登录。
          </p>
          <Link
            href="/auth/signin"
            className="inline-block px-6 py-2 bg-primary text-white rounded-md"
          >
            去登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-bold text-center mb-6">注册</h2>
        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">密码（至少6位）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
              minLength={6}
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">确认密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary text-white rounded-md"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>
        <p className="text-center mt-4">
          已有账号？{' '}
          <Link href="/auth/signin" className="text-primary hover:underline">
            登录
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

## 第五步：使用 API

### 管理员 API

#### 获取所有用户

```typescript
// GET /api/admin/users
const response = await fetch('/api/admin/users');
const { data, success } = await response.json();
```

#### 创建用户

```typescript
// POST /api/admin/users
const response = await fetch('/api/admin/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    display_name: '用户名称',
    role: 'user',
  }),
});
```

#### 更新用户

```typescript
// PUT /api/admin/users/[id]
const response = await fetch(`/api/admin/users/${userId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    role: 'user',
    is_active: true,
  }),
});
```

#### 删除用户

```typescript
// DELETE /api/admin/users/[id]
const response = await fetch(`/api/admin/users/${userId}`, {
  method: 'DELETE',
});
```

#### 重置密码

```typescript
// POST /api/admin/users/[id]/reset-password
const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    new_password: 'newPassword123',
  }),
});
```

---

## 第六步：权限控制示例

### 在 API 路由中使用

```typescript
import { validateUserAccess } from '@/lib/supabase/auth-service';

export async function GET(request: NextRequest) {
  // 验证用户登录
  const { user, profile } = await validateUserAccess(false);
  
  // 或者验证管理员权限
  // const { user, profile } = await validateUserAccess(true);

  return NextResponse.json({ user, profile });
}
```

### 在客户端使用

```typescript
import { useAuth } from '@/contexts/AuthContext';

export default function MyComponent() {
  const { user, userProfile, authenticated } = useAuth();

  if (!authenticated) {
    return <div>请先登录</div>;
  }

  if (userProfile?.role !== 'admin') {
    return <div>权限不足</div>;
  }

  return <div>管理员内容</div>;
}
```

---

## 权限控制流程

### 用户访问数据流程

```
用户请求 → API 路由 → validateUserAccess() 
                      ↓
                   检查用户登录
                      ↓
                   检查账号状态
                      ↓
                   检查用户角色
                      ↓
                   执行数据库操作
                      ↓
                   返回数据
```

### 权限验证函数

```typescript
// 验证用户是否登录
await validateUserAccess(false);

// 验证用户是否为管理员
await validateUserAccess(true);
```

---

## 安全特性

| 特性 | 说明 |
|------|------|
| **代码层权限控制** | 通过 `validateUserAccess()` 函数实现 |
| **用户隔离** | 所有 API 都验证 user_id |
| **角色管理** | admin（管理员）、user（普通用户） |
| **账号激活** | 可以禁用/启用用户账号 |
| **自我保护** | 管理员不能删除/修改自己的账号 |
| **Service Role Key** | 仅在服务器端使用，用于管理操作 |

---

## 常见问题

### Q: 如何检查用户权限？

A: 使用 `validateUserAccess()` 函数：

```typescript
// 验证用户登录
const { user } = await validateUserAccess(false);

// 验证管理员权限
const { user } = await validateUserAccess(true);
```

### Q: 如何禁用某个用户？

A: 使用管理员 API：

```typescript
await fetch(`/api/admin/users/${userId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ is_active: false }),
});
```

### Q: 如何防止用户访问其他用户的数据？

A: 在所有 API 路由中验证 user_id：

```typescript
// 获取当前用户
const { user } = await validateUserAccess(false);

// 只查询当前用户的数据
const { data } = await supabase
  .from('user_favorites')
  .select('*')
  .eq('user_id', user.id);  // 只查询自己的数据
```

### Q: 管理员可以查看所有用户数据吗？

A: 可以。管理员 API 使用 `validateUserAccess(true)` 验证管理员权限后，可以查询所有数据。

---

## 下一步

1. ✅ 执行数据库 SQL 脚本
2. ✅ 配置 SUPABASE_SERVICE_ROLE_KEY
3. ✅ 运行初始化脚本创建管理员
4. ✅ 创建登录/注册页面
5. ✅ 在 API 路由中使用权限控制
6. ✅ 测试用户管理功能

---

## 联系支持

如有问题，请参考：
- 项目文档：`docs/user-auth-design.md`
- 管理员指南：`docs/admin-guide.md`
- 认证服务：`lib/supabase/auth-service.ts`