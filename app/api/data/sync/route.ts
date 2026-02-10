import { NextRequest, NextResponse } from 'next/server';
import dataFetcherV2 from '@/lib/services/dataFetcherV2';
import cacheService from '@/lib/services/cacheServiceV2';
import * as database from '@/lib/supabase/database';

/**
 * 数据同步 API
 * POST /api/data/sync
 *
 * 参数:
 * - codes: 基金代码列表，逗号分隔
 * - force: 是否强制刷新缓存
 *
 * 用途: 同步基金数据到 Supabase 数据库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { codes, force = false } = body;

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json(
        { error: '请提供基金代码列表' },
        { status: 400 }
      );
    }

    console.log(`[同步] 开始同步 ${codes.length} 只基金的数据`);

    const results: {
      code: string;
      success: boolean;
      name?: string;
      error?: string;
    }[] = [];

    for (const code of codes) {
      try {
        console.log(`[同步] 处理基金: ${code}`);

        // 如果强制刷新，清除缓存
        if (force) {
          cacheService.clearFundCache(code);
          console.log(`[同步] 已清除基金 ${code} 的缓存`);
        }

        // 获取基金数据（会自动保存到数据库）
        const estimate = await dataFetcherV2.calculateFundEstimate(code);

        if (estimate) {
          results.push({
            code,
            success: true,
            name: estimate.name,
          });
        } else {
          results.push({
            code,
            success: false,
            error: '获取基金数据失败',
          });
        }
      } catch (error) {
        console.error(`[同步] 处理基金 ${code} 失败:`, error);
        results.push({
          code,
          success: false,
          error: error instanceof Error ? error.message : '未知错误',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    console.log(`[同步] 完成，成功: ${successCount}, 失败: ${failCount}`);

    return NextResponse.json({
      success: true,
      message: `同步完成，成功 ${successCount} 只，失败 ${failCount} 只`,
      results,
    });
  } catch (error) {
    console.error('[同步] API 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
      },
      { status: 500 }
    );
  }
}

/**
 * 获取缓存统计信息
 * GET /api/data/sync
 */
export async function GET() {
  try {
    const stats = await cacheService.getStats();
    const fundCount = await database.getFundCount();
    const recentlyUpdated = await database.getRecentlyUpdatedFunds(5);

    return NextResponse.json({
      success: true,
      data: {
        cache: {
          size: stats.memory.size,
          keys: stats.memory.keys,
        },
        database: {
          fundCount,
          recentlyUpdated,
        },
      },
    });
  } catch (error) {
    console.error('[统计] API 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器错误',
      },
      { status: 500 }
    );
  }
}