# 管理员功能使用指南

## 概述

本系统支持管理员手动创建和管理用户账号，无需邮件服务即可使用。

---

## 第一步：获取 Service Role Key

1. 登录 Supabase Dashboard
2. 进入 Settings → API
3. 复制 `service_role` secret key（注意：这个 key 只能在服务器端使用）

⚠️ **重要**：Service Role Key 可以绕过所有 RLS 策略，请妥善保管！

---

## 第二步：配置环境变量

在项目根目录的 `.env.local` 文件中添加：

```bash
# Supabase 配置（已有）
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# 新增：管理员 Service Role Key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## 第三步：初始化第一个管理员

### 方法一：使用初始化脚本（推荐）

```bash
# 在项目根目录运行
node scripts/init-admin.js admin@example.com admin123456
```

参数说明：
- `admin@example.com` - 管理员邮箱
- `admin123456` - 管理员密码（至少6位）

### 方法二：手动在数据库中创建

在 Supabase SQL Editor 中执行：

```sql
-- 1. 创建用户（使用 auth.admin.createUser 函数）
-- 注意：这需要在应用层使用 service_role key 调用

-- 2. 创建用户配置
INSERT INTO user_profiles (id, email, display_name, role, is_active)
VALUES (
  'user-uuid-here',
  'admin@example.com',
  '管理员',
  'admin',
  TRUE
);

-- 3. 创建默认分组
INSERT INTO user_groups (user_id, name, is_default, sort_order)
VALUES ('user-uuid-here', '全部', TRUE, 0);
```

---

## 第四步：登录管理员账号

1. 访问 `http://localhost:3000/auth/signin`
2. 输入管理员邮箱和密码
3. 登录成功后，可以访问管理功能

---

## 管理员功能

### 1. 创建普通用户

```typescript
import { adminCreateUser } from '@/lib/supabase/admin';

// 创建普通用户
const result = await adminCreateUser(
  'user@example.com',
  'password123',
  '用户显示名称',
  'user' // 角色：'admin' 或 'user'
);

console.log(result);
```

### 2. 查看所有用户

```typescript
import { adminGetAllUsers } from '@/lib/supabase/admin';

const users = await adminGetAllUsers(adminId);
console.log(users);
```

### 3. 更新用户信息

```typescript
import { adminUpdateUser } from '@/lib/supabase/admin';

await adminUpdateUser(adminId, targetUserId, {
  role: 'user',
  is_active: true,
  display_name: '新名称',
});
```

### 4. 重置用户密码

```typescript
import { adminResetPassword } from '@/lib/supabase/admin';

await adminResetPassword(adminId, targetUserId, 'newPassword123');
```

### 5. 删除用户

```typescript
import { adminDeleteUser } from '@/lib/supabase/admin';

await adminDeleteUser(adminId, targetUserId);
```

### 6. 批量创建用户

```typescript
import { adminBatchCreateUsers } from '@/lib/supabase/admin';

const result = await adminBatchCreateUsers([
  {
    email: 'user1@example.com',
    password: 'password123',
    displayName: '用户1',
    role: 'user',
  },
  {
    email: 'user2@example.com',
    password: 'password456',
    displayName: '用户2',
    role: 'user',
  },
]);

console.log(`成功: ${result.success}, 失败: ${result.failed}`);
console.log('错误:', result.errors);
```

---

## 创建管理后台页面

### 管理员用户列表页面 (`app/admin/users/page.tsx`)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  adminGetAllUsers, 
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser 
} from '@/lib/supabase/admin';

export default function AdminUsersPage() {
  const { user, userProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 检查是否为管理员
  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (isAdmin && user) {
      loadUsers();
    }
  }, [isAdmin, user]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminGetAllUsers(user.id);
      setUsers(data);
    } catch (error: any) {
      alert(`加载用户列表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    const email = prompt('请输入用户邮箱:');
    const password = prompt('请输入用户密码（至少6位）:');
    
    if (!email || !password) return;
    
    try {
      await adminCreateUser(email, password, email.split('@')[0], 'user');
      alert('创建成功');
      loadUsers();
    } catch (error: any) {
      alert(`创建失败: ${error.message}`);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
          权限不足：只有管理员可以访问此页面
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
        <button
          onClick={handleCreateUser}
          className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
        >
          创建用户
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  邮箱
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  显示名称
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  角色
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状态
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  基金数量
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  创建时间
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {user.display_name || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role === 'admin' ? '管理员' : '普通用户'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? '激活' : '禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {user.total_funds}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-sm">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {user.id !== user.id && (
                      <button
                        onClick={async () => {
                          if (confirm(`确定要删除用户 ${user.email} 吗？`)) {
                            try {
                              await adminDeleteUser(user.id, user.id);
                              alert('删除成功');
                              loadUsers();
                            } catch (error: any) {
                              alert(`删除失败: ${error.message}`);
                            }
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        删除
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

---

## 安全注意事项

### 1. Service Role Key 安全

⚠️ **Service Role Key 可以绕过所有安全策略，请务必：**

- ✅ 只在服务器端使用
- ✅ 永远不要提交到代码仓库
- ✅ 定期轮换
- ✅ 限制访问权限

### 2. 管理员账号安全

- ✅ 使用强密码（至少12位，包含大小写字母、数字、特殊字符）
- ✅ 定期更换密码
- ✅ 限制管理员数量
- ✅ 记录管理员操作日志

### 3. 权限控制

- ✅ 使用 RLS 策略确保数据隔离
- ✅ 管理员可以查看所有用户数据
- ✅ 管理员不能删除自己的账号
- ✅ 管理员不能修改自己的管理员权限

---

## 常见问题

### Q: 如何创建第二个管理员？

A: 使用管理员账号登录后，调用 `adminCreateUser` 并设置 `role: 'admin'`。

### Q: 用户忘记密码怎么办？

A: 管理员可以使用 `adminResetPassword` 函数重置用户密码。

### Q: 如何禁用某个用户？

A: 使用 `adminUpdateUser` 函数，设置 `is_active: false`。

### Q: 可以删除管理员账号吗？

A: 不可以。管理员不能删除自己的账号，也不能修改自己的管理员权限。

### Q: 如何查看管理员操作日志？

A: 可以在 `user_profiles` 表的 `updated_at` 字段追踪最后修改时间，或者添加审计日志表。

---

## 下一步

1. ✅ 配置 SUPABASE_SERVICE_ROLE_KEY
2. ✅ 运行初始化脚本创建管理员
3. ✅ 登录管理员账号
4. ✅ 创建管理后台页面
5. ✅ 开始管理用户

---

## 联系支持

如有问题，请参考：
- [Supabase 管理员 API 文档](https://supabase.com/docs/reference/javascript/auth-admin)
- [项目文档](../docs/user-auth-design.md)