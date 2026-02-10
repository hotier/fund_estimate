'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

interface FundData {
  code: string;
  name: string;
  estimate_value: string;
  change_percent: number;
  update_time: string;
  type?: string;
}

interface FundWithHoldings extends FundData {
  id?: string;
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

// 数据验证工具函数
const validateFundData = (fund: any): fund is FundData => {
  return (
    fund &&
    fund.code &&
    fund.name &&
    fund.estimate_value !== undefined &&
    fund.change_percent !== undefined &&
    fund.update_time &&
    typeof fund.code === 'string' &&
    typeof fund.name === 'string' &&
    (typeof fund.estimate_value === 'string' || typeof fund.estimate_value === 'number') &&
    typeof fund.change_percent === 'number'
  );
};

const validateFundWithHoldings = (fund: any): fund is FundWithHoldings => {
  return (
    validateFundData(fund) &&
    fund.holdings !== undefined &&
    fund.estimatedProfit !== undefined &&
    typeof fund.holdings === 'number' &&
    typeof fund.estimatedProfit === 'number' &&
    Array.isArray(fund.stocks)
  );
};

export default function FavoritesPage() {
  const { user, token, favorites: dbFavorites, groups: dbGroups, refreshFavorites, refreshGroups } = useAuth();

  const [funds, setFunds] = useState<FundWithHoldings[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [editingHoldings, setEditingHoldings] = useState<string | null>(null);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now());

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

  // 从数据库加载分组
  useEffect(() => {
    loadGroups();
  }, [dbGroups]);

  const loadGroups = () => {
    // 优先使用数据库中的分组
    if (dbGroups && dbGroups.length > 0) {
      const formattedGroups: Group[] = dbGroups.map(g => ({
        id: g.id,
        name: g.name,
        createdAt: new Date(g.created_at).getTime(),
        isDefault: g.is_default,
      }));

      // 确保始终有"全部"分组
      const hasAllGroup = formattedGroups.some(g => g.isDefault);
      if (!hasAllGroup) {
        const allGroup: Group = {
          id: 'all',
          name: '全部',
          createdAt: Date.now(),
          isDefault: true,
        };
        setGroups([allGroup, ...formattedGroups]);
      } else {
        setGroups(formattedGroups);
      }
    } else {
      // 降级使用 localStorage
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
        // 确保 localStorage 中也有"全部"分组
        const hasAllGroup = savedGroups.some((g: Group) => g.isDefault);
        if (!hasAllGroup) {
          const allGroup: Group = {
            id: 'all',
            name: '全部',
            createdAt: Date.now(),
            isDefault: true,
          };
          setGroups([allGroup, ...savedGroups]);
          localStorage.setItem('fundGroups', JSON.stringify([allGroup, ...savedGroups]));
        } else {
          setGroups(savedGroups);
        }
      }
      setFundGroupMapping(savedMapping);
    }
  };

  // 创建新分组
  const createGroup = async () => {
    if (!newGroupName.trim()) {
      alert('请输入分组名称');
      return;
    }

    if (user && token) {
      // 保存到数据库
      try {
        await (await import('@/lib/services/auth-service')).createGroup(
          user.id,
          newGroupName.trim()
        );
        await refreshGroups();
        setNewGroupName('');
      } catch (error: any) {
        console.error('创建分组失败:', error);
        if (error.code === '23505') {
          alert('该分组名称已存在');
        } else if (error.code === '409' || error.status === 409) {
          alert('分组冲突：可能该分组名称已存在');
        } else {
          alert(error.message || '创建分组失败');
        }
        return;
      }
    } else {
      // 保存到 localStorage
      const newGroup: Group = {
        id: Date.now().toString(),
        name: newGroupName.trim(),
        createdAt: Date.now(),
        isDefault: false,
      };

      const updatedGroups = [...groups, newGroup];
      setGroups(updatedGroups);
      localStorage.setItem('fundGroups', JSON.stringify(updatedGroups));
    }

    setNewGroupName('');
    setShowGroupManage(false);
  };

