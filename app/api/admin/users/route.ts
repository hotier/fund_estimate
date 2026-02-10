import { NextRequest, NextResponse } from 'next/server';
import {
  validateUserAccess,
  getAllUsers,
  createUser,
  updateUser,
  resetUserPassword,
  deleteUser,
} from '@/lib/services/auth-service';

/**
 * GET /api/admin/users - 获取所有用户列表（仅管理员）
 */
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证管理员权限
    if (!token) {
      throw new Error('未提供认证令牌');
    }
    const { role } = await validateUserAccess(token, true);

    // 获取所有用户
    const users = await getAllUsers();

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error: any) {
    console.error('获取用户列表失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('权限') ? 403 : 500 }
    );
  }
}

/**
 * POST /api/admin/users - 创建用户（仅管理员）
 */
export async function POST(request: NextRequest) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证管理员权限
    if (!token) {
      throw new Error('未提供认证令牌');
    }
    const { userId: adminId } = await validateUserAccess(token, true);

    const body = await request.json();
    const { email, password, display_name, role = 'user' } = body;

    // 验证输入
    if (!email || !password) {
      throw new Error('邮箱和密码不能为空');
    }

    if (password.length < 6) {
      throw new Error('密码至少需要6位');
    }

    if (!['admin', 'user'].includes(role)) {
      throw new Error('角色只能是 admin 或 user');
    }

    // 创建用户
    const user = await createUser(adminId, email, password, display_name, role);

    return NextResponse.json({
      success: true,
      message: '用户创建成功',
      data: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
        is_active: user.is_active,
      },
    });
  } catch (error: any) {
    console.error('创建用户失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('权限') ? 403 : 500 }
    );
  }
}