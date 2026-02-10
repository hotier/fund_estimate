/**
 * 认证和权限控制工具函数
 * 通过代码层实现权限控制，不使用 RLS
 */

import { supabase } from './client';
import { User, Session } from '@supabase/supabase-js';

// ===========================================
// 用户认证相关函数
// ===========================================

/**
 * 获取当前用户
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * 获取当前会话
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * 获取用户配置
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 检查用户是否为管理员
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.role === 'admin';
}

/**
 * 检查用户是否激活
 */
export async function isActive(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_active')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return false;
  }

  return data.is_active;
}

/**
 * 验证用户访问权限
 * @throws Error 如果用户未登录、未激活或权限不足
 */
export async function validateUserAccess(requireAdmin: boolean = false): Promise<{
  user: User;
  profile: any;
}> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('未登录，请先登录');
  }

  const profile = await getUserProfile(user.id);
  
  if (!profile) {
    throw new Error('用户配置不存在');
  }

  if (!profile.is_active) {
    throw new Error('账号已被禁用，请联系管理员');
  }

  if (requireAdmin && profile.role !== 'admin') {
    throw new Error('权限不足：需要管理员权限');
  }

  return { user, profile };
}

// ===========================================
// 分组管理相关函数
// ===========================================

/**
 * 获取用户所有分组
 */
export async function getUserGroups(userId: string) {
  const { data, error } = await supabase
    .from('user_groups')
    .select('*')
    .eq('user_id', userId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * 创建分组
 */
export async function createGroup(userId: string, name: string, isDefault: boolean = false) {
  const { data, error } = await supabase
    .from('user_groups')
    .insert({
      user_id: userId,
      name,
      is_default: isDefault,
      sort_order: 0,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 更新分组
 */
export async function updateGroup(groupId: string, updates: {
  name?: string;
  sort_order?: number;
}) {
  const { data, error } = await supabase
    .from('user_groups')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 删除分组
 */
export async function deleteGroup(groupId: string) {
  const { error } = await supabase
    .from('user_groups')
    .delete()
    .eq('id', groupId);

  if (error) {
    throw error;
  }

  return { error: null };
}

/**
 * 获取默认分组
 */
export async function getDefaultGroup(userId: string) {
  const { data, error } = await supabase
    .from('user_groups')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// ===========================================
// 自选基金相关函数
// ===========================================

/**
 * 获取用户自选基金
 */
export async function getUserFavorites(
  userId: string,
  groupId?: string
) {
  let query = supabase
    .from('user_favorites_view')
    .select('*')
    .eq('user_id', userId);

  if (groupId) {
    query = query.eq('group_id', groupId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * 添加自选基金
 */
export async function addFavorite(
  userId: string,
  fundCode: string,
  options?: {
    groupId?: string;
    holdings?: number;
    totalProfit?: number;
    notes?: string;
  }
) {
  const { data, error } = await supabase
    .from('user_favorites')
    .insert({
      user_id: userId,
      fund_code: fundCode,
      group_id: options?.groupId || null,
      holdings: options?.holdings || 0,
      total_profit: options?.totalProfit || 0,
      notes: options?.notes || null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 批量添加自选基金
 */
export async function addMultipleFavorites(
  userId: string,
  fundCodes: string[],
  groupId?: string
) {
  const favorites = fundCodes.map(code => ({
    user_id: userId,
    fund_code: code,
    group_id: groupId || null,
    holdings: 0,
    total_profit: 0,
  }));

  const { data, error } = await supabase
    .from('user_favorites')
    .insert(favorites)
    .select();

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * 更新自选基金
 */
export async function updateFavorite(
  favoriteId: string,
  updates: {
    group_id?: string;
    holdings?: number;
    total_profit?: number;
    notes?: string;
  }
) {
  const { data, error } = await supabase
    .from('user_favorites')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', favoriteId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 删除自选基金
 */
export async function removeFavorite(favoriteId: string) {
  const { error } = await supabase
    .from('user_favorites')
    .delete()
    .eq('id', favoriteId);

  if (error) {
    throw error;
  }

  return { error: null };
}

/**
 * 移动基金到分组
 */
export async function moveFundToGroup(
  userId: string,
  fundCode: string,
  groupId: string
) {
  const { error } = await supabase.rpc('move_fund_to_group', {
    p_user_id: userId,
    p_fund_code: fundCode,
    p_group_id: groupId,
  });

  if (error) {
    throw error;
  }

  return { error: null };
}

// ===========================================
// 统计相关函数
// ===========================================

/**
 * 获取用户统计信息
 */
export async function getUserStats(userId: string) {
  const { data, error } = await supabase.rpc('get_user_stats', {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || {
    total_funds: 0,
    total_holdings: 0,
    total_profit: 0,
    total_groups: 0,
  };
}

// ===========================================
// 数据迁移相关函数
// ===========================================

/**
 * 从 localStorage 迁移数据到云端
 */
export async function migrateFromLocalStorage(userId: string) {
  const migratedData = {
    favorites: [] as any[],
    groups: [] as any[],
    errors: [] as string[],
  };

  try {
    // 迁移分组
    const localGroups = JSON.parse(localStorage.getItem('fundGroups') || '[]');
    const groupMap: Record<string, string> = {};

    for (const group of localGroups) {
      if (group.isDefault) continue;

      try {
        const newGroup = await createGroup(userId, group.name, false);
        groupMap[group.id] = newGroup.id;
        migratedData.groups.push({
          oldId: group.id,
          newId: newGroup.id,
          name: group.name,
        });
      } catch (error: any) {
        migratedData.errors.push(`创建分组失败: ${group.name} - ${error.message}`);
      }
    }

    // 获取默认分组 ID
    const defaultGroup = await getDefaultGroup(userId);
    groupMap['all'] = defaultGroup?.id;

    // 迁移自选基金
    const localFavorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
    const localHoldings = JSON.parse(localStorage.getItem('fundHoldings') || '{}');
    const localTotalProfit = JSON.parse(localStorage.getItem('fundTotalProfit') || '{}');
    const localMapping = JSON.parse(localStorage.getItem('fundGroupMapping') || '[]');

    for (const code of localFavorites) {
      try {
        const mapping = localMapping.find((m: any) => m.fundCode === code);
        const oldGroupId = mapping?.groupId || 'all';
        const newGroupId = groupMap[oldGroupId] || defaultGroup?.id;

        await addFavorite(userId, code, {
          groupId: newGroupId,
          holdings: localHoldings[code] || 0,
          totalProfit: localTotalProfit[code] || 0,
        });

        migratedData.favorites.push({
          code,
          groupId: newGroupId,
        });
      } catch (error: any) {
        migratedData.errors.push(`添加基金失败: ${code} - ${error.message}`);
      }
    }

    return migratedData;
  } catch (error: any) {
    throw new Error(`迁移失败: ${error.message}`);
  }
}

/**
 * 检查用户是否已迁移
 */
export async function checkMigrationStatus(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('user_favorites')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  return (count || 0) > 0;
}

// ===========================================
// 类型定义
// ===========================================

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  preferences: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface UserGroup {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserFavorite {
  id: string;
  user_id: string;
  fund_code: string;
  fund_name?: string;
  fund_type?: string;
  group_id: string | null;
  group_name?: string;
  holdings: number;
  total_profit: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  total_funds: number;
  total_holdings: number;
  total_profit: number;
  total_groups: number;
}

export interface MigrationResult {
  favorites: Array<{ code: string; groupId: string }>;
  groups: Array<{ oldId: string; newId: string; name: string }>;
  errors: string[];
}