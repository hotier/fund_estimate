'use client';

import { useState, useRef, useEffect } from 'react';

interface FundSuggestion {
  code: string;
  name: string;
  type?: string;
}

export default function Home() {
  const [fundCode, setFundCode] = useState('');
  const [fundData, setFundData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<FundSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // 搜索建议
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (searchQuery.trim().length >= 1) {
        try {
          const response = await fetch(`/api/fund/search?q=${encodeURIComponent(searchQuery)}&limit=10`);
          const data = await response.json();
          setSuggestions(data);
          setShowSuggestions(true);
        } catch (err) {
          console.error('搜索失败:', err);
          setSuggestions([]);
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
  }, [searchQuery]);

  // 点击外部关闭搜索建议
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 高亮关键词
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-200 text-gray-900 px-0.5 rounded">
          {part}
        </mark>
      ) : (
        <span key={index}>{part}</span>
      )
    );
  };

  // 选择搜索建议
  const selectSuggestion = (suggestion: FundSuggestion) => {
    setFundCode(suggestion.code);
    setSearchQuery(`${suggestion.code} ${suggestion.name}`);
    setShowSuggestions(false);
    searchFund(suggestion.code);
  };

  // 搜索基金
  const searchFund = async (code?: string) => {
    let targetCode = code || fundCode;

    if (!targetCode.trim()) {
      setError('请输入基金代码或名称');
      return;
    }

    setLoading(true);
    setError('');

    // 智能处理：如果用户输入的不是6位代码，且有搜索建议，使用第一个建议
    const isSixDigitCode = /^\d{6}$/.test(targetCode.trim());
    if (!isSixDigitCode && suggestions.length > 0) {
      targetCode = suggestions[0].code;
      console.log('[首页] 使用搜索建议:', targetCode, suggestions[0].name);
    }

    // 隐藏搜索建议
    setShowSuggestions(false);

    try {
      // 先检查本地缓存
      const cacheKey = `fund_cache_${targetCode}`;
      const cachedData = localStorage.getItem(cacheKey);
      const cacheTime = localStorage.getItem(`${cacheKey}_time`);

      // 如果缓存存在且未过期（24小时）
      if (cachedData && cacheTime) {
        const cacheAge = Date.now() - parseInt(cacheTime);
        if (cacheAge < 24 * 60 * 60 * 1000) {
          console.log('[首页] 使用本地缓存');
          setFundData(JSON.parse(cachedData));
          return;
        }
      }

      // 从API获取数据
      const response = await fetch(`/api/fund/${targetCode}`);
      if (!response.ok) {
        throw new Error('获取基金数据失败');
      }
      const data = await response.json();

      // 保存到本地缓存（24小时）
      localStorage.setItem(cacheKey, JSON.stringify(data));
      localStorage.setItem(`${cacheKey}_time`, Date.now().toString());

      setFundData(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('未在基金索引中找到')) {
        if (!isSixDigitCode && suggestions.length === 0) {
          setError(`未找到匹配的基金。请尝试：\n1. 输入完整的基金代码（6位数字）\n2. 从下拉列表中选择匹配的基金`);
        } else {
          setError(`"${targetCode}" 未在基金索引中找到。请检查基金代码是否正确。`);
        }
      } else {
        setError('获取基金数据失败，请检查基金代码是否正确');
      }
      setFundData(null);
    } finally {
      setLoading(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setFundCode(value);
  };

  // 处理回车键
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      // 如果有搜索建议，自动选择第一个
      if (showSuggestions && suggestions.length > 0) {
        selectSuggestion(suggestions[0]);
      } else {
        searchFund();
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">基金实时估值</h1>
        <p className="text-xl text-gray-600">输入基金代码或名称，查看实时估算净值和涨跌幅</p>
      </div>

      <div className="max-w-2xl mx-auto relative">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="输入基金代码或名称（如 018957 或 华夏），按回车或点击搜索"
            className="w-full px-4 py-3 pr-24 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            autoComplete="off"
          />
          <button
            onClick={() => searchFund()}
            disabled={loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? '搜索中...' : '搜索'}
          </button>
        </div>

        {/* 提示信息 */}
        {loading && (
          <div className="mt-2 text-sm text-gray-500 flex items-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-primary"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            首次加载需要从服务器获取数据，请稍候...
          </div>
        )}

        {!loading && (
          <div className="mt-2 text-sm text-gray-400">
            💡 搜索过的基金会自动缓存24小时，再次搜索会更快
          </div>
        )}

        {/* 搜索建议下拉框 */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="relative">
            <div className="absolute z-10 w-full mt-1 bg-blue-50 border border-blue-200 rounded-t-lg px-4 py-2 text-sm text-blue-700">
              💡 找到 {suggestions.length} 只基金，按 <kbd className="px-1.5 py-0.5 bg-white border border-blue-300 rounded text-xs font-mono">Enter</kbd> 选择第一个，或用鼠标点击选择
            </div>
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-7 bg-white border border-gray-200 rounded-b-lg shadow-lg max-h-80 overflow-y-auto"
            >
              {suggestions.map((suggestion, index) => (
                <div
                  key={suggestion.code}
                  onClick={() => selectSuggestion(suggestion)}
                  className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {highlightText(suggestion.name, searchQuery)}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        代码：{highlightText(suggestion.code, searchQuery)}
                        {suggestion.type && (
                          <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {suggestion.type}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-400 ml-2 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-danger whitespace-pre-line">{error}</p>
          </div>
        )}
      </div>

      {fundData && (
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{fundData.name}</h2>
                <p className="text-gray-600">代码：{fundData.code}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
                    if (!favorites.includes(fundData.code)) {
                      favorites.push(fundData.code);
                      localStorage.setItem('fundFavorites', JSON.stringify(favorites));
                      alert('已添加到自选基金');
                    } else {
                      alert('该基金已在自选列表中');
                    }
                  }}
                  className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm hover:bg-green-200"
                >
                  添加自选
                </button>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">实时估值</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">估算净值</p>
                <p className="text-2xl font-semibold text-gray-900">{fundData.estimate_value}</p>
              </div>
              <div className={`bg-gray-50 p-4 rounded-lg ${fundData.change_percent >= 0 ? 'fund-up' : 'fund-down'}`}>
                <p className="text-sm text-gray-600">涨跌幅</p>
                <p className="text-2xl font-semibold">
                  {fundData.change_percent >= 0 ? '+' : ''}{Number(fundData.change_percent).toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="text-sm text-gray-500">
              <p>更新时间：{fundData.update_time}</p>
              <p>数据来源：{fundData.data_source}</p>
            </div>
          </div>

          {fundData.stocks && fundData.stocks.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">重仓股</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        股票名称
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        股票代码
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        占比
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        涨跌幅
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fundData.stocks.map((stock: any) => (
                      <tr key={stock.code}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{stock.name}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-gray-600 text-sm">{stock.code}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-gray-900">{stock.proportion}%</div>
                        </td>
                        <td className={`px-4 py-3 whitespace-nowrap ${stock.change >= 0 ? 'fund-up' : 'fund-down'}`}>
                          <div className="font-medium text-sm">
                            {stock.change >= 0 ? '+' : ''}{Number(stock.change).toFixed(2)}%
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
      )}

      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">热门基金</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { code: '000001', name: '华夏成长混合' },
            { code: '000002', name: '华夏回报混合' },
            { code: '000003', name: '华夏现金增利货币' },
            { code: '000008', name: '嘉实中证500ETF联接' },
            { code: '000011', name: '华夏大盘精选混合' },
            { code: '000016', name: '华夏上证50ETF联接' },
          ].map((fund) => (
            <div
              key={fund.code}
              className="bg-white rounded-lg shadow-sm p-3 hover:shadow-md cursor-pointer transition-all"
              onClick={() => {
                setFundCode(fund.code);
                setSearchQuery(fund.code + ' ' + fund.name);
                searchFund(fund.code);
              }}
            >
              <h3 className="font-semibold text-gray-900 text-sm truncate">{fund.name}</h3>
              <p className="text-gray-600 text-xs mt-1">{fund.code}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}