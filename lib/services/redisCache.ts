import { Redis } from '@upstash/redis';

// Redis 缓存层（第二层缓存）
class RedisCache {
  private redis: Redis | null = null;
  private isEnabled: boolean = false;

  constructor() {
    // 只在服务端初始化
    if (typeof window === 'undefined') {
      const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
      const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (redisUrl && redisToken) {
        try {
          this.redis = new Redis({
            url: redisUrl,
            token: redisToken,
          });
          this.isEnabled = true;
          console.log('[Redis] 缓存服务已初始化');
        } catch (error) {
          console.error('[Redis] 初始化失败:', error);
        }
      } else {
        console.log('[Redis] 未配置环境变量，跳过初始化');
      }
    }
  }

  /**
   * 检查 Redis 是否可用
   */
  isAvailable(): boolean {
    return this.isEnabled && this.redis !== null;
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.set(key, JSON.stringify(value), { ex: ttl });
      console.log(`[Redis] 设置: ${key}, TTL: ${ttl}s`);
    } catch (error) {
      console.error(`[Redis] 设置失败 ${key}:`, error);
    }
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;

    try {
      const value = await this.redis.get<string>(key);
      if (value) {
        console.log(`[Redis] 命中: ${key}`);
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      console.error(`[Redis] 获取失败 ${key}:`, error);
      return null;
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.del(key);
      console.log(`[Redis] 删除: ${key}`);
    } catch (error) {
      console.error(`[Redis] 删除失败 ${key}:`, error);
    }
  }

  /**
   * 批量删除缓存
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.redis) return;

    try {
      // Upstash Redis 不支持 keys 命令，使用 scan
      const keys: string[] = [];
      let cursor = '0';
      
      do {
        const result = await this.redis.scan(cursor, { match: pattern, count: 100 });
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');

      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`[Redis] 批量删除 ${keys.length} 个键，模式: ${pattern}`);
      }
    } catch (error) {
      console.error(`[Redis] 批量删除失败 ${pattern}:`, error);
    }
  }

  /**
   * 清空所有缓存（谨慎使用）
   */
  async flushAll(): Promise<void> {
    if (!this.redis) return;

    try {
      await this.redis.flushall();
      console.log('[Redis] 清空所有缓存');
    } catch (error) {
      console.error('[Redis] 清空失败:', error);
    }
  }

  /**
   * 获取 Redis 统计信息
   */
  async getStats(): Promise<{ dbsize: number } | null> {
    if (!this.redis) return null;

    try {
      const dbsize = await this.redis.dbsize();
      return { dbsize };
    } catch (error) {
      console.error('[Redis] 获取统计信息失败:', error);
      return null;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    if (!this.redis) return false;

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      console.error('[Redis] 健康检查失败:', error);
      return false;
    }
  }
}

// 导出单例
const redisCache = new RedisCache();

export default redisCache;
