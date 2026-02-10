'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface FundData {
  code: string;
  name: string;
  estimate_value: string;
  change_percent: number;
  update_time: string;
  type?: string;
}

interface FundWithHoldings extends FundData {
  holdings: number;
  units?: number;
  estimatedProfit: number;
  totalProfit?: number; // 当前总收益
}

interface Group {
  id: string;
  name: string;
  createdAt: number;
  isDefault: boolean;
}

interface FundGroupMapping {
  fundCode: string;
  groupId: string;
}

type SortOption = 'code' | 'name' | 'estimate' | 'change' | 'holdings' | 'profit' | 'totalProfit';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C'];

export default function FavoritesPage() {
  const [funds, setFunds] = useState<FundWithHoldings[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingHoldings, setEditingHoldings] = useState<string | null>(null);

  // 分组相关
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [fundGroupMapping, setFundGroupMapping] = useState<FundGroupMapping[]>([]);
  const [showGroupManage, setShowGroupManage] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // 添加自选弹窗相关
  const [showAddFundModal, setShowAddFundModal] = useState(false);
  const [addFundMode, setAddFundMode] = useState<'single' | 'batch'>('single');
  const [singleFundCode, setSingleFundCode] = useState('');
  const [singleFundName, setSingleFundName] = useState('');
  const [singleFundHoldings, setSingleFundHoldings] = useState('');
  const [singleFundTotalProfit, setSingleFundTotalProfit] = useState('');
  const [singleFundSuggestions, setSingleFundSuggestions] = useState<any[]>([]);
  const [batchFundCodes, setBatchFundCodes] = useState('');

  // 从 localStorage 加载分组
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = () => {
    const savedGroups = JSON.parse(localStorage.getItem('fundGroups') || '[]');
    const savedMapping = JSON.parse(localStorage.getItem('fundGroupMapping') || '[]');

    if (savedGroups.length === 0) {
      const defaultGroup: Group = {
        id: 'all',
        name: '全部',
        createdAt: Date.now(),
        isDefault: true,
      };
      setGroups([defaultGroup]);
      localStorage.setItem('fundGroups', JSON.stringify([defaultGroup]));
    } else {
      setGroups(savedGroups);
    }

    setFundGroupMapping(savedMapping);
  };

  // 创建新分组
  const createGroup = () => {
    if (!newGroupName.trim()) {
      alert('请输入分组名称');
      return;
    }

    const newGroup: Group = {
      id: Date.now().toString(),
      name: newGroupName.trim(),
      createdAt: Date.now(),
      isDefault: false,
    };

    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    localStorage.setItem('fundGroups', JSON.stringify(updatedGroups));
    setNewGroupName('');
    setShowGroupManage(false);
  };

  // 删除分组
  const deleteGroup = (groupId: string) => {
    if (groupId === 'all') {
      alert('默认分组不能删除');
      return;
    }

    if (!confirm('确定要删除这个分组吗？该分组下的基金将移到"全部"分组。')) {
      return;
    }

    const updatedGroups = groups.filter(g => g.id !== groupId);
    setGroups(updatedGroups);
    localStorage.setItem('fundGroups', JSON.stringify(updatedGroups));

    const updatedMapping = fundGroupMapping.map(mapping => {
      if (mapping.groupId === groupId) {
        return { ...mapping, groupId: 'all' };
      }
      return mapping;
    });
    setFundGroupMapping(updatedMapping);
    localStorage.setItem('fundGroupMapping', JSON.stringify(updatedMapping));

    if (selectedGroupId === groupId) {
      setSelectedGroupId('all');
    }
  };

  // 切换分组
  const switchGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
  };

  // 获取当前分组下的基金代码
  const getCurrentGroupFundCodes = () => {
    if (selectedGroupId === 'all') {
      const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
      return favorites;
    }
    return fundGroupMapping
      .filter(m => m.groupId === selectedGroupId)
      .map(m => m.fundCode);
  };

  // 从 localStorage 加载自选基金
  useEffect(() => {
    loadFavorites();
  }, [selectedGroupId, fundGroupMapping]);

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const currentGroupFundCodes = getCurrentGroupFundCodes();

      if (currentGroupFundCodes.length === 0) {
        setFunds([]);
        setLoading(false);
        return;
      }

      const holdingsMap = JSON.parse(localStorage.getItem('fundHoldings') || '{}');
      const totalProfitMap = JSON.parse(localStorage.getItem('fundTotalProfit') || '{}');

      const fundPromises = currentGroupFundCodes.map(async (code: string) => {
        try {
          const cacheKey = `fund_cache_${code}`;
          const cachedData = localStorage.getItem(cacheKey);
          const cacheTime = localStorage.getItem(`${cacheKey}_time`);

          if (cachedData && cacheTime) {
            const cacheAge = Date.now() - parseInt(cacheTime);
            if (cacheAge < 24 * 60 * 60 * 1000) {
              const data = JSON.parse(cachedData);
              return {
                ...data,
                holdings: holdingsMap[code] || 0,
                estimatedProfit: holdingsMap[code] ? (holdingsMap[code] * data.change_percent / 100) : 0,
                totalProfit: totalProfitMap[code] || 0,
              };
            }
          }

          const response = await fetch(`/api/fund/${code}`);
          if (!response.ok) return null;
          const data = await response.json();

          localStorage.setItem(cacheKey, JSON.stringify(data));
          localStorage.setItem(`${cacheKey}_time`, Date.now().toString());

          return {
            ...data,
            holdings: holdingsMap[code] || 0,
            estimatedProfit: holdingsMap[code] ? (holdingsMap[code] * data.change_percent / 100) : 0,
            totalProfit: totalProfitMap[code] || 0,
          };
        } catch (error) {
          console.error(`获取基金 ${code} 数据失败:`, error);
          return null;
        }
      });

      const results = await Promise.all(fundPromises);
      const validFunds = results.filter(f => f !== null) as FundWithHoldings[];
      setFunds(validFunds);
    } catch (error) {
      console.error('加载自选基金失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 更新持仓金额
  const updateHoldings = (code: string, value: string) => {
    const holdingsMap = JSON.parse(localStorage.getItem('fundHoldings') || '{}');
    const amount = parseFloat(value) || 0;

    holdingsMap[code] = amount;
    localStorage.setItem('fundHoldings', JSON.stringify(holdingsMap));

    setFunds(funds.map(fund => {
      if (fund.code === code) {
        const newHoldings = amount;
        return {
          ...fund,
          holdings: newHoldings,
          estimatedProfit: newHoldings * fund.change_percent / 100,
        };
      }
      return fund;
    }));

    setEditingHoldings(null);
  };

  // 更新总收益
  const updateTotalProfit = (code: string, value: string) => {
    const totalProfitMap = JSON.parse(localStorage.getItem('fundTotalProfit') || '{}');
    const amount = parseFloat(value) || 0;

    totalProfitMap[code] = amount;
    localStorage.setItem('fundTotalProfit', JSON.stringify(totalProfitMap));

    setFunds(funds.map(fund => {
      if (fund.code === code) {
        return { ...fund, totalProfit: amount };
      }
      return fund;
    }));
  };

  // 移除自选基金
  const removeFavorite = (code: string) => {
    if (!confirm('确定要移除这只基金吗？')) return;

    const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
    const updatedFavorites = favorites.filter((c: string) => c !== code);
    localStorage.setItem('fundFavorites', JSON.stringify(updatedFavorites));

    const holdingsMap = JSON.parse(localStorage.getItem('fundHoldings') || '{}');
    delete holdingsMap[code];
    localStorage.setItem('fundHoldings', JSON.stringify(holdingsMap));

    const totalProfitMap = JSON.parse(localStorage.getItem('fundTotalProfit') || '{}');
    delete totalProfitMap[code];
    localStorage.setItem('fundTotalProfit', JSON.stringify(totalProfitMap));

    const updatedMapping = fundGroupMapping.filter(m => m.fundCode !== code);
    setFundGroupMapping(updatedMapping);
    localStorage.setItem('fundGroupMapping', JSON.stringify(updatedMapping));

    setFunds(funds.filter(f => f.code !== code));
  };

  // 单个添加自选基金
  const addSingleFundToFavorites = async () => {
    if (!singleFundCode.trim()) {
      alert('请输入基金代码');
      return;
    }

    if (!/^\d{6}$/.test(singleFundCode.trim())) {
      alert('请输入有效的6位基金代码');
      return;
    }

    try {
      // 检查是否已存在
      const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
      if (favorites.includes(singleFundCode.trim())) {
        alert('该基金已在自选列表中');
        return;
      }

      // 获取基金数据
      const response = await fetch(`/api/fund/${singleFundCode.trim()}`);
      if (!response.ok) {
        alert('获取基金数据失败，请检查基金代码是否正确');
        return;
      }

      const data = await response.json();

      // 添加到自选列表
      favorites.push(singleFundCode.trim());
      localStorage.setItem('fundFavorites', JSON.stringify(favorites));

      // 添加到分组映射
      const updatedMapping = [...fundGroupMapping, {
        fundCode: singleFundCode.trim(),
        groupId: selectedGroupId,
      }];
      setFundGroupMapping(updatedMapping);
      localStorage.setItem('fundGroupMapping', JSON.stringify(updatedMapping));

      // 保存持仓金额
      if (singleFundHoldings) {
        const holdingsMap = JSON.parse(localStorage.getItem('fundHoldings') || '{}');
        holdingsMap[singleFundCode.trim()] = parseFloat(singleFundHoldings);
        localStorage.setItem('fundHoldings', JSON.stringify(holdingsMap));
      }

      // 保存总收益
      if (singleFundTotalProfit) {
        const totalProfitMap = JSON.parse(localStorage.getItem('fundTotalProfit') || '{}');
        totalProfitMap[singleFundCode.trim()] = parseFloat(singleFundTotalProfit);
        localStorage.setItem('fundTotalProfit', JSON.stringify(totalProfitMap));
      }

      // 刷新列表
      await loadFavorites();

      // 关闭弹窗并清空表单
      setShowAddFundModal(false);
      setSingleFundCode('');
      setSingleFundName('');
      setSingleFundHoldings('');
      setSingleFundTotalProfit('');
      setSingleFundSuggestions([]);

      alert(`已添加 ${data.name} 到自选`);
    } catch (error) {
      console.error('添加基金失败:', error);
      alert('添加基金失败');
    }
  };

  // 批量添加自选基金
  const addMultipleFundsToFavorites = async () => {
    if (!batchFundCodes.trim()) {
      alert('请输入基金代码');
      return;
    }

    const codes = batchFundCodes
      .split(/[,，\n]/)
      .map(c => c.trim())
      .filter(c => c.length === 6 && /^\d+$/.test(c));

    if (codes.length === 0) {
      alert('请输入有效的6位基金代码，用逗号或换行分隔');
      return;
    }

    try {
      const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
      const validCodes: string[] = [];
      const errors: string[] = [];

      for (const code of codes) {
        if (favorites.includes(code)) {
          errors.push(`${code} 已在自选列表中`);
          continue;
        }

        try {
          const response = await fetch(`/api/fund/${code}`);
          if (!response.ok) {
            errors.push(`${code} 获取失败`);
            continue;
          }

          validCodes.push(code);
          favorites.push(code);
        } catch (error) {
          errors.push(`${code} 添加失败`);
        }
      }

      if (validCodes.length === 0) {
        alert(errors.join('\n'));
        return;
      }

      localStorage.setItem('fundFavorites', JSON.stringify(favorites));

      const newMappings = validCodes.map(code => ({
        fundCode: code,
        groupId: selectedGroupId,
      }));
      const updatedMapping = [...fundGroupMapping, ...newMappings];
      setFundGroupMapping(updatedMapping);
      localStorage.setItem('fundGroupMapping', JSON.stringify(updatedMapping));

      await loadFavorites();

      setShowAddFundModal(false);
      setBatchFundCodes('');

      const message = `成功添加 ${validCodes.length} 只基金${errors.length > 0 ? `\n${errors.join('\n')}` : ''}`;
      alert(message);
    } catch (error) {
      console.error('批量添加基金失败:', error);
      alert('批量添加基金失败');
    }
  };

  // �搜索单个基金建议
  const searchSingleFundSuggestions = async (query: string) => {
    if (query.trim().length >= 1) {
      try {
        const response = await fetch(`/api/fund/search?q=${encodeURIComponent(query)}&limit=10`);
        const data = await response.json();
        setSingleFundSuggestions(data);
      } catch (err) {
        console.error('搜索失败:', err);
        setSingleFundSuggestions([]);
      }
    } else {
      setSingleFundSuggestions([]);
    }
  };

  // 排序基金
  const sortFunds = (fundsToSort: FundWithHoldings[]) => {
    const sorted = [...fundsToSort].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'code':
          comparison = a.code.localeCompare(b.code);
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'estimate':
          comparison = parseFloat(a.estimate_value) - parseFloat(b.estimate_value);
          break;
        case 'change':
          comparison = a.change_percent - b.change_percent;
          break;
        case 'holdings':
          comparison = a.holdings - b.holdings;
          break;
        case 'profit':
          comparison = a.estimatedProfit - b.estimatedProfit;
          break;
        case 'totalProfit':
          comparison = (a.totalProfit || 0) - (b.totalProfit || 0);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  };

  // 切换排序
  const toggleSort = (option: SortOption) => {
    if (sortBy === option) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(option);
      setSortOrder('asc');
    }
  };

  // 渲染排序图标
  const renderSortIcon = (option: SortOption) => {
    if (sortBy !== option) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  // 计算统计数据
  const stats = {
    totalAssets: funds.reduce((sum, f) => sum + f.holdings, 0),
    totalProfit: funds.reduce((sum, f) => sum + f.estimatedProfit, 0),
    totalHistoricalProfit: funds.reduce((sum, f) => sum + (f.totalProfit || 0), 0),
    profitRate: funds.reduce((sum, f) => sum + f.holdings, 0) > 0
      ? (funds.reduce((sum, f) => sum + f.estimatedProfit, 0) / funds.reduce((sum, f) => sum + f.holdings, 0)) * 100
      : 0,
    historicalProfitRate: funds.reduce((sum, f) => sum + f.holdings, 0) > 0
      ? (funds.reduce((sum, f) => sum + (f.totalProfit || 0), 0) / funds.reduce((sum, f) => sum + f.holdings, 0)) * 100
      : 0,
  };

  // 准备饼图数据
  const pieData = funds
    .filter(f => f.holdings > 0)
    .map(f => ({
      name: f.name.substring(0, 8) + '...',
      value: f.holdings,
      code: f.code,
    }))
    .sort((a, b) => b.value - a.value);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  const sortedFunds = sortFunds(funds);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">自选基金</h1>
          <p className="text-gray-600">共 {funds.length} 只基金</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddFundModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            添加自选
          </button>
          <button
            onClick={loadFavorites}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            刷新数据
          </button>
        </div>
      </div>

      {/* 分组选择器 */}
      {groups.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => switchGroup(group.id)}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    selectedGroupId === group.id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {group.name} ({group.id === 'all'
                    ? funds.length
                    : fundGroupMapping.filter(m => m.groupId === group.id).length
                  })
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowGroupManage(!showGroupManage)}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              管理分组
            </button>
          </div>

          {/* 分组管理面板 */}
          {showGroupManage && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="新分组名称"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={createGroup}
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  创建分组
                </button>
              </div>

              <div className="space-y-2">
                {groups.filter(g => !g.isDefault).map(group => (
                  <div key={group.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <span className="text-gray-700">{group.name}</span>
                    <button
                      onClick={() => deleteGroup(group.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 统计卡片 */}
      {funds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">总资产</p>
            <p className="text-3xl font-bold text-gray-900">
              {stats.totalAssets > 0
                ? stats.totalAssets.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : '--'
              }
            </p>
          </div>
          <div className={`bg-white rounded-lg shadow-sm p-6 ${stats.totalProfit >= 0 ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}`}>
            <p className="text-sm text-gray-600 mb-1">当日预估收益</p>
            <p className={`text-3xl font-bold ${stats.totalProfit >= 0 ? 'fund-up' : 'fund-down'}`}>
              {stats.totalAssets > 0 ? (
                <>
                  {stats.totalProfit >= 0 ? '+' : ''}
                  {stats.totalProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </>
              ) : (
                '--'
              )}
            </p>
            {stats.totalAssets > 0 && (
              <p className={`text-sm mt-1 ${stats.totalProfit >= 0 ? 'fund-up' : 'fund-down'}`}>
                {stats.totalProfit >= 0 ? '+' : ''}{stats.profitRate.toFixed(2)}%
              </p>
            )}
          </div>
          <div className={`bg-white rounded-lg shadow-sm p-6 ${stats.totalHistoricalProfit >= 0 ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'}`}>
            <p className="text-sm text-gray-600 mb-1">总收益</p>
            <p className={`text-3xl font-bold ${stats.totalHistoricalProfit >= 0 ? 'fund-up' : 'fund-down'}`}>
              {stats.totalAssets > 0 ? (
                <>
                  {stats.totalHistoricalProfit >= 0 ? '+' : ''}
                  {stats.totalHistoricalProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </>
              ) : (
                '--'
              )}
            </p>
            {stats.totalAssets > 0 && (
              <p className={`text-sm mt-1 ${stats.totalHistoricalProfit >= 0 ? 'fund-up' : 'fund-down'}`}>
                {stats.totalHistoricalProfit >= 0 ? '+' : ''}{stats.historicalProfitRate.toFixed(2)}%
              </p>
            )}
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">基金数量</p>
            <p className="text-3xl font-bold text-gray-900">{funds.length}</p>
          </div>
        </div>
      )}

      {/* 空状态 */}
      {funds.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <p className="text-gray-500 mb-4">暂无自选基金</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => setShowAddFundModal(true)}
              className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              添加自选基金
            </button>
            <Link
              href="/"
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              去搜索基金
            </Link>
          </div>
        </div>
      )}

      {/* 基金列表 */}
      {funds.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => toggleSort('code')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50"
                >
                  代码 {renderSortIcon('code')}
                </th>
                <th
                  onClick={() => toggleSort('name')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50"
                >
                  名称 {renderSortIcon('name')}
                </th>
                <th
                  onClick={() => toggleSort('estimate')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50"
                >
                  估算净值 {renderSortIcon('estimate')}
                </th>
                <th
                  onClick={() => toggleSort('change')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50"
                >
                  涨跌幅 {renderSortIcon('change')}
                </th>
                <th
                  onClick={() => toggleSort('holdings')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50"
                >
                  持仓金额 {renderSortIcon('holdings')}
                </th>
                <th
                  onClick={() => toggleSort('profit')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50"
                >
                  当日预估收益 {renderSortIcon('profit')}
                </th>
                <th
                  onClick={() => toggleSort('totalProfit')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-50"
                >
                  总收益 {renderSortIcon('totalProfit')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedFunds.map((fund) => (
                <tr key={fund.code} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/fund/${fund.code}`}
                      className="text-gray-900 hover:text-primary font-medium"
                    >
                      {fund.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/fund/${fund.code}`}
                      className="text-gray-900 hover:text-primary"
                    >
                      {fund.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                    {fund.estimate_value}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${fund.change_percent >= 0 ? 'fund-up' : 'fund-down'}`}>
                    {fund.change_percent >= 0 ? '+' : ''}{fund.change_percent.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {editingHoldings === fund.code ? (
                      <input
                        type="number"
                        defaultValue={fund.holdings}
                        onBlur={(e) => updateHoldings(fund.code, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateHoldings(fund.code, (e.target as HTMLInputElement).value);
                          }
                        }}
                        autoFocus
                        className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="输入金额"
                      />
                    ) : (
                      <button
                        onClick={() => setEditingHoldings(fund.code)}
                        className={`font-medium ${fund.holdings > 0 ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        {fund.holdings > 0
                          ? fund.holdings.toLocaleString('zh-CN', { minimumFractionDigits: 2 })
                          : '设置'}
                      </button>
                    )}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${fund.estimatedProfit >= 0 ? 'fund-up' : 'fund-down'}`}>
                    {fund.holdings > 0 ? (
                      <span className="font-medium">
                        {fund.estimatedProfit >= 0 ? '+' : ''}{fund.estimatedProfit.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap ${(fund.totalProfit || 0) >= 0 ? 'fund-up' : 'fund-down'}`}>
                    <input
                      type="number"
                      defaultValue={fund.totalProfit || 0}
                      onChange={(e) => updateTotalProfit(fund.code, e.target.value)}
                      className={`w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary ${(fund.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}
                      placeholder="输入总收益"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <button
                      onClick={() => removeFavorite(fund.code)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      移除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 持仓分布饼图 */}
      {pieData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">持仓分布</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.code}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value?.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`, '持仓金额']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 使用提示 */}
      {funds.length > 0 && stats.totalAssets === 0 && (
        <div className="bg-blue-50 rounded-lg shadow-sm p-4 border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="text-blue-600 text-xl">💡</div>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">设置持仓金额</h3>
              <p className="text-sm text-blue-700">
                点击每只基金的"持仓金额"列，输入您在该基金上的投资金额，即可查看总资产和预估收益。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 添加自选弹窗 */}
      {showAddFundModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">添加自选基金</h3>
                <button
                  onClick={() => {
                    setShowAddFundModal(false);
                    setSingleFundCode('');
                    setSingleFundName('');
                    setSingleFundHoldings('');
                    setSingleFundTotalProfit('');
                    setBatchFundCodes('');
                    setSingleFundSuggestions([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* 模式切换 */}
              <div className="flex mb-6 border-b border-gray-200">
                <button
                  onClick={() => setAddFundMode('single')}
                  className={`flex-1 px-4 py-2 font-medium ${addFundMode === 'single'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-600'
                  }`}
                >
                  单个添加
                </button>
                <button
                  onClick={() => setAddFundMode('batch')}
                  className={`flex-1 px-4 py-2 font-medium ${addFundMode === 'batch'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-600'
                  }`}
                >
                  批量添加
                </button>
              </div>

              {/* 单个添加 */}
              {addFundMode === 'single' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">基金代码</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={singleFundCode}
                        onChange={(e) => {
                          setSingleFundCode(e.target.value);
                          searchSingleFundSuggestions(e.target.value);
                        }}
                        placeholder="输入6位基金代码"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        maxLength={6}
                      />
                      {singleFundSuggestions.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                          {singleFundSuggestions.map((suggestion) => (
                            <div
                              key={suggestion.code}
                              onClick={() => {
                                setSingleFundCode(suggestion.code);
                                setSingleFundName(suggestion.name);
                                setSingleFundSuggestions([]);
                              }}
                              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-gray-900">{suggestion.name}</div>
                              <div className="text-sm text-gray-600 mt-1">
                                代码：{suggestion.code}
                                {suggestion.type && (
                                  <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                    {suggestion.type}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {singleFundName && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">基金名称</label>
                      <input
                        type="text"
                        value={singleFundName}
                        readOnly
                        className="w-full px-4 py-2 border border-gray-300 rounded-md bg-gray-50"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">当前持仓金额（选填）</label>
                    <input
                      type="number"
                      value={singleFundHoldings}
                      onChange={(e) => setSingleFundHoldings(e.target.value)}
                      placeholder="输入持仓金额"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">当前总收益（选填）</label>
                    <input
                      type="number"
                      value={singleFundTotalProfit}
                      onChange={(e) => setSingleFundTotalProfit(e.target.value)}
                      placeholder="输入总收益"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={addSingleFundToFavorites}
                      className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                    >
                      添加
                    </button>
                    <button
                      onClick={() => {
                        setShowAddFundModal(false);
                        setSingleFundCode('');
                        setSingleFundName('');
                        setSingleFundHoldings('');
                        setSingleFundTotalProfit('');
                        setSingleFundSuggestions([]);
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* 批量添加 */}
              {addFundMode === 'batch' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">基金代码</label>
                    <textarea
                      value={batchFundCodes}
                      onChange={(e) => setBatchFundCodes(e.target.value)}
                      placeholder="输入多个6位基金代码，用逗号或换行分隔&#10;例如：000001,000002,000003"
                      className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                      rows={6}
                    />
                  </div>

                  <p className="text-sm text-gray-500">
                    💡 提示：批量添加时只添加基金代码，不记录持仓金额和总收益。如需设置这些信息，请使用单个添加。
                  </p>

                  <div className="flex gap-2 pt-4">
                    <button
                      onClick={addMultipleFundsToFavorites}
                      className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                    >
                      批量添加
                    </button>
                    <button
                      onClick={() => {
                        setShowAddFundModal(false);
                        setBatchFundCodes('');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}