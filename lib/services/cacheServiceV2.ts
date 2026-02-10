import { CACHE_TTL } from '../supabase/client';
import * as database from '../supabase/database';

// 缓存项接口
interface CacheItem<T> {
  value: T;
  expiry: number;
}

// 内存缓存（第一层缓存）
class MemoryCache {
  private cache: Map<string, CacheItem<any>> = new Map();

  set<T>(key: string, value: T, ttl: number): void {
    const expiry = Date.now() + ttl * 1000;
    this.cache.set(key, { value, expiry });
    console.log(`[内存缓存] 设置: ${key}, TTL: ${ttl}s`);
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      console.log(`[内存缓存] 过期: ${key}`);
      return null;
    }

    console.log(`[内存缓存] 命中: ${key}`);
    return item.value as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
    console.log(`[内存缓存] 删除: ${key}`);
  }

  clear(): void {
    this.cache.clear();
    console.log(`[内存缓存] 清空`);
  }

  // 清理过期缓存
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[内存缓存] 清理 ${cleaned} 个过期项`);
    }
  }
}

// 双层缓存服务
class CacheServiceV2 {
  private memoryCache: MemoryCache;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.memoryCache = new MemoryCache();
    // 每分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      this.memoryCache.cleanup();
    }, 60000);
  }

  // ===========================================
  // 基金基本信息缓存
  // ===========================================

  /**
   * 获取基金基本信息（先查内存缓存，再查数据库）
   */
  async getFundInfo(code: string): Promise<database.FundInfo | null> {
    // 第一层：内存缓存
    const memValue = this.memoryCache.get<database.FundInfo>(`fund:info:${code}`);
    if (memValue) return memValue;

    // 第二层：数据库
    const dbValue = await database.getFundInfo(code);
    if (dbValue) {
      // 写入内存缓存
      this.memoryCache.set(`fund:info:${code}`, dbValue, CACHE_TTL.FUND_INFO);
    }

    return dbValue;
  }

  /**
   * 保存基金基本信息
   */
  async setFundInfo(fund: database.FundInfo): Promise<void> {
    // 保存到数据库
    await database.upsertFundInfo(fund);
    // 写入内存缓存
    this.memoryCache.set(`fund:info:${fund.code}`, fund, CACHE_TTL.FUND_INFO);
  }

  /**
   * 批量保存基金基本信息
   */
  async batchSetFundInfo(funds: database.FundInfo[]): Promise<void> {
    // 保存到数据库
    await database.batchUpsertFundInfo(funds);
    // 写入内存缓存
    funds.forEach(fund => {
      this.memoryCache.set(`fund:info:${fund.code}`, fund, CACHE_TTL.FUND_INFO);
    });
  }

  // ===========================================
  // 重仓股信息缓存
  // ===========================================

  /**
   * 获取重仓股信息
   */
  async getStocks(fundCode: string, updateDate?: string): Promise<database.StockInfo[]> {
    const cacheKey = updateDate
      ? `fund:stocks:${fundCode}:${updateDate}`
      : `fund:stocks:latest:${fundCode}`;

    // 第一层：内存缓存
    const memValue = this.memoryCache.get<database.StockInfo[]>(cacheKey);
    if (memValue) return memValue;

    // 第二层：数据库
    const dbValue = await database.getStocks(fundCode, updateDate);
    if (dbValue && dbValue.length > 0) {
      // 写入内存缓存
      this.memoryCache.set(cacheKey, dbValue, CACHE_TTL.STOCKS);
    }

    return dbValue;
  }

  /**
   * 保存重仓股信息
   */
  async setStocks(stocks: database.StockInfo[]): Promise<void> {
    if (stocks.length === 0) return;

    const fundCode = stocks[0].fund_code;
    const updateDate = stocks[0].update_date;
    const cacheKey = `fund:stocks:${fundCode}:${updateDate}`;

    // 保存到数据库
    await database.upsertStocks(stocks);
    // 写入内存缓存
    this.memoryCache.set(cacheKey, stocks, CACHE_TTL.STOCKS);
    // 更新最新缓存
    this.memoryCache.set(`fund:stocks:latest:${fundCode}`, stocks, CACHE_TTL.STOCKS);
  }

  // ===========================================
  // 历史净值缓存
  // ===========================================

  /**
   * 获取历史净值数据
   */
  async getHistory(fundCode: string, days: number = 365): Promise<database.HistoryData[]> {
    const cacheKey = `fund:history:${fundCode}:${days}`;

    // 第一层：内存缓存
    const memValue = this.memoryCache.get<database.HistoryData[]>(cacheKey);
    if (memValue) return memValue;

    // 第二层：数据库
    const dbValue = await database.getHistory(fundCode, days);
    if (dbValue && dbValue.length > 0) {
      // 写入内存缓存
      this.memoryCache.set(cacheKey, dbValue, CACHE_TTL.HISTORY);
    }

    return dbValue;
  }

  /**
   * 保存历史净值数据
   */
  async setHistory(history: database.HistoryData[]): Promise<void> {
    if (history.length === 0) return;

    const fundCode = history[0].fund_code;
    const cacheKey = `fund:history:${fundCode}:365`;

    // 保存到数据库
    await database.upsertHistory(history);
    // 写入内存缓存
    this.memoryCache.set(cacheKey, history, CACHE_TTL.HISTORY);
  }

  // ===========================================
  // 通用缓存（用于实时估值等短期数据）
  // ===========================================

  /**
   * 获取通用缓存
   */
  get<T>(key: string): T | null {
    return this.memoryCache.get<T>(key);
  }

  /**
   * 设置通用缓存
   */
  set<T>(key: string, value: T, ttl?: number): void {
    const defaultTtl = CACHE_TTL.ESTIMATE;
    this.memoryCache.set(key, value, ttl || defaultTtl);
  }

  /**
   * 删除缓存
   */
  delete(key: string): void {
    this.memoryCache.delete(key);
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.memoryCache.clear();
  }

  /**
   * 删除基金相关缓存
   */
  clearFundCache(fundCode: string): void {
    this.memoryCache.delete(`fund:info:${fundCode}`);
    this.memoryCache.delete(`fund:stocks:latest:${fundCode}`);
    this.memoryCache.delete(`fund:history:${fundCode}:365`);
    console.log(`[缓存] 清理基金 ${fundCode} 的缓存`);
  }

  /**
   * 获取缓存统计信息
   */
  getStats(): { size: number; keys: string[] } {
    const cache = (this.memoryCache as any).cache;
    return {
      size: cache.size,
      keys: Array.from(cache.keys()),
    };
  }

  /**
   * 销毁缓存服务
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.memoryCache.clear();
  }
}

// 导出单例
const cacheServiceV2 = new CacheServiceV2();

export default cacheServiceV2;
export type { CacheItem };
export { MemoryCache };