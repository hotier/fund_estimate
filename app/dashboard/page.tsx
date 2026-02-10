'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  
  // 未登录提示
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">请先登录</h2>
          <p className="text-gray-600 mb-6">登录后即可查看数据仪表板</p>
          <button
            onClick={() => {
              const event = new CustomEvent('openLoginModal');
              window.dispatchEvent(event);
            }}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            立即登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📈</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">数据仪表板</h1>
        <p className="text-xl text-gray-600 mb-8">此功能正在开发中，敬请期待</p>
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">即将推出</h2>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>自选基金组合概览</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>收益统计图表</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>市场指数对比</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>风险收益分析</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>投资组合建议</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}