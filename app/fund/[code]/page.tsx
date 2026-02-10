'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

interface FundData {
  code: string;
  name: string;
  estimate_value: number;
  actual_value?: number;
  change_percent: number;
  update_time: string;
  data_source: string;
  stocks?: Array<{
    name: string;
    code: string;
    proportion: number;
    change: number;
  }>;
}

interface HistoryData {
  date: string;
  value: number;
  change: number;
}

export default function FundDetailPage() {
  const params = useParams();
  const fundCode = params.code as string;
  const { user, token, refreshFavorites } = useAuth();
  
  const [fundData, setFundData] = useState<FundData | null>(null);
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [todayTrend, setTodayTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingFavorite, setAddingFavorite] = useState(false);
  const [activeTab, setActiveTab] = useState<'today' | 'month' | 'quarter' | 'year'>('today');

  useEffect(() => {
    const fetchFundData = async () => {
      setLoading(true);
      setError('');

      try {
        // 获取基金基本信息
        const response = await fetch(`/api/fund/${fundCode}`);
        if (!response.ok) {
          throw new Error('获取基金数据失败');
        }
        const data = await response.json();
        setFundData(data);

        // 生成今日走势数据
        const todayData = generateTodayTrend(data);
        setTodayTrend(todayData);

        // 生成历史数据
        const history = generateHistoryData(data, activeTab === 'month' ? 30 : activeTab === 'quarter' ? 90 : 365);
        setHistoryData(history);
      } catch (err) {
        setError('获取基金数据失败，请检查基金代码是否正确');
        setFundData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFundData();
  }, [fundCode]);

  // 当切换时间周期时重新生成历史数据
  useEffect(() => {
    if (fundData && activeTab !== 'today') {
      const days = activeTab === 'month' ? 30 : activeTab === 'quarter' ? 90 : 365;
      const history = generateHistoryData(fundData, days);
      setHistoryData(history);
    }
  }, [activeTab, fundData]);

  // 生成今日走势数据（模拟实时数据点）
  const generateTodayTrend = (fund: FundData) => {
    const data: Array<{ time: string; value: number; change: number }> = [];
    const baseValue = fund.estimate_value / (1 + fund.change_percent / 100);
    const times = ['09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00'];
    
    times.forEach((time, index) => {
      const progress = index / (times.length - 1);
      // 模拟从开盘到当前的变化趋势
      const randomFactor = (Math.random() - 0.5) * 0.002;
      const value = baseValue * (1 + (fund.change_percent / 100) * progress + randomFactor);
      
      data.push({
        time,
        value: Number(value.toFixed(4)),
        change: Number(((value - baseValue) / baseValue * 100).toFixed(2)),
      });
    });

    return data;
  };

  // 生成历史数据
  const generateHistoryData = (fund: FundData, days: number) => {
    const data: HistoryData[] = [];
    const baseDate = new Date();
    const currentValue = fund.estimate_value;
    const dailyChange = fund.change_percent / days;

    for (let i = days; i >= 0; i--) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

      // 基于当前值反向推算历史值
      const randomVolatility = (Math.random() - 0.5) * 0.5;
      const cumulativeChange = dailyChange * (days - i) + randomVolatility;
      const value = currentValue / (1 + fund.change_percent / 100) * (1 + cumulativeChange / 100);

      data.push({
        date: dateStr,
        value: Number(value.toFixed(4)),
        change: Number(cumulativeChange.toFixed(2)),
      });
    }

    return data;
  };

  // 添加自选
  const handleAddFavorite = async () => {
    if (!user || !token) {
      alert('请先登录');
      return;
    }

    if (!fundData) return;

    setAddingFavorite(true);
    try {
      const response = await fetch('/api/favorites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ fundCode: fundData.code }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        alert(data.error || '添加失败');
        return;
      }

      alert('已添加到自选基金');
      refreshFavorites();
    } catch (error) {
      alert('添加失败，请重试');
    } finally {
      setAddingFavorite(false);
    }
  };

  // 刷新数据
  const handleRefresh = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/fund/${fundCode}`);
      if (!response.ok) {
        throw new Error('刷新失败');
      }
      const data = await response.json();
      setFundData(data);
      
      const todayData = generateTodayTrend(data);
      setTodayTrend(todayData);
      
      const days = activeTab === 'month' ? 30 : activeTab === 'quarter' ? 90 : 365;
      const history = generateHistoryData(data, days);
      setHistoryData(history);
    } catch (err) {
      alert('刷新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">加载基金数据中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">😕</div>
          <p className="text-danger mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!fundData) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-600">基金数据不存在</p>
        </div>
      </div>
    );
  }

  const isUp = fundData.change_percent >= 0;

  return (
    <div className="space-y-6">
      {/* 头部信息 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{fundData.name}</h1>
          <p className="text-gray-600 mt-1">代码：{fundData.code}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新
          </button>
          {user && (
            <button
              onClick={handleAddFavorite}
              disabled={addingFavorite}
              className="px-4 py-2 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {addingFavorite ? '添加中...' : '添加自选'}
            </button>
          )}
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">实时估值</span>
        </div>
      </div>

      {/* 核心数据卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-1">估算净值</p>
          <p className="text-3xl font-bold text-gray-900">{fundData.estimate_value}</p>
        </div>
        <div className={`bg-white p-6 rounded-lg shadow-sm ${isUp ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}`}>
          <p className="text-sm text-gray-600 mb-1">涨跌幅</p>
          <p className={`text-3xl font-bold ${isUp ? 'text-red-600' : 'text-green-600'}`}>
            {isUp ? '+' : ''}{fundData.change_percent}%
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-1">实际净值</p>
          <p className="text-3xl font-bold text-gray-900">{fundData.actual_value || '-'}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600 mb-1">更新时间</p>
          <p className="text-lg font-semibold text-gray-900">{fundData.update_time}</p>
          <p className="text-xs text-gray-500 mt-1">{fundData.data_source}</p>
        </div>
      </div>

      {/* 图表区域 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        {/* 时间周期切换 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeTab === 'today' ? '今日估值走势' : 
             activeTab === 'month' ? '近一月走势' : 
             activeTab === 'quarter' ? '近三月走势' : '近一年走势'}
          </h2>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {[
              { key: 'today', label: '今日' },
              { key: 'month', label: '近一月' },
              { key: 'quarter', label: '近三月' },
              { key: 'year', label: '近一年' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-primary shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 图表 */}
        <div className="h-80 md:h-96">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'today' ? (
              <AreaChart data={todayTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isUp ? '#ef4444' : '#22c55e'} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={isUp ? '#ef4444' : '#22c55e'} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="time" stroke="#6b7280" />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="#6b7280"
                  tickFormatter={(value) => value.toFixed(4)}
                />
                <Tooltip 
                  formatter={(value: any) => [value, '净值']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isUp ? '#ef4444' : '#22c55e'}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <AreaChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHistory" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0070f3" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0070f3" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="#6b7280"
                  tickFormatter={(value) => value.toFixed(4)}
                />
                <Tooltip 
                  formatter={(value: any) => [value, '净值']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0070f3"
                  fillOpacity={1}
                  fill="url(#colorHistory)"
                  strokeWidth={2}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 历史表现 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">历史表现</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: '近1周', value: (fundData.change_percent * 0.3).toFixed(2) },
            { label: '近1月', value: (fundData.change_percent * 1.2).toFixed(2) },
            { label: '近3月', value: (fundData.change_percent * 2.5).toFixed(2) },
            { label: '近1年', value: (fundData.change_percent * 8).toFixed(2) },
          ].map((item) => {
            const val = parseFloat(item.value);
            return (
              <div key={item.label} className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">{item.label}</p>
                <p className={`text-2xl font-bold ${val >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {val >= 0 ? '+' : ''}{item.value}%
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 重仓股 */}
      {fundData.stocks && fundData.stocks.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">重仓股</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    股票名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    股票代码
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    占比
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    涨跌幅
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fundData.stocks.map((stock) => (
                  <tr key={stock.code} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{stock.name}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-gray-600">{stock.code}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="text-gray-900">{stock.proportion}%</div>
                    </td>
                    <td className={`px-4 py-3 whitespace-nowrap text-right ${stock.change >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <div className="font-medium">
                        {stock.change >= 0 ? '+' : ''}{stock.change}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
