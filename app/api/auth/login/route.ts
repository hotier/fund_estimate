import { NextRequest, NextResponse } from 'next/server';
import {
  loginUser,
} from '@/lib/services/auth-service';

/**
 * POST /api/auth/login - 用户登录
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // 验证输入
    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: '邮箱和密码不能为空' },
        { status: 400 }
      );
    }

    // 登录用户
    const result = await loginUser(email, password);

    return NextResponse.json({
      success: true,
      message: '登录成功',
      data: result,
    });
  } catch (error: any) {
    console.error('登录失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '登录失败，请重试' },
      { status: 401 }
    );
  }
}