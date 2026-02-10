import { NextRequest, NextResponse } from 'next/server';
import { updateFavorite, validateUserAccess, removeFavorite } from '@/lib/services/auth-service';

/**
 * PUT /api/favorites/[id] - 更新自选基金
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { holdings, totalProfit } = body;

    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证用户身份
    await validateUserAccess(token || null);

    // 更新自选基金
    const updates: any = {};
    if (holdings !== undefined) updates.holdings = holdings;
    if (totalProfit !== undefined) updates.total_profit = totalProfit;

    const favorite = await updateFavorite(id, updates);

    return NextResponse.json({
      success: true,
      message: '更新成功',
      data: favorite,
    });
  } catch (error: any) {
    console.error('更新自选基金失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '更新失败，请重试' },
      { status: 401 }
    );
  }
}

/**
 * DELETE /api/favorites/[id] - 删除自选基金
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 从请求头获取 token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    // 验证用户身份
    await validateUserAccess(token || null);

    // 删除自选基金
    await removeFavorite(id);

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