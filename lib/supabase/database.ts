import { supabase, TABLES } from './client';

// 基金基本信息类型
export interface FundInfo {
  id?: string;
  code: string;
  name: string;
  type?: string;
  manager?: string;
  company?: string;
  establish_date?: string;
  risk_level?: string;
  scale?: number;
  fee_rate?: number;
  created_at?: string;
  updated_at?: string;
}

// 重仓股信息类型
export interface StockInfo {
  id?: string;
  fund_code: string;
  stock_code: string;
  stock_name: string;
  proportion: number;
  change_percent?: number;
  shares?: number;
  market_value?: number;
  update_date: string;
  created_at?: string;
}

// 历史净值类型
export interface HistoryData {
  id?: string;
  fund_code: string;
  nav_date: string;
  nav_value: number;
  accumulated_value?: number;
  daily_return?: number;
  created_at?: string;
}

// ===========================================
// 基金索引操作
// ===========================================

/**
 * 添加基金到索引表
 */
export async function addFundToIndex(fund: { code: string; name: string; type?: string }): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.FUNDS_INDEX)
    .upsert(fund, { onConflict: 'code' });

  if (error) {
    console.error('添加基金到索引失败:', error);
    return false;
  }

  return true;
}

/**
 * 从索引表搜索基金
 */
export async function searchFundIndex(query: string, limit: number = 10): Promise<any[]> {
  const searchTerm = `%${query}%`;

  const { data, error } = await supabase
    .from(TABLES.FUNDS_INDEX)
    .select('code, name, type')
    .or(`code.ilike.${searchTerm},name.ilike.${searchTerm}`)
    .limit(limit);

  if (error) {
    console.error('搜索基金索引失败:', error);
    return [];
  }

  return data || [];
}

// ===========================================
// 基金基本信息操作
// ===========================================

/**
 * 获取基金基本信息
 */
export async function getFundInfo(code: string): Promise<FundInfo | null> {
  const { data, error } = await supabase
    .from(TABLES.FUNDS)
    .select('*')
    .eq('code', code)
    .single();

  if (error) {
    console.error('获取基金信息失败:', error);
    return null;
  }

  return data;
}

/**
 * 保存或更新基金基本信息
 */
export async function upsertFundInfo(fund: FundInfo): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.FUNDS)
    .upsert(fund, { onConflict: 'code' });

  if (error) {
    console.error('保存基金信息失败:', error);
    return false;
  }

  return true;
}

/**
 * 批量保存基金基本信息
 */
export async function batchUpsertFundInfo(funds: FundInfo[]): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.FUNDS)
    .upsert(funds, { onConflict: 'code' });

  if (error) {
    console.error('批量保存基金信息失败:', error);
    return false;
  }

  return true;
}

// ===========================================
// 重仓股信息操作
// ===========================================

/**
 * 获取基金重仓股信息
 */
export async function getStocks(fundCode: string, updateDate?: string): Promise<StockInfo[]> {
  let query = supabase
    .from(TABLES.STOCKS)
    .select('*')
    .eq('fund_code', fundCode);

  if (updateDate) {
    query = query.eq('update_date', updateDate);
  } else {
    // 默认获取最新的重仓股数据
    query = query.order('update_date', { ascending: false }).limit(10);
  }

  const { data, error } = await query;

  if (error) {
    console.error('获取重仓股信息失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 保存重仓股信息（先删除旧数据再插入新数据）
 */
export async function upsertStocks(stocks: StockInfo[]): Promise<boolean> {
  if (stocks.length === 0) return true;

  const fundCode = stocks[0].fund_code;
  const updateDate = stocks[0].update_date;

  // 先删除该基金在该日期的所有重仓股数据
  const { error: deleteError } = await supabase
    .from(TABLES.STOCKS)
    .delete()
    .eq('fund_code', fundCode)
    .eq('update_date', updateDate);

  if (deleteError) {
    console.error('删除旧重仓股数据失败:', deleteError);
    return false;
  }

  // 插入新的重仓股数据
  const { error: insertError } = await supabase
    .from(TABLES.STOCKS)
    .insert(stocks);

  if (insertError) {
    console.error('保存重仓股信息失败:', insertError);
    return false;
  }

  return true;
}

// ===========================================
// 历史净值操作
// ===========================================

/**
 * 获取基金历史净值数据
 */
export async function getHistory(fundCode: string, days: number = 365): Promise<HistoryData[]> {
  const { data, error } = await supabase
    .from(TABLES.HISTORY)
    .select('*')
    .eq('fund_code', fundCode)
    .order('nav_date', { ascending: false })
    .limit(days);

  if (error) {
    console.error('获取历史净值失败:', error);
    return [];
  }

  return data || [];
}

/**
 * 保存历史净值数据
 */
export async function upsertHistory(history: HistoryData[]): Promise<boolean> {
  if (history.length === 0) return true;

  const { error } = await supabase
    .from(TABLES.HISTORY)
    .upsert(history, { onConflict: 'fund_code,nav_date' });

  if (error) {
    console.error('保存历史净值失败:', error);
    return false;
  }

  return true;
}

/**
 * 获取最新净值日期
 */
export async function getLatestNavDate(fundCode: string): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLES.HISTORY)
    .select('nav_date')
    .eq('fund_code', fundCode)
    .order('nav_date', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('获取最新净值日期失败:', error);
    return null;
  }

  return data?.nav_date || null;
}

// ===========================================
// 统计操作
// ===========================================

/**
 * 获取基金数量
 */
export async function getFundCount(): Promise<number> {
  const { count, error } = await supabase
    .from(TABLES.FUNDS)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('获取基金数量失败:', error);
    return 0;
  }

  return count || 0;
}

/**
 * 获取最近更新的基金列表
 */
export async function getRecentlyUpdatedFunds(limit: number = 10): Promise<FundInfo[]> {
  const { data, error } = await supabase
    .from(TABLES.FUNDS)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('获取最近更新的基金失败:', error);
    return [];
  }

  return data || [];
}