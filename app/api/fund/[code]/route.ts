import { NextRequest, NextResponse } from 'next/server';
import cacheService from '@/lib/services/cacheServiceV2';
import dataFetcher from '@/lib/services/dataFetcherV2';

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: { code: string };
  }
) {
  const { code } = params;
  const cacheKey = `fund:estimate:${code}`;

  // 尝试从缓存获取数据（内存缓存）
  const cachedData = cacheService.get(cacheKey);
  if (cachedData) {
    console.log(`[API] 缓存命中: ${code}`);
    return NextResponse.json(cachedData);
  }

  // 从新浪财经获取基金数据（会自动保存到 Supabase）
  try {
    const fundData = await dataFetcher.calculateFundEstimate(code);

    if (!fundData) {
      return NextResponse.json(
        {
          error: `未找到基金代码 "${code}"。请确认：\n1. 基金代码是否正确（6位数字）\n2. 该基金是否已成立\n3. 尝试在基金索引中搜索该基金`
        },
        { status: 404 }
      );
    }

    // 缓存数据，过期时间30秒（实时估值）
    cacheService.set(cacheKey, fundData, 30);

    return NextResponse.json(fundData);
  } catch (error) {
    console.error('[API] 获取基金数据失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    return NextResponse.json(
      {
        error: `获取基金数据失败：${errorMessage}。请稍后重试或检查基金代码是否正确。`
      },
      { status: 500 }
    );
  }
}