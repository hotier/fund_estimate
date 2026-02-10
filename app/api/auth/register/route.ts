import { NextRequest, NextResponse } from 'next/server';
import {
  registerUser,
  loginUser,
} from '@/lib/services/auth-service';

/**
 * POST /api/auth/register - 用户注册
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, display_name } = body;

    // 验证输入
    if (!email || !password) {
      throw new Error('邮箱和密码不能为空');
    }

    if (password.length < 6) {
      throw new Error('密码至少需要6位');
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('邮箱格式不正确');
    }

    // 注册用户
    const user = await registerUser(email, password, display_name);

    return NextResponse.json({
      success: true,
      message: '注册成功',
      data: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('注册失败:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}