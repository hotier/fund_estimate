/**
 * 自定义认证系统工具函数
 * 不使用 Supabase Auth，使用自己的用户表和 JWT
 */

import { supabase } from '../supabase/client';
import jwt from 'jsonwebtoken';

// 动态导入 bcryptjs 以避免客户端加载问题
let bcrypt: any;
const getBcrypt = async () => {
  if (!bcrypt) {
    bcrypt = (await import('bcryptjs')).default;
  }
  return bcrypt;
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // token 有效期 7 天

// ===========================================
// JWT 相关函数
// ===========================================

/**
 * 生成 JWT Token
 */
export function generateToken(user: {
  id: string;
  email: string;
  role: string;
}): string {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * 验证 JWT Token
 */
export function verifyToken(token: string): {
  userId: string;
  email: string;
  role: string;
} | null {
  try {
    return jwt.verify(token, JWT_SECRET) as {
      userId: string;
      email: string;
      role: string;
    };
  } catch (error) {
    return null;
  }
}

// ===========================================
// 用户注册相关函数
// ===========================================

/**
 * 注册新用户
 */
export async function registerUser(email: string, password: string, displayName?: string) {
  // 检查邮箱是否已存在
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new Error('该邮箱已被注册');
  }

  // 加密密码
  const bcryptModule = await getBcrypt();
  const passwordHash = await bcryptModule.hash(password, 10);

  // 创建用户
  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      display_name: displayName || email.split('@')[0],
      role: 'user',
      is_active: true,
    })
    .select('id, email, display_name, role, is_active')
    .single();

  if (error) {
    throw new Error(`注册失败: ${error.message}`);
  }

  // 创建默认分组
  await supabase
    .from('user_groups')
    .insert({
      user_id: data.id,
      name: '全部',
      is_default: true,
      sort_order: 0,
    });

  return data;
}

/**
 * 用户登录
 */
export async function loginUser(email: string, password: string) {
  // 获取用户信息
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    throw new Error('邮箱或密码错误');
  }

  // 检查账号是否激活
  if (!user.is_active) {
    throw new Error('账号已被禁用，请联系管理员');
  }

  // 验证密码
  const bcryptModule = await getBcrypt();
  const isPasswordValid = await bcryptModule.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('邮箱或密码错误');
  }

  // 更新最后登录时间
  await supabase
    .from('users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  // 生成 Token
  const token = generateToken({
    id: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      avatar_url: user.avatar_url,
    },
    token,
  };
}

// ===========================================
// 权限验证函数
// ===========================================

/**
 * 验证用户访问权限
 * @throws Error 如果用户未登录或权限不足
 */
export async function validateUserAccess(
  token: string | null,
  requireAdmin: boolean = false
): Promise<{
  userId: string;
  email: string;
  role: string;
}> {
  if (!token) {
    throw new Error('未登录，请先登录');
  }

  const payload = verifyToken(token);
  if (!payload) {
    throw new Error('登录已过期，请重新登录');
  }

  // 获取用户最新信息
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, role, is_active')
    .eq('id', payload.userId)
    .single();

  if (error || !user) {
    throw new Error('用户不存在');
  }

  if (!user.is_active) {
    throw new Error('账号已被禁用，请联系管理员');
  }

  if (requireAdmin && user.role !== 'admin') {
    throw new Error('权限不足：需要管理员权限');
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role,
  };
}

// ===========================================
// 用户管理相关函数
// ===========================================

/**
 * 获取用户信息
 */
