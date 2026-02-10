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
    console.log(`[搜索] 搜索查询: "${q}", 限制: ${limit}`);

    // 将查询字符串拆分成多个部分（按空格分割）
    const searchTerms = q.trim().split(/\s+/);

    // 从 funds_index 表搜索基金（轻量级索引表）
    let query = supabase
      .from('funds_index')
      .select('code, name, type');

    // 构建搜索条件
    const searchConditions: string[] = [];
    for (const term of searchTerms) {
      // 如果是6位数字，优先匹配代码
      if (/^\d{6}$/.test(term)) {
        searchConditions.push(`code.eq.${term}`);
      } else {
        // 否则在名称中模糊匹配
        searchConditions.push(`name.ilike.%${term}%`);
      }
    }

    // 如果有多个搜索条件，使用 AND 连接
    if (searchConditions.length > 0) {
      query = query.or(searchConditions.join(','));
    }

    const { data, error } = await query
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[搜索] 数据库查询失败:', error);
      return NextResponse.json([]);
    }

    console.log(`[搜索] 查询结果: 找到 ${data?.length || 0} 条记录`);
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('[搜索] 搜索失败:', error);
    return NextResponse.json([]);
  }
}