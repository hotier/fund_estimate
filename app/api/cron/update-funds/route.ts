import { NextRequest, NextResponse } from 'next/server';
import dataFetcher from '@/lib/services/dataFetcherV2';
import cacheService from '@/lib/services/cacheServiceV2';
import redisCache from '@/lib/services/redisCache';

/**
 * 定时任务：更新热门基金数据
 * 配置：每5分钟执行一次（仅在工作日 9:00-15:00）
 */
export async function GET(request: NextRequest) {
  try {
    // 验证 Cron Job 密钥（防止被外部调用）
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // 如果不是来自 Vercel Cron，检查是否手动触发
      const { searchParams } = new URL(request.url);
      const manualToken = searchParams.get('token');
      
      if (manualToken !== process.env.ADMIN_TOKEN) {
        return NextResponse.json(
          { error: '未授权访问' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] 开始执行定时数据同步任务');

    // 检查是否在交易时间
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const dayOfWeek = now.getDay();
    
    // 工作日：周一到周五 (1-5)
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    // 交易时间：9:30 - 15:00
    const isTradingHours = (hour === 9 && minute >= 30) || (hour >= 10 && hour < 15);
    
    if (!isWeekday) {
      console.log('[Cron] 今天不是工作日，跳过同步');
      return NextResponse.json({
        success: true,
        message: '今天不是工作日，跳过同步',
        skipped: true,
        timestamp: now.toISOString(),
      });
    }

    if (!isTradingHours) {
      console.log('[Cron] 当前不在交易时间，跳过同步');
      return NextResponse.json({
        success: true,
        message: '当前不在交易时间，跳过同步',
        skipped: true,
        timestamp: now.toISOString(),
      });
    }

    // 热门基金列表（从缓存或数据库获取）
    const hotFunds = [
      '000001', '000002', '000008', '000011', '000016',
      '000021', '000024', '000031', '000039', '000043',
    ];

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      updatedFunds: [] as string[],
    };

    // 批量更新热门基金
    for (const fundCode of hotFunds) {
      try {
        // 清除旧缓存，强制获取最新数据
        await cacheService.delete(`fund:estimate:${fundCode}`);
        
        // 获取最新数据
        const fundData = await dataFetcher.calculateFundEstimate(fundCode);
        
        if (fundData) {
          // 缓存新数据
          await cacheService.set(`fund:estimate:${fundCode}`, fundData, 30);
          results.success++;
          results.updatedFunds.push(fundCode);
          console.log(`[Cron] 更新成功: ${fundCode}`);
        } else {
          results.failed++;
          results.errors.push(`${fundCode}: 未获取到数据`);
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        results.errors.push(`${fundCode}: ${errorMsg}`);
        console.error(`[Cron] 更新失败 ${fundCode}:`, errorMsg);
      }
      
      // 添加延迟，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('[Cron] 定时任务完成:', results);

    return NextResponse.json({
      success: true,
      message: `同步完成，成功 ${results.success} 只，失败 ${results.failed} 只`,
      timestamp: now.toISOString(),
      isTradingHours,
      results,
    });

  } catch (error) {
    console.error('[Cron] 定时任务执行失败:', error);
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST 请求：手动触发同步特定基金
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fundCodes, token } = body;

    // 验证管理员令牌
    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    if (!fundCodes || !Array.isArray(fundCodes) || fundCodes.length === 0) {
      return NextResponse.json(
        { error: '请提供基金代码列表' },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      updatedFunds: [] as Array<{ code: string; name: string; change: number }>,
    };

    for (const fundCode of fundCodes) {
      try {
        await cacheService.delete(`fund:estimate:${fundCode}`);
        const fundData = await dataFetcher.calculateFundEstimate(fundCode);
        
        if (fundData) {
          await cacheService.set(`fund:estimate:${fundCode}`, fundData, 30);
          results.success++;
          results.updatedFunds.push({
            code: fundData.code,
            name: fundData.name,
            change: fundData.change_percent,
          });
        } else {
          results.failed++;
          results.errors.push(`${fundCode}: 未获取到数据`);
        }
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        results.errors.push(`${fundCode}: ${errorMsg}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    return NextResponse.json({
      success: true,
      message: `同步完成，成功 ${results.success} 只，失败 ${results.failed} 只`,
      results,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
