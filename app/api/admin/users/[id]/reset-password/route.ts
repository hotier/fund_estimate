import { NextRequest, NextResponse } from 'next/server';
import {
  validateUserAccess,
  resetUserPassword,
} from '@/lib/services/auth-service';

/**
 * POST /api/admin/users/[id]/reset-password - 重置用户密码（仅管理员）
 */
export async function POST(
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

    // 防止重置自己的密码
    if (adminId === targetUserId) {
      throw new Error('不能重置自己的密码，请使用修改密码功能');
    }

    const body = await request.json();
    const { new_password } = body;

    // 验证密码
    if (!new_password) {
      throw new Error('新密码不能为空');
    }

    if (new_password.length < 6) {
      throw new Error('密码至少需要6位');
    }

    // 重置密码
    await resetUserPassword(targetUserId, new_password);

    return NextResponse.json({
      success: true,
      message: '密码重置成功',
    });
  } catch (error: any) {
    console.error('重置密码失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.message.includes('权限') ? 403 : 500 }
    );
  }
}