  // 删除分组
  const deleteGroup = async (groupId: string) => {
    if (groupId === 'all') {
      alert('默认分组不能删除');
      return;
    }

    if (!confirm('确定要删除这个分组吗？该分组下的基金将移到"全部"分组。')) {
      return;
    }

    if (user && token) {
      // 从数据库删除
      try {
        await (await import('@/lib/services/auth-service')).deleteGroup(groupId, user.id);
        await refreshGroups();
      } catch (error: any) {
        alert(error.message || '删除分组失败');
        return;
      }

      if (selectedGroupId === groupId) {
        setSelectedGroupId('all');
      }
    } else {
      // 从 localStorage 删除
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

  // 从数据库加载自选基金
  useEffect(() => {
    loadFavorites();
  }, [dbFavorites, selectedGroupId, fundGroupMapping]);

  const loadFavorites = async (useCache: boolean = true) => {
    setLoading(true);
    try {
      let currentGroupFundCodes: string[] = [];

      if (user && token && dbFavorites && dbFavorites.length > 0) {
        // 从数据库加载
        if (selectedGroupId === 'all') {
          currentGroupFundCodes = dbFavorites.map(f => f.fund_code);
        } else {
          currentGroupFundCodes = dbFavorites
            .filter(f => f.group_id === selectedGroupId)
            .map(f => f.fund_code);
        }
      } else {
        // 从 localStorage 加载
        currentGroupFundCodes = getCurrentGroupFundCodes();
      }

      if (currentGroupFundCodes.length === 0) {
        setFunds([]);
        setLoading(false);
        return;
      }

      // 优先使用缓存数据（如果是首次加载）
      if (useCache) {
        const cachedFundsData = localStorage.getItem('favorites_cache');
        const cachedFundsTime = localStorage.getItem('favorites_cache_time');
        
        if (cachedFundsData && cachedFundsTime) {
          try {
            const cacheAge = Date.now() - parseInt(cachedFundsTime);
            const CACHE_DURATION = 5 * 60 * 1000; // 5 分钟缓存
            
            // 检查缓存是否过期
            if (cacheAge > CACHE_DURATION) {
              console.log(`[自选页] 缓存已过期 (${Math.floor(cacheAge / 1000)}秒)，重新获取数据`);
              localStorage.removeItem('favorites_cache');
              localStorage.removeItem('favorites_cache_time');
            } else {
              const cachedFunds = JSON.parse(cachedFundsData);
              
              // 验证缓存数据的完整性
              const isValidCache = cachedFunds.every(validateFundWithHoldings);

              if (!isValidCache) {
                console.warn('[自选页] 缓存数据不完整，重新获取');
                localStorage.removeItem('favorites_cache');
                localStorage.removeItem('favorites_cache_time');
              } else {
                const cachedFundCodes = cachedFunds.map((f: any) => f.code);
                // 检查缓存的基金代码是否匹配当前分组
                const currentCodesSet = new Set(currentGroupFundCodes);
                const cachedCodesSet = new Set(cachedFundCodes);
                
                // 如果缓存数据有效（基金代码匹配且数据完整），先显示缓存
                if (currentCodesSet.size === cachedCodesSet.size && 
                    currentGroupFundCodes.every(code => cachedCodesSet.has(code))) {
                  console.log(`[自选页] 使用缓存数据快速加载 (缓存剩余 ${Math.floor((CACHE_DURATION - cacheAge) / 1000)}秒)`);
                  
                  // 从数据库获取持仓和收益数据
                  const fundsWithHoldings = cachedFunds.map((fund: any) => {
                    let holdings = 0;
                    let totalProfit = 0;
                    if (user && token && dbFavorites) {
                      const dbFund = dbFavorites.find(f => f.fund_code === fund.code);
                      if (dbFund) {
                        holdings = dbFund.holdings || 0;
                        totalProfit = dbFund.total_profit || 0;
                      }
                    } else {
                      const holdingsMap = JSON.parse(localStorage.getItem('fundHoldings') || '{}');
                      const totalProfitMap = JSON.parse(localStorage.getItem('fundTotalProfit') || '{}');
                      holdings = holdingsMap[fund.code] || 0;
                      totalProfit = totalProfitMap[fund.code] || 0;
                    }
                    
                    return {
                      ...fund,
                      holdings,
                      estimatedProfit: holdings ? (holdings * fund.change_percent / 100) : 0,
                      totalProfit,
                    };
                  });
                  
                  setFunds(fundsWithHoldings);
                  setLoading(false); // 先显示缓存
                  
                  // 然后在后台静默更新数据
                  fetchFreshFundData(currentGroupFundCodes);
                  return;
                }
              }
            }
          } catch (error) {
            console.error('[自选页] 读取缓存失败:', error);
            localStorage.removeItem('favorites_cache');
            localStorage.removeItem('favorites_cache_time');
          }
        }
      }

      // 如果没有缓存或缓存无效，直接获取新数据
      await fetchFreshFundData(currentGroupFundCodes);
    } catch (error) {
      console.error('加载自选基金失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取最新的基金数据
  const fetchFreshFundData = async (fundCodes: string[]) => {
    console.log(`[自选页] 从 API 获取 ${fundCodes.length} 只基金的实时数据...`);
    
    const fundPromises = fundCodes.map(async (code: string) => {
      try {
        // 直接从 API 获取实时估值数据（不使用缓存）
        console.log(`[自选页] 从 API 获取基金 ${code} 的实时估值数据...`);
        const response = await fetch(`/api/fund/${code}`);
        if (!response.ok) {
          console.error(`[自选页] 获取基金 ${code} 数据失败:`, response.status);
          return null;
        }
        const fundData = await response.json();

        // 从数据库获取持仓和收益数据
        let holdings = 0;
        let totalProfit = 0;
        if (user && token && dbFavorites) {
          const dbFund = dbFavorites.find(f => f.fund_code === code);
          if (dbFund) {
            holdings = dbFund.holdings || 0;
            totalProfit = dbFund.total_profit || 0;
          }
        } else {
          // 从 localStorage 获取
          const holdingsMap = JSON.parse(localStorage.getItem('fundHoldings') || '{}');
          const totalProfitMap = JSON.parse(localStorage.getItem('fundTotalProfit') || '{}');
          holdings = holdingsMap[code] || 0;
          totalProfit = totalProfitMap[code] || 0;
        }

        console.log(`[自选页] 基金 ${code} 数据获取成功: ${fundData.name}, 估值: ${fundData.estimate_value}, 涨跌幅: ${fundData.change_percent}%`);

        return {
          ...fundData,
          holdings,
          estimatedProfit: holdings ? (holdings * fundData.change_percent / 100) : 0,
          totalProfit,
        };
      } catch (error) {
        console.error(`获取基金 ${code} 数据失败:`, error);
        return null;
      }
    });

    const results = await Promise.all(fundPromises);
    const validFunds = results.filter(f => f !== null) as FundWithHoldings[];
    
    // 智能更新：只更新变动的数据
    setFunds(prevFunds => {
      if (prevFunds.length === 0) {
        // 如果没有旧数据，直接使用新数据
        return validFunds;
      }
      
      // 如果有旧数据，只更新估值相关的字段
      return validFunds.map(newFund => {
        const oldFund = prevFunds.find(f => f.code === newFund.code);
        if (oldFund) {
          // 检查是否有变化
          const valueChanged = newFund.estimate_value !== oldFund.estimate_value;
          const percentChanged = newFund.change_percent !== oldFund.change_percent;
          
          if (valueChanged || percentChanged) {
            console.log(`[自选页] 基金 ${newFund.code} 数据已更新: ${newFund.estimate_value} (${newFund.change_percent}%)`);
          }
          
          return newFund;
        }
        return newFund;
      });
    });
    
    // 验证数据完整性后再保存到缓存
    console.log(`[自选页] 开始验证 ${validFunds.length} 只基金数据的完整性...`);
    
    const isDataValid = validFunds.every((fund, index) => {
      console.log(`[自选页] 验证基金 ${fund?.code || 'unknown'} (索引 ${index}):`, {
        stocks: fund?.stocks,
        stocksType: typeof fund?.stocks,
        stocksIsArray: Array.isArray(fund?.stocks),
        stocksLength: Array.isArray(fund?.stocks) ? fund.stocks.length : 'N/A',
        validateFundDataResult: validateFundData(fund),
        validateFundWithHoldingsResult: validateFundWithHoldings(fund)
      });
      
      const isValid = validateFundWithHoldings(fund);
      if (!isValid) {
        console.error(`[自选页] 基金 ${fund?.code || 'unknown'} (索引 ${index}) 数据验证失败:`, {
          fund: fund,
          hasFund: !!fund,
          hasCode: !!fund?.code,
          code: fund?.code,
          codeType: typeof fund?.code,
          hasName: !!fund?.name,
          name: fund?.name,
          nameType: typeof fund?.name,
          hasEstimateValue: fund?.estimate_value !== undefined,
          estimateValue: fund?.estimate_value,
          estimateValueType: typeof fund?.estimate_value,
          hasChangePercent: fund?.change_percent !== undefined,
          changePercent: fund?.change_percent,
          changePercentType: typeof fund?.change_percent,
          hasUpdateTime: !!fund?.update_time,
          updateTime: fund?.update_time,
          hasHoldings: fund?.holdings !== undefined,
          holdings: fund?.holdings,
          holdingsType: typeof fund?.holdings,
          hasEstimatedProfit: fund?.estimatedProfit !== undefined,
          estimatedProfit: fund?.estimatedProfit,
          estimatedProfitType: typeof fund?.estimatedProfit,
          hasStocks: Array.isArray(fund?.stocks),
          stocks: fund?.stocks,
          stocksType: typeof fund?.stocks,
          stocksLength: Array.isArray(fund?.stocks) ? fund.stocks.length : 'N/A'
        });
      }
      return isValid;
    });

    console.log(`[自选页] 数据验证结果: ${isDataValid ? '通过' : '失败'}`);

    if (isDataValid) {
      // 保存到缓存（5分钟）
      localStorage.setItem('favorites_cache', JSON.stringify(validFunds));
      localStorage.setItem('favorites_cache_time', Date.now().toString());
      console.log(`[自选页] 已保存 ${validFunds.length} 只基金数据到缓存 (5分钟有效期)`);
    } else {
      console.warn('[自选页] 数据验证失败，不保存到缓存');
      localStorage.removeItem('favorites_cache');
      localStorage.removeItem('favorites_cache_time');
    }
    
    setLastUpdateTime(Date.now()); // 更新最后更新时间
    setLoading(false);
  };

  // 3 分钟自动刷新机制（后台静默更新，不显示 loading）
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[自选页] 3 分钟自动刷新基金数据（后台静默更新）...');
      loadFavorites(false); // false 表示不使用缓存，强制获取最新数据
    }, 3 * 60 * 1000); // 3 分钟 = 180,000 毫秒

    return () => clearInterval(interval);
  }, [dbFavorites, selectedGroupId]);

  // 更新持仓金额
  const updateHoldings = async (code: string, value: string) => {
    const amount = parseFloat(value) || 0;

    // 检查用户是否登录
    if (!user || !token) {
      alert('请先登录');
      return;
    }

    // 同步到数据库
    const dbFund = dbFavorites?.find(f => f.fund_code === code);
    if (!dbFund || !dbFund.id) {
      console.error('未找到自选基金:', code);
      alert('未找到该自选基金');
      return;
    }

    try {
      const response = await fetch(`/api/favorites/${dbFund.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ holdings: amount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新失败');
      }

      // 只刷新数据库数据，不触发基金估值数据刷新
      await refreshFavorites();
    } catch (error: any) {
      console.error('更新持仓失败:', error);
      alert(error.message || '更新持仓失败');
      return;
    }

    // 只更新本地状态，不触发基金估值数据刷新
    setFunds(funds.map(fund => {
      if (fund.code === code) {
        return {
          ...fund,
          holdings: amount,
          estimatedProfit: amount * fund.change_percent / 100,
        };
      }
      return fund;
    }));

    setEditingHoldings(null);
  };

  // 更新总收益
  const updateTotalProfit = async (code: string, value: string) => {
    const amount = parseFloat(value) || 0;

    // 检查用户是否登录
    if (!user || !token) {
      alert('请先登录');
      return;
    }

    // 同步到数据库
    const dbFund = dbFavorites?.find(f => f.fund_code === code);
    if (!dbFund || !dbFund.id) {
      console.error('未找到自选基金:', code);
      alert('未找到该自选基金');
      return;
    }

    try {
      const response = await fetch(`/api/favorites/${dbFund.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ totalProfit: amount }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '更新失败');
      }

      // 只刷新数据库数据，不触发基金估值数据刷新
      await refreshFavorites();
    } catch (error: any) {
      console.error('更新总收益失败:', error);
      alert(error.message || '更新总收益失败');
      return;
    }

    // 只更新本地状态，不触发基金估值数据刷新
    setFunds(funds.map(fund => {
      if (fund.code === code) {
        return { ...fund, totalProfit: amount };
      }
      return fund;
    }));
  };

