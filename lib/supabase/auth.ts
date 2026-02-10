/**
 * Supabase 认证工具函数（简化版 - 不使用 RLS）
 */

import { supabase } from './client';
import { User, Session, AuthError } from '@supabase/supabase-js';

// ===========================================
// 用户认证相关函数
// ===========================================

/**
 * 用户注册
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw new AuthError(error.message);
  }

  return { data, error: null };
}

/**
 * 用户登录
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new AuthError(error.message);
  }

  return { data, error: null };
}

/**
 * 用户登出
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new AuthError(error.message);
  }

  return { error: null };
}

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
 * 监听认证状态变化
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session);
    }
  );

  return subscription;
}

/**
 * 更新用户密码
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new AuthError(error.message);
  }

  return { error: null };
}

/**
 * 重置密码（发送重置邮件）
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw new AuthError(error.message);
  }

  return { error: null };
}

// ===========================================
// 导出 auth-service 中的数据操作函数
// ===========================================

export * from './auth-service';