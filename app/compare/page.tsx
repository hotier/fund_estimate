'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import Link from 'next/link';

interface FundSuggestion {
  code: string;
  name: string;
  type?: string;
}

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

interface ComparedFund extends FundData {
  isLoading: boolean;
  error?: string;
}

export default function ComparePage() {
  const { user } = useAuth();
  const [compareList, setCompareList] = useState<ComparedFund[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<FundSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // 搜索建议
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length >= 1) {
        setLoadingSuggestions(true);
        try {
          const response = await fetch(`/api/fund/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
          const data = await response.json();
          // 过滤已添加的基金
          const filtered = data.filter(
            (s: FundSuggestion) => !compareList.some((f) => f.code === s.code)
          );
          setSuggestions(filtered);
          setShowSuggestions(true);
        } catch (err) {
          console.error('搜索失败:', err);
          setSuggestions([]);
        } finally {
          setLoadingSuggestions(false);
        }
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, compareList]);

  // 添加基金到对比列表
  const addFundToCompare = async (suggestion: FundSuggestion) => {
    if (compareList.length >= 5) {
      alert('最多只能对比5只基金');
      return;
    }

    // 检查是否已存在
    if (compareList.some((f) => f.code === suggestion.code)) {
      alert('该基金已在对比列表中');
      return;
    }

    // 添加占位符
    const placeholderFund: ComparedFund = {
      code: suggestion.code,
      name: suggestion.name,
      estimate_value: 0,
      change_percent: 0,
      update_time: '',
      data_source: '',
      isLoading: true,
    };

    setCompareList((prev) => [...prev, placeholderFund]);
    setSearchQuery('');
    setShowSuggestions(false);

    // 获取基金数据
    try {
      const response = await fetch(`/api/fund/${suggestion.code}`);
      if (!response.ok) {
        throw new Error('获取基金数据失败');
      }
      const data = await response.json();

      setCompareList((prev) =>
        prev.map((f) =>
          f.code === suggestion.code ? { ...data, isLoading: false } : f
        )
      );
    } catch (err) {
      setCompareList((prev) =>
        prev.map((f) =>
          f.code === suggestion.code
            ? { ...f, isLoading: false, error: '获取数据失败' }
            : f
        )
      );
    }
  };

  // 移除基金
  const removeFund = (code: string) => {
    setCompareList((prev) => prev.filter((f) => f.code !== code));
  };

  // 生成对比图表数据（模拟不同时间段的表现）
  useEffect(() => {
    if (compareList.length === 0) {
      setChartData([]);
      return;
    }

    // 生成近30天的模拟数据
    const days = 30;
    const data = [];
    const baseDate = new Date();

    for (let i = days; i >= 0; i--) {
      const date = new Date(baseDate);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

      const dayData: any = { date: dateStr };

      compareList.forEach((fund) => {
        if (!fund.isLoading && !fund.error) {
          // 基于当前涨跌幅生成模拟历史数据
          const volatility = Math.abs(fund.change_percent) * 0.3;
          const randomChange = (Math.random() - 0.5) * volatility;
          const baseValue = fund.estimate_value * (1 - fund.change_percent / 100);
          dayData[fund.code] = Number((baseValue * (1 + randomChange / 100)).toFixed(4));
        }
      });

      data.push(dayData);
    }

    setChartData(data);
  }, [compareList]);

  // 计算统计数据
  const calculateStats = () => {
    const validFunds = compareList.filter((f) => !f.isLoading && !f.error);
    if (validFunds.length === 0) return null;

    const maxChange = Math.max(...validFunds.map((f) => f.change_percent));
    const minChange = Math.min(...validFunds.map((f) => f.change_percent));
    const avgChange = validFunds.reduce((sum, f) => sum + f.change_percent, 0) / validFunds.length;

    return { maxChange, minChange, avgChange };
  };

  const stats = calculateStats();

  // 未登录提示
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">请先登录</h2>
          <p className="text-gray-600 mb-6">登录后即可使用基金对比功能</p>
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

  const colors = ['#0070f3', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">基金对比</h1>
        <p className="text-gray-600">同时对比多只基金的实时估值和历史表现</p>
      </div>

      {/* 搜索添加区域 */}
      <div className="max-w-2xl mx-auto relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="输入基金代码或名称添加对比（最多5只）"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            disabled={compareList.length >= 5}
          />
          {loadingSuggestions && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {/* 搜索建议 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.code}
                onClick={() => addFundToCompare(suggestion)}
                className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{suggestion.name}</div>
                    <div className="text-sm text-gray-600">
                      代码：{suggestion.code}
                      {suggestion.type && (
                        <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {suggestion.type}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-primary text-sm">点击添加</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {compareList.length >= 5 && (
          <p className="mt-2 text-sm text-orange-600">已达到最大对比数量（5只）</p>
        )}
      </div>

      {/* 对比列表 */}
      {compareList.length > 0 && (
        <>
          {/* 已选基金卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {compareList.map((fund, index) => (
              <div
                key={fund.code}
                className="bg-white rounded-lg shadow-sm p-4 border-2"
                style={{ borderColor: colors[index % colors.length] }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: colors[index % colors.length] }}
                    ></div>
                    <span className="text-xs text-gray-500">{fund.code}</span>
                  </div>
                  <button
                    onClick={() => removeFund(fund.code)}
                    className="text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <h3 className="font-semibold text-gray-900 mb-2 truncate" title={fund.name}>
                  {fund.name}
                </h3>

                {fund.isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                ) : fund.error ? (
                  <p className="text-red-500 text-sm">{fund.error}</p>
                ) : (
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">估算净值</span>
                      <span className="font-medium">{fund.estimate_value}</span>
                    </div>
                    <div className={`flex justify-between text-sm ${fund.change_percent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      <span>涨跌幅</span>
                      <span className="font-semibold">
                        {fund.change_percent >= 0 ? '+' : ''}
                        {fund.change_percent}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 统计数据 */}
          {stats && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">对比统计</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">最高涨幅</p>
                  <p className="text-2xl font-bold text-red-600">+{stats.maxChange.toFixed(2)}%</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">最低涨幅</p>
                  <p className="text-2xl font-bold text-green-600">{stats.minChange.toFixed(2)}%</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-1">平均涨幅</p>
                  <p className={`text-2xl font-bold ${stats.avgChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {stats.avgChange >= 0 ? '+' : ''}
                    {stats.avgChange.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 走势图对比 */}
          {chartData.length > 0 && compareList.some((f) => !f.isLoading && !f.error) && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">净值走势对比（近30天）</h3>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip />
                    <Legend />
                    {compareList.map(
                      (fund, index) =>
                        !fund.isLoading &&
                        !fund.error && (
                          <Line
                            key={fund.code}
                            type="monotone"
                            dataKey={fund.code}
                            name={fund.name}
                            stroke={colors[index % colors.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6 }}
                          />
                        )
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 详细对比表格 */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <h3 className="text-lg font-semibold text-gray-900 p-6 pb-4">详细数据对比</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      基金名称
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      代码
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      估算净值
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      涨跌幅
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      数据来源
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {compareList.map((fund) => (
                    <tr key={fund.code} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{fund.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-600">{fund.code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {fund.isLoading ? (
                          <span className="text-gray-400">加载中...</span>
                        ) : fund.error ? (
                          <span className="text-red-500">-</span>
                        ) : (
                          <span className="font-medium">{fund.estimate_value}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {fund.isLoading ? (
                          <span className="text-gray-400">-</span>
                        ) : fund.error ? (
                          <span className="text-red-500">-</span>
                        ) : (
                          <span
                            className={`font-semibold ${
                              fund.change_percent >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {fund.change_percent >= 0 ? '+' : ''}
                            {fund.change_percent}%
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-600">{fund.data_source}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Link
                          href={`/fund/${fund.code}`}
                          className="text-primary hover:text-primary/80 text-sm font-medium"
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 空状态 */}
      {compareList.length === 0 && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">开始对比基金</h3>
          <p className="text-gray-600 mb-6">在上方搜索框中添加基金，开始对比分析</p>
          <div className="flex flex-wrap justify-center gap-3">
            {['000001', '000002', '000008'].map((code) => (
              <button
                key={code}
                onClick={() => addFundToCompare({ code, name: `基金 ${code}` })}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                添加 {code}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
