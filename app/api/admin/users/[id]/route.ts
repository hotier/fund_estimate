import { NextRequest, NextResponse } from 'next/server';
import {
  validateUserAccess,
  updateUser,
  resetUserPassword,
  deleteUser,
  adminGetUserStats,
} from '@/lib/services/auth-service';

/**
 * PUT /api/admin/users/[id] - 更新用户信息（仅管理员）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证管理员权限
    if (!token) {
      throw new Error('未提供认证令牌');
    }
    const { userId: adminId } = await validateUserAccess(token, true);
    const targetUserId = params.id;

    // 防止修改自己
    if (adminId === targetUserId) {
      throw new Error('不能修改自己的账号信息');
    }

    const body = await request.json();
    const { role, is_active, display_name } = body;

    // 验证输入
    if (role && !['admin', 'user'].includes(role)) {
      throw new Error('角色只能是 admin 或 user');
    }

    // 更新用户
    const user = await updateUser(targetUserId, {
      ...(role !== undefined && { role }),
      ...(is_active !== undefined && { is_active }),
      ...(display_name !== undefined && { display_name }),
    });

    return NextResponse.json({
      success: true,
      message: '用户更新成功',
      data: user,
    });
  } catch (error: any) {
    console.error('更新用户失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('权限') ? 403 : 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id] - 删除用户（仅管理员）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证管理员权限
    if (!token) {
      throw new Error('未提供认证令牌');
    }
    const { userId: adminId } = await validateUserAccess(token, true);
    const targetUserId = params.id;

    // 防止删除自己
    if (adminId === targetUserId) {
      throw new Error('不能删除自己的账号');
    }

    // 检查目标用户是否存在
    const { data: user } = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/users?token=${token}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    ).then(res => res.json());

    const targetUser = (user as any).data?.find((u: any) => u.id === targetUserId);
    if (!targetUser) {
      throw new Error('用户不存在');
    }

    // 防止删除其他管理员
    if (targetUser.role === 'admin') {
      throw new Error('不能删除管理员账号');
    }

    // 删除用户
    await deleteUser(targetUserId);

    return NextResponse.json({
      success: true,
      message: '用户删除成功',
    });
  } catch (error: any) {
    console.error('删除用户失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('权限') ? 403 : 500 }
    );
  }
}