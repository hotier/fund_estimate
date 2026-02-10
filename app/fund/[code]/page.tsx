'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function FundDetailPage() {
  const params = useParams();
  const fundCode = params.code as string;
  const [fundData, setFundData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchFundData = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/fund/${fundCode}`);
        if (!response.ok) {
          throw new Error('获取基金数据失败');
        }
        const data = await response.json();
        setFundData(data);
      } catch (err) {
        setError('获取基金数据失败，请检查基金代码是否正确');
        setFundData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchFundData();
  }, [fundCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-600">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-danger">{error}</div>
      </div>
    );
  }

  if (!fundData) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-gray-600">基金数据不存在</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{fundData.name}</h1>
          <p className="text-gray-600">代码：{fundData.code}</p>
        </div>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">实时估值</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600">估算净值</p>
          <p className="text-2xl font-semibold text-gray-900">{fundData.estimate_value}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <p className="text-sm text-gray-600">实际净值</p>
          <p className="text-2xl font-semibold text-gray-900">{fundData.actual_value}</p>
        </div>
        <div className={`bg-white p-4 rounded-lg shadow-sm ${fundData.change_percent >= 0 ? 'fund-up' : 'fund-down'}`}>
          <p className="text-sm text-gray-600">涨跌幅</p>
          <p className="text-2xl font-semibold">
            {fundData.change_percent >= 0 ? '+' : ''}{fundData.change_percent}%
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">基金信息</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">更新时间：</span>
            <span className="text-gray-900">{fundData.update_time}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">数据来源：</span>
            <span className="text-gray-900">{fundData.data_source}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">今日估值走势</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={[
                { time: '09:30', value: 1.2300 },
                { time: '10:00', value: 1.2320 },
                { time: '10:30', value: 1.2350 },
                { time: '11:00', value: 1.2330 },
                { time: '11:30', value: 1.2340 },
                { time: '13:30', value: 1.2345 },
                { time: '14:00', value: 1.2350 },
                { time: '14:30', value: 1.2345 },
                { time: '15:00', value: 1.2345 },
              ]}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={['dataMin - 0.001', 'dataMax + 0.001']} />
              <Tooltip formatter={(value) => [`${value}`, '估值净值']} />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#0070f3" strokeWidth={2} activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">历史表现</h2>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">近1月</span>
            <span className="font-medium fund-up">+2.35%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">近3月</span>
            <span className="font-medium fund-up">+5.78%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">近6月</span>
            <span className="font-medium fund-down">-1.23%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">近1年</span>
            <span className="font-medium fund-up">+12.45%</span>
          </div>
        </div>
      </div>
    </div>
  );
}