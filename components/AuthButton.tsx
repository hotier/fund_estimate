'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import LoginModal from './LoginModal';

export default function AuthButton() {
  const { user, loading, signOut } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 监听打开登录弹窗的事件
  useEffect(() => {
    const handleOpenLoginModal = () => {
      setIsModalOpen(true);
    };

    window.addEventListener('openLoginModal', handleOpenLoginModal);
    return () => window.removeEventListener('openLoginModal', handleOpenLoginModal);
  }, []);

  if (loading) {
    return <span className="text-gray-400">加载中...</span>;
  }

  if (user) {
    return (
      <div className="flex items-center space-x-4">
        <span className="text-sm text-gray-700">
          {user.display_name || user.email}
        </span>
        <button
          onClick={signOut}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          登出
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="text-sm bg-primary text-white px-4 py-2 rounded hover:bg-primary/90"
      >
        登录
      </button>
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}