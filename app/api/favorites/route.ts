import { NextRequest, NextResponse } from 'next/server';
import { addFavorite, validateUserAccess } from '@/lib/services/auth-service';

/**
 * POST /api/favorites - 添加自选基金
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fundCode, holdings, totalProfit, groupId } = body;

    if (!fundCode) {
      return NextResponse.json(
        { success: false, error: '基金代码不能为空' },
        { status: 400 }
      );
    }

    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证用户身份
    const { userId } = await validateUserAccess(token || null);

    // 添加自选基金
    const favorite = await addFavorite(userId, fundCode, {
      groupId,
      holdings: holdings ? parseFloat(holdings) : 0,
      totalProfit: totalProfit ? parseFloat(totalProfit) : 0,
    });

    return NextResponse.json({
      success: true,
      message: '添加成功',
      data: favorite,
    });
  } catch (error: any) {
    console.error('添加自选基金失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '添加失败，请重试' },
      { status: error.message === '未登录，请先登录' || error.message === '用户不存在' ? 401 : 500 }
    );
  }
}

/**
 * GET /api/favorites - 获取用户的自选基金列表
 */
export async function GET(request: NextRequest) {
  try {
    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证用户身份
    const { userId } = await validateUserAccess(token || null);

    // 获取自选基金列表
    const favorites = await (await import('@/lib/services/auth-service')).getUserFavorites(userId);

    return NextResponse.json({
      success: true,
      data: favorites,
    });
  } catch (error: any) {
    console.error('获取自选基金失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '获取失败，请重试' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/favorites - 删除自选基金
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const favoriteId = searchParams.get('id');

    if (!favoriteId) {
      return NextResponse.json(
        { success: false, error: '自选基金ID不能为空' },
        { status: 400 }
      );
    }

    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证用户身份
    await validateUserAccess(token || null);

    // 删除自选基金
    await (await import('@/lib/services/auth-service')).removeFavorite(favoriteId);

    return NextResponse.json({
      success: true,
      message: '删除成功',
    });
  } catch (error: any) {
    console.error('删除自选基金失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '删除失败，请重试' },
      { status: 401 }
    );
  }
}