  // 移除自选基金
  const removeFavorite = async (code: string) => {
    if (!confirm('确定要移除这只基金吗？')) return;

    try {
      if (user && token) {
        // 从数据库删除
        const dbFund = dbFavorites?.find(f => f.fund_code === code);
        if (dbFund && dbFund.id) {
          const response = await fetch(`/api/favorites/${dbFund.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) {
            throw new Error('删除失败');
          }

          // 只刷新数据库数据，不触发基金估值数据刷新
          await refreshFavorites();
        }
      } else {
        // 从 localStorage 删除
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

        // 刷新列表
        await loadFavorites();
      }

      // 只从本地状态移除，不触发基金估值数据刷新
      setFunds(funds.filter(f => f.code !== code));
    } catch (error) {
      console.error('移除基金失败:', error);
      alert('移除基金失败');
    }
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
      if (user && token) {
        const existingFund = dbFavorites?.find(f => f.fund_code === singleFundCode.trim());
        if (existingFund) {
          alert('该基金已在自选列表中');
          return;
        }
      } else {
        const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
        if (favorites.includes(singleFundCode.trim())) {
          alert('该基金已在自选列表中');
          return;
        }
      }

      // 获取基金数据
      const response = await fetch(`/api/fund/${singleFundCode.trim()}`);
      if (!response.ok) {
        alert('获取基金数据失败，请检查基金代码是否正确');
        return;
      }

      const data = await response.json();

      if (user && token) {
        // 保存到数据库
        const addResponse = await fetch('/api/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            fundCode: singleFundCode.trim(),
            holdings: singleFundHoldings ? parseFloat(singleFundHoldings) : 0,
            totalProfit: singleFundTotalProfit ? parseFloat(singleFundTotalProfit) : 0,
            groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
          }),
        });

        if (!addResponse.ok) {
          const errorData = await addResponse.json();
          throw new Error(errorData.error || '添加失败');
        }

        // 只刷新数据库数据，不触发基金估值数据刷新
        await refreshFavorites();
      } else {
        // 保存到 localStorage
        const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
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
      }

      // 关闭弹窗并清空表单
      setShowAddFundModal(false);
      setSingleFundCode('');
      setSingleFundName('');
      setSingleFundHoldings('');
      setSingleFundTotalProfit('');
      setSingleFundSuggestions([]);

      alert(`已添加 ${data.name} 到自选`);
    } catch (error: any) {
      console.error('添加基金失败:', error);
      alert(error.message || '添加基金失败');
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
      const validCodes: string[] = [];
      const errors: string[] = [];

      for (const code of codes) {
        // 检查是否已存在
        if (user && token) {
          const existingFund = dbFavorites?.find(f => f.fund_code === code);
          if (existingFund) {
            errors.push(`${code} 已在自选列表中`);
            continue;
          }
        } else {
          const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
          if (favorites.includes(code)) {
            errors.push(`${code} 已在自选列表中`);
            continue;
          }
        }

        try {
          const response = await fetch(`/api/fund/${code}`);
          if (!response.ok) {
            errors.push(`${code} 获取失败`);
            continue;
          }

          if (user && token) {
            // 保存到数据库
            const addResponse = await fetch('/api/favorites', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                fundCode: code,
                holdings: 0,
                totalProfit: 0,
                groupId: selectedGroupId !== 'all' ? selectedGroupId : undefined,
              }),
            });

            if (!addResponse.ok) {
              errors.push(`${code} 添加失败`);
              continue;
            }

            validCodes.push(code);
          } else {
            // 保存到 localStorage
            validCodes.push(code);
          }
        } catch (error) {
          errors.push(`${code} 添加失败`);
        }
      }

      if (validCodes.length === 0) {
        alert(errors.join('\n'));
        return;
      }

      if (!user || !token) {
        // 保存到 localStorage
        const favorites = JSON.parse(localStorage.getItem('fundFavorites') || '[]');
        validCodes.forEach(code => {
          favorites.push(code);
        });
        localStorage.setItem('fundFavorites', JSON.stringify(favorites));

        const newMappings = validCodes.map(code => ({
          fundCode: code,
          groupId: selectedGroupId,
        }));
        const updatedMapping = [...fundGroupMapping, ...newMappings];
        setFundGroupMapping(updatedMapping);
        localStorage.setItem('fundGroupMapping', JSON.stringify(updatedMapping));
      } else {
        // 刷新数据库数据
        await refreshFavorites();
      }

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

  // 未登录提示
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">请先登录</h2>
          <p className="text-gray-600 mb-6">登录后即可查看和管理您的自选基金</p>
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">自选基金</h1>
            <div className="h-6 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-24 animate-pulse"></div>
          </div>
        </div>

        {/* 统计卡片骨架 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-6">
              <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
              <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
            </div>
          ))}
        </div>

        {/* 基金列表骨架 */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                  </div>
                  <div className="flex gap-4">
                    <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                    <div className="h-6 bg-gray-200 rounded w-20 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
          <span className="text-sm text-gray-500">
            更新于 {new Date(lastUpdateTime).toLocaleTimeString('zh-CN')}
          </span>
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
                  <td className="px-4 py-3 whitespace-nowrap text-gray-900 value-update">
                    {fund.estimate_value}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap value-update ${fund.change_percent >= 0 ? 'fund-up' : 'fund-down'}`}>
                    {fund.change_percent >= 0 ? '+' : ''}{Number(fund.change_percent).toFixed(2)}%
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