import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const q = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!q.trim()) {
    return NextResponse.json([]);
  }

  try {
    // 从 funds_index 表搜索基金（轻量级索引表）
    // 支持基金代码和名称的模糊搜索
    const { data, error } = await supabase
      .from('funds_index')
      .select('code, name, type')
      .or(`code.ilike.%${q}%,name.ilike.%${q}%`)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[搜索] 数据库查询失败:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[搜索] 搜索失败:', error);
    return NextResponse.json([]);
  }
}