'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  verifyToken,
  getUserById,
  getUserFavorites,
  getUserGroups,
  type User,
  type UserGroup,
  type UserFavorite,
} from '@/lib/services/auth-service';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  authenticated: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
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
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<UserFavorite[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);

  // 加载用户数据
  const loadUserData = async (userId: string) => {
    try {
      const [userFavorites, userGroups] = await Promise.all([
        getUserFavorites(userId),
        getUserGroups(userId),
      ]);
      setFavorites(userFavorites);
      setGroups(userGroups);
    } catch (error: any) {
      console.error('加载用户数据失败:', error);
      
      // 如果是网络连接错误，不显示错误提示，让用户可以继续使用
      if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('net::'))) {
        console.warn('[AuthContext] 网络连接失败，使用本地缓存数据');
        // 不清除数据，让用户可以继续使用缓存的本地数据
      } else {
        // 其他错误（如认证失败），清除数据
        console.warn('[AuthContext] 认证失败，清除用户数据');
        setFavorites([]);
        setGroups([]);
      }
    }
  };

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        // 从 localStorage 读取 token
        const storedToken = localStorage.getItem('auth_token');
        if (storedToken) {
          const payload = verifyToken(storedToken);
          if (payload) {
            // 获取用户最新信息
            const userInfo = await getUserById(payload.userId);
            setUser(userInfo);
            setToken(storedToken);
            await loadUserData(payload.userId);
          } else {
            // token 无效，清除
            localStorage.removeItem('auth_token');
          }
        }
      } catch (error) {
        console.error('初始化认证失败:', error);
        localStorage.removeItem('auth_token');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // 用户注册
  const handleSignUp = async (email: string, password: string, displayName?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, display_name: displayName }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '注册失败');
      }

      // 注册成功后，需要用户手动登录
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || '登录失败');
      }

      setUser(data.data.user);
      setToken(data.data.token);

      // 保存 token 到 localStorage
      localStorage.setItem('auth_token', data.data.token);

      // 加载用户数据
      await loadUserData(data.data.user.id);
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
      // 清除本地状态
      setUser(null);
      setToken(null);
      setFavorites([]);
      setGroups([]);
      
      // 清除 localStorage
      localStorage.removeItem('auth_token');
    } catch (error: any) {
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // 刷新用户配置
  const refreshProfile = async () => {
    if (user) {
      try {
        const userInfo = await getUserById(user.id);
        setUser(userInfo);
      } catch (error) {
        console.error('刷新用户配置失败:', error);
      }
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
    token,
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