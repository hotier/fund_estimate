export default function ComparePage() {
  return (
    <div className="space-y-6">
      <div className="text-center py-20">
        <div className="text-6xl mb-4">📊</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">基金对比功能</h1>
        <p className="text-xl text-gray-600 mb-8">此功能正在开发中，敬请期待</p>
        <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">即将推出</h2>
          <ul className="space-y-3 text-gray-600">
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>多只基金同时对比</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>净值走势对比图</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>收益率对比分析</span>
            </li>
            <li className="flex items-start">
              <span className="text-green-500 mr-2">✓</span>
              <span>重仓股对比</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}