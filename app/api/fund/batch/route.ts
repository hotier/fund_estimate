import { NextRequest, NextResponse } from 'next/server';

// 模拟基金数据
const mockFundData = {
  '000001': {
    code: '000001',
    name: '华夏成长混合',
    estimate_value: '1.2345',
    actual_value: '1.2300',
    change_percent: 0.37,
    update_time: new Date().toLocaleTimeString('zh-CN'),
    data_source: '天天基金',
  },
  '000002': {
    code: '000002',
    name: '华夏回报混合',
    estimate_value: '1.8765',
    actual_value: '1.8800',
    change_percent: -0.18,
    update_time: new Date().toLocaleTimeString('zh-CN'),
    data_source: '天天基金',
  },
  '000003': {
    code: '000003',
    name: '华夏现金增利货币',
    estimate_value: '1.0000',
    actual_value: '1.0000',
    change_percent: 0.01,
    update_time: new Date().toLocaleTimeString('zh-CN'),
    data_source: '天天基金',
  },
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const codesParam = searchParams.get('codes');

  if (!codesParam) {
    return NextResponse.json(
      { error: '请提供基金代码参数' },
      { status: 400 }
    );
  }

  const codes = codesParam.split(',');
  const result: any[] = [];

  // 模拟API延迟
  await new Promise(resolve => setTimeout(resolve, 200));

  for (const code of codes) {
    if (mockFundData[code]) {
      result.push(mockFundData[code]);
    } else {
      result.push({
        code,
        error: '基金代码不存在',
      });
    }
  }

  return NextResponse.json(result);
}