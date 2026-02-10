import { NextResponse } from 'next/server';
import dataFetcher from '@/lib/services/dataFetcherV2';
import cacheService from '@/lib/services/cacheServiceV2';
import redisCache from '@/lib/services/redisCache';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    sinaFinance: {
      status: 'healthy' | 'unhealthy';
      responseTime: number;
      message: string;
    };
    redis: {
      status: 'healthy' | 'unhealthy';
      message: string;
      stats?: {
        dbsize: number;
      };
    };
    memoryCache: {
      status: 'healthy';
      size: number;
    };
    database: {
      status: 'healthy' | 'unhealthy';
      message: string;
    };
  };
  overall: {
    uptime: string;
    version: string;
    environment: string;
  };
}

/**
 * 数据源健康检查 API
 * 检查所有依赖服务的健康状态
 */
export async function GET() {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      sinaFinance: {
        status: 'unhealthy',
        responseTime: 0,
        message: '',
      },
      redis: {
        status: 'unhealthy',
        message: '',
      },
      memoryCache: {
        status: 'healthy',
        size: 0,
      },
      database: {
        status: 'unhealthy',
        message: '',
      },
    },
    overall: {
      uptime: process.uptime().toFixed(0) + 's',
      version: process.env.npm_package_version || '0.1.0',
      environment: process.env.NODE_ENV || 'development',
    },
  };

  // 检查新浪财经数据源
  try {
    const testCode = '000001'; // 使用一只稳定的基金作为测试
    const sinaStart = Date.now();
    
    // 尝试获取一只基金的数据
    const testData = await dataFetcher.calculateFundEstimate(testCode);
    const sinaResponseTime = Date.now() - sinaStart;

    if (testData && testData.code === testCode) {
      health.services.sinaFinance = {
        status: 'healthy',
        responseTime: sinaResponseTime,
        message: `响应时间: ${sinaResponseTime}ms`,
      };
    } else {
      health.services.sinaFinance = {
        status: 'unhealthy',
        responseTime: sinaResponseTime,
        message: '返回数据异常',
      };
      health.status = 'degraded';
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '连接失败';
    health.services.sinaFinance = {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: errorMsg,
    };
    health.status = 'degraded';
  }

  // 检查 Redis 缓存
  try {
    const redisHealthy = await redisCache.healthCheck();
    const redisStats = await redisCache.getStats();

    if (redisHealthy) {
      health.services.redis = {
        status: 'healthy',
        message: '连接正常',
        stats: redisStats || undefined,
      };
    } else {
      health.services.redis = {
        status: 'unhealthy',
        message: '连接失败',
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '检查失败';
    health.services.redis = {
      status: 'unhealthy',
      message: errorMsg,
    };
  }

  // 检查内存缓存
  try {
    const cacheStats = await cacheService.getStats();
    health.services.memoryCache = {
      status: 'healthy',
      size: cacheStats.memory.size,
    };
  } catch (error) {
    health.services.memoryCache = {
      status: 'healthy',
      size: 0,
    };
  }

  // 检查数据库（Supabase）
  try {
    // 尝试获取缓存统计信息，这会触发数据库查询
    const cacheStats = await cacheService.getStats();
    health.services.database = {
      status: 'healthy',
      message: '连接正常',
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '连接失败';
    health.services.database = {
      status: 'unhealthy',
      message: errorMsg,
    };
    health.status = 'degraded';
  }

  // 确定总体状态
  const unhealthyServices = Object.values(health.services).filter(
    (s) => s.status === 'unhealthy'
  ).length;
  
  if (unhealthyServices >= 2) {
    health.status = 'unhealthy';
  } else if (unhealthyServices >= 1) {
    health.status = 'degraded';
  }

  const totalResponseTime = Date.now() - startTime;

  return NextResponse.json({
    ...health,
    responseTime: `${totalResponseTime}ms`,
  }, {
    status: health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
    },
  });
}

/**
 * 获取详细的数据源状态
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, token } = body;

    // 验证管理员令牌
    if (token !== process.env.ADMIN_TOKEN) {
      return NextResponse.json(
        { error: '未授权访问' },
        { status: 401 }
      );
    }

    if (type === 'cache-stats') {
      // 获取详细的缓存统计
      const stats = await cacheService.getStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    if (type === 'clear-cache') {
      // 清空所有缓存
      await cacheService.clear();
      return NextResponse.json({
        success: true,
        message: '缓存已清空',
      });
    }

    if (type === 'test-fund') {
      // 测试特定基金数据获取
      const { fundCode } = body;
      if (!fundCode) {
        return NextResponse.json(
          { error: '请提供基金代码' },
          { status: 400 }
        );
      }

      const startTime = Date.now();
      const fundData = await dataFetcher.calculateFundEstimate(fundCode);
      const responseTime = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        fundCode,
        responseTime: `${responseTime}ms`,
        data: fundData,
      });
    }

    return NextResponse.json(
      { error: '未知的操作类型' },
      { status: 400 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
