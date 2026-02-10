'use client';

import { useState, useEffect } from 'react';

export default function DataSyncPage() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [customCodes, setCustomCodes] = useState('');
  const [stats, setStats] = useState<any>(null);

  // 热门基金代码列表
  const hotFunds = [
    '000001', '000002', '000003', '000008', '000011', '000016',
    '000018', '000021', '000027', '000031', '000048', '000063',
    '000091', '000098', '000104', '000113', '000117', '000132',
    '000166', '000171', '000174', '000178', '000184', '000187',
    '000213', '000248', '000267', '000271', '000290', '000298',
    '000303', '000308', '000311', '000342', '000358', '000369',
    '000382', '000390', '000401', '000406', '000409', '000410',
    '000418', '000421', '000432', '000443', '000446', '000466',
    '000467', '000470', '000471', '000472', '000475', '000478',
    '000483', '000485', '000506', '000518', '000521', '000523',
    '000533', '000538', '000540', '000545', '000547', '000548',
    '000552', '000556', '000558', '000562', '000563', '000566',
    '000567', '000568', '000569', '000570', '000571', '000572',
    '000573', '000575', '000576', '000577', '000578', '000579',
    '000580', '000582', '000583', '000586', '000588', '000590',
    '000591', '000592', '000593', '000594', '000596', '000597',
    '000598', '000599', '000600', '000601', '000602', '000603',
    '000604', '000605', '000606', '000607', '000608', '000609',
    '000610', '000611', '000612', '000613', '000615', '000616',
    '000617', '000618', '000619', '000620', '000621', '000622',
    '000623', '000625', '000626', '000628', '000629', '000630',
  ];

  // 获取缓存统计
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/data/sync');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('获取统计失败:', error);
    }
  };

  // 同步热门基金
  const syncHotFunds = async () => {
    if (!confirm(`确定要同步 ${hotFunds.length} 只热门基金吗？这可能需要几分钟时间。`)) {
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: hotFunds }),
      });

      const data = await response.json();
      setResults(data.results || []);

      // 刷新统计
      await fetchStats();
    } catch (error) {
      console.error('同步失败:', error);
      setResults([{ error: '同步失败' }]);
    } finally {
      setLoading(false);
    }
  };

  // 同步自定义基金
  const syncCustomFunds = async () => {
    const codes = customCodes
      .split(/[,，\n]/)
      .map(c => c.trim())
      .filter(c => c);

    if (codes.length === 0) {
      alert('请输入至少一个基金代码');
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      const response = await fetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes }),
      });

      const data = await response.json();
      setResults(data.results || []);

      // 刷新统计
      await fetchStats();
    } catch (error) {
      console.error('同步失败:', error);
      setResults([{ error: '同步失败' }]);
    } finally {
      setLoading(false);
    }
  };

  // 清除本地缓存
  const clearLocalCache = () => {
    if (confirm('确定要清除所有本地缓存吗？')) {
      localStorage.clear();
      alert('本地缓存已清除');
    }
  };

  // 加载统计
  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">数据管理</h1>
        <p className="text-gray-600">预加载和管理基金数据</p>
      </div>

      {/* 基金索引说明 */}
      <div className="bg-green-50 rounded-lg shadow-sm p-6 border border-green-200">
        <div className="flex items-start gap-3">
          <div className="text-green-600 text-2xl">✓</div>
          <div>
            <h2 className="text-lg font-semibold text-green-900 mb-1">基金索引已初始化</h2>
            <p className="text-green-700 text-sm">
              开发阶段已导入 26,094 只基金索引数据，包含基金代码、名称和类型。
              用户现在可以通过基金代码或名称快速搜索基金，搜索体验已优化。
            </p>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-600">基金索引数量</p>
          <p className="text-2xl font-semibold text-gray-900">26,094</p>
          <p className="text-xs text-gray-500 mt-1">完整基金库</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-600">缓存项数量</p>
          <p className="text-2xl font-semibold text-gray-900">{stats?.cache?.size || 0}</p>
          <p className="text-xs text-gray-500 mt-1">内存缓存</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6">
          <p className="text-sm text-gray-600">数据库基金数量</p>
          <p className="text-2xl font-semibold text-gray-900">{stats?.database?.fundCount || 0}</p>
          <p className="text-xs text-gray-500 mt-1">完整数据</p>
        </div>
      </div>

      {/* 操作区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 热门基金同步 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">同步热门基金</h2>
          <p className="text-gray-600 mb-4">
            预加载 {hotFunds.length} 只热门基金到数据库，让搜索更快
          </p>
          <button
            onClick={syncHotFunds}
            disabled={loading}
            className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '同步中...' : `同步 ${hotFunds.length} 只热门基金`}
          </button>
        </div>

        {/* 自定义基金同步 */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">同步自定义基金</h2>
          <p className="text-gray-600 mb-4">输入基金代码，用逗号或换行分隔</p>
          <textarea
            value={customCodes}
            onChange={(e) => setCustomCodes(e.target.value)}
            placeholder="例如：000001,000002,000003&#10;每行一个代码也可以"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary mb-4"
            rows={4}
          />
          <button
            onClick={syncCustomFunds}
            disabled={loading}
            className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? '同步中...' : '同步自定义基金'}
          </button>
        </div>
      </div>

      {/* 本地缓存管理 */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">本地缓存管理</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-600">清除浏览器本地缓存，强制从服务器重新获取数据</p>
          </div>
          <button
            onClick={clearLocalCache}
            className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            清除本地缓存
          </button>
        </div>
      </div>

      {/* 同步结果 */}
      {results.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">同步结果</h2>
          <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    代码
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    名称
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    状态
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {result.code}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {result.name || '-'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {result.success ? (
                        <span className="text-green-600">✓ 成功</span>
                      ) : (
                        <span className="text-red-600">✗ 失败</span>
                      )}
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