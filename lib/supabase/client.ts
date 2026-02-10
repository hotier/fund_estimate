import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('缺少 Supabase 环境变量配置');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 数据库表名常量
export const TABLES = {
  FUNDS: 'funds',           // 基金基本信息
  FUNDS_INDEX: 'funds_index', // 基金索引（代码+名称）
  STOCKS: 'stocks',         // 重仓股信息
  HISTORY: 'history',       // 历史净值数据
} as const;

// 缓存 TTL 配置（秒）
export const CACHE_TTL = {
  FUND_INFO: parseInt(process.env.CACHE_FUND_INFO_TTL || '86400'),
  STOCKS: parseInt(process.env.CACHE_STOCKS_TTL || '86400'),
  HISTORY: parseInt(process.env.CACHE_HISTORY_TTL || '2592000'),
  ESTIMATE: parseInt(process.env.CACHE_ESTIMATE_TTL || '30'),
} as const;