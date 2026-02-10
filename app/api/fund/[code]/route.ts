import { NextRequest, NextResponse } from 'next/server';
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

  console.log(`[API] 开始获取基金 ${code} 的实时估值数据...`);

  // 强制从新浪财经获取实时数据（不使用任何缓存）
  try {
    const fundData = await dataFetcher.calculateFundEstimate(code);

    if (!fundData) {
      return NextResponse.json(
        {
          error: `未找到基金代码 "${code}" 的估值数据。\n\n可能原因：\n1. 基金代码不正确（请输入6位数字代码）\n2. 该基金尚未成立或已清盘\n3. 数据源暂时无法获取该基金信息（如 QDII 基金、海外基金等）\n4. 网络连接问题，请稍后重试\n\n建议：\n- 在首页搜索框中输入基金代码或名称，查看是否有搜索建议\n- 如果是新基金，可能需要等待数据更新`
        },
        { status: 404 }
      );
    }

    console.log(`[API] 基金 ${code} 实时数据获取成功: ${fundData.name}, 估值: ${fundData.estimate_value}, 涨跌幅: ${fundData.change_percent}%`);

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