export async function getUserById(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name, avatar_url, role, is_active, last_login_at, created_at, updated_at')
    .eq('id', userId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 获取所有用户列表（仅管理员）
 */
export async function getAllUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, display_name, role, is_active, created_at, last_login_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * 创建用户（仅管理员）
 */
export async function createUser(
  creatorId: string,
  email: string,
  password: string,
  displayName?: string,
  role: 'admin' | 'user' = 'user'
) {
  // 检查邮箱是否已存在
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    throw new Error('该邮箱已被注册');
  }

  // 加密密码
  const bcryptModule = await getBcrypt();
  const passwordHash = await bcryptModule.hash(password, 10);

  // 创建用户
  const { data, error } = await supabase
    .from('users')
    .insert({
      email,
      password_hash: passwordHash,
      display_name: displayName || email.split('@')[0],
      role,
      is_active: true,
    })
    .select('id, email, display_name, role, is_active')
    .single();

  if (error) {
    throw new Error(`创建用户失败: ${error.message}`);
  }

  // 创建默认分组
  await supabase
    .from('user_groups')
    .insert({
      user_id: data.id,
      name: '全部',
      is_default: true,
      sort_order: 0,
    });

  return data;
}

/**
 * 更新用户（仅管理员）
 */
export async function updateUser(
  targetUserId: string,
  updates: {
    display_name?: string;
    role?: 'admin' | 'user';
    is_active?: boolean;
  }
) {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId)
    .select('id, email, display_name, role, is_active')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 重置用户密码（仅管理员）
 */
export async function resetUserPassword(targetUserId: string, newPassword: string) {
  // 加密新密码
  const bcryptModule = await getBcrypt();
  const passwordHash = await bcryptModule.hash(newPassword, 10);

  const { data, error } = await supabase
    .from('users')
    .update({
      password_hash: passwordHash,
      updated_at: new Date().toISOString(),
    })
    .eq('id', targetUserId)
    .select('id, email, display_name')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 删除用户（仅管理员）
 */
export async function deleteUser(targetUserId: string) {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', targetUserId);

  if (error) {
    throw error;
  }
}

// ===========================================
// 分组管理相关函数
// ===========================================

/**
 * 获取用户所有分组
 */
export async function getUserGroups(userId: string) {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase
        .from('user_groups')
        .select('*')
        .eq('user_id', userId)
        .order('sort_order', { ascending: true });

      if (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw error;
      }

      return data || [];
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('获取用户分组失败');
}

/**
 * 创建分组
 */
export async function createGroup(userId: string, name: string, isDefault: boolean = false) {
  console.log(`[createGroup] 开始创建分组 - userId: ${userId}, name: ${name}, isDefault: ${isDefault}`);

  const { data, error } = await supabase
    .from('user_groups')
    .insert({
      user_id: userId,
      name,
      is_default: isDefault,
      sort_order: 0,
    })
    .select('*')
    .single();

  if (error) {
    console.error('[createGroup] 创建分组失败:', {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    throw error;
  }

  console.log('[createGroup] 创建分组成功:', data);
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
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 删除分组
 */
export async function deleteGroup(groupId: string, userId: string) {
  // 检查是否为默认分组
  const { data: group } = await supabase
    .from('user_groups')
    .select('is_default')
    .eq('id', groupId)
    .single();

  if (group && group.is_default) {
    throw new Error('默认分组不能删除');
  }

  // 将该分组下的基金移到"全部"分组（即 group_id 设为 null）
  await supabase
    .from('user_favorites')
    .update({ group_id: null, updated_at: new Date().toISOString() })
    .eq('group_id', groupId);

  // 删除分组
  const { error } = await supabase
    .from('user_groups')
    .delete()
    .eq('id', groupId);

  if (error) {
    throw error;
  }
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
// 自选基金相关函数（普通用户）
// ===========================================

/**
 * 获取用户自选基金（包含敏感数据）
 */
export async function getUserFavorites(userId: string, groupId?: string) {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      let query = supabase
        .from('user_favorites_view')
        .select('*')
        .eq('user_id', userId);

      if (groupId) {
        query = query.eq('group_id', groupId);
      }

      const { data, error } = await query;

      if (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        throw error;
      }

      return data || [];
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      throw error;
    }
  }

  throw lastError || new Error('获取自选基金失败');
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
    .select('*')
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
    .select('*')
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
}


// ===========================================
// 统计相关函数
// ===========================================

/**
 * 获取用户统计信息（包含敏感数据）
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

/**
 * 管理员获取用户统计信息（不包含敏感数据）
 */
export async function adminGetUserStats(userId: string) {
  const { data, error } = await supabase.rpc('admin_get_user_stats', {
    p_user_id: userId,
  });

  if (error) {
    throw error;
  }

  return data?.[0] || {
    total_funds: 0,
    total_groups: 0,
  };
}

// ===========================================
// 管理员专用函数（不包含敏感数据）
// ===========================================

/**
 * 管理员获取所有用户的自选基金列表（不包含持仓金额和总收益）
 */
export async function adminGetAllUserFavorites() {
  const { data, error } = await supabase
    .from('admin_user_favorites_view')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

/**
 * 管理员获取指定用户的自选基金列表（不包含持仓金额和总收益）
 */
export async function adminGetUserFavorites(userId: string) {
  const { data, error } = await supabase
    .from('admin_user_favorites_view')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

// ===========================================
// 类型定义
// ===========================================

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'user';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LoginResult {
  user: {
    id: string;
    email: string;
    display_name: string;
    role: string;
    avatar_url: string | null;
  };
  token: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
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

export interface AdminUserFavorite {
  id: string;
  user_id: string;
  user_email: string;
  user_display_name: string;
  fund_code: string;
  fund_name?: string;
  fund_type?: string;
  group_id: string | null;
  group_name?: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}