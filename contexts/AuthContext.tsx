'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import {
  signUp,
  signIn,
  signOut,
  getCurrentUser,
  getCurrentSession,
  getUserProfile,
  onAuthStateChange,
  getUserFavorites,
  getUserGroups,
  type UserProfile,
  type UserGroup,
  type UserFavorite,
} from '@/lib/supabase/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authenticated: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // 数据相关
  favorites: UserFavorite[];
  groups: UserGroup[];
  refreshFavorites: () => Promise<void>;
  refreshGroups: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);

  // 加载用户配置
  const loadUserProfile = async (userId: string) => {
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);
    } catch (error) {
      console.error('加载用户配置失败:', error);
    }
  };

  // 加载用户数据
  const loadUserData = async (userId: string) => {
    try {
      const [userFavorites, userGroups] = await Promise.all([
        getUserFavorites(userId),
        getUserGroups(userId),
      ]);
      setFavorites(userFavorites);
      setGroups(userGroups);
    } catch (error) {
      console.error('加载用户数据失败:', error);
    }
  };

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        const session = await getCurrentSession();
        setSession(session);

        if (session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user.id);
          await loadUserData(session.user.id);
        }
      } catch (error) {
        console.error('初始化认证失败:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // 监听认证状态变化
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);

      setSession(session);
      setUser(session?.user || null);

      if (session?.user) {
        await loadUserProfile(session.user.id);
        await loadUserData(session.user.id);
      } else {
        setUserProfile(null);
        setFavorites([]);
        setGroups([]);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 用户注册
  const handleSignUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signUp(email, password);
      // 注册成功后，会自动触发 onAuthStateChange
    } catch (error: any) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 用户登录
  const handleSignIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signIn(email, password);
      // 登录成功后，会自动触发 onAuthStateChange
    } catch (error: any) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 用户登出
  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      // 登出成功后，会自动触发 onAuthStateChange
    } catch (error: any) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 刷新用户配置
  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user.id);
    }
  };

  // 刷新自选基金
  const refreshFavorites = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  // 刷新分组
  const refreshGroups = async () => {
    if (user) {
      await loadUserData(user.id);
    }
  };

  const value: AuthContextType = {
    user,
    session,
    userProfile,
    loading,
    authenticated: !!user,
    signUp: handleSignUp,
    signIn: handleSignIn,
    signOut: handleSignOut,
    refreshProfile,
    favorites,
    groups,
    refreshFavorites,
    refreshGroups,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}